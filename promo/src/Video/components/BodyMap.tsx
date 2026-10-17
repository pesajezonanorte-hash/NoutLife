// Mapa muscular del Coliseo, de frente: los mismos trazados que
// apps/web/src/components/coliseo/MuscleMap.tsx (media figura en un viewBox de
// 200 × 420; la otra mitad es su espejo). Cada músculo se pinta según su fatiga
// en una ola de arriba abajo; los de fatiga alta laten con un brillo rojo.
import type React from 'react';
import { interpolateColors } from 'remotion';
import { COLORS, rgba } from '../theme';
import { EASE, ramp } from '../lib/anim';

const MIRROR = 'matrix(-1 0 0 1 200 0)';
const BASE =
  'M101 46C99.3 46 93 43.3 91 46C89 48.7 90.8 58.5 89 62C87.2 65.5 83.8 65.5 80 67C76.2 68.5 70.3 70 66 71C61.7 72 57.5 71.3 54 73C50.5 74.7 47.2 77.3 45 81C42.8 84.7 41.8 90.2 41 95C40.2 99.8 40.2 104.2 40 110C39.8 115.8 40.2 123.3 40 130C39.8 136.7 39.3 144.5 39 150C38.7 155.5 38.8 157.3 38 163C37.2 168.7 35.3 176.8 34 184C32.7 191.2 31 199 30 206C29 213 28.8 220 28 226C27.2 232 25 237 25 242C25 247 26.3 253.2 28 256C29.7 258.8 33 260.3 35 259C37 257.7 39.2 252.5 40 248C40.8 243.5 39.3 238.3 40 232C40.7 225.7 42.3 217.3 44 210C45.7 202.7 48 195 50 188C52 181 54.3 175 56 168C57.7 161 59 153.3 60 146C61 138.7 61.5 130 62 124C62.5 118 62.3 109.7 63 110C63.7 110.3 65 119.3 66 126C67 132.7 68.2 141.7 69 150C69.8 158.3 70.5 168.7 71 176C71.5 183.3 72.5 188.3 72 194C71.5 199.7 69 204.3 68 210C67 215.7 66.7 221 66 228C65.3 235 64 242.3 64 252C64 261.7 64.8 275.7 66 286C67.2 296.3 69.8 307.3 71 314C72.2 320.7 73.2 320.3 73 326C72.8 331.7 70.2 340.3 70 348C69.8 355.7 70.7 364 72 372C73.3 380 77.7 390 78 396C78.3 402 74 405 74 408C74 411 74.7 413 78 414C81.3 415 91.2 416 94 414C96.8 412 94.8 407.7 95 402C95.2 396.3 94.8 388.3 95 380C95.2 371.7 95.8 360.3 96 352C96.2 343.7 95.8 338.7 96 330C96.2 321.3 96.5 311.3 97 300C97.5 288.7 98.5 272 99 262C99.5 252 99.7 243.7 100 240C100.3 236.3 100.8 240 101 240Z';
const DELT_OUTER =
  'M60 72C59 71.7 52.8 74 50 76C47.2 78 44.7 80.7 43 84C41.3 87.3 40.5 92 40 96C39.5 100 39.5 104.3 40 108C40.5 111.7 41.8 117.3 43 118C44.2 118.7 46 115 47 112C48 109 48.2 104 49 100C49.8 96 50.8 91.7 52 88C53.2 84.3 54.7 80.7 56 78C57.3 75.3 61 72.3 60 72Z';
const DELT_INNER =
  'M62 72C59.8 72.7 58.7 75 57 78C55.3 81 53.3 85.7 52 90C50.7 94.3 49.5 99.7 49 104C48.5 108.3 48.5 113 49 116C49.5 119 50.5 122.3 52 122C53.5 121.7 56 117.3 58 114C60 110.7 62 106 64 102C66 98 68.3 93.7 70 90C71.7 86.3 74 82.7 74 80C74 77.3 72 75.3 70 74C68 72.7 64.2 71.3 62 72Z';
const FOREARM =
  'M54 171C52.2 170.5 47.7 171.5 45 174C42.3 176.5 40 181.3 38 186C36 190.7 34.3 196.8 33 202C31.7 207.2 30.5 212.8 30 217C29.5 221.2 28.8 224.8 30 227C31.2 229.2 35 231.5 37 230C39 228.5 40.3 222.7 42 218C43.7 213.3 45.3 207 47 202C48.7 197 50.5 192.2 52 188C53.5 183.8 55.7 179.8 56 177C56.3 174.2 55.8 171.5 54 171Z';

type Status = 'high' | 'moderate' | 'fresh' | 'idle';

/** Músculos de frente, en orden de arriba abajo (para la ola), con su estado de ejemplo. */
const MUSCLES: Array<{ id: string; status: Status; paths: string[] }> = [
  {
    id: 'traps',
    status: 'fresh',
    paths: ['M91 56C90.3 54.8 88.5 61 86 63C83.5 65 79.3 66.5 76 68C72.7 69.5 66.3 70.8 66 72C65.7 73.2 71 74.8 74 75C77 75.2 81.3 73.8 84 73C86.7 72.2 88.8 72.8 90 70C91.2 67.2 91.7 57.2 91 56Z'],
  },
  { id: 'sideDelts', status: 'moderate', paths: [DELT_OUTER] },
  { id: 'frontDelts', status: 'high', paths: [DELT_INNER] },
  {
    id: 'chest',
    status: 'high',
    paths: ['M100 80C98 79.7 92 78.3 88 78C84 77.7 79 77 76 78C73 79 71.7 81 70 84C68.3 87 66.8 92 66 96C65.2 100 64.7 104.3 65 108C65.3 111.7 66.2 115.3 68 118C69.8 120.7 72.7 122.7 76 124C79.3 125.3 84 126 88 126C92 126 98 124.3 100 124Z'],
  },
  {
    id: 'biceps',
    status: 'moderate',
    paths: ['M52 124C49.8 124.7 47.7 128.7 46 132C44.3 135.3 42.7 140.2 42 144C41.3 147.8 41.5 151.8 42 155C42.5 158.2 43.5 161 45 163C46.5 165 49 167.3 51 167C53 166.7 55.5 164 57 161C58.5 158 59.3 153 60 149C60.7 145 61.2 140.5 61 137C60.8 133.5 60.5 130.2 59 128C57.5 125.8 54.2 123.3 52 124Z'],
  },
  {
    id: 'abs',
    status: 'fresh',
    paths: [130, 149, 168]
      .map((y) => `M92 ${y}h4a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-4a3 3 0 0 1 -3 -3v-10a3 3 0 0 1 3 -3Z`)
      .concat('M92 187h4a3 3 0 0 1 3 3v19a3 3 0 0 1 -3 3h-4a3 3 0 0 1 -3 -3v-19a3 3 0 0 1 3 -3Z'),
  },
  {
    id: 'obliques',
    status: 'fresh',
    paths: ['M86 132C84.7 128.7 80.3 133.7 78 136C75.7 138.3 73.3 141.7 72 146C70.7 150.3 70.2 156.3 70 162C69.8 167.7 70.3 174.3 71 180C71.7 185.7 72.5 192 74 196C75.5 200 77.8 202.3 80 204C82.2 205.7 85.8 210 87 206C88.2 202 87.2 188.3 87 180C86.8 171.7 86.2 164 86 156C85.8 148 87.3 135.3 86 132Z'],
  },
  { id: 'forearms', status: 'idle', paths: [FOREARM] },
  {
    id: 'quads',
    status: 'moderate',
    paths: ['M70 226C68 228.2 66.8 234.3 66 240C65.2 245.7 65 253 65 260C65 267 65.3 275.3 66 282C66.7 288.7 67.7 294.7 69 300C70.3 305.3 71.8 311 74 314C76.2 317 79.3 317.3 82 318C84.7 318.7 87.8 319 90 318C92.2 317 93.8 316.3 95 312C96.2 307.7 96.5 299.3 97 292C97.5 284.7 97.8 275.7 98 268C98.2 260.3 98.7 251.3 98 246C97.3 240.7 96 238.7 94 236C92 233.3 88.7 231.5 86 230C83.3 228.5 80.7 227.7 78 227C75.3 226.3 72 223.8 70 226Z'],
  },
  {
    id: 'calves',
    status: 'fresh',
    paths: [
      'M74 338C73 339.7 71.5 345.7 71 350C70.5 354.3 70.7 359.3 71 364C71.3 368.7 72 374.3 73 378C74 381.7 75.8 385.7 77 386C78.2 386.3 79.5 383.7 80 380C80.5 376.3 80.2 369 80 364C79.8 359 79.5 354 79 350C78.5 346 77.8 342 77 340C76.2 338 75 336.3 74 338Z',
      'M94 338C93.3 338 92.5 345.3 92 350C91.5 354.7 91 361 91 366C91 371 91.3 377 92 380C92.7 383 94.3 386.3 95 384C95.7 381.7 95.8 371.7 96 366C96.2 360.3 96.3 354.7 96 350C95.7 345.3 94.7 338 94 338Z',
    ],
  },
];

/** Colores de fatiga de la app (MuscleMap.tsx); el vídeo los pasa más encendidos. */
export const FATIGUE_COLORS: Record<Status, string> = {
  high: COLORS.error,
  moderate: COLORS.warning,
  fresh: COLORS.success,
  idle: rgba(COLORS.textMuted, 0.3),
};
const UNPAINTED = '#2a3a31';

/** `local` = fotogramas desde que empieza a pintarse. */
export const BodyMap: React.FC<{ local: number; frame: number; height: number; palette?: Record<Status, string> }> = ({
  local,
  frame,
  height,
  palette = FATIGUE_COLORS,
}) => {
  const width = (height * 200) / 420;
  const pulse = 0.65 + 0.35 * Math.sin(frame / 7);
  return (
    <svg width={width} height={height} viewBox="0 0 200 420" style={{ overflow: 'visible' }}>
      <g fill="#1a2a21">
        <ellipse cx="100" cy="30" rx="16" ry="21" />
        <path d={BASE} />
        <path d={BASE} transform={MIRROR} />
      </g>
      {MUSCLES.map((m, i) => {
        const p = ramp(local, 6 + i * 2.2, 16 + i * 2.2, EASE.out);
        const fill = interpolateColors(p, [0, 1], [UNPAINTED, palette[m.status]]);
        const glow = m.status !== 'idle' && m.status !== 'fresh' && p > 0.5;
        const strength = m.status === 'high' ? 1 : 0.55;
        return (
          <g
            key={m.id}
            fill={fill}
            stroke="#0c1611"
            strokeWidth={1.5}
            strokeLinejoin="round"
            style={glow ? { filter: `drop-shadow(0 0 ${(4 + 4 * pulse) * strength}px ${rgba(palette[m.status], 0.85)})` } : undefined}
          >
            {m.paths.map((d) => (
              <g key={d}>
                <path d={d} />
                <path d={d} transform={MIRROR} />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
};
