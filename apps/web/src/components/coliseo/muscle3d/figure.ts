// Figura del Coliseo: un cuerpo atlético (masculino o femenino) modelado en Blender
// (scripts/blender/avatar.py) con cada vértice marcado con su músculo de lib/coliseo.
// Es una sola malla: el visor la colorea por fatiga desde el shader y sabe qué
// músculo se toca por el triángulo. Metros, pies en y = 0, frente hacia +z.
// Sin DOM ni WebGL: MuscleScene la pinta y tests/unit/coliseo.unit.ts la prueba.
import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from 'three';
import { MUSCLE_IDS, type Muscle } from '@/lib/coliseo';
import { decodeNlm } from './nlm';

export type Body = 'male' | 'female';

/** Peso por debajo del cual un vértice se considera surco (no se elige al tocar). */
export const PICK_WEIGHT = 0.2;

export interface Figure {
  /** Malla con `position`, `normal`, `muscle` (0–15, 255 = piel), `mweight` y `ao` (0–1). */
  geometry: BufferGeometry;
  /** Alto de los pies a la coronilla (m). */
  height: number;
  /** Desde dónde se ve cada músculo: 1 de frente, −1 de espaldas, 0 de los dos lados. */
  facing: Record<Muscle, -1 | 0 | 1>;
  /** Músculo de un triángulo tocado (el vértice con más peso), o null si es piel o surco. */
  muscleOfFace: (a: number, b: number, c: number) => Muscle | null;
  /** Índices de los triángulos de un músculo (para su contorno de selección). */
  trianglesOf: (m: Muscle) => Uint32Array;
}

export function buildFigure(buffer: ArrayBuffer): Figure {
  const mesh = decodeNlm(buffer);
  const n = mesh.positions.length / 3;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(mesh.positions, 3));
  // Float: el shader compara índices exactos (255 = piel).
  geometry.setAttribute('muscle', new Float32BufferAttribute(Float32Array.from(mesh.muscle), 1));
  geometry.setAttribute('mweight', new BufferAttribute(mesh.weight, 1, true));
  geometry.setAttribute('ao', new BufferAttribute(mesh.ao, 1, true));
  geometry.setIndex(new BufferAttribute(mesh.index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const facing = {} as Record<Muscle, -1 | 0 | 1>;
  MUSCLE_IDS.forEach((m, id) => {
    let z = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (mesh.muscle[i] === id && mesh.weight[i] > 128) { z += mesh.positions[i * 3 + 2]; count++; }
    }
    const mean = count ? z / count : 0;
    facing[m] = mean > 0.015 ? 1 : mean < -0.015 ? -1 : 0;
  });

  const muscleOfFace = (a: number, b: number, c: number): Muscle | null => {
    const best = [a, b, c].reduce((x, y) => (mesh.weight[y] > mesh.weight[x] ? y : x));
    const id = mesh.muscle[best];
    return id < MUSCLE_IDS.length && mesh.weight[best] / 255 >= PICK_WEIGHT ? MUSCLE_IDS[id] : null;
  };

  const cache = new Map<Muscle, Uint32Array>();
  const trianglesOf = (m: Muscle) => {
    const hit = cache.get(m);
    if (hit) return hit;
    const id = MUSCLE_IDS.indexOf(m);
    const own = (v: number) => mesh.muscle[v] === id && mesh.weight[v] > 40;
    const out: number[] = [];
    for (let t = 0; t < mesh.index.length; t += 3) {
      const [a, b, c] = [mesh.index[t], mesh.index[t + 1], mesh.index[t + 2]];
      if (own(a) || own(b) || own(c)) out.push(a, b, c);
    }
    const tris = Uint32Array.from(out);
    cache.set(m, tris);
    return tris;
  };

  return { geometry, height: mesh.max[1], facing, muscleOfFace, trianglesOf };
}

