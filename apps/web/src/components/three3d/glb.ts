// Lector mínimo de los .glb que generan los scripts de Blender: KHR_mesh_quantization (enteros
// normalizados + escala y traslación del nodo) y EXT_meshopt_compression (con sus filtros).
// `readGlb` devuelve el primer nodo con malla (figuras del Coliseo, scripts/build-avatars.mjs);
// `readGlbNodes`, todos los nodos con su nombre y sus `extras` (objetos de las zonas,
// scripts/build-props.mjs); `readGlbScene`, además los morph targets, las animaciones de pesos
// y las imágenes (Materia calma, scripts/build-calm.mjs). Atributos en Float32Array (posición en
// metros); las imágenes, tal cual vienen. Sin DOM: también lo usan los tests de Node.
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export interface GlbAttribute { array: Float32Array; size: number }

export interface GlbPrimitive {
  material: string;
  /** Por nombre glTF (POSITION, NORMAL, TEXCOORD_0, _MUSCLE0…): valores y componentes por vértice. */
  attributes: Record<string, GlbAttribute>;
  /** Morph targets, en el orden de `targetNames`: diferencia con la base (posición en metros). */
  targets: Array<Record<string, GlbAttribute>>;
  index: Uint32Array;
}

export interface Glb {
  primitives: GlbPrimitive[];
  images: Array<{ mimeType: string; bytes: Uint8Array<ArrayBuffer> }>;
}

export interface GlbNode {
  name: string;
  extras: Record<string, unknown>;
  primitives: GlbPrimitive[];
  targetNames: string[];
}

/** Animación de pesos de morph: `weights` trae `targets` valores por cada tiempo (segundos). */
export interface GlbClip {
  name: string;
  times: Float32Array;
  weights: Float32Array;
  targets: number;
}

export interface GlbScene extends Glb {
  nodes: GlbNode[];
  clips: GlbClip[];
}

interface Json {
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; normalized?: boolean; count: number; type: string }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number; byteStride?: number; extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } } }>;
  meshes: Array<{ extras?: { targetNames?: string[] }; primitives: Array<{ attributes: Record<string, number>; targets?: Array<Record<string, number>>; indices: number; material: number }> }>;
  materials: Array<{ name: string }>;
  images?: Array<{ bufferView: number; mimeType: string }>;
  nodes: Array<{ name?: string; mesh?: number; translation?: number[]; scale?: number[]; extras?: Record<string, unknown> }>;
  animations?: Array<{ name?: string; channels: Array<{ sampler: number; target: { path: string } }>; samplers: Array<{ input: number; output: number }> }>;
}

const SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array } as const;
const MAX: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

async function parse(buffer: ArrayBuffer) {
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

  const primitivesOf = (node: Json['nodes'][number]): GlbPrimitive[] => {
    const [sx, sy, sz] = node.scale ?? [1, 1, 1];
    const [tx, ty, tz] = node.translation ?? [0, 0, 0];
    return json.meshes[node.mesh!].primitives.map((p) => {
      const attributes = Object.fromEntries(Object.entries(p.attributes).map(([name, i]) => [name, read(i)]));
      const pos = attributes.POSITION.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] = pos[i] * sx + tx;
        pos[i + 1] = pos[i + 1] * sy + ty;
        pos[i + 2] = pos[i + 2] * sz + tz;
      }
      // Las diferencias de posición llevan la escala del nodo, no su traslación.
      const targets = (p.targets ?? []).map((target) => {
        const out = Object.fromEntries(Object.entries(target).map(([name, i]) => [name, read(i)]));
        const delta = out.POSITION?.array;
        for (let i = 0; delta && i < delta.length; i += 3) {
          delta[i] *= sx;
          delta[i + 1] *= sy;
          delta[i + 2] *= sz;
        }
        return out;
      });
      return { material: json.materials[p.material]?.name ?? '', attributes, targets, index: Uint32Array.from(read(p.indices).array) };
    });
  };
  const nodes = (): GlbNode[] => json.nodes.filter((n) => n.mesh !== undefined).map((n) => ({
    name: n.name ?? '',
    extras: n.extras ?? {},
    primitives: primitivesOf(n),
    targetNames: json.meshes[n.mesh!].extras?.targetNames ?? [],
  }));
  const clips = (): GlbClip[] => (json.animations ?? []).flatMap((a) => {
    const channel = a.channels.find((c) => c.target.path === 'weights');
    if (!channel) return [];
    const sampler = a.samplers[channel.sampler];
    const times = read(sampler.input).array;
    const weights = read(sampler.output).array;
    return [{ name: a.name ?? '', times, weights, targets: weights.length / times.length }];
  });
  return { json, views, primitivesOf, nodes, clips };
}

export async function readGlb(buffer: ArrayBuffer): Promise<Glb> {
  const { json, views, primitivesOf } = await parse(buffer);
  const node = json.nodes.find((n) => n.mesh !== undefined)!;
  const images = (json.images ?? []).map((img) => ({ mimeType: img.mimeType, bytes: views[img.bufferView] }));
  return { primitives: primitivesOf(node), images };
}

export async function readGlbNodes(buffer: ArrayBuffer): Promise<GlbNode[]> {
  return (await parse(buffer)).nodes();
}

export async function readGlbScene(buffer: ArrayBuffer): Promise<GlbScene> {
  const { json, views, primitivesOf, nodes, clips } = await parse(buffer);
  const first = json.nodes.find((n) => n.mesh !== undefined)!;
  const images = (json.images ?? []).map((img) => ({ mimeType: img.mimeType, bytes: views[img.bufferView] }));
  return { primitives: primitivesOf(first), images, nodes: nodes(), clips: clips() };
}

/** Pesos de un clip en `t` segundos (interpolación lineal, como el .glb). Reutiliza `out`. */
export function sampleClip(clip: GlbClip, t: number, out: number[]): number[] {
  const { times, weights, targets } = clip;
  const last = times.length - 1;
  let i = 0;
  while (i < last && times[i + 1] <= t) i++;
  if (t <= times[0] || i >= last) {
    const k = (t <= times[0] ? 0 : last) * targets;
    for (let c = 0; c < targets; c++) out[c] = weights[k + c];
    return out;
  }
  const f = (t - times[i]) / (times[i + 1] - times[i]);
  for (let c = 0; c < targets; c++) out[c] = weights[i * targets + c] + (weights[(i + 1) * targets + c] - weights[i * targets + c]) * f;
  return out;
}

/** Duración de un clip en segundos. */
export const clipLength = (clip: GlbClip) => clip.times[clip.times.length - 1];
