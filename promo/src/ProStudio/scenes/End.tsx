// Cierre: con la cámara ya quieta y tras el silencio, la tarjeta se va y en el centro del
// papel crema queda el logo de NoutLife en sus colores para fondo claro (noutlife-mark.svg
// y el logotipo #0e1d16 de noutlife-logo-horizontal.svg). Entra con un fundido, se asienta
// un 1,5 % y una sola luz recorre las hojas del isotipo. Debajo, la dirección de la app.
import type React from 'react';
import { lerp, ramp } from '../../Video/lib/anim';
import { MARK_SIZE, NoutLifeMark, WORDMARK_BOX, Wordmark } from '../../Video/components/Brand';
import { LOGO_GRADIENTS_ON_LIGHT, WORDMARK_ON_LIGHT } from '../../Video/theme';
import { AD } from '../palette';
import { EASE } from '../motion';
import { END } from '../timeline';
import { COPY } from '../copy';
import { OutlineText } from '../type/OutlineText';

const MARK_H = 132;
const WORDMARK_W = 340;
const GAP = 42;
const CENTER_Y = 900;

export const End: React.FC<{ frame: number }> = ({ frame }) => {
  const logo = ramp(frame, END.logo, END.logo + 20, EASE.inOut);
  if (logo <= 0) return null;
  const settle = ramp(frame, END.logo, END.logo + 40, EASE.text);
  const sheen = ramp(frame, END.logo + 6, END.logo + 28, EASE.inOut);
  const url = ramp(frame, END.url, END.url + 16, EASE.inOut);
  const markW = (MARK_H * MARK_SIZE.w) / MARK_SIZE.h;
  const wordH = (WORDMARK_W * WORDMARK_BOX.h) / WORDMARK_BOX.w;
  const top = CENTER_Y - (MARK_H + GAP + wordH) / 2;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: logo, transform: `scale(${lerp(0.985, 1, settle)})`, transformOrigin: `540px ${CENTER_Y}px` }}>
        <div style={{ position: 'absolute', left: 540 - markW / 2, top }}>
          <NoutLifeMark height={MARK_H} gradients={LOGO_GRADIENTS_ON_LIGHT} sheen={sheen > 0 && sheen < 1 ? sheen : null} />
        </div>
        <div style={{ position: 'absolute', left: 540 - WORDMARK_W / 2, top: top + MARK_H + GAP }}>
          <Wordmark width={WORDMARK_W} color={WORDMARK_ON_LIGHT} />
        </div>
      </div>
      {url > 0 && <OutlineText line={COPY.end.url[0]} size={28} tracking={0.02} x={540} y={top + MARK_H + GAP + wordH + 86} color={AD.mutedOnPaper} style={{ opacity: url }} />}
    </>
  );
};
