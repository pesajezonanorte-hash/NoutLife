// Guion del anuncio «7 días de Pro» en fotogramas: 15 s a 30 fps sobre una rejilla de
// 120 BPM (1 pulso = 15 f, 1 compás = 60 f). Los tres actos del brief caen en pulsos:
// el teléfono entra en el 6 (3 s), la oferta en el 16 (8 s, compás 4) y el final en el 30.
// scripts/build-music-pro-trial.mjs usa los mismos tiempos para la música.
//
// Hoja (segundo · fotograma · qué pasa · sonido)
//  0,1 s  f3    «¿Y si tu vida real» se abre desde el centro          pad y una nota
//  0,4 s  f12   «tuviera un»                                          nota
//  0,7 s  f22   «modo Pro?» en Black, con rebote elástico             golpe suave
//  1,5 s  f45   corte a plano corto (fundido cruzado de 3 f)          whoosh rápido
//  2,0 s  f60   «modo Pro» parpadea en oro champán                    glass y campanas
//  2,4 s  f72   zoom out: el fondo absorbe la malla de luz dorada     barrido hacia el golpe
//  3,0 s  f90   el teléfono entra desde abajo con inercia             golpe sub; entra el ritmo
//  3,3 s  f100  los anillos dorados empiezan a girar
//  3,5 s  f105  «Todas tus zonas,»
//  4,0 s  f120  un haz jade abre el Coliseo                           click y campana
//  4,5 s  f135  Recreación                                            click y campana
//  5,0 s  f150  Analíticas; «desbloqueadas.»                          click y campana
//  5,5 s  f165  hábitos: «Ilimitados» y la barra se llena             pop
//  6,0 s  f180  la racha se enciende y su tarjeta sale del teléfono   confirm y acorde
//  6,5 s  f195  el teléfono gira 18° en Y (un 5 % de vuelta)
//  7,0 s  f210  la pantalla se transforma en el panel de Pro          whoosh rápido; barrido
//  8,0 s  f240  el teléfono sube y los anillos se van                 whoosh; medio tiempo
//  8,3 s  f250  la tarjeta de cristal
//  8,6 s  f258  la cinta de 7 días se llena                           ticks
//  9,0 s  f270  «7 DÍAS DE PRO.»                                      golpe suave
//  9,5 s  f285  «GRATIS.»                                             glass
// 10,0 s  f300  «Sin tarjeta de crédito.»                             vuelve el ritmo
// 10,5 s  f315  la letra pequeña
// 11,0 s  f330  botón «Empieza ahora con 1 clic»                      pop
// 12,5 s  f375  toque en el botón                                     click y acorde final
// 13,0 s  f390  fundido a negro
// 13,4 s  f402  el logo de NoutLife                                   glass
// 15,0 s  f450  fin

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const BPM = 120;
/** Fotogramas por pulso (15). */
export const BEAT = (60 / BPM) * FPS;
/** Fotograma del pulso `n` (admite fracciones). */
export const beat = (n: number) => n * BEAT;
/** 30 pulsos = 15 s = 450 fotogramas. */
export const DURATION = beat(30);

/**
 * Ventanas de render de cada capa (fotogramas globales). Se solapan unos fotogramas
 * para que lo que cruza un corte (el zoom out, el teléfono) no desaparezca de golpe.
 */
export const SEQUENCES = {
  hook: { from: 0, to: 104 },
  device: { from: 84, to: 412 },
  unlockTitle: { from: 96, to: 250 },
  offer: { from: 236, to: 412 },
  end: { from: 384, to: DURATION },
} as const;

/** Escena 1: el gancho. */
export const HOOK = {
  lines: [
    { text: '¿Y si tu vida real', at: 3 },
    { text: 'tuviera un', at: 12 },
  ],
  /** «modo Pro?» */
  payoff: 22,
  /** Corte a plano corto sobre «modo Pro?», con un fundido cruzado de 3 fotogramas. */
  cut: 45,
  /** «modo Pro» parpadea y se queda en oro. */
  flicker: beat(4), // 60
  /** Zoom out rápido hacia atrás. */
  zoomOut: { from: 72, to: 98 },
  /** La malla de partículas doradas que el fondo absorbe. */
  mesh: { from: 62, to: 104 },
} as const;

/** Escena 2: el teléfono entra y las zonas Pro se desbloquean. */
export const UNLOCK = {
  phoneIn: beat(6), // 90
  rings: { in: 100, out: beat(16) },
  title: [
    { text: 'Todas tus zonas,', at: beat(7) }, // 105
    { text: 'desbloqueadas.', at: beat(10) }, // 150
  ],
  /** Cada zona se abre en un pulso, con el haz jade unos fotogramas antes. */
  zones: { coliseo: beat(8), recreacion: beat(9), analiticas: beat(10) }, // 120, 135, 150
  habits: beat(11), // 165
  streak: beat(12), // 180
  turn: beat(13), // 195
  morph: { from: beat(14), to: 236 }, // 210
} as const;
export type UnlockZone = keyof typeof UNLOCK.zones;

/** Escena 3: la oferta y la llamada a la acción. */
export const OFFER = {
  rise: beat(16), // 240
  card: 250,
  /** Siete segmentos, uno cada 3 fotogramas. */
  ribbon: 258,
  headline: [beat(18), beat(19)], // 270, 285
  noCard: beat(20), // 300
  fine: beat(21), // 315
  button: beat(22), // 330
  shimmer: beat(23), // 345
  tap: beat(25), // 375
} as const;

/** Cierre: fundido a negro y logo. */
export const END = {
  fade: { from: beat(26), to: 408 },
  logo: 402,
  url: beat(28), // 420
} as const;

/**
 * Huecos para la locución (marcadores en la línea de tiempo del Studio). El gancho
 * dice «tuviera» y no «se sintiera como jugar»: los videojuegos nunca son el gancho de
 * la marca. La prueba es una por persona, así que la frase de Lite lo aclara.
 */
export const VO_CUES = [
  { id: 'gancho', from: 3, to: 84, text: '¿Y si organizar tu día tuviera un modo Pro?' },
  { id: 'zonas', from: 104, to: 226, text: 'Desbloquea el poder de todas tus zonas conectadas. Sin límites.' },
  {
    id: 'oferta',
    from: 246,
    to: 444,
    text: 'Disfruta de 7 días de Pro completamente gratis. Sin tarjeta. Para cuentas nuevas y cuentas Lite que aún no lo han probado. Empieza hoy en NoutLife.',
  },
] as const;

/** Efectos de sonido (archivos CC0 en public/audio/sfx, créditos en public/audio/CREDITS.md). */
export const SFX_CUES: Array<{ frame: number; file: string; volume: number; label: string }> = [
  // Escena 1
  { frame: HOOK.lines[0].at, file: 'swoosh-short.ogg', volume: 0.18, label: HOOK.lines[0].text },
  { frame: HOOK.payoff, file: 'impact-soft.ogg', volume: 0.42, label: '«modo Pro?»' },
  { frame: HOOK.cut - 2, file: 'whoosh-quick.ogg', volume: 0.32, label: 'corte a plano corto' },
  { frame: HOOK.flicker, file: 'glass.ogg', volume: 0.36, label: 'parpadeo dorado' },
  { frame: HOOK.zoomOut.from, file: 'whoosh.ogg', volume: 0.5, label: 'zoom out' },
  // Escena 2
  { frame: UNLOCK.phoneIn, file: 'impact-soft.ogg', volume: 0.5, label: 'entra el teléfono' },
  ...Object.entries(UNLOCK.zones).map(([zone, frame]) => ({ frame, file: 'click.ogg', volume: 0.42, label: `se abre ${zone}` })),
  { frame: UNLOCK.habits, file: 'pop.ogg', volume: 0.3, label: 'hábitos ilimitados' },
  { frame: UNLOCK.streak, file: 'confirm.ogg', volume: 0.3, label: 'la racha se enciende' },
  { frame: UNLOCK.morph.from, file: 'whoosh-quick.ogg', volume: 0.42, label: 'panel de Pro' },
  // Escena 3
  { frame: OFFER.rise, file: 'whoosh.ogg', volume: 0.4, label: 'sube el teléfono' },
  ...Array.from({ length: 7 }, (_, i) => ({ frame: OFFER.ribbon + i * 3, file: 'tick.ogg', volume: 0.16 + i * 0.02, label: `día ${i + 1}` })),
  { frame: OFFER.headline[0], file: 'impact-soft.ogg', volume: 0.42, label: '«7 DÍAS DE PRO.»' },
  { frame: OFFER.headline[1], file: 'glass.ogg', volume: 0.34, label: '«GRATIS.»' },
  { frame: OFFER.button, file: 'pop.ogg', volume: 0.4, label: 'botón' },
  { frame: OFFER.tap, file: 'click.ogg', volume: 0.7, label: 'toque' },
  { frame: END.logo, file: 'glass.ogg', volume: 0.22, label: 'logo' },
];
