// Glifos pixel para los gestos entre amigos (mano que saluda, corazón, nota,
// estrella, sobre…): el mismo lenguaje que los muñequitos. Cada glifo es una
// rejilla pequeña pintada con tokens; son decorativos (aria-hidden): el gesto
// siempre va acompañado de su texto.
import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { GestureKind } from '@/services/network.service';

type GlyphName = 'wave' | 'heart' | 'note' | 'star' | 'laugh' | 'highfive' | 'letter' | 'bang';

// X = tono principal · o = contorno · w = papel · . = vacío
const GRIDS: Record<GlyphName, { rows: string[]; fill: string }> = {
  wave: {
    fill: 'rgb(var(--lq-warning))',
    rows: [
      '.o.o.o..',
      'oXoXoXo.',
      'oXoXoXoo',
      'oXXXXXXo',
      'ooXXXXXo',
      'oXXXXXXo',
      '.oXXXXo.',
      '..oooo..',
    ],
  },
  highfive: {
    fill: 'rgb(var(--lq-warning))',
    rows: [
      'o..o.o.o',
      '.oXoXoXo',
      '.oXoXoXo',
      '.oXXXXXo',
      'ooXXXXXo',
      'oXXXXXXo',
      '.oXXXXo.',
      '..oooo..',
    ],
  },
  heart: {
    fill: 'rgb(var(--lq-error))',
    rows: [
      '.oo.oo.',
      'oXXoXXo',
      'oXwXXXo',
      'oXXXXXo',
      '.oXXXo.',
      '..oXo..',
      '...o...',
    ],
  },
  note: {
    fill: 'rgb(var(--lq-info))',
    rows: [
      '...ooo.',
      '...oXXo',
      '...o.oX',
      '...o...',
      '.ooo...',
      'oXXo...',
      '.oo....',
    ],
  },
  star: {
    fill: 'rgb(var(--lq-warning))',
    rows: [
      '...o...',
      '..oXo..',
      'ooXXXoo',
      'oXXwXXo',
      '.oXXXo.',
      'oXXoXXo',
      'oo...oo',
    ],
  },
  laugh: {
    fill: 'rgb(var(--lq-warning))',
    rows: [
      '.ooooo.',
      'oXXXXXo',
      'oXoXoXo',
      'oXXXXXo',
      'oowwwoo',
      'oXoooXo',
      '.ooooo.',
    ],
  },
  letter: {
    fill: 'rgb(var(--lq-jade-50))',
    rows: [
      'oooooooo',
      'oowXXwoo',
      'oXowwoXo',
      'oXXooXXo',
      'oXXXXXXo',
      'oooooooo',
    ],
  },
  bang: {
    fill: 'rgb(var(--lq-error))',
    rows: ['oXo', 'oXo', 'oXo', 'oXo', '.o.', 'oXo', '.o.'],
  },
};

export const GESTURE_GLYPH: Record<GestureKind, GlyphName> = {
  wave: 'wave', heart: 'heart', dance: 'note', cheer: 'star', laugh: 'laugh', highfive: 'highfive',
};

export const PixelGlyph = memo(function PixelGlyph({ name, size = 16, className }: { name: GlyphName; size?: number; className?: string }) {
  const g = GRIDS[name];
  const w = Math.max(...g.rows.map((r) => r.length));
  const h = g.rows.length;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" className={cn('block overflow-visible', className)}>
      {g.rows.flatMap((row, y) => [...row].map((c, x) => {
        if (c === '.') return null;
        const fill = c === 'X' ? g.fill : c === 'w' ? 'rgb(255 255 255 / .85)' : 'rgb(var(--lq-jade-900))';
        return <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />;
      }))}
    </svg>
  );
});

export type { GlyphName };
