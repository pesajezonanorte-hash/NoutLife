// El panel de Pro en el teléfono (escenas 2 y 3): la pantalla de Inicio se transforma
// en él. Medalla con la gema, «NoutLife Pro», la cinta de la prueba («Día 1 de 7»), lo
// que desbloquea Pro y el botón. Los textos son los de la app (PricingSection,
// PLAN_ROWS y la bienvenida del regalo).
import type React from 'react';
import { Check, Gem } from 'lucide-react';
import { COLORS, FONT, rgba } from '../../Video/theme';
import { EASE, clamp, ramp, springAt } from '../../Video/lib/anim';
import { Kicker, ScreenBg, StatusBar, fadeUp } from '../../Video/screens/kit';
import { AD_SPRING } from '../brand';

const FEATURES = ['Coliseo, Recreación y 9 zonas más', 'Hábitos y rutinas ilimitados', 'Historial y analíticas completos', 'El Sabio con IA'];
const RIBBON = { w: 470, gap: 8, h: 12 };

const goldFill: React.CSSProperties = {
  backgroundImage: `linear-gradient(100deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 60%, ${COLORS.goldDeep} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

/** `at`: cuándo empieza a verse (el contenido entra en cascada). */
export const ProPanel: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const medal = springAt(frame, at, AD_SPRING.pop);
  const sheen = (frame * 2.2) % 360;
  const seg = (RIBBON.w - RIBBON.gap * 6) / 7;
  return (
    <ScreenBg accent={COLORS.gold}>
      <StatusBar />
      <div style={{ ...fadeUp(frame, at), position: 'absolute', left: 0, right: 0, top: 104, display: 'flex', justifyContent: 'center' }}>
        <Kicker color={rgba(COLORS.gold, 0.9)}>TU PLAN</Kicker>
      </div>
      {/* Medalla con la gema */}
      <div
        style={{
          position: 'absolute',
          left: 281 - 80,
          top: 156,
          width: 160,
          height: 160,
          transform: `scale(${0.6 + 0.4 * medal})`,
          opacity: clamp(medal * 2),
        }}
      >
        <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(COLORS.gold, 0.32)} 0%, transparent 66%)` }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            padding: 3,
            background: `conic-gradient(from ${sheen}deg, ${COLORS.goldDeep}, ${COLORS.goldLight}, ${COLORS.gold}, ${COLORS.goldDeep}, ${COLORS.goldLight}, ${COLORS.goldDeep})`,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `radial-gradient(circle at 35% 30%, #2a2416 0%, ${COLORS.bg} 70%)`,
            }}
          >
            <Gem size={70} color={COLORS.goldLight} strokeWidth={1.7} />
          </div>
        </div>
      </div>
      <div style={{ ...fadeUp(frame, at + 2), position: 'absolute', left: 0, right: 0, top: 344, textAlign: 'center', fontWeight: 800, fontSize: 52, letterSpacing: '-0.03em' }}>
        NoutLife <span style={goldFill}>Pro</span>
      </div>
      <div style={{ ...fadeUp(frame, at + 3), position: 'absolute', left: 0, right: 0, top: 414, textAlign: 'center', fontWeight: 600, fontSize: 22, color: COLORS.textSoft }}>
        7 días de Pro incluidos, sin tarjeta.
      </div>
      {/* Cinta de la prueba */}
      <div style={{ ...fadeUp(frame, at + 4), position: 'absolute', left: (562 - RIBBON.w) / 2, top: 474, width: RIBBON.w }}>
        <div style={{ display: 'flex', gap: RIBBON.gap }}>
          {Array.from({ length: 7 }, (_, i) => {
            const on = i === 0 ? ramp(frame, at + 6, at + 12, EASE.out) : 0;
            return (
              <div key={i} style={{ position: 'relative', width: seg, height: RIBBON.h, borderRadius: RIBBON.h / 2, background: rgba(COLORS.text, 0.1), overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${on * 100}%`,
                    height: '100%',
                    borderRadius: RIBBON.h / 2,
                    background: `linear-gradient(90deg, ${COLORS.goldDeep}, ${COLORS.gold} 60%, ${COLORS.goldLight})`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, display: 'flex', fontFamily: FONT.mono, fontWeight: 600, fontSize: 16, color: COLORS.textMuted }}>
          <span>Día 1 de 7</span>
          <span style={{ marginLeft: 'auto', color: COLORS.gold }}>$0 hoy</span>
        </div>
      </div>
      {/* Lo que abre Pro */}
      <div style={{ position: 'absolute', left: 46, right: 30, top: 566 }}>
        {FEATURES.map((text, i) => {
          const p = springAt(frame, at + 6 + i * 2, AD_SPRING.settle);
          return (
            <div
              key={text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                height: 64,
                opacity: clamp(p * 1.5),
                transform: `translateX(${(1 - p) * 26}px)`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: rgba(COLORS.jade, 0.18),
                  boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.5)}`,
                }}
              >
                <Check size={21} color={COLORS.jade} strokeWidth={3} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 23, whiteSpace: 'nowrap' }}>{text}</span>
            </div>
          );
        })}
      </div>
      <div style={{ ...fadeUp(frame, at + 12), position: 'absolute', left: 46, right: 46, top: 852 }}>
        <div
          style={{
            height: 84,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(180deg, ${COLORS.jade300} 0%, ${COLORS.jade} 60%, #6fb48f 100%)`,
            boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.4)',
            fontWeight: 800,
            fontSize: 28,
            color: COLORS.jade900,
          }}
        >
          Empezar
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', fontWeight: 500, fontSize: 18, color: COLORS.textMuted }}>Sin costo ni tarjeta de crédito.</div>
      </div>
    </ScreenBg>
  );
};
