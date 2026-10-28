// Guion del anuncio «Modo Pro» en fotogramas: 15 s a 30 fps sobre una rejilla de 120 BPM
// (1 pulso = 15 f). Los tres actos del brief caen en pulsos: el teléfono en el 6 (3 s),
// la oferta en el 16 (8 s) y el fundido a negro en el 26 (13 s).
// scripts/build-music-keynote.mjs usa los mismos tiempos para la música.
//
// Hoja (segundo · fotograma · qué pasa · sonido)
//  0,1 s  f4    «¿Y si tu vida real» sube 18 px y aparece             pad y una nota
//  0,3 s  f10   «tuviera un modo Pro?»                               nota
//  0–3 s        la cámara empuja de 1 a 1,05, sin parar
//  1,5 s  f45   «Pro» pasa a oro champán, con un brillo que lo cruza  campana
//  2,8 s  f84   el texto se desenfoca y se va (cambio de foco)
//  3,0 s  f90   la cámara retrocede; el teléfono sale del centro      golpe sub suave; entra el pulso
//               girando hasta quedar a 3° en Y
//  3,9 s  f118  se abre el menú (la hoja de la app)                   swoosh
//  4,4 s  f133  Recreación y Coliseo salen de la pantalla como        aire
//               tarjetas de cristal (arriba a la derecha y abajo a la izquierda)
//  5,0 s  f150  deriva lenta de la cámara (acercamiento y paneo)
//  5,5 s  f165  un haz jade baja por la escena: cada candado se abre  una campana por zona
//               a su paso y las tarjetas pasan a «Desbloqueada»
//  6,8 s  f205  todo abierto
//  7,6 s  f228  las tarjetas se van
//  8,0 s  f240  se cierra el menú: la cabecera ya dice «Pro · día 1   aire
//               de 7»; el teléfono sube y la tarjeta de cristal se
//               funde con su base
//  9,0 s  f270  «7 DÍAS DE PRO.» / «GRATIS.»                         acorde
//  9,6 s  f288  «Sin tarjeta de crédito.»
// 10,0 s  f300  la letra pequeña
// 10,5 s  f315  el botón «Empieza ahora»                             campana suave
// 12,9 s  f386  fundido a negro
// 13,5 s  f406  el logo de NoutLife, ya sobre negro                  tres campanas
// 15,0 s  f450  fin

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BPM = 120;
/** Fotogramas por pulso (15). */
export const BEAT = (60 / BPM) * FPS;
export const beat = (n: number) => n * BEAT;
/** 30 pulsos = 15 s = 450 fotogramas. */
export const DURATION = beat(30);

/** Ventanas de render de cada capa (fotogramas globales), con unos fotogramas de solape. */
export const SEQUENCES = {
  hook: { from: 0, to: 104 },
  device: { from: 86, to: 410 },
  offer: { from: 246, to: 410 },
  end: { from: 382, to: DURATION },
} as const;

/** Escena 1: el gancho. */
export const HOOK = {
  /** Cada línea sube y aparece en `lineFrames`. */
  lines: [4, 10],
  lineFrames: 26,
  /** «Pro» pasa de blanco a oro, y un brillo lo cruza una vez. */
  pro: { from: beat(3), to: beat(3) + 24 },
  sheen: { from: 52, to: 82 },
  /** Empuje continuo de la cámara: 1 → 1,05 en los 3 s. */
  zoom: { to: beat(6), scale: 1.05 },
  /** Cambio de foco: el texto se desenfoca y se apaga mientras la cámara retrocede. */
  exit: { from: 84, to: 100 },
} as const;

/** Escena 2: el teléfono y el desbloqueo. */
export const REVEAL = {
  pullBack: beat(6),
  phoneIn: beat(6),
  sheetUp: 118,
  callouts: { recreacion: 133, coliseo: 139 },
  /** El haz recorre el teléfono de arriba abajo. */
  beam: { from: beat(11), to: beat(11) + 40 },
  /** Deriva lenta de la cámara mientras todo está abierto. */
  drift: { from: 150, to: beat(16) },
} as const;
export type CalloutId = keyof typeof REVEAL.callouts;

/** Escena 3: la oferta. */
export const OFFER = {
  calloutsOut: 228,
  sheetDown: beat(16),
  rise: 242,
  card: 252,
  headline: [beat(18), beat(18) + 5],
  noCard: 288,
  fine: beat(20),
  button: beat(21),
} as const;

/** Cierre: fundido a negro y, ya en negro, el logo. */
export const END = {
  fade: { from: 386, to: 406 },
  logo: 406,
  url: 418,
} as const;

/**
 * Huecos para una locución opcional (marcadores en el Studio). Repiten lo que dice la
 * pantalla; la letra pequeña no se locuta.
 */
export const VO_CUES = [
  { id: 'gancho', from: 4, to: 84, text: '¿Y si tu vida real tuviera un modo Pro?' },
  { id: 'zonas', from: 133, to: 222, text: 'Coliseo, Recreación y todas tus zonas Pro, abiertas.' },
  { id: 'oferta', from: 270, to: 386, text: 'Siete días de Pro, gratis. Sin tarjeta de crédito. Empieza ahora.' },
] as const;

/** Efectos (CC0, public/audio/sfx): pocos y bajos, la música lleva el peso. */
export const SFX_CUES: Array<{ frame: number; file: string; volume: number; label: string }> = [
  { frame: HOOK.pro.from, file: 'glass.ogg', volume: 0.22, label: '«Pro» en oro' },
  { frame: REVEAL.pullBack - 4, file: 'whoosh.ogg', volume: 0.2, label: 'la cámara retrocede' },
  { frame: REVEAL.sheetUp, file: 'swoosh-short.ogg', volume: 0.16, label: 'se abre el menú' },
  { frame: REVEAL.callouts.recreacion, file: 'whoosh-quick.ogg', volume: 0.14, label: 'salen las tarjetas' },
  { frame: OFFER.sheetDown, file: 'whoosh.ogg', volume: 0.16, label: 'sube el teléfono' },
  { frame: END.logo, file: 'glass.ogg', volume: 0.16, label: 'logo' },
];
