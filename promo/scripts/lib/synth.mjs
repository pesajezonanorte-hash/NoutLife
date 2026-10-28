// Piezas de síntesis compartidas por los scripts de música (las mismas que usan
// build-music*.mjs, aquí en un solo sitio): ruido con semilla, filtro de estado variable,
// ecos, reverb, sonoridad BS.1770, limitador y escritura WAV. Todo determinista.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const SR = 48000;

export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
export const mix = (a, b, t) => a + (b - a) * smooth(t);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noiseBuffer(seed, length) {
  const r = rng(seed);
  const b = new Float32Array(length);
  for (let i = 0; i < length; i++) b[i] = r() * 2 - 1;
  return b;
}

/** Filtro de variable de estado (TPT): lp/bp/hp con corte modulable. */
export function svf(fc, q = 0.707) {
  let ic1 = 0, ic2 = 0, g = 0, k = 0, a1 = 0, a2 = 0, a3 = 0;
  const set = (fr, qq = q) => {
    g = Math.tan((Math.PI * Math.min(Math.max(fr, 10), SR * 0.45)) / SR);
    k = 1 / qq;
    a1 = 1 / (1 + g * (g + k));
    a2 = g * a1;
    a3 = g * a2;
  };
  set(fc);
  let v1 = 0, v2 = 0;
  const tick = (x) => {
    const v3 = x - ic2;
    v1 = a1 * ic1 + a2 * v3;
    v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
  };
  return {
    set,
    lp(x) { tick(x); return v2; },
    bp(x) { tick(x); return v1; },
    hp(x) { tick(x); return x - k * v1 - v2; },
  };
}

export const polyblep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};

/** Ganancias izquierda/derecha de potencia constante para `p` en −1…1. */
export const pan = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

export const makeBus = (n) => [new Float32Array(n), new Float32Array(n)];

/** Eco ping-pong con amortiguación. */
export function pingPong(input, time, feedback) {
  const n = input[0].length;
  const d = Math.round(time * SR);
  const out = makeBus(n);
  const bl = new Float32Array(d), br = new Float32Array(d);
  const damp = svf(3200, 0.7);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const yl = bl[idx], yr = br[idx];
    out[0][i] = yl;
    out[1][i] = yr;
    bl[idx] = (input[0][i] + input[1][i]) * 0.5 + damp.lp(yr) * feedback;
    br[idx] = yl * feedback;
    idx = (idx + 1) % d;
  }
  return out;
}

/** Reverb Freeverb (8 peines y 4 pasa-todo por canal). */
export function freeverb(input, roomSize = 0.88, damp = 0.3) {
  const n = input[0].length;
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * scale));
  const spread = Math.round(23 * scale);
  const out = makeBus(n);
  for (let ch = 0; ch < 2; ch++) {
    const combs = combT.map((t) => ({ buf: new Float32Array(t + ch * spread), i: 0, store: 0 }));
    const aps = apT.map((t) => ({ buf: new Float32Array(t + ch * spread), i: 0 }));
    const x = input[ch];
    for (let s = 0; s < n; s++) {
      const inp = x[s] * 0.015;
      let acc = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = inp + c.store * roomSize;
        if (++c.i >= c.buf.length) c.i = 0;
        acc += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = acc + b * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
        acc = b - acc;
      }
      out[ch][s] = acc * 3;
    }
  }
  return out;
}

/** Sonoridad integrada (ITU-R BS.1770-4, filtro K y doble compuerta), en LUFS. */
export function integratedLufs(l, r) {
  const kw = (x) => {
    const s1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] };
    const s2 = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] };
    const y = new Float64Array(x.length);
    for (const st of [s1, s2]) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      const src = st === s1 ? x : y;
      for (let i = 0; i < x.length; i++) {
        const xi = src[i];
        const yi = st.b[0] * xi + st.b[1] * x1 + st.b[2] * x2 - st.a[0] * y1 - st.a[1] * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = yi;
        y[i] = yi;
      }
    }
    return y;
  };
  const kl = kw(l), kr = kw(r);
  const block = Math.round(0.4 * SR), hop = Math.round(0.1 * SR);
  const z = [];
  for (let s = 0; s + block <= l.length; s += hop) {
    let sum = 0;
    for (let i = s; i < s + block; i++) sum += kl[i] * kl[i] + kr[i] * kr[i];
    z.push(sum / block);
  }
  const lufs = (v) => -0.691 + 10 * Math.log10(v);
  const abs = z.filter((v) => lufs(v) > -70);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rel = abs.filter((v) => lufs(v) > lufs(mean(abs)) - 10);
  return lufs(mean(rel));
}

/** Pico real aproximado (sobremuestreo ×4 por interpolación cúbica), en dBFS. */
export function truePeakDb(l, r) {
  let peak = 0;
  for (const x of [l, r]) {
    for (let i = 1; i < x.length - 2; i++) {
      const [y0, y1, y2, y3] = [x[i - 1], x[i], x[i + 1], x[i + 2]];
      for (const t of [0, 0.25, 0.5, 0.75]) {
        const v = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)));
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
    }
  }
  return 20 * Math.log10(peak);
}

/** Normaliza a `targetLufs` y limita los picos a `ceilingDb` (anticipación de 3 ms). Devuelve cuántos dB bajó el limitador como máximo. */
export function master(L, R, targetLufs, ceilingDb) {
  const n = L.length;
  const gain = 10 ** ((targetLufs - integratedLufs(L, R)) / 20);
  for (let i = 0; i < n; i++) { L[i] *= gain; R[i] *= gain; }
  const ceiling = 10 ** (ceilingDb / 20);
  const look = Math.round(0.003 * SR);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  let g = 1;
  let least = 1;
  const release = Math.exp(-1 / (0.08 * SR));
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let k = i; k < Math.min(n, i + look); k++) if (need[k] < m) m = need[k];
    g = m < g ? m : m - (m - g) * release;
    if (g < least) least = g;
    L[i] *= g;
    R[i] *= g;
  }
  return -20 * Math.log10(least);
}

/** WAV estéreo de 16 bits con tramado triangular (las muestras en cero exacto quedan en cero: el silencio es digital). */
export function writeWav(path, L, R) {
  const n = L.length;
  const dither = rng(99);
  const data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 4, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    for (const [ch, x] of [[0, L[i]], [1, R[i]]]) {
      const d = dither() - dither();
      const v = x === 0 ? 0 : Math.round(x * 32767 + d);
      data.writeInt16LE(Math.max(-32768, Math.min(32767, v)), 44 + i * 4 + ch * 2);
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}
