// Guion del vídeo en fotogramas: 30 fps sobre una rejilla de 120 BPM, así que
// 1 pulso = 0,5 s = 15 fotogramas y 1 compás = 2 s = 60 fotogramas. Los cambios
// grandes caen en el primer pulso del compás y la tipografía en corcheas (7,5 f).
// scripts/build-music.mjs usa los mismos tiempos para la música.
//
// Hoja de pulsos (segundo · fotograma · qué pasa · sonido)
//  0,0 s   f0    «Tu rutina.» cae de golpe (verde menta)              golpe sub + acorde
//  1,0 s   f30   «Tu cuerpo.» (rojo y naranja)                        golpe
//  2,0 s   f60   «Tu mente.» (azul y violeta)                         golpe
//  3,0 s   f90   «Todo en un solo lugar.» palabra a palabra           una nota por palabra
//  4,0 s   f120  cae «lugar.»: los tres colores se juntan             impacto
//  5,4 s   f162  la frase se encoge hasta un solo punto de luz        aspiración (crece el impacto cinemático)
//  6,0 s   f180  del punto salen las tres hojas del isotipo           impacto cinemático + tres campanas
//  6,6 s   f198  «Noutlife» letra a letra; las hojas se vuelven jade  glass
//  8,0 s   f240  la cámara se aleja: el logo era la pantalla de un    whoosh y entra el ritmo
//                teléfono; aparece el inicio de la app y se inclina
//  9,5 s   f285  toque en la baldosa del Coliseo                      click
// 10,0 s   f300  Coliseo (rojo): mapa de calor y 1RM salen de la      —
//                pantalla en 3D
// 12,0 s   f360  Ciclo Menstrual (rosa): la rueda de fases            whoosh rápido
// 14,0 s   f420  Hábitos y Rituales (menta): checks en corcheas       whoosh rápido + pops + confirm
// 16,0 s   f480  El Sabio (azul y violeta): el teléfono gira y la IA  whoosh + glass; se va el bombo
//                lo envuelve en luz; las zonas le mandan su señal
// 19,0 s   f570  el teléfono baja al centro                           redoble hacia el final
// 19,2 s   f576  «Y muchas zonas más...» en el sitio de los títulos   —
// 20,0 s   f600  «Diseña tu versión Pro.»                             impacto cinemático y vuelve el ritmo
// 21,0 s   f630  el teléfono sube de nivel                            confirm
// 21,5 s   f645  botón «Empieza ahora en NoutLife»                    pop
// 23,0 s   f690  toque en el botón, acorde final                      click + ring-out
// 24,0 s   f720  fin

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BPM = 120;
/** Fotogramas por pulso (15). */
export const BEAT = (60 / BPM) * FPS;
/** Fotograma del pulso `n` (admite corcheas: 0,5). */
export const beat = (n: number) => n * BEAT;
/** 48 pulsos = 12 compases = 24 s = 720 fotogramas. */
export const DURATION = beat(48);

/**
 * Ventanas de render de cada escena (fotogramas globales). Se solapan con la vecina
 * para que la forma que cruza el corte (el punto, el logo, el teléfono) no desaparezca.
 */
export const SEQUENCES = {
  hook: { from: 0, to: 184 },
  brand: { from: 176, to: 246 },
  device: { from: 234, to: DURATION },
  cta: { from: 596, to: DURATION },
} as const;

/** Escena 1: el gancho. */
export const HOOK = {
  /** Cada palabra cae en un pulso; la primera ya va cayendo en el fotograma 0. */
  nouns: [
    { tint: 'rutina', text: 'rutina.', at: -3 },
    { tint: 'cuerpo', text: 'cuerpo.', at: beat(2) },
    { tint: 'mente', text: 'mente.', at: beat(4) },
  ],
  /** «Tu» y la última palabra se van justo antes de «Todo». */
  out: beat(6) - 2,
  /** «Todo en un solo lugar.» en corcheas; «lugar.» cae en el compás 3. */
  phrase: [
    { text: 'Todo', at: beat(6), line: 0 },
    { text: 'en', at: beat(6.5), line: 0 },
    { text: 'un', at: beat(7), line: 0 },
    { text: 'solo', at: beat(7.5), line: 1 },
    { text: 'lugar.', at: beat(8), line: 1 },
  ],
  /** La frase se encoge hasta un punto (5,4 → 6,0 s). */
  collapse: { from: 162, to: beat(12) },
} as const;

/** Escena 2: el isotipo nace del punto. */
export const BRAND = {
  burst: beat(12), // 180
  /** Las hojas b, a y c salen con un fotograma de diferencia. */
  blades: { b: 180, a: 181, c: 182 },
  wordmark: 188,
  /** Los colores del gancho se funden en el jade de la marca. */
  tint: { from: 194, to: 214 },
  sheen: { from: 200, to: 222 },
  /** Fundido al teléfono, que en ese instante tiene el logo en la pantalla. */
  handoff: { from: 234, to: 240 },
} as const;

/** Escenas 3 y 4: el teléfono y las zonas. */
export const DEVICE = {
  pullBack: { from: beat(16), to: 268 },
  homeIn: 254,
  tilt: 258,
  tapColiseo: beat(19), // 285
} as const;

/** Cada zona: cuándo entra su pantalla (y su color) y cuándo se va. */
export const ZONE_TIMES = {
  coliseo: { from: beat(19), to: beat(24) },
  ciclo: { from: beat(24), to: beat(28) },
  habitos: { from: beat(28), to: beat(32) },
  sabio: { from: beat(32), to: 572 },
} as const;
export const ZONE_ORDER = ['coliseo', 'ciclo', 'habitos', 'sabio'] as const;
/** «Y muchas zonas más...»: aparece al irse la última zona (El Sabio) y se despide antes del titular. */
export const MORE_ZONES = { from: 576, hold: 590, gone: 598 } as const;

/** Las tarjetas bajan antes del barrido a Ciclo (f357). */
export const COLISEO = { lift: 306, drop: 342 } as const;
export const CICLO = { lift: 368, drop: 402 } as const;
/** Los cuatro checks caen en corcheas desde el pulso 29; el ritual se completa en el 31. */
export const HABITOS = { checks: [beat(29), beat(29.5), beat(30), beat(30.5)], ritual: beat(31) } as const;
export const SABIO = { ask: 492, reply: beat(33.6), lift: 512, drop: 566 } as const;

/** Escena 4: llamada a la acción. */
export const CTA = {
  move: 570,
  headline: beat(40), // 600
  levelUp: beat(42), // 630
  button: beat(43), // 645
  url: beat(44), // 660
  shimmer: 668,
  tap: beat(46), // 690
} as const;

/** Huecos para la locución (marcadores en la línea de tiempo del Studio). */
export const VO_CUES = [
  { id: 'gancho', from: 2, to: 150, text: 'Tu rutina. Tu cuerpo. Tu mente. Todo en un solo lugar.' },
  { id: 'marca', from: 184, to: 236, text: 'NoutLife.' },
  { id: 'zonas', from: 290, to: 476, text: 'Entrena en el Coliseo. Entiende tu ciclo. Suma hábitos y rituales.' },
  { id: 'sabio', from: 484, to: 590, text: 'Y El Sabio, tu consejero con IA, une todas las piezas. Y muchas zonas más...' },
  { id: 'cta', from: 600, to: 712, text: 'Diseña tu versión Pro. Empieza ahora en NoutLife.' },
] as const;

/** Efectos de sonido (archivos CC0 en public/audio/sfx, créditos en public/audio/CREDITS.md). */
export const SFX_CUES: Array<{ frame: number; file: string; volume: number; label: string }> = [
  // Escena 1: un barrido corto en cada palabra que cae y un tick por palabra de la frase
  ...HOOK.nouns.map((n) => ({ frame: Math.max(0, n.at + 2), file: 'swoosh-short.ogg', volume: 0.3, label: n.text })),
  ...HOOK.phrase.slice(0, 4).map((w) => ({ frame: Math.round(w.at), file: 'tick.ogg', volume: 0.32, label: w.text })),
  { frame: beat(8), file: 'impact-soft.ogg', volume: 0.5, label: 'lugar.' },
  // El impacto cinemático crece 1,3 s y golpea cuando nace el isotipo
  { frame: BRAND.burst - 39, file: 'impact-cinematic.ogg', volume: 0.5, label: 'nace el isotipo' },
  { frame: BRAND.sheen.from, file: 'glass.ogg', volume: 0.32, label: 'brillo del isotipo' },
  // Escena 3
  { frame: DEVICE.pullBack.from, file: 'whoosh.ogg', volume: 0.55, label: 'la cámara se aleja' },
  { frame: DEVICE.tapColiseo, file: 'click.ogg', volume: 0.5, label: 'toque: Coliseo' },
  { frame: DEVICE.tapColiseo + 2, file: 'whoosh-quick.ogg', volume: 0.4, label: 'abre el Coliseo' },
  { frame: ZONE_TIMES.ciclo.from - 3, file: 'whoosh-quick.ogg', volume: 0.6, label: 'Ciclo' },
  { frame: ZONE_TIMES.habitos.from - 3, file: 'whoosh-quick.ogg', volume: 0.6, label: 'Hábitos' },
  ...HABITOS.checks.map((frame) => ({ frame: Math.round(frame), file: 'pop.ogg', volume: 0.3, label: 'check' })),
  { frame: HABITOS.ritual, file: 'confirm.ogg', volume: 0.28, label: 'ritual completo' },
  { frame: ZONE_TIMES.sabio.from - 4, file: 'whoosh.ogg', volume: 0.5, label: 'El Sabio' },
  { frame: ZONE_TIMES.sabio.from + 4, file: 'glass.ogg', volume: 0.3, label: 'brillo de la IA' },
  { frame: SABIO.ask, file: 'pop.ogg', volume: 0.22, label: 'pregunta' },
  // El segundo impacto cinemático golpea con el titular
  { frame: CTA.headline - 39, file: 'impact-cinematic.ogg', volume: 0.45, label: 'llamada a la acción' },
  { frame: Math.round(CTA.headline + 22.5), file: 'glass.ogg', volume: 0.32, label: '«Pro.»' },
  { frame: CTA.levelUp, file: 'confirm.ogg', volume: 0.3, label: 'sube de nivel' },
  { frame: CTA.button, file: 'pop.ogg', volume: 0.42, label: 'botón' },
  { frame: CTA.tap, file: 'click.ogg', volume: 0.7, label: 'toque' },
  { frame: CTA.tap, file: 'ring-out.ogg', volume: 0.3, label: 'final' },
];
