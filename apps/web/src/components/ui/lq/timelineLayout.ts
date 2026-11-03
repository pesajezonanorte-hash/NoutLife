import type { ReactNode } from 'react';

export interface TimelineItem {
  id: string;
  /** Minutos desde las 00:00. */
  start: number;
  /** Duración en minutos: el bloque ocupa exactamente ese tramo de la rejilla. */
  duration: number;
  render: ReactNode;
  className?: string;
}

/**
 * Alto mínimo de un bloque (px): una línea de título con su hora. Un bloque más corto
 * que su duración se muestra con este alto, y el reparto en columnas lo cuenta igual,
 * así que dos bloques nunca quedan encima uno del otro.
 */
export const MIN_BLOCK_PX = 28;

/** Reparte los bloques solapados en columnas (greedy por inicio). Cada bloque ocupa al menos `minMinutes`. */
export function layoutTimeline(items: TimelineItem[], minMinutes: number) {
  const extent = (item: TimelineItem) => Math.max(item.duration, minMinutes);
  const sorted = [...items].sort((a, b) => a.start - b.start || b.duration - a.duration);
  const out: Array<{ item: TimelineItem; col: number; cols: number }> = [];
  let group: typeof out = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => { g.cols = cols; });
    out.push(...group);
    group = [];
  };
  for (const item of sorted) {
    if (group.length && item.start >= groupEnd) flush();
    const taken = new Set(group.filter((g) => g.item.start + extent(g.item) > item.start).map((g) => g.col));
    let col = 0;
    while (taken.has(col)) col += 1;
    group.push({ item, col, cols: 1 });
    groupEnd = Math.max(groupEnd, item.start + extent(item));
  }
  flush();
  return out;
}
