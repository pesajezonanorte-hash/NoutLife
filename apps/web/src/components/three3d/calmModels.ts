// Modelos de «Materia calma» (scripts/build-calm.mjs → src/assets/models/calm-<juego>.glb): mallas
// con shape keys, animaciones de pesos y un mapa de normales. Los datos se descargan y decodifican
// una vez por archivo; cada escena crea sus propias BufferGeometry sobre los mismos arrays.
import { BufferAttribute, BufferGeometry } from 'three';
import { readGlbScene, type GlbClip } from './glb';

export { clipLength, sampleClip } from './glb';

export interface CalmModel {
  name: string;
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  /** Primitiva de origen de cada vértice: en cada modelo, 0 es el cuerpo y 1 el detalle. */
  part: Float32Array;
  index: Uint32Array;
  targets: Record<string, { position: Float32Array; normal: Float32Array }>;
}

export interface CalmSet {
  models: Map<string, CalmModel>;
  clips: Map<string, GlbClip>;
  normalMap: { mimeType: string; bytes: Uint8Array<ArrayBuffer> } | null;
}

export async function decodeCalm(buffer: ArrayBuffer): Promise<CalmSet> {
  const scene = await readGlbScene(buffer);
  const models = new Map<string, CalmModel>();
  for (const node of scene.nodes) {
    const verts = node.primitives.reduce((s, p) => s + p.attributes.POSITION.array.length / 3, 0);
    const tris = node.primitives.reduce((s, p) => s + p.index.length, 0);
    const position = new Float32Array(verts * 3);
    const normal = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const part = new Float32Array(verts);
    const index = new Uint32Array(tris);
    const targets = Object.fromEntries(node.targetNames.map((name) => [name, { position: new Float32Array(verts * 3), normal: new Float32Array(verts * 3) }]));
    let v = 0;
    let t = 0;
    node.primitives.forEach((p, k) => {
      const n = p.attributes.POSITION.array.length / 3;
      position.set(p.attributes.POSITION.array, v * 3);
      normal.set(p.attributes.NORMAL.array, v * 3);
      if (p.attributes.TEXCOORD_0) uv.set(p.attributes.TEXCOORD_0.array, v * 2);
      part.fill(k, v, v + n);
      for (let i = 0; i < p.index.length; i++) index[t + i] = p.index[i] + v;
      node.targetNames.forEach((name, i) => {
        targets[name].position.set(p.targets[i].POSITION.array, v * 3);
        targets[name].normal.set(p.targets[i].NORMAL.array, v * 3);
      });
      v += n;
      t += p.index.length;
    });
    models.set(node.name, { name: node.name, position, normal, uv, part, index, targets });
  }
  return { models, clips: new Map(scene.clips.map((c) => [c.name, c])), normalMap: scene.images[0] ?? null };
}

const cache = new Map<string, Promise<CalmSet>>();

export function loadCalm(url: string): Promise<CalmSet> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`calm ${r.status}`))))
      .then(decodeCalm);
    // Un fallo (sin red) no se queda guardado: la próxima visita lo reintenta.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Geometría con los shape keys pedidos como atributos aT0…aT3 (posición) y aN0…aN3 (normal). */
export function calmGeometry(model: CalmModel, targets: readonly string[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(model.position, 3));
  g.setAttribute('normal', new BufferAttribute(model.normal, 3));
  g.setAttribute('uv', new BufferAttribute(model.uv, 2));
  g.setAttribute('part', new BufferAttribute(model.part, 1));
  targets.forEach((name, i) => {
    g.setAttribute(`aT${i}`, new BufferAttribute(model.targets[name].position, 3));
    g.setAttribute(`aN${i}`, new BufferAttribute(model.targets[name].normal, 3));
  });
  g.setIndex(new BufferAttribute(model.index, 1));
  g.computeBoundingSphere();
  // El volumen deformado sale un poco de la esfera en reposo: que no se recorte al borde.
  if (g.boundingSphere) g.boundingSphere.radius *= 1.4;
  return g;
}

/** Decodifica el mapa de normales del .glb. Sin datos o sin soporte, null: se ve igual, más liso. */
export async function calmNormalBitmap(set: CalmSet): Promise<ImageBitmap | null> {
  const img = set.normalMap;
  if (!img) return null;
  return createImageBitmap(new Blob([img.bytes], { type: img.mimeType })).catch(() => null);
}
