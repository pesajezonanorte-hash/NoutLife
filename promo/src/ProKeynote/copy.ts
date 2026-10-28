// Los textos del anuncio (copy.json) con su tipo. copy.json es también la entrada de
// scripts/build-keynote-type.mjs, que compone sus contornos: al cambiar un texto hay que
// volver a ejecutar `npm run type:pro-keynote`.
import raw from './copy.json';
import type { Line } from './type/OutlineText';

/** Un bloque son líneas; cada línea, tramos { t, w, role? }. */
type Block = Line[];

export const COPY = raw as unknown as {
  hook: Block;
  callout: { coliseo: Block; recreacion: Block; locked: Block; unlocked: Block };
  offer: { headline: Block; noCard: Block; fine: Block; button: Block };
  end: { url: Block };
};
