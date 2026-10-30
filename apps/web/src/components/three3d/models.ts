// Objetos de las zonas (scripts/build-props.mjs → src/assets/models/props-<set>[-hd].glb). Cada
// nodo pasa a datos de malla con `position`, `normal` y `part` (índice de PARTS); los nombres
// pierden el sufijo `_lo` (el LOD bajo y el alto se llaman igual). Los datos se descargan y
// decodifican una vez por archivo; cada escena crea sus propias BufferGeometry sobre los mismos
// arrays, así al desmontarse libera las suyas sin tocar las de otra.
import { BufferAttribute, BufferGeometry } from 'three';
import { readGlbNodes } from './glb';
import { PARTS } from './propMaterial';

export interface PropData {
  name: string;
  position: Float32Array;
  normal: Float32Array;
  part: Float32Array;
  index: Uint32Array;
  /** Radio de la esfera que lo envuelve, desde `center` (coordenadas de three.js). */
  radius: number;
  center: [number, number, number];
  extras: Record<string, unknown>;
}

export async function decodeProps(buffer: ArrayBuffer): Promise<Map<string, PropData>> {
  const out = new Map<string, PropData>();
  for (const node of await readGlbNodes(buffer)) {
    const verts = node.primitives.reduce((s, p) => s + p.attributes.POSITION.array.length / 3, 0);
    const tris = node.primitives.reduce((s, p) => s + p.index.length, 0);
    const position = new Float32Array(verts * 3);
    const normal = new Float32Array(verts * 3);
    const part = new Float32Array(verts);
    const index = new Uint32Array(tris);
    let v = 0;
    let t = 0;
    for (const p of node.primitives) {
      const n = p.attributes.POSITION.array.length / 3;
      position.set(p.attributes.POSITION.array, v * 3);
      normal.set(p.attributes.NORMAL.array, v * 3);
      // _PART = k/255; sin el atributo, la parte sale del nombre del material.
      const fromMaterial = Math.max(0, PARTS.indexOf(p.material as (typeof PARTS)[number]));
      const src = p.attributes._PART?.array;
      for (let i = 0; i < n; i++) part[v + i] = src ? Math.round(src[i] * 255) : fromMaterial;
      for (let i = 0; i < p.index.length; i++) index[t + i] = p.index[i] + v;
      v += n;
      t += p.index.length;
    }
    const name = node.name.replace(/_lo$/, '');
    const center = (node.extras.center as [number, number, number] | undefined) ?? [0, 0, 0];
    out.set(name, { name, position, normal, part, index, radius: Number(node.extras.radius) || 0.5, center, extras: node.extras });
  }
  return out;
}

const cache = new Map<string, Promise<Map<string, PropData>>>();

export function loadProps(url: string): Promise<Map<string, PropData>> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`props ${r.status}`))))
      .then(decodeProps);
    // Un fallo (sin red) no se queda guardado: la próxima visita lo reintenta.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Geometría nueva sobre los datos compartidos (se libera con dispose() sin afectar a otras). */
export function propGeometry(d: PropData): BufferGeometry {
  const g = new BufferGeometry();
  // BufferAttribute usa el array tal cual (Float32BufferAttribute lo copiaría).
  g.setAttribute('position', new BufferAttribute(d.position, 3));
  g.setAttribute('normal', new BufferAttribute(d.normal, 3));
  g.setAttribute('part', new BufferAttribute(d.part, 1));
  g.setIndex(new BufferAttribute(d.index, 1));
  g.computeBoundingSphere();
  return g;
}
