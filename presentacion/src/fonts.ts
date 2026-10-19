// Las fuentes de NoutLife, incrustadas en public/fonts (SIL OFL): Montserrat para
// todo y JetBrains Mono para código y cifras. loadFont() retiene el render hasta
// que cargan, así que nunca cae en una fuente del sistema ni depende de internet
// (el salón puede no tener wifi).
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const fontsReady = Promise.all([
  loadFont({ family: 'Montserrat', url: staticFile('fonts/Montserrat-Variable.woff2'), weight: '100 900' }),
  loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/JetBrainsMono-Variable.woff2'), weight: '100 800' }),
]);
