// Guion del vídeo en fotogramas: 30 fps sobre una rejilla de 120 BPM, así que
// 1 pulso = 0,5 s = 15 fotogramas y 1 compás = 2 s = 60 fotogramas. Los cortes
// grandes caen en pulsos y la tipografía en corcheas (7,5 fotogramas).
// scripts/build-music.mjs usa los mismos tiempos para la música.
//
// Hoja de pulsos (segundo · fotograma · qué pasa · sonido)
//  0,0 s   f0    Escena 1: lista gris, partículas y destello         pad en La menor
//  0,3 s   f8    «Tu vida no es una lista de tareas aburrida.»       tick por palabra
//  2,0 s   f61   sube la tensión hacia la marca                      riser
//  2,8 s   f84   un trazo jade tacha «aburrida»                      swoosh
//  3,2 s   f96   la cámara entra en el punto final                   —
//  4,0 s   f120  Escena 2: el punto es luz y arma el isotipo         impacto suave + sub
//  4,5 s   f134  «Noutlife» letra a letra                            glass
//  5,0 s   f150  «Evoluciona en todas tus áreas con NoutLife.»       —
//  7,7 s   f230  el punto de la «i» se suelta y se vuelve el nodo    —
//  8,0 s   f240  Escena 3: Coliseo (entra el ritmo)                  whoosh
// 10,0 s   f300  Ciclo Menstrual                                     whoosh
// 12,0 s   f360  Hábitos y Rituales: checks de tinta en corcheas     whoosh + pops + confirm
// 14,0 s   f420  El Sabio: ondas de luz                              whoosh
// 16,0 s   f480  ecosistema: las cuatro zonas unidas al nodo         swoosh + impacto (crece)
// 18,0 s   f540  Escena 4: todo entra al teléfono                    golpe del impacto
// 19,0 s   f572  sube de nivel                                       confirm
// 20,0 s   f600  «Toma el control de tu leyenda personal.»           —
// 21,5 s   f645  botón «Empieza gratis en NoutLife Lite»             pop
// 23,5 s   f705  toque en el botón, acorde final                     click + ring-out
// 25,0 s   f750  fin

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BPM = 120;
/** Fotogramas por pulso (15). */
export const BEAT = (60 / BPM) * FPS;
export const beat = (n: number) => Math.round(n * BEAT);
/** 50 pulsos = 25 s = 750 fotogramas. */
export const DURATION = beat(50);

/** Escenas del guion (inicio y fin, en fotogramas globales). */
export const SCENES = {
  hook: { from: 0, to: beat(8) },
  brand: { from: beat(8), to: beat(16) },
  zones: { from: beat(16), to: beat(36) },
  cta: { from: beat(36), to: DURATION },
} as const;

/**
 * Ventanas de render de cada escena: se solapan unos fotogramas con la vecina para
 * que la forma que cruza el corte (el punto, el nodo, las tarjetas) nunca desaparezca.
 */
export const SEQUENCES = {
  hook: { from: 0, to: 122 },
  brand: { from: 118, to: 252 },
  zones: { from: 228, to: 566 },
  cta: { from: 530, to: DURATION },
} as const;

/** Tarjetas de la escena 3: cuándo entran y cuándo salen (fotogramas globales). */
export const CARD_TIMES = {
  coliseo: { enter: 238, exit: 300 },
  ciclo: { enter: 300, exit: 360 },
  habitos: { enter: 360, exit: 420 },
  sabio: { enter: 420, exit: 480 },
} as const;
export type CardId = keyof typeof CARD_TIMES;
export const CARD_ORDER: CardId[] = ['coliseo', 'ciclo', 'habitos', 'sabio'];

/** Ecosistema: las cuatro tarjetas vuelven en pequeño alrededor del nodo. */
export const ECOSYSTEM = { from: 480, gather: 528, to: 566 } as const;

/** Escena 4 (CTA). */
export const CTA = {
  phoneIn: 540,
  levelUp: 572,
  poseB: 598,
  headline: 600,
  button: beat(43), // 645
  url: 660,
  tap: beat(47), // 705
} as const;

/** Huecos para la locución (marcadores en la línea de tiempo del Studio). */
export const VO_CUES = [
  { id: 'hook', from: 6, to: 112, text: 'Tu vida no es una lista de tareas aburrida.' },
  { id: 'marca', from: 148, to: 232, text: 'Evoluciona en todas tus áreas con NoutLife.' },
  { id: 'zonas', from: 246, to: 530, text: 'Entrena en el Coliseo. Entiende tu ciclo. Cumple tus hábitos y rituales. Y deja que El Sabio lo conecte todo.' },
  { id: 'cta', from: 600, to: 742, text: 'Toma el control de tu leyenda personal. Empieza gratis en NoutLife Lite.' },
] as const;

/** Efectos de sonido (archivos CC0 en public/audio/sfx, créditos en public/audio/CREDITS.md). */
export const SFX_CUES: Array<{ frame: number; file: string; volume: number; label: string }> = [
  // Escena 1: un tick discreto por palabra del gancho
  ...[8, 15, 23, 30, 38, 45, 53, 60, 75].map((frame, i) => ({ frame, file: 'tick.ogg', volume: i === 8 ? 0.5 : 0.28, label: 'palabra' })),
  { frame: 61, file: 'riser.ogg', volume: 0.42, label: 'riser a la marca' },
  { frame: 84, file: 'swoosh-short.ogg', volume: 0.22, label: 'tachado' },
  // Escena 2
  { frame: 118, file: 'impact-soft.ogg', volume: 0.5, label: 'la luz se abre' },
  { frame: 136, file: 'glass.ogg', volume: 0.35, label: 'brillo del isotipo' },
  // Escena 3: un whoosh por tarjeta
  { frame: 236, file: 'whoosh.ogg', volume: 0.62, label: 'Coliseo' },
  { frame: 298, file: 'whoosh-quick.ogg', volume: 0.66, label: 'Ciclo' },
  { frame: 358, file: 'whoosh.ogg', volume: 0.62, label: 'Hábitos' },
  ...[378, 386, 394, 402].map((frame) => ({ frame, file: 'pop.ogg', volume: 0.32, label: 'check' })),
  { frame: 404, file: 'confirm.ogg', volume: 0.3, label: 'ritual completo' },
  { frame: 418, file: 'whoosh-quick.ogg', volume: 0.66, label: 'El Sabio' },
  { frame: 478, file: 'swoosh-short.ogg', volume: 0.2, label: 'ecosistema' },
  // El impacto cinemático crece 1,3 s y golpea justo en el corte a la escena 4
  { frame: 501, file: 'impact-cinematic.ogg', volume: 0.55, label: 'al teléfono' },
  // Escena 4
  { frame: CTA.levelUp, file: 'confirm.ogg', volume: 0.32, label: 'sube de nivel' },
  { frame: CTA.button, file: 'pop.ogg', volume: 0.45, label: 'botón' },
  { frame: CTA.tap, file: 'click.ogg', volume: 0.7, label: 'toque' },
  { frame: CTA.tap, file: 'ring-out.ogg', volume: 0.32, label: 'final' },
];
