// iPhone para mostrar NoutLife: canto de titanio, cristal negro, isla dinámica y un
// reflejo. La pantalla mide 390 × 844 (puntos de iPhone 15) y el teléfono se escala
// a `width`. Entra subiendo y girando; después flota despacio.
// El halo es un radial-gradient, no un box-shadow (el teléfono se escala).
import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, lerp, springAt } from '../lib';

export const SCREEN = { w: 390, h: 844, r: 54 };
const BEZEL = 14;
const PHONE = { w: SCREEN.w + BEZEL * 2, h: SCREEN.h + BEZEL * 2, r: SCREEN.r + BEZEL };

export const PhoneMockup: React.FC<{
  width: number;
  at?: number;
  /** Giro en Y (grados) ya en reposo. */
  tilt?: number;
  glow?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ width, at = 0, tilt = 12, glow = COLORS.jade, style, children }) => {
  const frame = useCurrentFrame();
  const p = springAt(frame, at, SPRING.phone);
  const s = width / PHONE.w;
  const ry = lerp(tilt * 2.5, tilt, p) + Math.sin(frame / 95) * 2;
  const rx = 5 + Math.sin(frame / 120) * 1.2;
  const y = (1 - p) * 220 + Math.sin(frame / 70) * 7;
  return (
    <div style={{ position: 'relative', width, height: PHONE.h * s, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -45%',
          background: `radial-gradient(closest-side, ${rgba(glow, 0.3)}, ${rgba(glow, 0.08)} 55%, transparent)`,
          opacity: clamp(p * 1.2),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: PHONE.w,
          height: PHONE.h,
          marginLeft: -PHONE.w / 2,
          marginTop: -PHONE.h / 2,
          opacity: clamp(p * 2),
          transform: `translateY(${y}px) perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})`,
        }}
      >
        {/* Canto de titanio y botones */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: PHONE.r,
            background: 'linear-gradient(140deg, #e2e8f0 0%, #64748b 16%, #1e293b 42%, #334155 70%, #cbd5e1 100%)',
          }}
        />
        {[
          [-1, 160, 30],
          [-1, 220, 62],
          [-1, 296, 62],
          [1, 240, 96],
        ].map(([side, top, h], i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top,
              height: h,
              width: 5,
              [side < 0 ? 'left' : 'right']: -3,
              borderRadius: 3,
              background: 'linear-gradient(90deg, #94a3b8, #334155)',
            }}
          />
        ))}
        <div style={{ position: 'absolute', inset: 3, borderRadius: PHONE.r - 3, background: '#030405' }} />
        <div
          style={{
            position: 'absolute',
            left: BEZEL,
            top: BEZEL,
            width: SCREEN.w,
            height: SCREEN.h,
            borderRadius: SCREEN.r,
            overflow: 'hidden',
            background: '#000',
          }}
        >
          {children}
          {/* Reflejo del cristal: se corre un poco con el giro */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${112 + ry}deg, ${rgba('#ffffff', 0.1)} 0%, ${rgba('#ffffff', 0.03)} 30%, transparent 46%)`,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 11,
              left: '50%',
              width: 118,
              height: 34,
              marginLeft: -59,
              borderRadius: 17,
              background: '#000',
            }}
          />
        </div>
      </div>
    </div>
  );
};
