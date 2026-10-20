// Marca de NoutLife con la geometría de apps/web/src/components/layout/Brand.tsx:
// la N de tres hojas y el wordmark «noutlife» monolínea. `SplashMark` repite el
// splash de la PWA (index.html, #lq-boot): las hojas entran volando desde fuera,
// derivan, se pasan un poco y se asientan; luego la N late una vez.
import type React from 'react';
import { useId } from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { COLORS, LOGO_GRADIENTS } from '../theme';
import { EASE, HEIGHT, WIDTH, ramp, springAt, SPRING } from '../lib';

export const MARK_SIZE = { w: 670, h: 786 };

const MARK_PATHS = {
  c: 'M474 198C581.2 230.2 670.1 305.6 669.0 500.0L669 760C669 776 666 783 662 785L500 600L474 489Z',
  a: 'M1 0C124.1 148.2 331.6 191.3 474.0 489.0L662 785C314.2 532.2 633.0 710.9 118.0 399.0C-22.3 290.2 2.6 200.5 0.0 150.0L0 4Z',
  b: 'M2 271C93.4 468.0 228.1 416.0 251.0 545.0L251 743C76.1 695.7 -13.2 587.2 0.0 380.0L0 275Z',
} as const;
type Blade = keyof typeof MARK_PATHS;

const GRADIENT_AXES: Record<Blade, [number, number, number, number]> = {
  a: [60, 40, 650, 770],
  b: [30, 290, 250, 740],
  c: [520, 210, 669, 780],
};

interface BladeState {
  /** Desplazamiento (unidades del SVG), giro (grados), escala y opacidad. */
  x?: number;
  y?: number;
  r?: number;
  s?: number;
  o?: number;
}

export const NoutLifeMark: React.FC<{ height: number; blades?: Partial<Record<Blade, BladeState>>; style?: React.CSSProperties }> = ({
  height,
  blades = {},
  style,
}) => {
  const uid = useId().replace(/:/g, '');
  return (
    <svg width={(height * MARK_SIZE.w) / MARK_SIZE.h} height={height} viewBox={`0 0 ${MARK_SIZE.w} ${MARK_SIZE.h}`} style={{ overflow: 'visible', flex: 'none', ...style }}>
      <defs>
        {(Object.keys(MARK_PATHS) as Blade[]).map((k) => {
          const [x1, y1, x2, y2] = GRADIENT_AXES[k];
          return (
            <linearGradient key={k} id={`${uid}${k}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
              {LOGO_GRADIENTS[k].map(([offset, color]) => (
                <stop key={offset} offset={offset} stopColor={color} />
              ))}
            </linearGradient>
          );
        })}
      </defs>
      {(['c', 'a', 'b'] as const).map((k) => {
        const b = blades[k] ?? {};
        return (
          <path
            key={k}
            d={MARK_PATHS[k]}
            fill={`url(#${uid}${k})`}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              transform: `translate(${b.x ?? 0}px, ${b.y ?? 0}px) rotate(${b.r ?? 0}deg) scale(${b.s ?? 1})`,
              opacity: b.o ?? 1,
            }}
          />
        );
      })}
    </svg>
  );
};

/** Trazos del wordmark «noutlife» (caja −10 −10 486 120), en orden de escritura. */
const WORDMARK_PATHS = [
  'M4 100 L16 52 A22.5 22.5 0 0 1 59 58.5 V100',
  'M110 43.5a24.5 24.5 0 1 1 0 49a24.5 24.5 0 1 1 0-49',
  'M163.5 36v41.5a22.5 22.5 0 0 0 45 0V36M208.5 36v64',
  'M240 12v68a20 20 0 0 0 20 20M240 40h26',
  'M290 0v100',
  'M322 52v48',
  'M356 100V30a22 22 0 0 1 22-22h4M342 46h34',
  'M406 78 L449 56 A24.5 24.5 0 1 0 448.3 84.7',
];

/** Wordmark monolínea. Con `at`, se escribe trazo a trazo desde ese fotograma. */
export const Wordmark: React.FC<{ height: number; at?: number; color?: string }> = ({ height, at, color = COLORS.text }) => {
  const frame = useCurrentFrame();
  const draw = (i: number) => (at === undefined ? 1 : ramp(frame, at + i * 4, at + i * 4 + 36, EASE.inOut));
  const dot = at === undefined ? 1 : springAt(frame, at + 42, SPRING.pop);
  return (
    <svg
      viewBox="-10 -10 486 120"
      height={height}
      width={(height * 486) / 120}
      fill="none"
      stroke={color}
      strokeWidth={15}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ overflow: 'visible', flex: 'none' }}
    >
      {WORDMARK_PATHS.map((d, i) => (
        <path key={d} d={d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1.01 * (1 - draw(i))} />
      ))}
      <circle cx={322} cy={22} r={9} fill={color} stroke="none" style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${dot})` }} />
    </svg>
  );
};

// ---------- Splash ----------

/** [fracción del vuelo, x, y, giro, escala] por hoja (index.html, @keyframes lqb-a/b/c). */
type Key = [number, number, number, number, number];
const FLIGHT: Record<Blade, { delay: number; keys: Key[] }> = {
  b: { delay: 0.05, keys: [[0, -0.46 * WIDTH, 0.22 * HEIGHT, -140, 0.45], [0.55, -90, -110, 38, 0.95], [0.82, 6, 4, -5, 1.02], [1, 0, 0, 0, 1]] },
  a: { delay: 0.12, keys: [[0, 0.4 * WIDTH, -0.34 * HEIGHT, 170, 0.4], [0.55, 120, 70, -34, 1.06], [0.82, -5, -3, 4, 0.99], [1, 0, 0, 0, 1]] },
  c: { delay: 0.2, keys: [[0, 0.34 * WIDTH, 0.36 * HEIGHT, -210, 0.5], [0.55, -110, 40, 28, 0.92], [0.82, 4, -5, -4, 1.02], [1, 0, 0, 0, 1]] },
};
/** El splash mide 150 px de alto: sus desplazamientos intermedios (px) escalan con la marca. */
const SPLASH_H = 150;
const FLIGHT_EASE = Easing.bezier(0.45, 0.05, 0.2, 1);
const SETTLE_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

/** La N del splash: las hojas vuelan desde fuera (1,45 s cada una) y la N late al final. */
export const SplashMark: React.FC<{ height: number; at: number; style?: React.CSSProperties }> = ({ height, at, style }) => {
  const frame = useCurrentFrame();
  const units = MARK_SIZE.h / height; // px del lienzo → unidades del SVG
  const blades: Partial<Record<Blade, BladeState>> = {};
  for (const k of Object.keys(FLIGHT) as Blade[]) {
    const { delay, keys } = FLIGHT[k];
    const t = (frame - at - delay * 60) / (1.45 * 60);
    const input = keys.map((key) => key[0]);
    const val = (i: number) => interpolate(t, input, keys.map((key) => key[i]), { easing: FLIGHT_EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    blades[k] = {
      x: val(1) * units * lerpScale(t, height),
      y: val(2) * units * lerpScale(t, height),
      r: val(3),
      s: val(4),
      o: interpolate(t, [0, 0.18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    };
  }
  const settleT = (frame - at - 1.62 * 60) / (0.7 * 60);
  const settle = interpolate(settleT, [0, 0.4, 1], [1, 1.07, 1], { easing: SETTLE_EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ transform: `scale(${settle})`, ...style }}>
      <NoutLifeMark height={height} blades={blades} />
    </div>
  );
};

/**
 * En el primer tramo la hoja pasa de coordenadas de pantalla (inicio) a las del
 * splash (a mitad de vuelo): mezcla las dos escalas para que no salte.
 */
function lerpScale(t: number, height: number) {
  const k = Math.min(1, Math.max(0, t / 0.55));
  return 1 + (height / SPLASH_H - 1) * k;
}
