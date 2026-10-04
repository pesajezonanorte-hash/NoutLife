import { Dumbbell, Flag, Flame, LayoutGrid, Sparkles, Star, Trophy, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui/lq';
import { resolveGlyph } from '@/components/ui/glyphs';
import type { Achievement } from '@/services/achievement.service';

export const ACHIEVEMENT_CATEGORY: Record<string, { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  quest: { label: 'Misiones', tone: 'primary', icon: Flag },
  habit: { label: 'Hábitos', tone: 'warning', icon: Flame },
  level: { label: 'Nivel', tone: 'forest', icon: Star },
  gym: { label: 'Gimnasio', tone: 'success', icon: Dumbbell },
  category: { label: 'Zonas', tone: 'info', icon: LayoutGrid },
  special: { label: 'Especiales', tone: 'error', icon: Sparkles },
};
export const achievementCategory = (c: string) => ACHIEVEMENT_CATEGORY[c] ?? { label: 'Otros', tone: 'primary' as const, icon: Trophy };

/** Ícono del logro; resolveGlyph devuelve Star para claves desconocidas → ícono de la categoría. */
export function achievementIcon(a: Achievement): LucideIcon {
  const glyph = a.icon ? resolveGlyph(a.icon) : null;
  return glyph && (glyph !== Star || /star|⭐|🌟/i.test(a.icon)) ? glyph : achievementCategory(a.category).icon;
}

export function achievementProgress(a: Achievement) {
  const target = a.target ?? a.progressTarget ?? 0;
  const current = Math.min(target, a.progress ?? 0);
  const pct = a.unlocked ? 100 : target > 0 ? Math.round((current / target) * 100) : 0;
  return { target, current, pct };
}
