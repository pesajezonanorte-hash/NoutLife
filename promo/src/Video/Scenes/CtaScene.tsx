// Escena 4 (20–24 s): llamada a la acción, encima del teléfono (que vive en
// DeviceScene y aquí ya está en el centro, inclinado, subiendo de nivel).
// «Diseña tu versión Pro.» cae palabra a palabra, con «Pro.» en champán y un
// destello; luego el botón «Empieza gratis en NoutLife Lite», que late con el
// pulso, brilla y recibe un toque al final, y la URL que se escribe sola.
import type React from 'react';
import { ArrowRight } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONT, SPRING, gradientText, rgba } from '../theme';
import { EASE, clamp, decay, lerp, ramp, springAt, typed } from '../lib/anim';
import { BUTTON, HEADLINE_TOP, URL_Y } from '../layout';
import { CTA, SEQUENCES } from '../timeline';

const URL = 'noutlife.vercel.app';
const LINES = [
  [
    { text: 'Diseña', at: CTA.headline },
    { text: 'tu', at: CTA.headline + 7.5 },
  ],
  [
    { text: 'versión', at: CTA.headline + 15 },
    { text: 'Pro.', at: CTA.headline + 22.5 },
  ],
];
const PRO_AT = CTA.headline + 22.5;

/** Destello de cuatro puntas, como el brillo de una gema. */
const Glint: React.FC<{ frame: number; at: number; size: number }> = ({ frame, at, size }) => {
  const p = ramp(frame, at, at + 16, EASE.out);
  if (p <= 0 || p >= 1) return null;
  const s = Math.sin(Math.PI * p);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ position: 'absolute', overflow: 'visible', transform: `rotate(${p * 90}deg) scale(${s})` }}>
      <path d="M0 -50 C4 -8 8 -4 50 0 C8 4 4 8 0 50 C-4 8 -8 4 -50 0 C-8 -4 -4 -8 0 -50Z" fill="#fff" style={{ filter: `drop-shadow(0 0 10px ${COLORS.goldLight})` }} />
    </svg>
  );
};

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.cta.from;

  // Botón: entra con muelle, late en cada pulso, brilla y recibe un toque
  const btn = springAt(frame, CTA.button, SPRING.card);
  const beatT = frame >= CTA.url ? ((frame - CTA.url) % 15) / 15 : 1;
  const press = ramp(frame, CTA.tap - 3, CTA.tap, EASE.out);
  const release = springAt(frame, CTA.tap + 1, SPRING.pop);
  const btnScale = (0.62 + 0.38 * btn) * (1 - 0.05 * press + 0.05 * release);
  const shimmer = (a: number) => lerp(-260, BUTTON.w + 120, ramp(frame, a, a + 20, EASE.inOut));
  const shimmerX = frame < CTA.tap ? shimmer(CTA.shimmer) : shimmer(CTA.tap + 14);
  const tapFlash = decay(frame, CTA.tap, 8);

  // Toque: el dedo aparece, presiona y deja una onda (sobre la flecha: «Lite» sigue a la vista)
  const finger = ramp(frame, CTA.tap - 14, CTA.tap - 6, EASE.out) * (1 - ramp(frame, CTA.tap + 8, CTA.tap + 16));
  const fingerScale = 1.15 - 0.15 * ramp(frame, CTA.tap - 14, CTA.tap - 6, EASE.out) - 0.16 * press + 0.16 * release;
  const ripple = ramp(frame, CTA.tap, CTA.tap + 22, EASE.out);
  const tapX = 540 + BUTTON.w / 2 - 66;

  return (
    <AbsoluteFill style={{ fontFamily: FONT.sans }}>
      {/* Titular */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: HEADLINE_TOP,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: 108,
          lineHeight: 1.04,
          letterSpacing: '-0.04em',
          color: '#f4f8f5',
        }}
      >
        {LINES.map((line, li) => (
          <div key={li} style={{ whiteSpace: 'nowrap' }}>
            {line.map((w, wi) => {
              const pro = w.text === 'Pro.';
              const p = springAt(frame, w.at, SPRING.slam);
              const scale = lerp(pro ? 1.9 : 1.45, 1, p);
              const blur = (1 - clamp(p)) * 10;
              return (
                <span
                  key={w.text}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    marginRight: wi < line.length - 1 ? '0.24em' : 0,
                    transform: `scale(${scale})`,
                    opacity: clamp(p * 2.5),
                    filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                  }}
                >
                  {pro && (
                    <span aria-hidden style={{ position: 'absolute', inset: 0, color: COLORS.gold, filter: 'blur(26px)', opacity: 0.5 + 0.4 * decay(frame, PRO_AT, 12) }}>
                      {w.text}
                    </span>
                  )}
                  <span style={{ position: 'relative', ...(pro ? gradientText(COLORS.goldLight, COLORS.goldDeep, 100) : {}) }}>{w.text}</span>
                  {pro && (
                    <span style={{ position: 'absolute', right: '0.02em', top: '0.04em', width: 0, height: 0 }}>
                      <span style={{ position: 'absolute', left: -38, top: -38 }}>
                        <Glint frame={frame} at={PRO_AT + 4} size={76} />
                      </span>
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>

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
            `0 0 0 ${beatT * 24}px ${rgba(COLORS.jade, 0.3 * (1 - beatT))}`,
            `0 18px 50px ${rgba(COLORS.jade, 0.34 + 0.3 * tapFlash)}`,
            'inset 0 2px 0 rgba(255, 255, 255, 0.45)',
            'inset 0 -3px 0 rgba(0, 0, 0, 0.12)',
          ].join(', '),
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
          top: BUTTON.y + 4 - 34,
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.22)',
          boxShadow: 'inset 0 0 0 2.5px rgba(255, 255, 255, 0.75)',
          transform: `scale(${fingerScale})`,
          opacity: finger,
        }}
      />
      {ripple > 0 && ripple < 1 && (
        <div
          style={{
            position: 'absolute',
            left: tapX - 170,
            top: BUTTON.y + 4 - 170,
            width: 340,
            height: 340,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${lerp(6, 1.5, ripple)}px rgba(255, 255, 255, ${0.6 * (1 - ripple)})`,
            transform: `scale(${lerp(0.18, 1, ripple)})`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
