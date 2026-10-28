// Música original del anuncio «7 días de Pro», sintetizada nota a nota: sin samples
// ni licencias de terceros, y determinista. 120 BPM, los mismos acordes que el promo de
// 24 s (La menor, Fa, Do, Sol: la misma firma sonora) y 15 s con los cortes de
// src/ProTrial/timeline.ts:
//    0–3 s    gancho: pad oscuro, una nota por línea, golpe suave en «modo Pro?»,
//             campanas con el oro (2 s) y un barrido hacia el golpe
//    3 s      entra el teléfono: golpe sub y el ritmo (bombo, palmas, hats, bajo, arpegio)
//    4–5 s    una campana ascendente por cada zona que se abre (4,0 · 4,5 · 5,0 s)
//    6 s      la racha: acorde de campanas
//    7 s      barrido y platillo al revés hacia la oferta
//    8–10 s   medio tiempo bajo la tarjeta de cristal; golpe en «7 DÍAS DE PRO.»
//   10 s      vuelve el ritmo con «Sin tarjeta de crédito.»
//   12,5 s    toque en el botón: acorde final en Do que resuena bajo el logo
//   13,4 s    tres campanas con el logo (las tres hojas del isotipo)
//
// Uso: node scripts/build-music-pro-trial.mjs  →  public/audio/pro-trial-music.wav (48 kHz, 16 bits, estéreo)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const BPM = 120;
const BEAT = 60 / BPM;
const DUR = 15;
const N = Math.ceil(DUR * SR);
/** Volumen del lecho musical: los efectos van encima y el total queda cerca de −16 LUFS. */
const TARGET_LUFS = -17;
const CEILING_DB = -3;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio', 'pro-trial-music.wav');

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
  const set = (f, qq = q) => {
    g = Math.tan((Math.PI * Math.min(Math.max(f, 10), SR * 0.45)) / SR);
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
/** Segundo → acorde. El gancho queda suspendido en Sol; el teléfono cae en La menor; el toque resuelve en Do. */
const PROGRESSION = [
  [0, 'Fmaj9'], [2, 'G6'],
  [3, 'Am9'], [5, 'Fmaj9'], [6, 'Cadd9'], [7, 'G6'],
  [8, 'Am9'], [9, 'Fmaj9'], [10, 'Cadd9'], [11, 'G6'], [12, 'Fmaj9'], [12.5, 'Cadd9'],
];
const SEGMENTS = PROGRESSION.map(([start, name], i) => ({
  start,
  end: i + 1 < PROGRESSION.length ? PROGRESSION[i + 1][0] : DUR,
  chord: CHORDS[name],
}));
const chordAt = (t) => SEGMENTS.find((s) => t >= s.start && t < s.end)?.chord ?? CHORDS.Cadd9;

/** Pulsos con groove completo: del teléfono a la oferta (3–8 s) y de «Sin tarjeta» al toque (10–12,5 s). */
const GROOVE = [...range(6, 16), ...range(20, 25)];
/** Medio tiempo bajo la tarjeta (8–10 s): bombo cada dos pulsos. */
const HALF = range(16, 20, 2);

// ─── Batería ─────────────────────────────────────────────────────────────────
const kickNoise = noiseBuffer(11, SR);
const kicks = [];
function kick(t0, vel, muffled = false) {
  kicks.push({ t: t0, vel: muffled ? vel * 0.4 : vel });
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.5 * SR);
  const lp = svf(muffled ? 180 : 9000, 0.7);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const f = 44 + 118 * Math.exp(-t / 0.032);
    phase += (2 * Math.PI * f) / SR;
    let s = Math.sin(phase) * Math.exp(-t / 0.2);
    if (!muffled) s += kickNoise[k] * Math.exp(-t / 0.0025) * 0.4;
    s = Math.tanh(s * 1.9) * 0.82;
    s = lp.lp(s) * (muffled ? 1.7 : 1);
    add(drums, i0 + k, s * vel, s * vel);
  }
}

const clapNoise = noiseBuffer(22, SR);
function clap(t0, vel) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.4 * SR);
  const bp = svf(1350, 0.9);
  const [l, r] = pan(0.06);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    let env = 0;
    for (const o of [0, 0.009, 0.018]) if (t >= o) env += Math.exp(-(t - o) / 0.0045) * 0.75;
    if (t >= 0.022) env += Math.exp(-(t - 0.022) / 0.1);
    const s = bp.bp(clapNoise[k]) * env * vel * 1.5;
    add(drums, i0 + k, s * l, s * r);
    add(reverbSend, i0 + k, s * 0.4, s * 0.4);
  }
}

const hatNoise = noiseBuffer(33, 2 * SR);
let hatOffset = 0;
function hat(t0, vel, open = false) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor((open ? 0.4 : 0.09) * SR);
  const hp = svf(open ? 7000 : 8200, 0.8);
  const [l, r] = pan(0.28);
  hatOffset = (hatOffset + 977) % SR;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const s = hp.hp(hatNoise[hatOffset + k]) * Math.exp(-t / (open ? 0.13 : 0.021)) * vel * 0.42;
    add(drums, i0 + k, s * l, s * r);
    if (open) add(reverbSend, i0 + k, s * 0.2, s * 0.2);
  }
}

const crashNoise = noiseBuffer(55, 3 * SR);
function crash(t0, vel) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(2.4 * SR);
  const hpL = svf(4200, 0.7), hpR = svf(4600, 0.7);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.exp(-t / 0.55) * clamp(t / 0.002) * vel * 0.2;
    const l = hpL.hp(crashNoise[k]) * env;
    const r = hpR.hp(crashNoise[(k + 12011) % crashNoise.length]) * env;
    add(drums, i0 + k, l, r);
    add(reverbSend, i0 + k, l * 0.5, r * 0.5);
  }
}

// Gancho: solo hats muy suaves que crecen desde el oro (2 s) hacia el golpe
for (const b of range(4, 6, 0.25)) hat(at(b), 0.05 + 0.2 * ((b - 4) / 2));
// Teléfono y zonas (3–8 s): groove; antes de la oferta, redoble de palmas
for (const b of GROOVE) kick(at(b), 1);
for (const b of GROOVE) if (b % 2 === 1) clap(at(b), 1);
for (const b of GROOVE) hat(at(b + 0.5), b % 2 === 1 ? 0.85 : 0.7, b % 2 === 1);
for (const b of range(15, 16, 0.25)) clap(at(b), 0.18 + 0.4 * (b - 15));
crash(3, 0.85);
crash(6, 0.35);
// Medio tiempo bajo la tarjeta: bombo cada dos pulsos y hats en semicorcheas
for (const b of HALF) kick(at(b), 0.9);
for (const b of range(16, 20, 0.25)) hat(at(b), b % 1 === 0.5 ? 0.2 : 0.09);
crash(8, 0.5);
// Vuelve el ritmo con «Sin tarjeta de crédito.» y crece hacia el toque
crash(10, 0.55);
for (const b of range(24, 25, 0.25)) clap(at(b), 0.2 + 0.45 * (b - 24));
// El toque: golpe final y se acaba la batería
kick(12.5, 1.15);
crash(12.5, 0.7);

// ─── Bajo ────────────────────────────────────────────────────────────────────
function subBass(from, to, level) {
  const i0 = Math.round(from * SR);
  const i1 = Math.round(to * SR);
  let phase = 0;
  for (let i = i0; i < i1 && i < N; i++) {
    const t = i / SR;
    const f = midiHz(chordAt(t).root);
    phase += (2 * Math.PI * f) / SR;
    const env = clamp((t - from) / 0.01) * clamp((to - t) / 0.06);
    const s = (Math.sin(phase) + 0.32 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase)) * level * env;
    add(bass, i, s, s);
  }
}
subBass(0.36, 2.95, 0.12);
subBass(3, 7.95, 0.34);
subBass(8, 9.95, 0.24);
subBass(10, 12.48, 0.34);
subBass(12.5, 14.6, 0.22);

function pluckBass(t0, root) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.22 * SR);
  const f = midiHz(root + 12);
  const dt = f / SR;
  const lp = svf(400, 1.1);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    phase += dt;
    if (phase >= 1) phase -= 1;
    const saw = 2 * phase - 1 - polyblep(phase, dt);
    lp.set(260 + 1500 * Math.exp(-t / 0.05), 1.1);
    const s = lp.lp(saw) * Math.exp(-t / 0.12) * clamp(t / 0.003) * 0.22;
    add(bass, i0 + k, s, s);
  }
}
for (const b of GROOVE) pluckBass(at(b + 0.5), chordAt(at(b + 0.5)).root);

// ─── Pad ─────────────────────────────────────────────────────────────────────
const DETUNE = [[-11, -3, 6], [-6, 3, 11]];
for (const seg of SEGMENTS) {
  const rel = seg.end >= DUR ? 0 : 0.5;
  const attack = seg.start === 0 ? 0.6 : 0.12;
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
          pad[ch][i] += saw * env * 0.06;
        }
      }
    }
  }
}

/** Corte del filtro del pad (Hz): oscuro en el gancho, abierto bajo la oferta, se cierra con el logo. */
function padCutoff(t) {
  if (t < 2) return mix(380, 900, t / 2);
  if (t < 3) return mix(900, 2600, t - 2);
  if (t < 7) return 1700 + 300 * Math.sin((t - 3) * Math.PI * 0.5);
  if (t < 8) return mix(1700, 3600, t - 7);
  if (t < 10) return 3000;
  if (t < 12.5) return 2200;
  return mix(3200, 700, (t - 12.5) / 2.3);
}
/** Nivel del pad por tramo (en el groove deja sitio a la batería). */
function padLevel(t) {
  if (t < 3) return 0.95;
  if (t < 8) return 0.8;
  if (t < 10) return 1.25;
  if (t < 12.5) return 0.85;
  return 1.15 * (1 - smooth((t - 14) / 0.9));
}

// ─── Teclas: notas, arpegios y campanas ──────────────────────────────────────
function pluck(t0, note, vel, p, echo = 0.4) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(0.7 * SR);
  const f = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const index = 2.1 * Math.exp(-t / 0.07);
    const s = Math.sin(2 * Math.PI * f * t + index * Math.sin(2 * Math.PI * 2 * f * t)) * clamp(t / 0.002) * Math.exp(-t / 0.2) * vel * 0.3;
    add(keys, i0 + k, s * l, s * r);
    add(delaySend, i0 + k, s * echo, s * echo);
    add(reverbSend, i0 + k, s * 0.3 * l, s * 0.3 * r);
  }
}
function bell(t0, note, vel, p = 0) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(3.6 * SR);
  const f = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const index = 2.6 * Math.exp(-t / 0.5);
    const s = Math.sin(2 * Math.PI * f * t + index * Math.sin(2 * Math.PI * 3.5 * f * t)) * clamp(t / 0.001) * Math.exp(-t / 1.0) * vel * 0.26;
    add(keys, i0 + k, s * l, s * r);
    add(reverbSend, i0 + k, s * 0.55, s * 0.55);
  }
}
function stab(t0, vel) {
  chordAt(t0).pad.forEach((note, i, all) => pluck(t0, note + 12, vel, -0.5 + i / (all.length - 1), 0.2));
}

// Gancho: una nota por línea (f3, f12, f22) y un acorde suave con «modo Pro?»
[[0.1, 69], [0.4, 72], [22 / 30, 76]].forEach(([t, note], i) => pluck(t, note, 0.85, i % 2 ? 0.3 : -0.3, 0.5));
stab(22 / 30, 0.45);
// El oro: tres campanas de Sol, una por fotograma
bell(2, 83, 0.8, -0.3);
bell(2 + 1 / 30, 86, 0.7, 0.3);
bell(2 + 2 / 30, 91, 0.6, 0);
// Arpegio en corcheas en todo el groove y en el medio tiempo
for (const b of [...GROOVE, ...range(16, 20)].flatMap((b) => [b, b + 0.5])) {
  const chord = chordAt(at(b));
  const step = Math.round((b % 4) * 2);
  pluck(at(b), chord.arp[step], b % 1 === 0 ? 0.9 : 0.68, step % 2 === 0 ? -0.35 : 0.35);
}
// Cada zona que se abre: una campana más aguda (Mi, Sol, Do)
bell(4, 88, 0.75, -0.35);
bell(4.5, 91, 0.75, 0.35);
bell(5, 96, 0.7, 0);
// La racha: acorde de campanas en Do
bell(6, 72, 0.8, -0.2);
bell(6, 79, 0.7, 0.2);
bell(6, 88, 0.6, 0);
// «7 DÍAS DE PRO.» y «GRATIS.»
stab(9, 0.55);
bell(9.5, 88, 0.65, 0.25);
// El toque: acorde final en Do
stab(12.5, 0.7);
bell(12.5, 72, 1, -0.2);
bell(12.5, 79, 0.85, 0.2);
bell(12.5, 88, 0.7, 0);
// El logo: tres campanas, una por hoja del isotipo
bell(13.4, 81, 0.55, -0.3);
bell(13.4 + 1 / 30, 84, 0.5, 0.3);
bell(13.4 + 2 / 30, 88, 0.45, 0);

// ─── Efectos: golpes sub, barridos, platillos al revés ───────────────────────
function boom(t0, vel) {
  const i0 = Math.round(t0 * SR);
  const len = Math.floor(1.8 * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    phase += (2 * Math.PI * (30 + 42 * Math.exp(-t / 0.18))) / SR;
    const s = Math.tanh(Math.sin(phase) * 1.4) * Math.exp(-t / 0.55) * vel * 0.55;
    add(fx, i0 + k, s, s);
  }
}
boom(22 / 30, 0.45);
boom(3, 1);
boom(9, 0.6);
boom(12.5, 0.9);

const airNoise = noiseBuffer(44, N);
/** Barrido de ruido que sube hacia un corte (riser). */
function sweep(from, to, f0, f1, level) {
  const bp = svf(f0, 1.4);
  const i0 = Math.round(from * SR);
  const i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) {
    const p = (i - i0) / (i1 - i0);
    bp.set(f0 * (f1 / f0) ** p, 1.4);
    const s = bp.bp(airNoise[(i * 3) % N]) * level * p * p;
    add(fx, i, s * 0.9, s);
    add(reverbSend, i, s * 0.3, s * 0.3);
  }
}
sweep(2.3, 3, 600, 7000, 0.4);
sweep(7, 7.98, 900, 6500, 0.32);
sweep(12, 12.48, 1200, 7000, 0.3);
/** Platillo al revés: crece y se corta en seco justo antes del golpe. */
function reverseSwell(from, to, level) {
  const hp = svf(3000, 0.7);
  const i0 = Math.round(from * SR);
  const i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) {
    const p = (i - i0) / (i1 - i0);
    const s = hp.hp(crashNoise[(i - i0) % crashNoise.length]) * level * p ** 3;
    add(fx, i, s, s * 0.92);
  }
}
reverseSwell(2.4, 2.98, 0.45);
reverseSwell(7.3, 7.98, 0.4);

// ─── Compresión lateral (sidechain) del bombo ────────────────────────────────
const kickEnv = new Float32Array(N);
for (const { t, vel } of kicks) {
  const i0 = Math.round(t * SR);
  for (let k = 0; k < SR * 0.6 && i0 + k < N; k++) kickEnv[i0 + k] = Math.max(kickEnv[i0 + k], Math.min(1, vel) * Math.exp(-k / SR / 0.13));
}
{
  const fl = svf(400, 0.85), fr = svf(400, 0.85);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (i % 32 === 0) { const c = padCutoff(t); fl.set(c, 0.85); fr.set(c, 0.85); }
    const duck = 1 - 0.5 * kickEnv[i];
    const g = padLevel(t) * duck;
    pad[0][i] = fl.lp(pad[0][i]) * g;
    pad[1][i] = fr.lp(pad[1][i]) * g;
    add(reverbSend, i, pad[0][i] * 0.25, pad[1][i] * 0.25);
  }
  for (let i = 0; i < N; i++) {
    const duck = 1 - 0.78 * kickEnv[i];
    bass[0][i] *= duck;
    bass[1][i] *= duck;
  }
}

// ─── Eco ping-pong (corchea con puntillo) y reverb (Freeverb) ────────────────
function pingPong(input, time, feedback) {
  const d = Math.round(time * SR);
  const out = bus();
  const bl = new Float32Array(d), br = new Float32Array(d);
  const damp = svf(3500, 0.7);
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
function freeverb(input, roomSize = 0.86, damp = 0.32) {
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
const echo = pingPong(delaySend, BEAT * 0.75, 0.38);
const verb = freeverb(reverbSend);

// ─── Mezcla ──────────────────────────────────────────────────────────────────
const L = new Float32Array(N), R = new Float32Array(N);
const stems = [[drums, 0.55], [bass, 1], [pad, 1], [keys, 1], [fx, 1], [echo, 0.7], [verb, 1]];
for (const [b, g] of stems) for (let i = 0; i < N; i++) { L[i] += b[0][i] * g; R[i] += b[1][i] * g; }
// Saturación suave del bus y fundido en los últimos 0,4 s
for (let i = 0; i < N; i++) {
  const fade = 1 - smooth((i / SR - (DUR - 0.4)) / 0.4);
  L[i] = Math.tanh(L[i] * 1.1) * fade;
  R[i] = Math.tanh(R[i] * 1.1) * fade;
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
