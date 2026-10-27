import { Flag, Flame, LayoutGrid, Sparkles, Star, Swords, Trophy, type LucideIcon } from 'lucide-react';
import type { Tone } from '@/components/ui/lq';
import { resolveGlyph } from '@/components/ui/glyphs';
import type { Achievement } from '@/services/achievement.service';
import type { Locale } from '@/lib/locale';

const CATEGORY_STYLE: Record<string, { tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  quest: { tone: 'primary', icon: Flag },
  habit: { tone: 'warning', icon: Flame },
  level: { tone: 'forest', icon: Star },
  // «gym» es la categoría guardada de los logros del Coliseo.
  gym: { tone: 'success', icon: Swords },
  category: { tone: 'info', icon: LayoutGrid },
  special: { tone: 'error', icon: Sparkles },
};

const CATEGORY_LABEL: Record<Locale, Record<string, string>> = {
  es: { quest: 'Misiones', habit: 'Hábitos', level: 'Nivel', gym: 'Coliseo', category: 'Zonas', special: 'Especiales', other: 'Otros' },
  en: { quest: 'Goals', habit: 'Habits', level: 'Level', gym: 'Coliseum', category: 'Zones', special: 'Special', other: 'Other' },
};

/** Nombre y estilo de la categoría de un logro, en el idioma indicado. */
export function achievementCategory(c: string, locale: Locale = 'es') {
  const style = CATEGORY_STYLE[c];
  const label = CATEGORY_LABEL[locale][style ? c : 'other'];
  return style ? { label, ...style } : { label, tone: 'primary' as const, icon: Trophy };
}

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
