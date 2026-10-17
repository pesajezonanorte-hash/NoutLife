// Tarjeta de El Sabio: las ondas de luz que unen las zonas y un consejo que se
// escribe solo. El consejo cruza sueño y entreno, como hace el Sabio de la app
// («conéctalas cuando ayude: sueño y entreno…»), y sigue a la tarjeta del Coliseo.
import type React from 'react';
import { Sparkles } from 'lucide-react';
import { COLORS, FONT, SPRING, rgba } from '../../theme';
import { clamp, springAt, typed } from '../../lib/anim';
import { LightWaves } from '../../components/LightWaves';
import { GlowCard, IconChip, ZoneHeader } from '../../components/ui';
import { CARD } from '../../layout';

const ADVICE = 'Dormiste 6 h y tu pecho sigue cargado. Hoy toca pierna.';

export const SabioCard: React.FC<{ local: number; frame: number }> = ({ local, frame }) => {
  const bubble = springAt(local, 8, SPRING.snappy);
  const text = typed(ADVICE, local, 12, 2.2);
  const typing = text.length < ADVICE.length;
  const caret = typing || Math.floor(frame / 8) % 2 === 0;
  return (
    <GlowCard frame={frame} accent={COLORS.gold} width={CARD.w} height={CARD.h}>
      <ZoneHeader icon={Sparkles} accent={COLORS.gold} kicker="ZONA 04 · IA" title="El Sabio" subtitle="Tu consejero con IA" pro />

      <div style={{ position: 'absolute', left: 0, top: 262 }}>
        <LightWaves local={local} frame={frame} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 44,
          right: 44,
          top: 760,
          height: 252,
          borderRadius: 34,
          padding: '28px 34px',
          background: `linear-gradient(160deg, ${rgba(COLORS.gold, 0.11)}, ${rgba(COLORS.gold, 0.04)})`,
          boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.3)}, 0 20px 50px rgba(0,0,0,0.35)`,
          opacity: clamp(bubble * 1.5),
          transform: `translateY(${(1 - bubble) * 30}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IconChip icon={Sparkles} color={COLORS.gold} size={46} radius={23} />
          <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 21, letterSpacing: '0.16em', color: COLORS.gold }}>EL SABIO</span>
          <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 19, color: COLORS.textMuted }}>ahora</span>
        </div>
        <div style={{ marginTop: 18, fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 500, fontSize: 44, lineHeight: 1.2, color: COLORS.text }}>
          «{text}
          {text.length === ADVICE.length ? '»' : ''}
          <span style={{ display: 'inline-block', width: 3, height: 40, marginLeft: 4, verticalAlign: '-6px', background: COLORS.gold, opacity: caret ? 1 : 0 }} />
        </div>
      </div>
    </GlowCard>
  );
};
