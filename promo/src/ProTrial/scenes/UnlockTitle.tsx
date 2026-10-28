// Titular de la escena 2, en el tercio superior (como pide el plan para los vídeos sin
// sonido): «NOUTLIFE PRO» en oro, «Todas tus zonas,» en Light y, cuando se abre la
// última zona, «desbloqueadas.» en jade. Se va hacia arriba cuando sube el teléfono.
import type React from 'react';
import { Gem } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, ramp, springAt } from '../../Video/lib/anim';
import { AD, AD_SPRING, goldText, jadeText } from '../brand';
import { Reveal } from '../components/Reveal';
import { OFFER, SEQUENCES, UNLOCK } from '../timeline';

export const UnlockTitle: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.unlockTitle.from;
  const kicker = springAt(frame, UNLOCK.title[0].at - 6, AD_SPRING.settle);
  const exit = ramp(frame, OFFER.rise - 8, OFFER.rise + 8, EASE.in);
  return (
    <AbsoluteFill
      style={{
        transform: `translateY(${-70 * exit}px)`,
        opacity: 1 - exit,
        filter: exit > 0.02 ? `blur(${8 * exit}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 236,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: '0.32em',
          opacity: kicker,
          transform: `translateY(${(1 - kicker) * 16}px)`,
        }}
      >
        <Gem size={28} color={AD.goldLight} strokeWidth={2} />
        <span style={{ ...goldText(90), paddingLeft: '0.32em' }}>NOUTLIFE PRO</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 284 }}>
        <Reveal frame={frame} at={UNLOCK.title[0].at} style={{ fontWeight: 300, fontSize: 66, lineHeight: 1.2, color: AD.inkSoft }}>
          {UNLOCK.title[0].text}
        </Reveal>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 362 }}>
        <Reveal frame={frame} at={UNLOCK.title[1].at} tracking={-0.03} style={{ fontWeight: 900, fontSize: 94, lineHeight: 1.1 }}>
          <span style={jadeText(100)}>{UNLOCK.title[1].text}</span>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
