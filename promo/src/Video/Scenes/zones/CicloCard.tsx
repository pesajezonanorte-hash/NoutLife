// Tarjeta del Ciclo Menstrual: la rueda de fases con hoy marcado y lo que se
// anotó hoy (síntomas y ánimo), con la terminología y los íconos de la app.
import type React from 'react';
import { Cookie, Flower2, Wind, Zap, type LucideIcon } from 'lucide-react';
import { COLORS, CYCLE, FONT, SPRING, rgba } from '../../theme';
import { clamp, springAt } from '../../lib/anim';
import { CycleRing } from '../../components/CycleRing';
import { GlowCard, ZoneHeader } from '../../components/ui';
import { CARD } from '../../layout';

const LOGGED: Array<{ label: string; icon: LucideIcon; color: string }> = [
  { label: 'Energía alta', icon: Zap, color: CYCLE.follicular },
  { label: 'Hinchazón', icon: Wind, color: CYCLE.luteal },
  { label: 'Antojos', icon: Cookie, color: CYCLE.menstrual },
];

export const CicloCard: React.FC<{ local: number; frame: number }> = ({ local, frame }) => (
  <GlowCard frame={frame} accent={CYCLE.menstrual} width={CARD.w} height={CARD.h}>
    <ZoneHeader icon={Flower2} accent={CYCLE.menstrual} kicker="ZONA 02" title="Ciclo Menstrual" subtitle="Fases, síntomas y predicciones" />

    <div style={{ position: 'absolute', left: (CARD.w - 540) / 2, top: 282 }}>
      <CycleRing local={local} frame={frame} size={540} />
    </div>

    <div style={{ position: 'absolute', left: 54, right: 54, top: 880 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 19, fontWeight: 600, letterSpacing: '0.18em', color: COLORS.textMuted }}>HOY ANOTASTE</div>
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        {LOGGED.map((s, i) => {
          const p = springAt(local, 26 + i * 4, SPRING.snappy);
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 64,
                padding: '0 24px',
                borderRadius: 999,
                background: rgba(s.color, 0.13),
                boxShadow: `inset 0 0 0 1.5px ${rgba(s.color, 0.42)}`,
                fontFamily: FONT.sans,
                fontWeight: 600,
                fontSize: 26,
                color: COLORS.text,
                whiteSpace: 'nowrap',
                transform: `scale(${0.6 + 0.4 * p})`,
                opacity: clamp(p * 1.6),
              }}
            >
              <Icon size={26} color={s.color} strokeWidth={2.2} />
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  </GlowCard>
);
