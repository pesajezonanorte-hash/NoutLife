import { getLocale, INTL_LOCALE } from '@/lib/i18n';

export function xpForNextLevel(currentLevel: number): number {
  return Math.floor(100 * currentLevel * Math.pow(1.15, currentLevel - 1));
}

export function calculateLevel(totalXp: number): number {
  let level = 1;
  let xpSum = 0;
  while (true) {
    const needed = xpForNextLevel(level);
    if (xpSum + needed > totalXp) return level;
    xpSum += needed;
    level++;
  }
}

export function xpProgressPercent(xp: number, xpToNext: number): number {
  return Math.min(100, Math.round((xp / xpToNext) * 100));
}

export function formatXP(n: number): string {
  return n.toLocaleString(INTL_LOCALE[getLocale()]);
}
