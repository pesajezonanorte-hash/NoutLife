// Formato NLF1 de la rosa del Jardín (lo escribe scripts/blender/rose.py):
//   'NLF1' · u32 vértices · u32 índices · f32×6 caja (mín, máx)
//   u16×3 por vértice: posición en capullo · u16×3 por vértice: posición abierta
//   u8×3 por vértice: color sRGB · relleno hasta 4 bytes · índices u16
// Sin DOM ni three.js: lo prueban los tests de Node.

export interface NlfMesh {
  closed: Float32Array;
  open: Float32Array;
  color: Uint8Array;
  index: Uint16Array;
}

export function decodeNlf(buffer: ArrayBuffer): NlfMesh {
  const view = new DataView(buffer);
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'NLF1') throw new Error('nlf: formato desconocido');
  const n = view.getUint32(4, true);
  const m = view.getUint32(8, true);
  const lo = [0, 1, 2].map((i) => view.getFloat32(12 + i * 4, true));
  const hi = [0, 1, 2].map((i) => view.getFloat32(24 + i * 4, true));
  let at = 36;
  const read = () => {
    const q = new Uint16Array(buffer.slice(at, at + n * 6));
    at += n * 6;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) out[i] = lo[i % 3] + (q[i] / 65535) * (hi[i % 3] - lo[i % 3]);
    return out;
  };
  const closed = read();
  const open = read();
  const color = new Uint8Array(buffer.slice(at, at + n * 3));
  at += n * 3;
  at += (4 - (at % 4)) % 4;
  const index = new Uint16Array(buffer.slice(at, at + m * 2));
  return { closed, open, color, index };
}
