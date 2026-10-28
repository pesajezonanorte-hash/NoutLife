// Escena 3 (8–13 s): la oferta. Mientras el teléfono sube, una tarjeta de cristal se
// materializa sobre su base: el teléfono se funde con ella y su pantalla se ve
// desenfocada a través del cristal. Encima, quieto una vez dentro, el texto:
// «7 DÍAS DE PRO.» / «GRATIS.» (Bold, «PRO.» en oro champán como el «Pro» del gancho),
// «Sin tarjeta de crédito.» en jade, la letra pequeña en Light y el botón.
// Cada pieza entra con un fundido y 16 px de subida; luego nada se mueve.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lerp, ramp } from '../../Video/lib/anim';
import { usePalette } from '../palette';
import { EASE, KEY_SPRING, softSpring } from '../motion';
import { COPY } from '../copy';
import { OutlineText } from '../type/OutlineText';
import { GlassPanel } from '../components/GlassPanel';
import { CtaButton } from '../components/CtaButton';
import { ChampagneGradient } from '../components/ChampagneGradient';
import { SUBPIXEL } from '../subpixel';
import { OFFER, SEQUENCES } from '../timeline';

/** La tarjeta (px del lienzo): centrada y dentro de la zona segura de las redes. */
export const CARD = { x: 132, y: 812, w: 816, h: 588, radius: 48 };
const BUTTON = { w: 520, h: 104, top: 420 };
const RISE = 16;

export const OfferScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.offer.from;
  const palette = usePalette();
  const card = softSpring(frame, OFFER.card, KEY_SPRING.glass, 6);
  const enter = (at: number): React.CSSProperties => {
    const p = ramp(frame, at, at + 22, EASE.text);
    return { opacity: p, transform: `translateY(${lerp(RISE, 0, p)}px)` };
  };
  const cx = CARD.w / 2;
  return (
    <AbsoluteFill>
      <GlassPanel
        width={CARD.w}
        height={CARD.h}
        radius={CARD.radius}
        presence={card}
        shadow={false}
        style={{ left: CARD.x, top: CARD.y, transform: `translateY(${(1 - card) * 44}px) ${SUBPIXEL}` }}
      >
        {COPY.offer.headline.map((line, i) => (
          <OutlineText
            key={i}
            line={line}
            size={80}
            tracking={0.01}
            x={cx}
            y={120 + i * 86}
            color={palette.ink}
            style={enter(OFFER.headline[i])}
            fill={(run, id) => (run.run.role === 'pro' ? `url(#${id}-gold)` : undefined)}
            defs={(layout, id) => <ChampagneGradient id={`${id}-gold`} capHeight={layout.capHeight} />}
          />
        ))}
        <OutlineText line={COPY.offer.noCard[0]} size={40} x={cx} y={280} color={palette.jade} style={enter(OFFER.noCard)} />
        {COPY.offer.fine.map((line, i) => (
          <OutlineText key={i} line={line} size={28} x={cx} y={336 + i * 40} color={palette.inkMuted} style={enter(OFFER.fine)} />
        ))}
        <div style={{ position: 'absolute', left: (CARD.w - BUTTON.w) / 2, top: BUTTON.top, ...enter(OFFER.button) }}>
          <CtaButton width={BUTTON.w} height={BUTTON.h} />
        </div>
      </GlassPanel>
    </AbsoluteFill>
  );
};
