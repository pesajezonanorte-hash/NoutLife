// Cierre (13–15 s): fundido limpio a negro y, en el centro, el logo de NoutLife (isotipo
// sobre el logotipo), que aparece con un fundido y se asienta un 1,5 %. Debajo, la
// dirección de la app en Light.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lerp, ramp } from '../../Video/lib/anim';
import { MARK_SIZE, NoutLifeMark, WORDMARK_BOX, Wordmark } from '../../Video/components/Brand';
import { usePalette } from '../palette';
import { EASE } from '../motion';
import { COPY } from '../copy';
import { OutlineText } from '../type/OutlineText';
import { SUBPIXEL } from '../subpixel';
import { END, SEQUENCES } from '../timeline';

const MARK_H = 150;
const WORDMARK_W = 372;
const GAP = 46;
const CENTER_Y = 905;

export const EndScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.end.from;
  const palette = usePalette();
  const black = ramp(frame, END.fade.from, END.fade.to, EASE.inOut);
  const logo = ramp(frame, END.logo, END.logo + 26, EASE.inOut);
  const settle = ramp(frame, END.logo, END.logo + 44, EASE.text);
  const url = ramp(frame, END.url, END.url + 22, EASE.inOut);
  const markW = (MARK_H * MARK_SIZE.w) / MARK_SIZE.h;
  const wordH = (WORDMARK_W * WORDMARK_BOX.h) / WORDMARK_BOX.w;
  const top = CENTER_Y - (MARK_H + GAP + wordH) / 2;
  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(0, 0, 0, ${black})` }}>
      {logo > 0 && (
        <AbsoluteFill style={{ opacity: logo, transform: `scale(${lerp(0.985, 1, settle)}) ${SUBPIXEL}`, transformOrigin: `540px ${CENTER_Y}px` }}>
          <div style={{ position: 'absolute', left: 540 - markW / 2, top }}>
            <NoutLifeMark height={MARK_H} />
          </div>
          <div style={{ position: 'absolute', left: 540 - WORDMARK_W / 2, top: top + MARK_H + GAP }}>
            <Wordmark width={WORDMARK_W} />
          </div>
        </AbsoluteFill>
      )}
      {url > 0 && <OutlineText line={COPY.end.url[0]} size={28} tracking={0.02} x={540} y={top + MARK_H + GAP + wordH + 92} color={palette.inkMuted} style={{ opacity: url }} />}
    </AbsoluteFill>
  );
};
