// Escena 4 (18–25 s): llamada a la acción. Las zonas entran al teléfono, que se
// centra y sube de nivel; luego deja sitio al titular y al botón «Empieza gratis
// en NoutLife Lite», que late con el pulso, brilla y recibe un toque al final.
import type React from 'react';
import { ArrowRight } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONT, SPRING, rgba } from '../theme';
import { EASE, clamp, lerp, ramp, springAt, typed } from '../lib/anim';
import { PhoneMockup } from '../components/Phone';
import { WordReveal } from '../components/ui';
import { BUTTON, PHONE, PHONE_POSE_A, PHONE_POSE_B, URL_Y } from '../layout';
import { CTA, SEQUENCES } from '../timeline';

const URL = 'noutlife.vercel.app';
const GOLD_TEXT: React.CSSProperties = {
  backgroundImage: `linear-gradient(100deg, ${COLORS.goldLight} 0%, ${COLORS.gold} 50%, ${COLORS.goldDeep} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.cta.from;
  if (frame < CTA.phoneIn) return null;

  // Teléfono: entra desde abajo inclinado, se centra (pose A) y sube un poco (pose B)
  const pin = springAt(frame, CTA.phoneIn, SPRING.card);
  const pb = springAt(frame, CTA.poseB, SPRING.soft);
  const float = Math.sin(frame / 26) * 6 * ramp(frame, CTA.poseB + 20, CTA.poseB + 50);
  const px = lerp(lerp(540, PHONE_POSE_A.x, pin), PHONE_POSE_B.x, pb);
  const py = lerp(lerp(1060, PHONE_POSE_A.y, pin), PHONE_POSE_B.y, pb) + float;
  const ps = lerp(lerp(0.55, PHONE_POSE_A.s, pin), PHONE_POSE_B.s, pb);
  const rx = lerp(26, 0, pin) + Math.sin(frame / 34) * 1.5 * ramp(frame, CTA.poseB + 20, CTA.poseB + 50);
  const ry = Math.sin(frame / 41) * 2.5 * ramp(frame, CTA.poseB + 20, CTA.poseB + 50);

  // Botón: entra con muelle, late en cada pulso, brilla y recibe un toque
  const btn = springAt(frame, CTA.button, SPRING.card);
  const beatT = frame >= CTA.url ? ((frame - CTA.url) % 15) / 15 : 1;
  const press = ramp(frame, CTA.tap - 3, CTA.tap, EASE.out);
  const release = springAt(frame, CTA.tap + 1, SPRING.snappy);
  const btnScale = (0.62 + 0.38 * btn) * (1 - 0.05 * press + 0.05 * release);
  const shimmer = (a: number) => lerp(-260, BUTTON.w + 120, ramp(frame, a, a + 20, EASE.inOut));
  const shimmerX = frame < CTA.tap ? shimmer(CTA.url + 12) : shimmer(CTA.tap + 16);

  // Toque: el dedo aparece, presiona y deja una onda
  const finger = ramp(frame, CTA.tap - 14, CTA.tap - 6, EASE.out) * (1 - ramp(frame, CTA.tap + 8, CTA.tap + 16));
  const fingerScale = 1.15 - 0.15 * ramp(frame, CTA.tap - 14, CTA.tap - 6, EASE.out) - 0.16 * press + 0.16 * release;
  const ripple = ramp(frame, CTA.tap, CTA.tap + 22, EASE.out);
  // El dedo toca la flecha: «NoutLife Lite» sigue a la vista
  const tapX = 540 + 316;
  const push = 1 + 0.025 * ramp(frame, CTA.button, 750, EASE.linear);

  return (
    <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: '50% 46%' }}>
      {/* Brillo bajo el teléfono */}
      <div
        style={{
          position: 'absolute',
          left: px - 380,
          top: py + (PHONE.h / 2) * ps - 90,
          width: 760,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${rgba(COLORS.jade, 0.3 * pin)} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: `50% ${py}px` }}>
        <div
          style={{
            position: 'absolute',
            left: px - PHONE.w / 2,
            top: py - PHONE.h / 2,
            transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(${ps})`,
            opacity: clamp(pin * 2.5),
          }}
        >
          <PhoneMockup frame={frame} />
        </div>
      </AbsoluteFill>

      <WordReveal
        frame={frame}
        rise={40}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 206,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: 74,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          color: COLORS.text,
          textShadow: '0 4px 30px rgba(0, 0, 0, 0.6)',
        }}
        lines={[
          [
            { text: 'Toma', at: CTA.headline },
            { text: 'el', at: CTA.headline + 4 },
            { text: 'control', at: CTA.headline + 8 },
            { text: 'de', at: CTA.headline + 14 },
          ],
          [
            { text: 'tu', at: CTA.headline + 20 },
            { text: 'leyenda', at: CTA.headline + 25, style: { ...GOLD_TEXT, textShadow: 'none' } },
            { text: 'personal.', at: CTA.headline + 31, style: { ...GOLD_TEXT, textShadow: 'none' } },
          ],
        ]}
      />

      {/* Botón */}
      <div
        style={{
          position: 'absolute',
          left: 540 - BUTTON.w / 2,
          top: BUTTON.y - BUTTON.h / 2,
          width: BUTTON.w,
          height: BUTTON.h,
          borderRadius: 999,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: `linear-gradient(180deg, ${COLORS.jade300} 0%, ${COLORS.jade} 58%, #6fb48f 100%)`,
          boxShadow: [
            `0 0 0 ${beatT * 26}px ${rgba(COLORS.jade, 0.3 * (1 - beatT))}`,
            `0 22px 64px ${rgba(COLORS.jade, 0.38)}`,
            'inset 0 2px 0 rgba(255, 255, 255, 0.4)',
            'inset 0 -3px 0 rgba(0, 0, 0, 0.12)',
          ].join(', '),
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: 37,
          letterSpacing: '-0.01em',
          color: COLORS.jade900,
          whiteSpace: 'nowrap',
          transform: `translateY(${(1 - btn) * 44}px) scale(${btnScale})`,
          opacity: clamp(btn * 1.6),
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -20,
            bottom: -20,
            left: shimmerX,
            width: 150,
            background: 'linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
            transform: 'skewX(-20deg)',
          }}
        />
        <span style={{ position: 'relative' }}>Empieza gratis en NoutLife Lite</span>
        <ArrowRight size={38} strokeWidth={2.8} color={COLORS.jade900} style={{ position: 'relative' }} />
      </div>

      {/* URL que se escribe sola */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: URL_Y - 20,
          textAlign: 'center',
          fontFamily: FONT.mono,
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: '0.06em',
          color: COLORS.textMuted,
        }}
      >
        {typed(URL, frame, CTA.url, 1)}
        <span style={{ opacity: frame >= CTA.url && Math.floor(frame / 8) % 2 === 0 ? 1 : 0, color: COLORS.jade }}>▍</span>
      </div>

      {/* El toque */}
      <div
        style={{
          position: 'absolute',
          left: tapX - 34,
          top: BUTTON.y + 6 - 34,
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.22)',
          boxShadow: 'inset 0 0 0 2.5px rgba(255, 255, 255, 0.75), 0 6px 20px rgba(0, 0, 0, 0.35)',
          transform: `scale(${fingerScale})`,
          opacity: finger,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: tapX - 170,
          top: BUTTON.y + 6 - 170,
          width: 340,
          height: 340,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 ${lerp(6, 1.5, ripple)}px rgba(255, 255, 255, ${0.6 * (1 - ripple)})`,
          transform: `scale(${lerp(0.18, 1, ripple)})`,
          opacity: ripple > 0 && ripple < 1 ? 1 : 0,
        }}
      />
    </AbsoluteFill>
  );
};
