// Paleta del anuncio fuera del teléfono: todo va sobre papel crema #FAF6F0 liso (sin viñetas
// ni cambios de fondo en todo el anuncio) con texto negro #111111, como los anuncios claros
// de Apple. El acento es el jade #10b981 del brief, con oro champán (el de la app, #d4b483,
// el mismo del candado NavLock y de Pro). Dentro del teléfono la app se ve en su modo oscuro
// con sus tokens reales (Aurora), que no usan ese jade: contraste de estudio.
export const AD = {
  jade: '#10b981',
  jadeBright: '#34d399',
  gold: '#d4b483',

  /** Papel: el blanco cálido de todo el anuncio. */
  paper: '#faf6f0',
  /** Texto sobre el papel: negro (#111111, contraste 17:1), gris cálido para la letra pequeña y un jade que se lee (#059669, 3,6:1; el #10b981 da 2,5:1). */
  inkOnPaper: '#111111',
  mutedOnPaper: '#6b645b',
  jadeOnPaper: '#059669',
  /**
   * El oro champán de «Pro» como tinta sobre el papel y el cristal: hondo de punta a punta
   * (de 8,7:1 a 4,3:1) para que la palabra se lea sólida; con un oro claro (#c39f63, 2,4:1)
   * su final parecía a medio aparecer. El #d4b483 de la app da 1,8:1.
   */
  goldOnPaper: ['#5e4520', '#7d5d2e', '#94733f'],
} as const;
