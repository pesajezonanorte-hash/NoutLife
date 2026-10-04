// Paletas de los temas de la Tienda: son datos del catálogo (los colores que el
// tema aplica a la app), no estilos de componente. Las usa ThemePreviewDialog.
import type { ThemePalette } from '@/components/ui/lq';

export const THEME_PALETTES: Record<string, ThemePalette> = {
  aurora: { background: '#131316', surface: '#1a1a1e', accent: '#d9b44a', soft: '#a8871e', text: '#f5f5f5' },
  cyber: { background: '#050505', surface: '#0d0d0d', accent: '#f5f5f5', soft: '#8a8a92', text: '#f5f5f5' },
  forest: { background: '#151411', surface: '#1c1a16', accent: '#c9a94e', soft: '#4a825f', text: '#f2efe6' },
  ocean: { background: '#121316', surface: '#181a1e', accent: '#cbb45c', soft: '#3b82f6', text: '#eef2f7' },
  sunset: { background: '#1a1a1a', surface: '#212121', accent: '#d4b45e', soft: '#b5453a', text: '#f5f0e8' },
  retro: { background: '#141414', surface: '#1c1c1c', accent: '#e0c040', soft: '#8a8a92', text: '#f5f5f5' },
};

const NAME_TO_ID: Record<string, string> = { Aurora: 'aurora', Cyber: 'cyber', Forest: 'forest', Ocean: 'ocean', Sunset: 'sunset', 'Retro SNES': 'retro', Retro: 'retro' };

/** Id del tema a partir del nombre o la imageKey del artículo. */
export function themeIdOf(item: { name: string; imageKey?: string }): string | null {
  if (item.imageKey && THEME_PALETTES[item.imageKey]) return item.imageKey;
  const byName = Object.entries(NAME_TO_ID).find(([n]) => item.name.includes(n));
  return byName ? byName[1] : null;
}
