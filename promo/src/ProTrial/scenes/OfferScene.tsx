// Escena 3 (8–13 s): la oferta. La tarjeta de cristal sube y se posa sobre el pie del
// teléfono; su franja de arriba deja ver, desenfocado, el botón jade del panel de Pro
// (sobre algo oscuro el cristal no se notaría). Debajo: la cinta de los 7 días,
// «7 DÍAS DE PRO.» / «GRATIS.», «Sin tarjeta de crédito.» en jade, la letra pequeña y
// el botón de Google, que late con el pulso, brilla y recibe un toque. Cuatro gemas de
// oro flotan alrededor; una asoma por detrás del cristal.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, clamp, flash, lerp, ramp, springAt } from '../../Video/lib/anim';
import { AD, AD_SPRING, goldText, jadeText } from '../brand';
import { GlassCard } from '../components/GlassCard';
import { GoldGem } from '../components/GoldGem';
import { GoogleButton } from '../components/GoogleButton';
import { Reveal } from '../components/Reveal';
import { END, OFFER, SEQUENCES } from '../timeline';

/** La tarjeta (px del lienzo): desde el pie del teléfono hasta el límite seguro de las redes (y = 1480). */
const CARD = { x: 110, y: 742, w: 860, h: 732 };
/** Franja de arriba sin texto: el cristal sobre el teléfono. */
const GLASS_TOP = 100;
const BUTTON = { w: 740, h: 112, top: GLASS_TOP + 486 };
/** Toque: sobre la mitad derecha del texto del botón. */
const TAP = { x: 540 + 170, y: CARD.y + BUTTON.top + BUTTON.h / 2 + 6 };

/** Las gemas: posición, tamaño, si van detrás del cristal y su fase de flotación. */
const GEMS = [
  { x: 178, y: 748, size: 34, behind: true, phase: 0, at: OFFER.card + 6 },
  { x: 942, y: 1196, size: 26, behind: false, phase: 1.7, at: OFFER.card + 14 },
  { x: 884, y: 330, size: 21, behind: false, phase: 3.1, at: OFFER.card + 10 },
  { x: 168, y: 520, size: 15, behind: false, phase: 4.4, at: OFFER.card + 18 },
];

const Gems: React.FC<{ frame: number; behind: boolean }> = ({ frame, behind }) => {
  const out = 1 - ramp(frame, END.fade.from - 6, END.fade.from + 8);
  return (
    <>
      {GEMS.filter((g) => g.behind === behind).map((g, i) => {
        const p = springAt(frame, g.at, AD_SPRING.pop);
        return (
          <GoldGem
            key={i}
            x={g.x}
            y={g.y + Math.sin(frame / 26 + g.phase) * 9 + (1 - clamp(p)) * 40}
            size={g.size * lerp(0.4, 1, p)}
            rx={18 + Math.sin(frame / 40 + g.phase) * 14}
            ry={frame * 1.5 + g.phase * 50}
            rz={Math.sin(frame / 34 + g.phase) * 12}
            opacity={clamp(p * 2) * out}
          />
        );
      })}
    </>
  );
};

/** La cinta de los 7 días: un segmento de oro cada 3 fotogramas. */
const Ribbon: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
    {Array.from({ length: 7 }, (_, i) => {
      const at = OFFER.ribbon + i * 3;
      const on = ramp(frame, at, at + 6, EASE.out);
      const glow = flash(frame, at, 2, 8);
      return (
        <div key={i} style={{ position: 'relative', width: 66, height: 12, borderRadius: 6, background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${on * 100}%`,
              height: '100%',
              borderRadius: 6,
              background: `linear-gradient(90deg, ${AD.goldDeep}, ${AD.gold} 55%, ${AD.goldLight})`,
              boxShadow: `0 0 ${8 + 10 * glow}px rgba(212, 175, 55, ${0.5 + 0.4 * glow})`,
            }}
          />
        </div>
      );
    })}
  </div>
);

export const OfferScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.offer.from;
  const card = springAt(frame, OFFER.card, AD_SPRING.settle);
  const cardIn = clamp(card * 1.6);
  const sheen = ramp(frame, OFFER.card + 8, OFFER.card + 34, EASE.inOut);
  const float = Math.sin((frame - OFFER.card) / 34) * 4 * ramp(frame, OFFER.card + 20, OFFER.card + 50);

  const fadeUp = (at: number, rise = 26) => {
    const p = springAt(frame, at, AD_SPRING.settle);
    return { opacity: clamp(p * 1.4), transform: `translateY(${(1 - p) * rise}px)` };
  };

  // Botón: entra con muelle, late en cada pulso, brilla y recibe el toque
  const btn = springAt(frame, OFFER.button, AD_SPRING.pop);
  const beat = frame >= OFFER.shimmer ? ((frame - OFFER.shimmer) % 15) / 15 : 1;
  const press = ramp(frame, OFFER.tap - 3, OFFER.tap, EASE.out);
  const release = springAt(frame, OFFER.tap + 1, AD_SPRING.pop);
  const shimmerAt = (a: number) => ramp(frame, a, a + 20, EASE.inOut);
  const shimmer = frame < OFFER.tap ? shimmerAt(OFFER.shimmer) : shimmerAt(OFFER.tap + 6);
  const tapGlow = flash(frame, OFFER.tap, 2, 12);

  // El dedo: aparece, presiona y deja una onda
  const finger = ramp(frame, OFFER.tap - 14, OFFER.tap - 6, EASE.out) * (1 - ramp(frame, OFFER.tap + 8, OFFER.tap + 16));
  const fingerScale = 1.15 - 0.15 * ramp(frame, OFFER.tap - 14, OFFER.tap - 6, EASE.out) - 0.16 * press + 0.16 * release;
  const ripple = ramp(frame, OFFER.tap, OFFER.tap + 22, EASE.out);

  return (
    <AbsoluteFill>
      <Gems frame={frame} behind />
      <GlassCard
        x={CARD.x}
        y={CARD.y}
        w={CARD.w}
        h={CARD.h}
        opacity={cardIn}
        sheen={sheen}
        style={{ transform: `perspective(1600px) translateY(${(1 - card) * 110 + float}px) rotateX(${(1 - card) * 16}deg)`, transformOrigin: '50% 100%' }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: GLASS_TOP + 52, ...fadeUp(OFFER.ribbon - 2, 12) }}>
          <Ribbon frame={frame} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: GLASS_TOP + 96 }}>
          <Reveal frame={frame} at={OFFER.headline[0]} tracking={-0.02} style={{ fontWeight: 900, fontSize: 90, lineHeight: 1.12, color: AD.ink }}>
            7 DÍAS DE <span style={goldText(100)}>PRO.</span>
          </Reveal>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: GLASS_TOP + 196 }}>
          <Reveal frame={frame} at={OFFER.headline[1]} tracking={-0.02} style={{ fontWeight: 900, fontSize: 90, lineHeight: 1.12, color: AD.ink }}>
            GRATIS.
          </Reveal>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: GLASS_TOP + 318, textAlign: 'center', fontWeight: 700, fontSize: 44, letterSpacing: '-0.01em', ...fadeUp(OFFER.noCard) }}>
          <span style={jadeText(100)}>Sin tarjeta de crédito.</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 90,
            right: 90,
            top: GLASS_TOP + 384,
            textAlign: 'center',
            fontWeight: 400,
            fontSize: 27,
            lineHeight: 1.35,
            color: AD.inkMuted,
            ...fadeUp(OFFER.fine, 14),
          }}
        >
          Para cuentas nuevas y cuentas Lite que aún no han probado Pro.
        </div>
        <div
          style={{
            position: 'absolute',
            left: (CARD.w - BUTTON.w) / 2,
            top: BUTTON.top,
            transform: `translateY(${(1 - btn) * 34}px) scale(${(0.72 + 0.28 * btn) * (1 - 0.05 * press + 0.05 * release)})`,
            opacity: clamp(btn * 1.8),
          }}
        >
          <GoogleButton w={BUTTON.w} h={BUTTON.h} shimmer={shimmer > 0 && shimmer < 1 ? shimmer : null} beat={beat} glow={tapGlow} />
        </div>
      </GlassCard>
      <Gems frame={frame} behind={false} />

      {/* El toque */}
      <div
        style={{
          position: 'absolute',
          left: TAP.x - 36,
          top: TAP.y - 36,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.24)',
          boxShadow: 'inset 0 0 0 2.5px rgba(255, 255, 255, 0.8)',
          transform: `scale(${fingerScale})`,
          opacity: finger,
        }}
      />
      {ripple > 0 && ripple < 1 && (
        <div
          style={{
            position: 'absolute',
            left: TAP.x - 180,
            top: TAP.y - 180,
            width: 360,
            height: 360,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${lerp(6, 1.5, ripple)}px rgba(255, 255, 255, ${0.6 * (1 - ripple)})`,
            transform: `scale(${lerp(0.18, 1, ripple)})`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
