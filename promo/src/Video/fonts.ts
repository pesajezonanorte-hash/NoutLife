// Fuentes de la app incrustadas en public/fonts (SIL OFL): Montserrat para todo,
// JetBrains Mono para cifras y etiquetas, EB Garamond itálica para la voz de El Sabio.
// loadFont() retiene cada fotograma hasta que la fuente carga, así que el render
// nunca cae en una fuente del sistema ni depende de la red.
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const fontsReady = Promise.all([
  loadFont({ family: 'Montserrat', url: staticFile('fonts/Montserrat-Variable.woff2'), weight: '100 900' }),
  loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/JetBrainsMono-Variable.woff2'), weight: '100 800' }),
  loadFont({ family: 'EB Garamond', url: staticFile('fonts/EBGaramond-Italic-Variable.woff2'), weight: '400 800', style: 'italic' }),
]);
