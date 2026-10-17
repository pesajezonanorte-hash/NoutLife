// Isotipo y logotipo de NoutLife con los trazados reales de
// apps/web/public/brand/noutlife-logo-horizontal-on-dark.svg. El isotipo son tres
// hojas que se animan por separado; las letras de «Noutlife» también, y el punto
// de la «i» es su propio trazado para que pueda soltarse y volverse el nodo.
import type React from 'react';
import { useId } from 'react';
import { COLORS, LOGO_GRADIENTS } from '../theme';

export const MARK_SIZE = { w: 670, h: 786 };

const MARK_PATHS = {
  c: 'M474 198C581.2 230.2 670.1 305.6 669.0 500.0L669 760C669 776 666 783 662 785L500 600L474 489Z',
  a: 'M1 0C124.1 148.2 331.6 191.3 474.0 489.0L662 785C314.2 532.2 633.0 710.9 118.0 399.0C-22.3 290.2 2.6 200.5 0.0 150.0L0 4Z',
  b: 'M2 271C93.4 468.0 228.1 416.0 251.0 545.0L251 743C76.1 695.7 -13.2 587.2 0.0 380.0L0 275Z',
} as const;
export type Blade = keyof typeof MARK_PATHS;

/** Centro de cada hoja respecto del centro del isotipo (unidades del SVG). */
export const BLADE_OFFSET: Record<Blade, { x: number; y: number }> = {
  a: { x: -4, y: -1 },
  b: { x: -210, y: 114 },
  c: { x: 236, y: 98 },
};

const GRADIENT_AXES: Record<Blade, [number, number, number, number]> = {
  a: [60, 40, 650, 770],
  b: [30, 290, 250, 740],
  c: [520, 210, 669, 780],
};

export interface BladeState {
  /** Escala, giro (grados), desplazamiento (unidades del SVG) y opacidad. */
  s?: number;
  r?: number;
  x?: number;
  y?: number;
  o?: number;
}

export const NoutLifeMark: React.FC<{
  height: number;
  blades?: Partial<Record<Blade, BladeState>>;
  /** 0→1: barrido de luz sobre las hojas (null = sin barrido). */
  sheen?: number | null;
  style?: React.CSSProperties;
}> = ({ height, blades = {}, sheen = null, style }) => {
  const uid = useId().replace(/:/g, '');
  const width = (height * MARK_SIZE.w) / MARK_SIZE.h;
  const bladeStyle = (k: Blade): React.CSSProperties => {
    const b = blades[k] ?? {};
    return {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      transform: `translate(${b.x ?? 0}px, ${b.y ?? 0}px) rotate(${b.r ?? 0}deg) scale(${b.s ?? 1})`,
      opacity: b.o ?? 1,
    };
  };
  const showSheen = sheen !== null && sheen > 0 && sheen < 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${MARK_SIZE.w} ${MARK_SIZE.h}`} style={{ overflow: 'visible', ...style }}>
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
        <clipPath id={`${uid}clip`}>
          <path d={MARK_PATHS.c} />
          <path d={MARK_PATHS.a} />
          <path d={MARK_PATHS.b} />
        </clipPath>
        <linearGradient id={`${uid}sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={MARK_PATHS.c} fill={`url(#${uid}c)`} style={bladeStyle('c')} />
      <path d={MARK_PATHS.a} fill={`url(#${uid}a)`} style={bladeStyle('a')} />
      <path d={MARK_PATHS.b} fill={`url(#${uid}b)`} style={bladeStyle('b')} />
      {showSheen && (
        <g clipPath={`url(#${uid}clip)`}>
          <rect x={-520 + sheen * 1500} y={-120} width={240} height={1040} fill={`url(#${uid}sheen)`} transform="skewX(-20)" opacity={0.55} />
        </g>
      )}
    </svg>
  );
};

/** Caja del logotipo «Noutlife» en unidades de la fuente (línea base en y = 0). */
export const WORDMARK_BOX = { x: 100, y: -760, w: 3840, h: 770 };
/** El punto de la «i»: centro y radio en unidades de la fuente. */
export const I_DOT = { cx: 2896.35, cy: -694.45, r: 62.35 };

const LETTERS: Array<{ d: string; order: number; dot?: boolean }> = [
  { order: 0, d: 'M105.1 0V-700H187.2L649.5 -125.2H607.3V-700H706.6V0H624.6L162.3 -574.8H204.5V0Z' },
  {
    order: 1,
    d: 'M1117.7 5.5Q1038.4 5.5 976.3 -29.2Q914.1 -64 878.1 -125.3Q842.2 -186.7 842.2 -265.1Q842.2 -344.4 878.3 -405.1Q914.4 -465.7 976.2 -500.5Q1038.1 -535.2 1117.7 -535.2Q1197.3 -535.2 1259.6 -500.5Q1322 -465.9 1357.6 -405.3Q1393.2 -344.7 1393.2 -265Q1393.2 -186.4 1357.7 -125.2Q1322.2 -64 1259.6 -29.2Q1196.9 5.5 1117.7 5.5ZM1117.7 -78.5Q1169.3 -78.5 1209.6 -101.5Q1249.8 -124.4 1273.1 -166.8Q1296.3 -209.1 1296.3 -265Q1296.3 -321.7 1273.1 -363.5Q1249.8 -405.4 1209.6 -428.3Q1169.3 -451.2 1118.1 -451.2Q1066.9 -451.2 1026.7 -428.3Q986.5 -405.4 962.8 -363.5Q939 -321.7 939 -265Q939 -209.1 962.8 -166.8Q986.5 -124.4 1026.6 -101.5Q1066.7 -78.5 1117.7 -78.5Z',
  },
  {
    order: 2,
    d: 'M1737.2 5.5Q1668.7 5.5 1617.4 -19.4Q1566.1 -44.3 1537.7 -95.7Q1509.2 -147.1 1509.2 -224.7V-529.7H1605.2V-235.6Q1605.2 -158.2 1642.5 -119.2Q1679.9 -80.2 1748.1 -80.2Q1797.9 -80.2 1834.7 -100.5Q1871.6 -120.8 1892 -160.3Q1912.3 -199.7 1912.3 -256.3V-529.7H2008.3V0H1916.5V-142.6L1932 -105Q1905.8 -52.4 1853.9 -23.4Q1802 5.5 1737.2 5.5Z',
  },
  {
    order: 3,
    d: 'M2361.3 5.5Q2280.9 5.5 2237.1 -37.1Q2193.3 -79.7 2193.3 -160.3V-646H2289.3V-163.6Q2289.3 -121.3 2310.8 -98.2Q2332.3 -75.1 2372.5 -75.1Q2416.9 -75.1 2446.6 -99.5L2476.7 -30.6Q2455.3 -12.5 2424.4 -3.5Q2393.6 5.5 2361.3 5.5ZM2102.6 -450.7V-529.7H2441.5V-450.7Z',
  },
  { order: 4, d: 'M2581.4 0V-742H2677.4V0Z' },
  { order: 5, d: 'M2848.4 0V-529.7H2944.4V0Z' },
  {
    order: 5,
    dot: true,
    d: 'M2896.4 -632.1Q2868.6 -632.1 2850.1 -650.3Q2831.5 -668.4 2831.5 -694.4Q2831.5 -720.6 2850.1 -738.7Q2868.6 -756.8 2896.4 -756.8Q2924.2 -756.8 2942.7 -739.5Q2961.2 -722.3 2961.2 -696.1Q2961.2 -669.2 2943.1 -650.7Q2925.1 -632.1 2896.4 -632.1Z',
  },
  {
    order: 6,
    d: 'M3129.3 0V-577.5Q3129.3 -654.7 3174.4 -701.1Q3219.6 -747.5 3304.1 -747.5Q3335.5 -747.5 3363.8 -740.2Q3392.2 -732.9 3411.8 -717.3L3382.6 -644.2Q3368.3 -656 3349.2 -662.3Q3330.1 -668.6 3309.3 -668.6Q3266.6 -668.6 3244.7 -645.1Q3222.7 -621.6 3222.7 -575.8V-504.7L3225.3 -460.8V0ZM3038.6 -450.7V-529.7H3377.5V-450.7Z',
  },
  {
    order: 7,
    d: 'M3692.2 5.5Q3607.1 5.5 3542.7 -29.2Q3478.4 -64 3442.8 -125.2Q3407.2 -186.4 3407.2 -264.9Q3407.2 -343.6 3441.6 -404.6Q3475.9 -465.7 3536.3 -500.4Q3596.8 -535.2 3673.2 -535.2Q3749.6 -535.2 3808.8 -501Q3867.9 -466.8 3901.5 -405.4Q3935.2 -344.1 3935.2 -262.3Q3935.2 -256.2 3934.7 -248.1Q3934.3 -239.9 3933.5 -232.8H3482.4V-302.5H3882.8L3844.4 -278.2Q3845.2 -329.3 3823 -369Q3800.7 -408.6 3762.2 -431.2Q3723.7 -453.7 3673.2 -453.7Q3622.9 -453.7 3583.8 -431.2Q3544.8 -408.6 3523.1 -368.5Q3501.3 -328.5 3501.3 -275.7V-259.8Q3501.3 -206.6 3525.6 -165.5Q3549.8 -124.4 3593.7 -101.5Q3637.6 -78.5 3694.7 -78.5Q3741.7 -78.5 3780.6 -94.3Q3819.5 -110 3847.9 -142.4L3900.8 -80.3Q3865.1 -38.3 3811.7 -16.4Q3758.3 5.5 3692.2 5.5Z',
  },
];

/** Logotipo «Noutlife»: `progress(i)` da el avance 0→1 de la letra i (0 = N … 7 = e). */
export const Wordmark: React.FC<{
  width: number;
  progress?: (order: number) => number;
  hideDot?: boolean;
  color?: string;
  style?: React.CSSProperties;
}> = ({ width, progress = () => 1, hideDot = false, color = COLORS.ivory, style }) => {
  const height = (width * WORDMARK_BOX.h) / WORDMARK_BOX.w;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${WORDMARK_BOX.x} ${WORDMARK_BOX.y} ${WORDMARK_BOX.w} ${WORDMARK_BOX.h}`}
      style={{ overflow: 'visible', ...style }}
    >
      {LETTERS.map((l, i) => {
        if (l.dot && hideDot) return null;
        const p = progress(l.order);
        return (
          <path
            key={i}
            d={l.d}
            fill={color}
            style={{ transform: `translateY(${(1 - p) * 150}px)`, opacity: Math.min(1, p * 1.4) }}
          />
        );
      })}
    </svg>
  );
};
