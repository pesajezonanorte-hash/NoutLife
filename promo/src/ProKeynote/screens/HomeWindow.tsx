// La ventana de Inicio (apps/web/src/components/dashboard/HomeWindow.tsx), de día a las
// 9:41, con los colores de ambience.css en modo oscuro: el cielo, el sol en su punto del
// arco, tres nubes que pasan muy despacio, las colinas, el marco con su parteluz, las
// cortinas que se mecen y el alféizar con la planta y la taza. Los ritmos son los de la
// app (nubes de 84–140 s, cortinas de 9 s, hojas de 7–9,5 s).
import type React from 'react';
import { rgba } from '../../Video/theme';
import { APP, pt } from './ui';

const SKY = 'linear-gradient(180deg, #b5d5e7 0%, #e0eef5 72%, #fbf3e6 100%)';
/** Sol de las 9:41 (skyPosition): 32 % a lo ancho, 35 % de alto. */
const SUN = { x: 32, y: 35 };
const CURTAIN = 'repeating-linear-gradient(90deg, #2e4638 0 9px, #39574a 9px 13px, #273c30 13px 21px)';
const HILL_FAR = '#c0dfcb';
const HILL_NEAR = '#85c7a1';
const ROD = 'linear-gradient(180deg, #e1caa8, #d4b483)';
const POT = '#eaa577';
const POT_RIM = '#eda583';

/** Nubes: alto, ancho (pt), opacidad, periodo y desfase (s), como las de la app. */
const CLOUDS = [
  { top: 0.16, h: 28, w: 96, o: 1, period: 84, delay: -20 },
  { top: 0.34, h: 20, w: 64, o: 0.8, period: 110, delay: -70 },
  { top: 0.08, h: 16, w: 48, o: 0.6, period: 140, delay: -35 },
];

const Cloud: React.FC<{ t: number; width: number; c: (typeof CLOUDS)[number]; glassH: number }> = ({ t, width, c, glassH }) => {
  const w = pt(c.w);
  // lq-cloud: translateX de −120 % a 460 % de su ancho, lineal y en bucle
  const phase = (((t - c.delay) % c.period) + c.period) % c.period / c.period;
  const x = (-1.2 + 5.8 * phase) * w;
  if (x > width) return null;
  return (
    <div style={{ position: 'absolute', left: x, top: glassH * c.top, width: w, height: pt(c.h), opacity: c.o }}>
      {[
        { left: '8%', width: '48%', height: '62%' },
        { left: '34%', width: '46%', height: '100%' },
        { left: '54%', width: '40%', height: '55%' },
      ].map((p, i) => (
        <div key={i} style={{ position: 'absolute', bottom: 0, ...p, borderRadius: 999, background: 'rgba(255, 255, 255, 0.88)', boxShadow: `inset 0 -3px 4px ${rgba(APP.info, 0.12)}` }} />
      ))}
    </div>
  );
};

const LEAVES = [
  { d: 'M30 58C24 44 14 40 6 42c4 10 12 16 24 16Z', r: 3, period: 7, delay: 0 },
  { d: 'M30 58C36 42 46 36 56 38c-4 12-14 18-26 20Z', r: 4, period: 8.5, delay: -2 },
  { d: 'M30 58C28 40 32 24 38 14c6 14 2 32-8 44Z', r: 2.5, period: 9.5, delay: -4 },
  { d: 'M30 58C30 44 22 30 14 24c-2 14 4 28 16 34Z', r: 3.5, period: 7.8, delay: -1 },
];

/** lq-amb-sway: vaivén suave alrededor de la base de cada hoja. */
const sway = (t: number, period: number, delay: number) => Math.sin(((t - delay) / period) * Math.PI * 2);

const Plant: React.FC<{ t: number }> = ({ t }) => (
  <svg viewBox="0 0 60 92" width={pt(60)} height={pt(73.6)} style={{ display: 'block', overflow: 'visible' }}>
    {LEAVES.map((l, i) => (
      <path
        key={i}
        d={l.d}
        fill={i % 2 ? rgba(APP.success, 0.8) : APP.success}
        style={{ transformOrigin: '30px 58px', transform: `rotate(${sway(t, l.period, l.delay) * l.r}deg)` }}
      />
    ))}
    <path d="M14 60h32l-4 30H18Z" fill={POT} />
    <path d="M12 56h36v7H12Z" fill={POT_RIM} />
  </svg>
);

const Mug: React.FC<{ t: number }> = ({ t }) => (
  <svg viewBox="0 0 48 60" width={pt(40)} height={pt(48)} style={{ display: 'block', overflow: 'visible' }}>
    {[0, 1, 2].map((i) => {
      // lq-steam: tres hilos que suben a destiempo
      const p = (((t - i * 1.1) % 3.3) + 3.3) % 3.3 / 3.3;
      return (
        <path
          key={i}
          d={`M${14 + i * 7} 22c-4-5 4-8 0-13s4-8 0-12`}
          fill="none"
          stroke={rgba(APP.onSurfaceLight, 0.6)}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ opacity: Math.sin(Math.PI * p) * 0.9, transform: `translateY(${-8 * p}px)` }}
        />
      );
    })}
    <path d="M34 34h4a7 7 0 0 1 0 14h-4" fill="none" stroke={APP.infoText} strokeWidth={3.5} />
    <path d="M8 28h28v20a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8Z" fill={APP.infoText} />
    <path d="M8 28h28v4H8Z" fill="rgba(255, 255, 255, 0.25)" />
  </svg>
);

/** La ventana entera: `width` es el ancho del marco (px de pantalla); el alto sale del 16:10. */
export const HomeWindow: React.FC<{ frame: number; width: number }> = ({ frame, width }) => {
  const t = frame / 30;
  const frameH = width / 1.6;
  const border = pt(10);
  const glassH = frameH - 2 * border;
  const top = pt(16);
  const curtain = (side: -1 | 1) => {
    const s = sway(t, 9, side < 0 ? 0 : -3.5) * 0.5 + 0.5;
    return `skewX(${1.4 * s}deg) scaleX(${1 - 0.04 * s})`;
  };
  return (
    <div style={{ position: 'relative', width, height: top + frameH + pt(10) }}>
      {/* La barra de la cortina */}
      <div style={{ position: 'absolute', left: -pt(12), right: -pt(12), top: pt(4), height: pt(8), borderRadius: 999, background: ROD, zIndex: 2 }} />
      {/* El marco con el cielo de esta hora */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top,
          width,
          height: frameH,
          boxSizing: 'border-box',
          border: `${border}px solid ${APP.surfaceVariant}`,
          borderRadius: `${pt(112)}px ${pt(112)}px 0 0`,
          overflow: 'hidden',
          background: SKY,
          boxShadow: 'inset 0 6px 14px -6px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${SUN.x}%`,
            top: `${SUN.y}%`,
            width: pt(56),
            height: pt(56),
            transform: `translate(-50%, -50%) scale(${0.925 + 0.075 * Math.sin((t / 7) * Math.PI * 2)})`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #f6e5c9 0 32%, rgba(224, 168, 74, 0.55) 34%, rgba(224, 168, 74, 0.18) 52%, transparent 70%)',
          }}
        />
        {CLOUDS.map((c, i) => (
          <Cloud key={i} t={t} width={width} c={c} glassH={glassH} />
        ))}
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '34%' }}>
          <path d="M0 70C60 40 120 52 180 62s130-34 220-8V120H0Z" fill={HILL_FAR} />
          <path d="M0 92c70-26 150-16 220-4s120 6 180-10V120H0Z" fill={HILL_NEAR} />
        </svg>
        {/* Reflejo en el vidrio */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '33%', background: 'linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.22) 50%, transparent)' }} />
        {/* Parteluz y travesaño */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: pt(8), transform: 'translateX(-50%)', background: APP.surfaceVariant }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '58%', height: pt(8), background: APP.surfaceVariant }} />
      </div>
      {/* Cortinas */}
      {([-1, 1] as const).map((side) => (
        <div
          key={side}
          style={{
            position: 'absolute',
            top: pt(8),
            bottom: pt(12),
            width: '21%',
            [side < 0 ? 'left' : 'right']: -pt(8),
            borderRadius: side < 0 ? '4px 4px 14px 10px' : '4px 4px 10px 14px',
            background: CURTAIN,
            boxShadow: `inset ${side < 0 ? -6 : 6}px 0 10px -6px rgba(0, 0, 0, 0.25)`,
            transformOrigin: '50% 0',
            transform: curtain(side),
            zIndex: 1,
          }}
        />
      ))}
      {/* El alféizar con la planta y la taza */}
      <div style={{ position: 'absolute', left: -pt(16), right: -pt(16), top: top + frameH - pt(4), height: pt(14), zIndex: 2 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: pt(6), background: `linear-gradient(180deg, ${APP.surfaceVariant}, ${APP.surface})` }} />
        <div style={{ position: 'absolute', left: pt(24), bottom: pt(12) - 2 }}>
          <Plant t={t} />
        </div>
        <div style={{ position: 'absolute', right: pt(32), bottom: pt(12) - 2 }}>
          <Mug t={t} />
        </div>
      </div>
    </div>
  );
};
