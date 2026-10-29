// Lector mínimo de los .glb de las figuras (scripts/build-avatars.mjs): un nodo con su
// malla, KHR_mesh_quantization (enteros normalizados + escala y traslación del nodo) y
// EXT_meshopt_compression. Devuelve cada primitiva con sus atributos en Float32Array (posición
// en metros) y las imágenes tal cual vienen. Sin DOM: también lo usan los tests de Node.
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export interface GlbPrimitive {
  material: string;
  /** Por nombre glTF (POSITION, NORMAL, TEXCOORD_0, _MUSCLE0…): valores y componentes por vértice. */
  attributes: Record<string, { array: Float32Array; size: number }>;
  index: Uint32Array;
}

export interface Glb {
  primitives: GlbPrimitive[];
  images: Array<{ mimeType: string; bytes: Uint8Array<ArrayBuffer> }>;
}

interface Json {
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; normalized?: boolean; count: number; type: string }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }>;
  meshes: Array<{ primitives: Array<{ attributes: Record<string, number>; indices: number; material: number }> }>;
  materials: Array<{ name: string }>;
  images?: Array<{ bufferView: number; mimeType: string }>;
  nodes: Array<{ mesh?: number; translation?: number[]; scale?: number[] }>;
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array } as const;
const MAX: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

export async function readGlb(buffer: ArrayBuffer): Promise<Glb> {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('glb: formato desconocido');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength))) as Json;
  const bin = new Uint8Array(buffer, 28 + jsonLength, view.getUint32(20 + jsonLength, true));
  await MeshoptDecoder.ready;

  // Cada vista en su propio búfer (alineado); las comprimidas se descomprimen aquí.
  const views = json.bufferViews.map((bv) => {
    const mo = bv.extensions?.EXT_meshopt_compression;
    if (!mo) return bin.slice(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const out = new Uint8Array(mo.count * mo.byteStride);
    const src = bin.subarray(mo.byteOffset ?? 0, (mo.byteOffset ?? 0) + mo.byteLength);
    MeshoptDecoder.decodeGltfBuffer(out, mo.count, mo.byteStride, src, mo.mode, mo.filter);
    return out;
  });

  const read = (i: number) => {
    const a = json.accessors[i];
    const Kind = ARRAY[a.componentType as keyof typeof ARRAY];
    const size = SIZE[a.type];
    const bytes = views[a.bufferView];
    const stride = (json.bufferViews[a.bufferView].byteStride ?? size * Kind.BYTES_PER_ELEMENT) / Kind.BYTES_PER_ELEMENT;
    const src = new Kind(bytes.buffer, bytes.byteOffset, bytes.byteLength / Kind.BYTES_PER_ELEMENT);
    const first = (a.byteOffset ?? 0) / Kind.BYTES_PER_ELEMENT;
    const k = a.normalized ? 1 / MAX[a.componentType] : 1;
    const out = new Float32Array(a.count * size);
    for (let e = 0; e < a.count; e++) {
      for (let c = 0; c < size; c++) out[e * size + c] = Math.max(src[first + e * stride + c] * k, a.normalized ? -1 : -Infinity);
    }
    return { array: out, size };
  };

  const node = json.nodes.find((n) => n.mesh !== undefined)!;
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const primitives = json.meshes[node.mesh!].primitives.map((p) => {
    const attributes = Object.fromEntries(Object.entries(p.attributes).map(([name, i]) => [name, read(i)]));
    const pos = attributes.POSITION.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = pos[i] * sx + tx;
      pos[i + 1] = pos[i + 1] * sy + ty;
      pos[i + 2] = pos[i + 2] * sz + tz;
    }
    return { material: json.materials[p.material].name, attributes, index: Uint32Array.from(read(p.indices).array) };
  });
  const images = (json.images ?? []).map((img) => ({ mimeType: img.mimeType, bytes: views[img.bufferView] }));
  return { primitives, images };
}
