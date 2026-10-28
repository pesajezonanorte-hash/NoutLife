// Música y diseño de sonido del anuncio «Pro Studio» (src/ProStudio): una pista mínima, de
// estudio, sintetizada nota a nota (sin samples ni licencias de terceros, y determinista),
// con los tiempos de src/ProStudio/timeline.json:
//    0–2,8 s    el gancho: zumbido ambiental cálido desde el primer fotograma (La y Mi con su
//               batido y aire de estudio) y una nota de mazo apagada por línea; «Pro» en
//               oro: tres campanas de cristal
//    2,8 s      emerge el teléfono: el zumbido baja a la octava grave, un soplo de aire lo
//               acompaña y, cuando frena, un golpe sub muy suave (su peso)
//    3–12,4 s   un pad cálido y lento con un bajo suave y un arpegio de cristal escaso
//    4,6 s      las tarjetas salen de la pantalla: dos toques de cristal
//    5,9 s      la cámara se acerca a las zonas: el pad se cierra; cada candado suena con un
//               clic doble finísimo y una campanita jade; las demás zonas, una cascada de
//               clics mínimos
//    7,8 s      las tarjetas pasan a «DESBLOQUEADA»: dos notas
//    9,5 s      llega la oferta: un acorde punteado; un brillo con el oro de «PRO.»
//   11,3 s      el botón: un clic al llegar y, al pulsarlo, el clic de bajar y el de subir;
//               el acorde respira hacia dentro y se corta
//   12,4 s      silencio absoluto (también las colas del eco y la reverb)
//   13 s        el cierre: acorde de Do mayor 9 y, con el logo, tres campanas; todo se
//               apaga solo y el fundido final termina en silencio antes del último fotograma
// Sin saturación ni golpes graves al final: lo único que toca el máster es la normalización
// y un limitador de picos.
//
// Uso: node scripts/build-music-studio.mjs  →  public/audio/pro-studio-music.wav (48 kHz, 16 bits, estéreo)
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SR,
  clamp,
  freeverb,
  integratedLufs,
  makeBus,
  master,
  midiHz,
  mix,
  noiseBuffer,
  pan,
  pingPong,
  polyblep,
  rng,
  smooth,
  svf,
  truePeakDb,
  writeWav,
} from './lib/synth.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = JSON.parse(readFileSync(join(ROOT, 'src', 'ProStudio', 'timeline.json'), 'utf8'));
const OUT = join(ROOT, 'public', 'audio', 'pro-studio-music.wav');
const TARGET_LUFS = -14;
const CEILING_DB = -1.5;

const DUR = T.duration / T.fps;
const N = Math.ceil(DUR * SR);
const BEAT = 60 / T.bpm;
/** Fotograma (30 fps) → segundos. */
const f = (frame) => frame / T.fps;

const EMERGE = f(T.device.emerge[0]);
/** Entra la música (el pad) mientras el teléfono emerge. */
const MUSIC = f(T.device.emerge[0] + 6);
/** Donde más frena el teléfono: ahí se siente su peso. */
const BRAKE = f(T.device.emerge[0] + 22);
const CLOSEUP = T.device.closeup.map(f);
const RISE = f(T.device.rise[0]);
const LAND = f(T.offer.enter[0] + 4);
const BUTTON = f(T.offer.button);
const PRESS = f(T.offer.press);
const SILENCE = T.end.silence.map(f);
/** El cierre: lo primero que suena después del silencio. */
const CLOSE = SILENCE[1];
const LOGO = f(T.end.logo);
/** Fundido final: termina 40 ms antes del último fotograma, en silencio digital. */
const FADE = [DUR - 1.15, DUR - 0.04];

// Dos mezclas: lo que empieza antes del silencio (se corta y no vuelve, ni sus colas de eco
// y reverb) y lo que empieza con el cierre, en buses propios desde cero.
const makeMix = () => ({ drone: makeBus(N), bass: makeBus(N), pad: makeBus(N), keys: makeBus(N), sfx: makeBus(N), reverbSend: makeBus(N), delaySend: makeBus(N) });
const PRE = makeMix();
const POST = makeMix();
let { drone, bass, pad, keys, sfx, reverbSend, delaySend } = PRE;
/** Escribe en la mezcla de después del silencio todo lo que suene dentro de `fn`. */
function afterSilence(fn) {
  ({ drone, bass, pad, keys, sfx, reverbSend, delaySend } = POST);
  fn();
  ({ drone, bass, pad, keys, sfx, reverbSend, delaySend } = PRE);
}
function add(b, i, l, r) {
  if (i >= 0 && i < N) { b[0][i] += l; b[1][i] += r; }
}

// ─── Armonía ─────────────────────────────────────────────────────────────────
const CHORDS = {
  Am9: { root: 33, pad: [57, 60, 64, 67, 71], arp: [76, 72, 69, 71, 76, 79, 76, 71] },
  Fmaj9: { root: 29, pad: [53, 57, 60, 64, 67], arp: [76, 72, 69, 67, 72, 76, 79, 76] },
  Cadd9: { root: 36, pad: [55, 60, 62, 64, 67], arp: [79, 76, 74, 72, 76, 79, 74, 76] },
  G6: { root: 31, pad: [55, 59, 62, 64, 67], arp: [74, 71, 67, 71, 74, 76, 79, 74] },
  Cmaj9: { root: 36, pad: [52, 55, 59, 62, 64], arp: [76, 72, 71, 67, 72, 76, 79, 76] },
};
/** El teléfono llega en La menor; el primer plano va a Do; la oferta sube por Fa y Sol, el botón vuelve a Do y el cierre resuelve en Do mayor 9 tras el silencio. */
const PROGRESSION = [
  [MUSIC, 'Am9'], [MUSIC + 4 * BEAT, 'Fmaj9'], [CLOSEUP[0] + BEAT, 'Cadd9'], [CLOSEUP[1], 'G6'],
  [RISE, 'Fmaj9'], [RISE + 2 * BEAT, 'G6'], [BUTTON, 'Cadd9'], [CLOSE, 'Cmaj9'],
];
const SEGMENTS = PROGRESSION.map(([start, name], i) => ({ start, end: i + 1 < PROGRESSION.length ? PROGRESSION[i + 1][0] : DUR, chord: CHORDS[name] }));
const chordAt = (t) => SEGMENTS.find((s) => t >= s.start && t < s.end)?.chord ?? CHORDS.Am9;
const range = (from, to, step) => {
  const out = [];
  for (let t = from; t < to - 1e-9; t += step) out.push(t);
  return out;
};

// ─── El zumbido ambiental del gancho ─────────────────────────────────────────
// Cálido y en el registro medio (La 110 Hz y Mi 165 Hz con un batido lento, abiertos a
// izquierda y derecha). Está desde el primer fotograma (sube en un cuarto de segundo, sin
// clic); cuando emerge el teléfono baja a la octava grave (55 Hz) y se funde con el pad.
{
  const end = f(T.hook.exit[1]) + 0.6;
  const lp = [svf(300, 0.7), svf(300, 0.7)];
  let sawPh = 0;
  for (let i = 0; i < end * SR; i++) {
    const t = i / SR;
    const env = smooth(t / 0.25) * (1 - smooth((t - (end - 0.9)) / 0.9));
    const deep = smooth((t - EMERGE) / 0.6);
    const warm = 0.5 * Math.sin(2 * Math.PI * 110 * t) + 0.35 * Math.sin(2 * Math.PI * 110.35 * t + 0.9) + 0.18 * Math.sin(2 * Math.PI * 164.8 * t + 0.4);
    const warmR = 0.5 * Math.sin(2 * Math.PI * 110 * t + 0.6) + 0.35 * Math.sin(2 * Math.PI * 109.7 * t + 1.7) + 0.18 * Math.sin(2 * Math.PI * 164.8 * t + 1.1);
    const sub = Math.sin(2 * Math.PI * 55 * t) + 0.6 * Math.sin(2 * Math.PI * 55.42 * t + 1.3);
    const dt = 110 / SR;
    sawPh = (sawPh + dt) % 1;
    const saw = 2 * sawPh - 1 - polyblep(sawPh, dt);
    if (i % 32 === 0) for (const filt of lp) filt.set(mix(240, 700, t / 2.6), 0.7);
    const shimmer = 0.6 + 0.4 * Math.sin(t * 1.7);
    const l = (warm * 0.34 + lp[0].lp(saw) * 0.1 * shimmer) * (1 - 0.6 * deep) + sub * 0.34 * deep;
    const r = (warmR * 0.34 + lp[1].lp(saw) * 0.1 * shimmer) * (1 - 0.6 * deep) + sub * 0.34 * deep;
    add(drone, i, l * env, r * env);
  }
  // Aire de estudio: ruido muy bajo que abre el espacio
  const air = noiseBuffer(5, N);
  const bp = svf(2400, 0.6);
  for (let i = 0; i < end * SR; i++) {
    const t = i / SR;
    const env = smooth(t / 0.4) * (1 - smooth((t - (end - 0.9)) / 0.9));
    const s = bp.bp(air[i]) * 0.028 * env;
    const [l, r] = pan(Math.sin(t * 0.9) * 0.5);
    add(drone, i, s * l, s * r);
  }
}

// ─── Instrumentos ────────────────────────────────────────────────────────────
/** Mazo de fieltro: una nota cálida y apagada que se va sola (las líneas del gancho). */
function mallet(t0, note, vel, p = 0) {
  const i0 = Math.round(t0 * SR);
  const fr = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < 1.4 * SR; k++) {
    const t = k / SR;
    const s = (Math.sin(2 * Math.PI * fr * t) + 0.2 * Math.sin(4 * Math.PI * fr * t) * Math.exp(-t / 0.06)) * clamp(t / 0.006) * Math.exp(-t / 0.42) * vel * 0.2;
    add(keys, i0 + k, s * l, s * r);
    add(reverbSend, i0 + k, s * 0.5 * l, s * 0.5 * r);
  }
}
/**
 * Campana de cristal: parciales casi armónicos que se apagan antes cuanto más agudos. Sin
 * modulación de frecuencia, que en notas agudas daba un brillo metálico áspero.
 */
const CHIME_PARTIALS = [[1, 1, 1], [2.005, 0.24, 0.5], [3.01, 0.08, 0.3], [4.18, 0.035, 0.18]];
function chime(t0, note, vel, p = 0, decay = 1.1, send = 0.5) {
  const i0 = Math.round(t0 * SR);
  const fr = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < decay * 4 * SR; k++) {
    const t = k / SR;
    let s = 0;
    for (const [ratio, gain, d] of CHIME_PARTIALS) s += Math.sin(2 * Math.PI * fr * ratio * t) * gain * Math.exp(-t / (decay * d));
    s *= clamp(t / 0.003) * vel * 0.2;
    add(keys, i0 + k, s * l, s * r);
    add(reverbSend, i0 + k, s * send * l, s * send * r);
    add(delaySend, i0 + k, s * 0.12, s * 0.12);
  }
}
/** Pulsación suave (arpegio y acordes): FM leve que se apaga rápido, con algo de eco. */
function pluck(t0, note, vel, p, echo = 0.25) {
  const i0 = Math.round(t0 * SR);
  const fr = midiHz(note);
  const [l, r] = pan(p);
  for (let k = 0; k < 0.9 * SR; k++) {
    const t = k / SR;
    const index = 0.7 * Math.exp(-t / 0.05);
    const s = Math.sin(2 * Math.PI * fr * t + index * Math.sin(2 * Math.PI * 2 * fr * t)) * clamp(t / 0.004) * Math.exp(-t / 0.26) * vel * 0.22;
    add(keys, i0 + k, s * l, s * r);
    add(delaySend, i0 + k, s * echo, s * echo);
    add(reverbSend, i0 + k, s * 0.35 * l, s * 0.35 * r);
  }
}
/**
 * Clic de interfaz finísimo, como un háptico: un tic afinado de un milisegundo y un cuerpo
 * breve, sin ruido (el ruido filtrado sonaba a grano). `pitch` sube o baja los dos.
 */
function tick(t0, vel, p = 0, pitch = 1) {
  const i0 = Math.round(t0 * SR);
  const [l, r] = pan(p);
  for (let k = 0; k < 0.05 * SR; k++) {
    const t = k / SR;
    const snap = Math.sin(2 * Math.PI * 3100 * pitch * t) * Math.exp(-t / 0.0009);
    const body = Math.sin(2 * Math.PI * 720 * pitch * t) * Math.exp(-t / 0.008) * 0.5;
    const s = (snap + body) * clamp(t / 0.00025) * vel * 0.32;
    add(sfx, i0 + k, s * l, s * r);
    add(reverbSend, i0 + k, s * 0.1 * l, s * 0.1 * r);
  }
}
/** Pestillo del candado: dos tics (el clic y, 34 ms después, el arco al abrirse) y su campanita. */
function latch(t0, vel, p, notes) {
  tick(t0, vel, p, 1);
  tick(t0 + 0.034, vel * 0.6, p, 0.82);
  notes.forEach((n, i) => chime(t0 + 0.05 + 0.03 * i, n, 0.3 - 0.06 * i, p + 0.15 * i, 0.9));
}
/** Golpe sub muy suave: el peso del teléfono al frenar (sin distorsión ni chasquido). */
function weight(t0, vel) {
  const i0 = Math.round(t0 * SR);
  let phase = 0;
  for (let k = 0; k < 1.6 * SR; k++) {
    const t = k / SR;
    phase += (2 * Math.PI * (46 + 14 * Math.exp(-t / 0.12))) / SR;
    const s = Math.sin(phase) * smooth(t / 0.05) * Math.exp(-t / 0.45) * vel * 0.5;
    add(sfx, i0 + k, s, s);
  }
}
/** Soplo de aire: ruido en banda que se mueve de f0 a f1 con una campana de volumen. */
const airNoise = noiseBuffer(44, N);
function whoosh(from, to, f0, f1, level, p0 = 0, p1 = 0) {
  const bp = svf(f0, 0.9);
  const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  for (let i = i0; i < i1 && i < N; i++) {
    const x = (i - i0) / (i1 - i0);
    if ((i - i0) % 32 === 0) bp.set(f0 * (f1 / f0) ** x, 0.9);
    const s = bp.bp(airNoise[(i * 3) % N]) * level * Math.sin(Math.PI * x) ** 2;
    const [l, r] = pan(p0 + (p1 - p0) * x);
    add(sfx, i, s * l, s * r);
    add(reverbSend, i, s * 0.25 * l, s * 0.25 * r);
  }
}
/** El acorde que respira hacia dentro: sube desde nada y se corta con el silencio. */
function inhale(from, to, notes, level) {
  const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  notes.forEach((note, j) => {
    const fr = midiHz(note);
    const [l, r] = pan(-0.4 + (0.8 * j) / (notes.length - 1));
    for (let i = i0; i < i1 && i < N; i++) {
      const x = (i - i0) / (i1 - i0);
      const env = (Math.exp(3 * x) - 1) / (Math.exp(3) - 1);
      const s = (Math.sin(2 * Math.PI * fr * (i / SR)) + 0.15 * Math.sin(4 * Math.PI * fr * (i / SR))) * env * level;
      add(keys, i, s * l, s * r);
    }
  });
}

// ─── El guion ────────────────────────────────────────────────────────────────
// El gancho: una nota de mazo con cada línea (La, Do, Mi); la primera línea ya está en el
// primer fotograma, así que su nota suena al empezar. «Pro» en oro: tres campanas (Mi, Sol, Si)
T.hook.lines.forEach((frame, i) => mallet(Math.max(0.02, f(frame)), [69, 72, 76][i], 0.5 + 0.1 * i, [-0.25, 0.25, 0][i]));
[88, 91, 95].forEach((n, i) => chime(f(T.hook.glint + 2 * i), n, 0.3 - 0.05 * i, [-0.3, 0.3, 0][i], 0.8, 0.7));
// Emerge el teléfono: aire mientras viene y su peso cuando frena
whoosh(f(T.hook.exit[0]) - 0.2, BRAKE + 0.35, 380, 2400, 0.12, -0.15, 0.15);
weight(BRAKE - 0.08, 0.7);
// Las tarjetas salen de la pantalla: Coliseo a la izquierda, Recreación a la derecha
chime(f(T.device.cards.coliseo + 6), 91, 0.22, -0.45, 0.5, 0.6);
tick(f(T.device.cards.coliseo + 6), 0.35, -0.45, 1.2);
chime(f(T.device.cards.recreacion + 6), 95, 0.2, 0.45, 0.5, 0.6);
tick(f(T.device.cards.recreacion + 6), 0.32, 0.45, 1.3);
// El primer plano: la cámara entra y sale con un aire muy bajo; cada candado, su pestillo y su campanita
whoosh(CLOSEUP[0] - 0.1, CLOSEUP[0] + 1.0, 1600, 600, 0.06, 0.2, -0.1);
latch(f(T.device.unlock.coliseo), 0.9, -0.15, [84, 91]);
latch(f(T.device.unlock.recreacion), 0.85, 0.15, [86, 93]);
{
  // El resto de zonas Pro, en cadena: clics mínimos que se alejan
  const r = rng(8);
  const [a, b] = T.device.ripple;
  for (let k = 0; k < 9; k++) tick(f(a + ((b - a) * k) / 8 + r() * 0.8), 0.42 - 0.03 * k, r() * 1.2 - 0.6, 1.1 + 0.05 * k);
}
whoosh(CLOSEUP[1] - 1.0, CLOSEUP[1] + 0.1, 600, 1800, 0.05, -0.1, 0.2);
// «DESBLOQUEADA»
chime(f(T.device.cardsUnlock), 79, 0.26, -0.2, 0.9);
chime(f(T.device.cardsUnlock + 3), 86, 0.22, 0.2, 0.9);
// La oferta: las tarjetas se van y el teléfono sube; llega la tarjeta (acorde punteado) y el oro brilla
whoosh(f(T.device.cardsOut[0]), RISE + 0.9, 500, 2600, 0.08, 0, 0);
chordAt(LAND).pad.forEach((note, i, all) => pluck(LAND + 0.014 * i, note + 12, 0.34, -0.5 + i / (all.length - 1), 0.2));
chime(f(T.offer.glint), 91, 0.18, -0.15, 0.7, 0.6);
chime(f(T.offer.glint + 2), 98, 0.14, 0.15, 0.7, 0.6);
// El botón: un clic al llegar; al pulsarlo, el de bajar y el de subir (cuando vuelve su muelle)
tick(BUTTON, 0.6, 0, 1);
tick(PRESS, 0.85, 0, 0.9);
tick(PRESS + 0.1, 0.45, 0, 1.08);
// El acorde respira hacia dentro hasta el silencio
inhale(SILENCE[0] - 2 * BEAT, SILENCE[0], [60, 64, 67, 74], 0.035);

// ─── Música: pad, bajo y arpegio ─────────────────────────────────────────────
/** Acorde final: florece con el cierre y se va apagando bajo el logo. */
const finalDecay = (t) => (t < CLOSE ? 1 : 0.25 + 0.75 * Math.exp(-(t - CLOSE) / 1.8));
function subBass(from, to, level) {
  const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  let phase = 0;
  for (let i = i0; i < i1 && i < N; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * midiHz(chordAt(t).root)) / SR;
    const env = smooth((t - from) / 0.6) * clamp((to - t) / 0.3) * finalDecay(t);
    const s = (Math.sin(phase) + 0.22 * Math.sin(2 * phase)) * level * env;
    add(bass, i, s, s);
  }
}
subBass(MUSIC, SILENCE[0], 0.085);
afterSilence(() => subBass(CLOSE, DUR, 0.07));
// Pad: sierras desafinadas por un pasabajos suave
const DETUNE = [[-8, -2, 5], [-5, 2, 8]];
function padSegment(seg) {
  const rel = 0.6;
  const attack = seg.start === MUSIC ? 0.9 : seg.start === CLOSE ? 0.35 : 0.45;
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
          const env = smooth((t - seg.start) / attack) * (t < seg.end ? 1 : 1 - (t - seg.end) / rel) * finalDecay(t);
          pad[ch][i] += saw * env * 0.045;
        }
      }
    }
  }
}
for (const seg of SEGMENTS) {
  if (seg.start >= CLOSE) afterSilence(() => padSegment(seg));
  else padSegment(seg);
}
/** Corte del pad: se abre con el teléfono, se cierra en el primer plano (íntimo), brilla en la oferta y se apaga con el logo. */
function padCutoff(t) {
  if (t < CLOSEUP[0]) return mix(500, 1300, (t - MUSIC) / 2);
  if (t < CLOSEUP[1]) return mix(1300, 760, (t - CLOSEUP[0]) / 0.8);
  if (t < CLOSE) return mix(760, 1700, (t - CLOSEUP[1]) / 1.5);
  return mix(1900, 650, (t - CLOSE) / 2.2);
}
/** Volumen del pad: baja en el primer plano para que se oigan los candados y vuelve con la oferta. */
const padLevel = (t) => (t < CLOSEUP[1] ? mix(1, 0.72, (t - CLOSEUP[0]) / 0.6) : mix(0.72, 1, (t - CLOSEUP[1]) / 1.2));
// Arpegio de cristal en negras, escaso, solo con el plano abierto
for (const t of [...range(MUSIC + 2 * BEAT, CLOSEUP[0], BEAT), ...range(CLOSEUP[1] + BEAT, SILENCE[0] - 2 * BEAT, BEAT)]) {
  const chord = chordAt(t);
  const step = Math.round((t - MUSIC) / BEAT) % 8;
  pluck(t, chord.arp[step], (step % 2 === 0 ? 1 : 0.75) * 0.3, step % 2 === 0 ? -0.35 : 0.35);
}
// El cierre (acorde con campanas) y el logo: después del silencio, en su propia mezcla
afterSilence(() => {
  [84, 88, 91, 95].forEach((n, i) => chime(CLOSE + 0.02 + 0.015 * i, n, 0.2 - 0.025 * i, -0.3 + 0.2 * i, 1.5));
  [81, 84, 88].forEach((n, i) => chime(LOGO + f(2 * i), n, 0.26 - 0.04 * i, [-0.3, 0.3, 0][i], 1.3));
});

// ─── Proceso: filtro y volumen del pad ─────────────────────────────────────────────
for (const m of [PRE, POST]) {
  const pl = svf(600, 0.7), pr = svf(600, 0.7);
  for (let i = 0; i < N; i++) {
    if (i % 32 === 0) {
      const c = padCutoff(i / SR);
      pl.set(c, 0.7);
      pr.set(c, 0.7);
    }
    const g = padLevel(i / SR);
    m.pad[0][i] = pl.lp(m.pad[0][i]) * g;
    m.pad[1][i] = pr.lp(m.pad[1][i]) * g;
    add(m.reverbSend, i, m.pad[0][i] * 0.3, m.pad[1][i] * 0.3);
  }
}

// ─── Mezcla ──────────────────────────────────────────────────────────────────
const L = new Float32Array(N), R = new Float32Array(N);
for (const [m, cut] of [[PRE, true], [POST, false]]) {
  const echo = pingPong(m.delaySend, BEAT * 0.75, 0.3);
  const verb = freeverb(m.reverbSend);
  const stems = [[m.drone, 1], [m.bass, 1], [m.pad, 0.65], [m.keys, 1], [m.sfx, 1], [echo, 0.45], [verb, 1]];
  for (let i = 0; i < N; i++) {
    // La mezcla de antes se apaga en 30 ms y termina justo al empezar el silencio: no vuelve
    const g = cut ? 1 - smooth((i / SR - (SILENCE[0] - 0.03)) / 0.03) : 1;
    if (g <= 0) break;
    for (const [b, gain] of stems) {
      L[i] += b[0][i] * gain * g;
      R[i] += b[1][i] * gain * g;
    }
  }
}
// Fundido final largo (coseno): sin cortes, y en silencio digital antes del último fotograma
for (let i = 0; i < N; i++) {
  const fade = 0.5 + 0.5 * Math.cos(Math.PI * clamp((i / SR - FADE[0]) / (FADE[1] - FADE[0])));
  L[i] *= fade;
  R[i] *= fade;
}
const reduction = master(L, R, TARGET_LUFS, CEILING_DB);
for (let i = Math.round(FADE[1] * SR); i < N; i++) L[i] = R[i] = 0;

writeWav(OUT, L, R);
console.log(`música → ${OUT}`);
console.log(`  ${DUR} s · ${integratedLufs(L, R).toFixed(1)} LUFS · pico real ≈ ${truePeakDb(L, R).toFixed(1)} dBTP · limitador −${reduction.toFixed(1)} dB · silencio ${SILENCE[0].toFixed(2)}–${SILENCE[1].toFixed(2)} s · fundido ${FADE[0].toFixed(2)}–${FADE[1].toFixed(2)} s`);
