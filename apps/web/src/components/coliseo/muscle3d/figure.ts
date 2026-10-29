// Figura del Coliseo: un cuerpo atlético (masculino o femenino) modelado en Blender sobre las
// mallas humanas de Blender Studio (scripts/blender/avatar.py, scripts/build-avatars.mjs).
// Cada vértice trae sus dos músculos de lib/coliseo con su peso, la oclusión horneada y los
// campos de la ropa; el mapa de normales pone el relieve de la escultura. Metros, pies en
// y = 0, frente hacia +z. Sin DOM ni WebGL: MuscleScene la pinta y tests/unit/coliseo.unit.ts la prueba.
import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import { MUSCLE_IDS, type Muscle } from '@/lib/coliseo';
import { readGlb } from './glb';

export type Body = 'male' | 'female';

/** Peso medio del triángulo por debajo del cual un toque cae en piel (cara, manos, pies, articulaciones). */
export const PICK_WEIGHT = 0.25;
/** Medio ancho de los tirantes en unidades de `surf` (avatar.py: STRAP / CLOTH_RANGE). */
export const STRAP = 0.0135 / 0.12;

const N = MUSCLE_IDS.length;

export interface Figure {
  /**
   * Piel y ropa: `position`, `normal`, `tangent`, `uv`, `ao` (0–1), `muscle` (id₀, peso₀, id₁, peso₁;
   * id 255 = piel) y `surf` (campos de la tela: tela donde max(x, min(STRAP − |y|, z)) > 0).
   */
  geometry: BufferGeometry;
  /** Ojos: sin músculo, tela ni relieve. */
  eyes: BufferGeometry;
  /** Mapa de normales en espacio tangente, tal cual viene en el .glb. */
  normalMap: { mimeType: string; bytes: Uint8Array<ArrayBuffer> } | null;
  /** Alto de los pies a la coronilla (m). */
  height: number;
  /** Desde dónde se ve cada músculo: 1 de frente, −1 de espaldas, 0 de los dos lados. */
  facing: Record<Muscle, -1 | 0 | 1>;
  /** Músculo de un triángulo tocado (el de más peso entre sus vértices), o null si es piel. */
  muscleOfFace: (a: number, b: number, c: number) => Muscle | null;
  /** Índices de los triángulos de un músculo (su halo de selección). */
  trianglesOf: (m: Muscle) => Uint32Array;
}

export async function buildFigure(buffer: ArrayBuffer): Promise<Figure> {
  const glb = await readGlb(buffer);
  const skin = glb.primitives.find((p) => p.material === 'skin');
  if (!skin) throw new Error('figure: falta la piel');
  const a = skin.attributes;
  const n = a.POSITION.array.length / 3;
  const muscle = new Float32Array(n * 4);
  const ao = new Float32Array(n);
  let height = 0;
  for (let i = 0; i < n; i++) {
    // id exacto (k/255 → k) y peso de los dos músculos del vértice.
    muscle[i * 4] = Math.round(a._MUSCLE0.array[i * 2] * 255);
    muscle[i * 4 + 1] = a._MUSCLE0.array[i * 2 + 1];
    muscle[i * 4 + 2] = Math.round(a._MUSCLE1.array[i * 2] * 255);
    muscle[i * 4 + 3] = a._MUSCLE1.array[i * 2 + 1];
    ao[i] = a.COLOR_0.array[i * 4];
    height = Math.max(height, a.POSITION.array[i * 3 + 1]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(a.POSITION.array, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(a.NORMAL.array, 3));
  geometry.setAttribute('tangent', new Float32BufferAttribute(a.TANGENT.array, 4));
  geometry.setAttribute('uv', new Float32BufferAttribute(a.TEXCOORD_0.array, 2));
  geometry.setAttribute('ao', new Float32BufferAttribute(ao, 1));
  geometry.setAttribute('muscle', new Float32BufferAttribute(muscle, 4));
  geometry.setAttribute('surf', new Float32BufferAttribute(a._SURF.array, 3));
  geometry.setIndex(new BufferAttribute(skin.index, 1));
  geometry.computeBoundingSphere();

  const eyes = new BufferGeometry();
  const eye = glb.primitives.find((p) => p.material === 'eye');
  if (eye) {
    eyes.setAttribute('position', new Float32BufferAttribute(eye.attributes.POSITION.array, 3));
    eyes.setAttribute('normal', new Float32BufferAttribute(eye.attributes.NORMAL.array, 3));
    eyes.setIndex(new BufferAttribute(eye.index, 1));
  }

  // Hacia dónde mira la piel del músculo (z de sus normales): los brazos girados de la figura
  // femenina dejan el bíceps casi en x = 0, pero su piel sigue mirando al frente.
  const facing = {} as Record<Muscle, -1 | 0 | 1>;
  MUSCLE_IDS.forEach((m, id) => {
    let z = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (muscle[i * 4] === id && muscle[i * 4 + 1] > 0.5) { z += a.NORMAL.array[i * 3 + 2]; count++; }
    }
    const mean = count ? z / count : 0;
    facing[m] = mean > 0.35 ? 1 : mean < -0.35 ? -1 : 0;
  });

  const acc = new Float32Array(N);
  const muscleOfFace = (va: number, vb: number, vc: number): Muscle | null => {
    acc.fill(0);
    for (const v of [va, vb, vc]) {
      for (const s of [0, 2]) {
        const id = muscle[v * 4 + s];
        if (id < N) acc[id] += muscle[v * 4 + s + 1];
      }
    }
    let best = 0;
    for (let i = 1; i < N; i++) if (acc[i] > acc[best]) best = i;
    return acc[best] / 3 >= PICK_WEIGHT ? MUSCLE_IDS[best] : null;
  };

  const cache = new Map<Muscle, Uint32Array>();
  const trianglesOf = (m: Muscle) => {
    const hit = cache.get(m);
    if (hit) return hit;
    const id = MUSCLE_IDS.indexOf(m);
    const own = (v: number) => (muscle[v * 4] === id && muscle[v * 4 + 1] > 0.1) || (muscle[v * 4 + 2] === id && muscle[v * 4 + 3] > 0.1);
    const out: number[] = [];
    for (let t = 0; t < skin.index.length; t += 3) {
      const [i, j, k] = [skin.index[t], skin.index[t + 1], skin.index[t + 2]];
      if (own(i) || own(j) || own(k)) out.push(i, j, k);
    }
    const tris = Uint32Array.from(out);
    cache.set(m, tris);
    return tris;
  };

  return { geometry, eyes, normalMap: glb.images[0] ?? null, height, facing, muscleOfFace, trianglesOf };
}
