// Música original del anuncio «Modo Pro» (src/ProKeynote), sintetizada nota a nota: sin
// samples ni licencias de terceros, y determinista. 120 BPM y los acordes de la marca
// (Fa, Sol, La menor, Do), pero más sobria que la del primer anuncio: pad cálido, un
// pulso suave en vez de batería, arpegio discreto con eco y campanas solo en los
// momentos que importan. Los tiempos son los de src/ProKeynote/timeline.ts:
//    0–3 s    gancho: pad abierto, una nota por línea, campanas con «Pro» en oro (1,5 s)
//             y un barrido de aire hacia el teléfono
//    3 s      el teléfono: golpe sub suave; entran el pulso, el bajo y el arpegio
//    5,9 s    el haz abre Recreación: campana; 6,3 s abre Coliseo: otra más aguda
//    8 s      la oferta: medio tiempo; 9 s acorde en Do con el titular
//   10,5 s    el botón: campana suave
//   12,9 s    fundido a negro: se va el pulso; 13,5 s tres campanas con el logo
//
// Uso: node scripts/build-music-keynote.mjs  →  public/audio/pro-keynote-music.wav (48 kHz, 16 bits, estéreo)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const BPM = 120;
const BEAT = 60 / BPM;
const DUR = 15;
const N = Math.ceil(DUR * SR);
/** Volumen del lecho: los efectos van encima y el total queda cerca de −16 LUFS. */
const TARGET_LUFS = -16;
const CEILING_DB = -3;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio', 'pro-keynote-music.wav');
/** Fotograma (30 fps) → segundos. */
const f = (frame) => frame / 30;

// ─── Utilidades (las mismas que build-music.mjs) ────────────────────────────
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, t) => a + (b - a) * smooth(t);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noiseBuffer(seed, length) {
  const r = rng(seed);
  const b = new Float32Array(length);
  for (let i = 0; i < length; i++) b[i] = r() * 2 - 1;
  return b;
}

/** Filtro de variable de estado (TPT): lp/bp/hp con corte modulable. */
function svf(fc, q = 0.707) {
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

const polyblep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};

const bus = () => [new Float32Array(N), new Float32Array(N)];
const drums = bus(), bass = bus(), pad = bus(), keys = bus(), fx = bus(), reverbSend = bus(), delaySend = bus();
const pan = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];
function add(b, i, l, r) {
  if (i >= 0 && i < N) { b[0][i] += l; b[1][i] += r; }
}
const at = (beat) => beat * BEAT;
function range(from, to, step = 1) {
  const out = [];
  for (let b = from; b < to - 1e-9; b += step) out.push(b);
  return out;
}

// ─── Armonía ─────────────────────────────────────────────────────────────────
const CHORDS = {
  Am9: { root: 33, pad: [57, 60, 64, 67, 71], arp: [76, 72, 69, 71, 76, 79, 76, 71] },
  Fmaj9: { root: 29, pad: [53, 57, 60, 64, 67], arp: [76, 72, 69, 67, 72, 76, 79, 76] },
  Cadd9: { root: 36, pad: [55, 60, 62, 64, 67], arp: [79, 76, 74, 72, 76, 79, 74, 76] },
  G6: { root: 31, pad: [55, 59, 62, 64, 67], arp: [74, 71, 67, 71, 74, 76, 79, 74] },
};
/**
 * Segundo → acorde. El gancho flota en Fa y se suspende en Sol; el teléfono cae en La
 * menor; el haz abre a Do; la oferta resuelve en Do con el titular y el logo descansa en Do.
 */
const PROGRESSION = [
  [0, 'Fmaj9'], [2, 'G6'],
  [3, 'Am9'], [4.5, 'Fmaj9'], [5.9, 'Cadd9'], [7, 'G6'],
  [8, 'Fmaj9'], [9, 'Cadd9'], [10.5, 'G6'], [11.5, 'Fmaj9'], [12.9, 'Cadd9'],
];
const SEGMENTS = PROGRESSION.map(([start, name], i) => ({
  start,
  end: i + 1 < PROGRESSION.length ? PROGRESSION[i + 1][0] : DUR,
  chord: CHORDS[name],
}));
const chordAt = (t) => SEGMENTS.find((s) => t >= s.start && t < s.end)?.chord ?? CHORDS.Cadd9;

/** El pulso: negras del teléfono a la oferta (3–8 s) y medio tiempo bajo la tarjeta (8–12,9 s). */
const PULSE = range(6, 16);
const HALF = range(16, 26, 2);

// ─── Pulso (bombo apagado y hats muy bajos) ─────────────────────────────────
const kickNoise = noiseBuffer(11, SR);
const kicks = [];
function kick(t0, vel) {
  kicks.push({ t: t0, vel });
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.5 * SR);
  const lp = svf(2400, 0.7);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const fr = 46 + 96 * Math.exp(-t / 0.03);
    phase += (2 * Math.PI * fr) / SR;
    let s = Math.sin(phase) * Math.exp(-t / 0.22);
    s += kickNoise[k] * Math.exp(-t / 0.002) * 0.12;
    s = lp.lp(Math.tanh(s * 1.5) * 0.8);
    add(drums, i0 + k, s * vel, s * vel);
  }
}
const hatNoise = noiseBuffer(33, 2 * SR);
let hatOffset = 0;
function hat(t0, vel) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.08 * SR);
  const hp = svf(8600, 0.8);
  const [l, r] = pan(0.25);
  hatOffset = (hatOffset + 977) % SR;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const s = hp.hp(hatNoise[hatOffset + k]) * Math.exp(-t / 0.018) * vel * 0.3;
    add(drums, i0 + k, s * l, s * r);
  }
}
for (const b of PULSE) kick(at(b), b === 6 ? 0.9 : 0.62);
for (const b of HALF) kick(at(b), 0.55);
// Hats en las corcheas a contratiempo solo mientras todo se abre (5–8 s)
for (const b of range(10, 16)) hat(at(b + 0.5), 0.35 + 0.1 * ((b - 10) / 6));

// ─── Bajo ────────────────────────────────────────────────────────────────────
function subBass(from, to, level) {
  const i0 = Math.round(from * SR);
  const i1 = Math.round(to * SR);
  let phase = 0;
  for (let i = i0; i < i1 && i < N; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * midiHz(chordAt(t).root)) / SR;
    const env = clamp((t - from) / 0.04) * clamp((to - t) / 0.3);
    const s = (Math.sin(phase) + 0.28 * Math.sin(2 * phase) + 0.08 * Math.sin(3 * phase)) * level * env;
    add(bass, i, s, s);
  }
}
subBass(0.5, 2.95, 0.08);
subBass(3, 12.9, 0.3);
subBass(12.9, 14.8, 0.16);

// ─── Pad ─────────────────────────────────────────────────────────────────────
const DETUNE = [[-9, -2, 5], [-5, 2, 9]];
for (const seg of SEGMENTS) {
  const rel = seg.end >= DUR ? 0 : 0.6;
  const attack = seg.start === 0 ? 0.8 : 0.25;
  const i0 = Math.round(seg.start * SR);
  const i1 = Math.min(N, Math.round((seg.end + rel) * SR));
  for (const note of seg.chord.pad) {
    for (let ch = 0; ch < 2; ch++) {
      for (const cents of DETUNE[ch]) {
        const dt = (midiHz(note) * 2 ** (cents / 1200)) / SR;
        let phase = (note * 0.137 + cents * 0.071 + ch * 0.31) % 1;
        for (let i = i0; i < i1; i++) {
          const t = i / SR;
          phase += dt;
          if (phase >= 1) phase -= 1;
          const saw = 2 * phase - 1 - polyblep(phase, dt);
          const env = smooth((t - seg.start) / attack) * (t < seg.end ? 1 : 1 - (t - seg.end) / rel);
          pad[ch][i] += saw * env * 0.055;
        }
      }
    }
  }
}
/** Corte del filtro del pad (Hz): se abre con el teléfono y la oferta, se cierra con el logo. */
function padCutoff(t) {
  if (t < 3) return mix(520, 1400, t / 3);
  if (t < 5.9) return mix(1400, 2200, (t - 3) / 2.9);
  if (t < 8) return 2600;
  if (t < 12.9) return mix(2600, 3200, (t - 8) / 4);
  return mix(3000, 800, (t - 12.9) / 2);
}
function padLevel(t) {
  if (t < 3) return 1;
  if (t < 12.9) return 0.85;
  return 1.1 * (1 - smooth((t - 14.2) / 0.8));
}

// ─── Teclas: notas, arpegio y campanas ───────────────────────────────────────
function pluck(t0, note, vel, p, echo = 0.35) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.8 * SR);
  const fr = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const index = 1.6 * Math.exp(-t / 0.06);
    const s = Math.sin(2 * Math.PI * fr * t + index * Math.sin(2 * Math.PI * 2 * fr * t)) * clamp(t / 0.003) * Math.exp(-t / 0.24) * vel * 0.26;
    add(keys, i0 + k, s * l, s * r);
    add(delaySend, i0 + k, s * echo, s * echo);
    add(reverbSend, i0 + k, s * 0.35 * l, s * 0.35 * r);
  }
}
function bell(t0, note, vel, p = 0) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(3.6 * SR);
  const fr = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const index = 2.2 * Math.exp(-t / 0.45);
    const s = Math.sin(2 * Math.PI * fr * t + index * Math.sin(2 * Math.PI * 3.5 * fr * t)) * clamp(t / 0.002) * Math.exp(-t / 1.1) * vel * 0.22;
    add(keys, i0 + k, s * l, s * r);
    add(reverbSend, i0 + k, s * 0.6, s * 0.6);
  }
}
function stab(t0, vel) {
  chordAt(t0).pad.forEach((note, i, all) => pluck(t0, note + 12, vel, -0.5 + i / (all.length - 1), 0.2));
}

// Gancho: una nota por línea (f4, f10) y el oro de «Pro» (f45): tres campanas, una por fotograma
pluck(f(4), 72, 0.7, -0.25, 0.5);
pluck(f(10), 76, 0.7, 0.25, 0.5);
bell(f(45), 84, 0.55, -0.3);
bell(f(46), 88, 0.5, 0.3);
bell(f(47), 91, 0.42, 0);
// Arpegio en corcheas: discreto con el teléfono, algo más presente bajo la oferta
for (const b of [...range(6, 26)].flatMap((b) => [b, b + 0.5])) {
  const chord = chordAt(at(b));
  const step = Math.round((b % 4) * 2);
  const level = b < 16 ? 0.5 : 0.6;
  pluck(at(b), chord.arp[step], (b % 1 === 0 ? 1 : 0.75) * level, step % 2 === 0 ? -0.35 : 0.35);
}
// El haz abre Recreación (f178) y Coliseo (f189), los cruces que da beam.ts: Mi y Sol agudos
bell(f(178), 88, 0.7, 0.35);
bell(f(189), 91, 0.7, -0.35);
// La oferta: acorde en Do con el titular y una campana con el botón
stab(f(270), 0.5);
bell(f(270), 84, 0.6, 0);
bell(f(315), 88, 0.45, 0.2);
// El logo: tres campanas en La, Do y Mi, una por fotograma (las tres hojas del isotipo)
bell(f(406), 81, 0.55, -0.3);
bell(f(407), 84, 0.5, 0.3);
bell(f(408), 88, 0.45, 0);

// ─── Efectos: golpe sub y barridos de aire ───────────────────────────────────
function boom(t0, vel) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(1.8 * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    phase += (2 * Math.PI * (32 + 36 * Math.exp(-t / 0.2))) / SR;
    const s = Math.tanh(Math.sin(phase) * 1.2) * Math.exp(-t / 0.6) * vel * 0.45;
    add(fx, i0 + k, s, s);
  }
}
boom(3, 0.8);
boom(f(270), 0.4);

const airNoise = noiseBuffer(44, N);
/** Barrido de ruido que sube hacia un corte. */
function sweep(from, to, f0, f1, level) {
  const bp = svf(f0, 1.2);
  const i0 = Math.round(from * SR);
  const i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) {
    const p = (i - i0) / (i1 - i0);
    bp.set(f0 * (f1 / f0) ** p, 1.2);
    const s = bp.bp(airNoise[(i * 3) % N]) * level * p * p;
    add(fx, i, s * 0.9, s);
    add(reverbSend, i, s * 0.3, s * 0.3);
  }
}
sweep(2.2, 3, 500, 5000, 0.26);
sweep(7.4, 8, 700, 4800, 0.18);

// ─── Compresión lateral del pulso sobre pad y bajo ──────────────────────────
const kickEnv = new Float32Array(N);
for (const { t, vel } of kicks) {
  const i0 = Math.round(t * SR);
  for (let k = 0; k < SR * 0.5 && i0 + k < N; k++) kickEnv[i0 + k] = Math.max(kickEnv[i0 + k], Math.min(1, vel) * Math.exp(-k / SR / 0.12));
}
{
  const fl = svf(520, 0.8), fr = svf(520, 0.8);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (i % 32 === 0) { const c = padCutoff(t); fl.set(c, 0.8); fr.set(c, 0.8); }
    const g = padLevel(t) * (1 - 0.3 * kickEnv[i]);
    pad[0][i] = fl.lp(pad[0][i]) * g;
    pad[1][i] = fr.lp(pad[1][i]) * g;
    add(reverbSend, i, pad[0][i] * 0.3, pad[1][i] * 0.3);
  }
  for (let i = 0; i < N; i++) {
    const duck = 1 - 0.6 * kickEnv[i];
    bass[0][i] *= duck;
    bass[1][i] *= duck;
  }
}

// ─── Eco ping-pong (corchea con puntillo) y reverb (Freeverb) ────────────────
function pingPong(input, time, feedback) {
  const d = Math.round(time * SR);
  const out = bus();
  const bl = new Float32Array(d), br = new Float32Array(d);
  const damp = svf(3200, 0.7);
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const yl = bl[idx], yr = br[idx];
    out[0][i] = yl;
    out[1][i] = yr;
    bl[idx] = (input[0][i] + input[1][i]) * 0.5 + damp.lp(yr) * feedback;
    br[idx] = yl * feedback;
    idx = (idx + 1) % d;
  }
  return out;
}
function freeverb(input, roomSize = 0.88, damp = 0.3) {
  const scale = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round(x * scale));
  const apT = [556, 441, 341, 225].map((x) => Math.round(x * scale));
  const spread = Math.round(23 * scale);
  const out = bus();
  for (let ch = 0; ch < 2; ch++) {
    const combs = combT.map((t) => ({ buf: new Float32Array(t + ch * spread), i: 0, store: 0 }));
    const aps = apT.map((t) => ({ buf: new Float32Array(t + ch * spread), i: 0 }));
    const x = input[ch];
    for (let n = 0; n < N; n++) {
      const inp = x[n] * 0.015;
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
      out[ch][n] = acc * 3;
    }
  }
  return out;
}
const echo = pingPong(delaySend, BEAT * 0.75, 0.34);
const verb = freeverb(reverbSend);

// ─── Mezcla ──────────────────────────────────────────────────────────────────
const L = new Float32Array(N), R = new Float32Array(N);
const stems = [[drums, 0.5], [bass, 1], [pad, 1], [keys, 1], [fx, 1], [echo, 0.6], [verb, 1]];
for (const [b, g] of stems) for (let i = 0; i < N; i++) { L[i] += b[0][i] * g; R[i] += b[1][i] * g; }
for (let i = 0; i < N; i++) {
  const fade = 1 - smooth((i / SR - (DUR - 0.4)) / 0.4);
  L[i] = Math.tanh(L[i] * 1.05) * fade;
  R[i] = Math.tanh(R[i] * 1.05) * fade;
}

/** Sonoridad integrada (ITU-R BS.1770-4, filtro K y doble compuerta), en LUFS. */
function integratedLufs(l, r) {
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

// Normaliza la sonoridad y limita los picos (anticipación de 3 ms)
const gain = 10 ** ((TARGET_LUFS - integratedLufs(L, R)) / 20);
for (let i = 0; i < N; i++) { L[i] *= gain; R[i] *= gain; }
{
  const ceiling = 10 ** (CEILING_DB / 20);
  const look = Math.round(0.003 * SR);
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  let g = 1;
  const release = Math.exp(-1 / (0.08 * SR));
  for (let i = 0; i < N; i++) {
    let m = 1;
    for (let k = i; k < Math.min(N, i + look); k++) if (need[k] < m) m = need[k];
    g = m < g ? m : m - (m - g) * release;
    L[i] *= g;
    R[i] *= g;
  }
}

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));

// WAV de 16 bits con dither triangular
const dither = rng(99);
const data = Buffer.alloc(44 + N * 4);
data.write('RIFF', 0);
data.writeUInt32LE(36 + N * 4, 4);
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
data.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  for (const [ch, x] of [[0, L[i]], [1, R[i]]]) {
    const v = Math.round(x * 32767 + (dither() - dither()));
    data.writeInt16LE(Math.max(-32768, Math.min(32767, v)), 44 + i * 4 + ch * 2);
  }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, data);
console.log(`música → ${OUT}`);
console.log(`  ${DUR} s · ${integratedLufs(L, R).toFixed(1)} LUFS · pico ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
