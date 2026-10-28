// Texto de los avisos (bandeja y push): siempre texto plano. Los hábitos guardan su
// ícono como clave ('gym', 'code', 'strong'…) o como emoji antiguo; en un título se
// ve el emoji, nunca la clave. Un texto con etiquetas o markdown (IA, copias) llega limpio.

/** Claves de HABIT_ICON_OPTIONS (web, components/ui/glyphs.tsx) → emoji. */
const ICON_EMOJI: Record<string, string> = {
  droplet: '💧', moon: '🌙', yoga: '🧘', book: '📖', gym: '🏋️', apple: '🍎', pill: '💊', walk: '🚶',
  clean: '🧹', write: '✍️', music: '🎵', game: '🎮', leaf: '🍃', sun: '☀️', run: '🏃', bike: '🚴',
  code: '💻', notes: '📝', target: '🎯', star: '⭐', strong: '💪', brain: '🧠', money: '💰', art: '🎨',
  dance: '💃', salad: '🥗', sleep: '😴', read: '📚', sea: '🌊', heart: '❤️',
};

/** Emoji del ícono de un hábito: el emoji guardado tal cual, la clave traducida o `fallback`. */
export function iconEmoji(icon: string | null | undefined, fallback = '✅'): string {
  const value = (icon ?? '').trim();
  if (!value) return fallback;
  if (!/[a-z]/i.test(value)) return value;
  return ICON_EMOJI[value.toLowerCase()] ?? fallback;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Quita entidades, etiquetas HTML y marcas de markdown; deja un espacio entre palabras. */
export function plainText(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_, name: string) => ENTITIES[name])
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}
