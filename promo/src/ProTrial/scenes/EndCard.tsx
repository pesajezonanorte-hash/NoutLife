// Cierre (13–15 s): fundido a negro y, en el centro, el logo de NoutLife: el isotipo se
// enfoca y se posa con un contraluz jade muy tenue, «Noutlife» entra letra a letra y
// debajo queda la dirección de la app.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, SPRING, rgba } from '../../Video/theme';
import { EASE, clamp, lerp, ramp, springAt } from '../../Video/lib/anim';
import { MARK_SIZE, NoutLifeMark, Wordmark } from '../../Video/components/Brand';
import { AD, AD_SPRING } from '../brand';
import { END, SEQUENCES } from '../timeline';

const MARK_H = 176;
const WORDMARK_W = 400;
const CENTER_Y = 900;
const URL = 'noutlife.vercel.app';

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.end.from;
  const black = ramp(frame, END.fade.from, END.fade.to, EASE.inOut);
  const mark = springAt(frame, END.logo, AD_SPRING.settle);
  const glow = ramp(frame, END.logo, END.logo + 26, EASE.out);
  const url = springAt(frame, END.url, SPRING.smooth, 16);
  const markW = (MARK_H * MARK_SIZE.w) / MARK_SIZE.h;
  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(0, 0, 0, ${black})` }}>
      <div
        style={{
          position: 'absolute',
          left: 540 - 420,
          top: CENTER_Y - 120 - 420,
          width: 840,
          height: 840,
          borderRadius: '50%',
          background: `radial-gradient(circle closest-side, ${rgba(COLORS.jade, 0.16 * glow)} 0%, ${rgba('#1a5547', 0.06 * glow)} 60%, transparent 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 540 - markW / 2,
          top: CENTER_Y - 120 - MARK_H / 2,
          transform: `scale(${lerp(0.9, 1, mark)})`,
          opacity: clamp(mark * 1.4),
          filter: mark < 0.97 ? `blur(${(1 - mark) * 10}px)` : undefined,
        }}
      >
        <NoutLifeMark height={MARK_H} />
      </div>
      <div style={{ position: 'absolute', left: 540 - WORDMARK_W / 2, top: CENTER_Y + 22 }}>
        <Wordmark width={WORDMARK_W} progress={(i) => springAt(frame, END.logo + 5 + i * 1.8, SPRING.smooth, 18)} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: CENTER_Y + 150,
          textAlign: 'center',
          fontWeight: 500,
          fontSize: 30,
          letterSpacing: '0.08em',
          color: AD.inkMuted,
          opacity: url,
          transform: `translateY(${(1 - url) * 12}px)`,
        }}
      >
        {URL}
      </div>
    </AbsoluteFill>
  );
};
