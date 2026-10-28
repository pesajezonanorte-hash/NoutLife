// La ventana de Inicio (apps/web HomeWindow, la pieza firma de la marca): el cielo de
// la hora real. Aquí es de día, las 9:41: el sol en su arco, nubes que pasan muy
// despacio, colinas, el marco con su parteluz, las cortinas que se mecen y el
// alféizar con la planta y la taza. Los colores salen de ambience.css (modo oscuro).
import type React from 'react';
import { COLORS, rgba } from '../../Video/theme';

/** Cielo de día: info + blanco arriba, un toque de advertencia (cálido) abajo. */
const SKY = 'linear-gradient(180deg, #b5d5e7 0%, #e0eef5 72%, #faf3e6 100%)';
/** Sol de las 9:41 (skyPosition): 32 % a lo ancho, 35 % de alto. */
const SUN = { x: 32, y: 35 };
const CURTAIN = `repeating-linear-gradient(90deg, #2e4638 0 9px, #39574a 9px 13px, #273c30 13px 21px)`;

const Cloud: React.FC<{ x: number; y: number; w: number; h: number; opacity?: number }> = ({ x, y, w, h, opacity = 1 }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, opacity }}>
    {[
      { l: '8%', w: '48%', h: '62%' },
      { l: '34%', w: '46%', h: '100%' },
      { l: '60%', w: '34%', h: '55%' },
    ].map((p, i) => (
      <div
        key={i}
        style={{ position: 'absolute', bottom: 0, left: p.l, width: p.w, height: p.h, borderRadius: 999, background: 'rgba(255, 255, 255, 0.9)', boxShadow: 'inset 0 -3px 4px rgba(127, 182, 214, 0.14)' }}
      />
    ))}
  </div>
);

const Plant: React.FC<{ frame: number }> = ({ frame }) => {
  const leaves = [
    { d: 'M30 58C24 44 14 40 6 42c4 10 12 16 24 16Z', r: 3, rate: 7 },
    { d: 'M30 58C36 42 46 36 56 38c-4 12-14 18-26 20Z', r: 4, rate: 8.5 },
    { d: 'M30 58C28 40 32 24 38 14c6 14 2 32-8 44Z', r: 2.5, rate: 9.5 },
    { d: 'M30 58C30 44 22 30 14 24c-2 14 4 28 16 34Z', r: 3.5, rate: 7.8 },
  ];
  return (
    <svg viewBox="0 0 60 92" width={44} height={68} style={{ overflow: 'visible' }}>
      {leaves.map((l, i) => (
        <path
          key={i}
          d={l.d}
          fill={i % 2 ? rgba(COLORS.success, 0.8) : COLORS.success}
          style={{ transformOrigin: '30px 58px', transform: `rotate(${Math.sin((frame / 30 / l.rate) * Math.PI * 2 + i) * l.r}deg)` }}
        />
      ))}
      <path d="M14 60h32l-4 30H18Z" fill="#a56f50" />
      <path d="M12 56h36v7H12Z" fill="#c08562" />
    </svg>
  );
};

const Mug: React.FC<{ frame: number }> = ({ frame }) => (
  <svg viewBox="0 0 48 60" width={32} height={40} style={{ overflow: 'visible' }}>
    {[0, 1, 2].map((i) => {
      // Tres hilos de vapor que suben a destiempo
      const t = ((frame / 30 + i * 1.1) % 3.3) / 3.3;
      return (
        <path
          key={i}
          d={`M${14 + i * 7} 22c-4-5 4-8 0-13s4-8 0-12`}
          fill="none"
          stroke={rgba(COLORS.textSoft, 0.55)}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ opacity: Math.sin(Math.PI * t), transform: `translateY(${-8 * t}px)` }}
        />
      );
    })}
    <path d="M34 34h4a7 7 0 0 1 0 14h-4" fill="none" stroke={COLORS.info} strokeWidth={3.5} />
    <path d="M8 28h28v20a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8Z" fill={COLORS.info} />
    <path d="M8 28h28v4H8Z" fill="rgba(255, 255, 255, 0.25)" />
  </svg>
);

/** `width` × `height` en px de pantalla; incluye la barra de la cortina y el alféizar. */
export const SkyWindow: React.FC<{ frame: number; width: number; height: number }> = ({ frame, width, height }) => {
  const t = frame / 30;
  const glassH = height - 26;
  const arch = width * 0.28;
  const sway = (phase: number) => `skewX(${Math.sin(t * 0.7 + phase) * 1.4}deg) scaleX(${1 - 0.02 * (1 + Math.sin(t * 0.7 + phase))})`;
  return (
    <div style={{ position: 'relative', width, height }}>
      {/* La barra de la cortina */}
      <div style={{ position: 'absolute', left: -10, right: -10, top: 0, height: 7, borderRadius: 4, background: 'linear-gradient(180deg, #2c3d33, #15221b)', zIndex: 2 }} />
      {/* El marco con el cielo de esta hora */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 5,
          width,
          height: glassH,
          borderRadius: `${arch}px ${arch}px 0 0`,
          border: `9px solid ${COLORS.surfaceVariant}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: SKY,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${SUN.x}%`,
            top: `${SUN.y}%`,
            width: 74,
            height: 74,
            transform: `translate(-50%, -50%) scale(${0.95 + 0.05 * Math.sin(t * 0.9)})`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #f6e5c9 0 32%, rgba(224, 168, 74, 0.55) 34%, rgba(224, 168, 74, 0.18) 52%, transparent 70%)',
          }}
        />
        <Cloud x={((300 + t * 9) % (width + 160)) - 120} y={glassH * 0.14} w={104} h={30} />
        <Cloud x={((60 + t * 6) % (width + 120)) - 80} y={glassH * 0.33} w={70} h={22} opacity={0.8} />
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: '34%' }}>
          <path d="M0 70C60 40 120 52 180 62s130-34 220-8V120H0Z" fill="#9cc4ad" />
          <path d="M0 92c70-26 150-16 220-4s120 6 180-10V120H0Z" fill="#6aa585" />
        </svg>
        {/* Reflejo en el vidrio */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '34%', background: 'linear-gradient(105deg, transparent 10%, rgba(255, 255, 255, 0.32) 45%, transparent 80%)' }} />
        {/* Parteluz y travesaño */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 8, transform: 'translateX(-50%)', background: COLORS.surfaceVariant }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '58%', height: 8, background: COLORS.surfaceVariant }} />
      </div>
      {/* Cortinas */}
      {[-1, 1].map((side) => (
        <div
          key={side}
          style={{
            position: 'absolute',
            top: 3,
            bottom: 18,
            width: '20%',
            [side < 0 ? 'left' : 'right']: -12,
            borderRadius: side < 0 ? '4px 4px 14px 10px' : '4px 4px 10px 14px',
            background: CURTAIN,
            boxShadow: `inset ${side < 0 ? -6 : 6}px 0 10px -6px rgba(0, 0, 0, 0.35)`,
            transformOrigin: '50% 0',
            transform: sway(side < 0 ? 0 : 3.5),
            zIndex: 1,
          }}
        />
      ))}
      {/* El alféizar con la planta y la taza */}
      <div
        style={{
          position: 'absolute',
          left: -16,
          right: -16,
          bottom: 4,
          height: 16,
          borderRadius: 6,
          background: `linear-gradient(180deg, ${COLORS.surfaceVariant}, ${COLORS.surface})`,
          boxShadow: `0 1px 0 ${COLORS.border}`,
          zIndex: 2,
        }}
      >
        <div style={{ position: 'absolute', left: 54, bottom: 12 }}>
          <Plant frame={frame} />
        </div>
        <div style={{ position: 'absolute', right: 60, bottom: 12 }}>
          <Mug frame={frame} />
        </div>
      </div>
    </div>
  );
};
