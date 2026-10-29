// Formato NLM2 de las figuras del Coliseo (lo escribe scripts/blender/avatar.py):
//   'NLM2' · u32 vértices · u32 índices · f32×6 caja (mín, máx)
//   u16×3 por vértice: posición cuantizada en la caja
//   u8 por vértice: músculo (índice de MUSCLE_IDS; 255 = piel)
//   u8 por vértice: peso del músculo (0 en el surco, 255 en el vientre)
//   u8 por vértice: oclusión horneada (sombra ambiental y surcos; 255 = sin sombra)
//   relleno hasta 4 bytes · índices u16 (u32 si hay más de 65 535 vértices)
// Sin DOM ni three.js: lo prueban los tests de Node.

export interface NlmMesh {
  positions: Float32Array;
  muscle: Uint8Array;
  weight: Uint8Array;
  ao: Uint8Array;
  index: Uint16Array | Uint32Array;
  min: [number, number, number];
  max: [number, number, number];
}

export function decodeNlm(buffer: ArrayBuffer): NlmMesh {
  const view = new DataView(buffer);
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'NLM2') throw new Error('nlm: formato desconocido');
  const n = view.getUint32(4, true);
  const m = view.getUint32(8, true);
  const min = [0, 1, 2].map((i) => view.getFloat32(12 + i * 4, true)) as [number, number, number];
  const max = [0, 1, 2].map((i) => view.getFloat32(24 + i * 4, true)) as [number, number, number];
  let at = 36;
  const q = new Uint16Array(buffer.slice(at, at + n * 6));
  at += n * 6;
  const muscle = new Uint8Array(buffer, at, n);
  at += n;
  const weight = new Uint8Array(buffer, at, n);
  at += n;
  const ao = new Uint8Array(buffer, at, n);
  at += n;
  at += (4 - (at % 4)) % 4;
  const index = n <= 65535 ? new Uint16Array(buffer.slice(at, at + m * 2)) : new Uint32Array(buffer.slice(at, at + m * 4));
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    const axis = i % 3;
    positions[i] = min[axis] + (q[i] / 65535) * (max[axis] - min[axis]);
  }
  return { positions, muscle, weight, ao, index, min, max };
}
