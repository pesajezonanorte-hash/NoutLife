// Paletas de los temas de la Tienda: son datos del catálogo (los colores que el
// tema aplica a la app), no estilos de componente. Las usa ThemePreviewDialog.
import type { ThemePalette } from '@/components/ui/lq';

export const THEME_PALETTES: Record<string, ThemePalette> = {
  aurora: { background: '#0e1d16', surface: '#14261d', accent: '#d4b483', soft: '#85c7a1', text: '#e6f2e8' },
  cyber: { background: '#050505', surface: '#0d0d0d', accent: '#f5f5f5', soft: '#8a8a92', text: '#f5f5f5' },
  forest: { background: '#151411', surface: '#1c1a16', accent: '#c9a94e', soft: '#4a825f', text: '#f2efe6' },
  ocean: { background: '#121316', surface: '#181a1e', accent: '#cbb45c', soft: '#3b82f6', text: '#eef2f7' },
  sunset: { background: '#1a1a1a', surface: '#212121', accent: '#d4b45e', soft: '#b5453a', text: '#f5f0e8' },
  retro: { background: '#141414', surface: '#1c1c1c', accent: '#e0c040', soft: '#8a8a92', text: '#f5f5f5' },
  lava: { background: '#1a1210', surface: '#241815', accent: '#ff7a2f', soft: '#d9434b', text: '#f8ece4' },
  neon: { background: '#0d0b16', surface: '#16122a', accent: '#ff4fd8', soft: '#22d3ee', text: '#f2f0ff' },
  galaxy: { background: '#0f0b1f', surface: '#181233', accent: '#b794f6', soft: '#7c5cff', text: '#efeaff' },
};

const NAME_TO_ID: Record<string, string> = { Aurora: 'aurora', Cyber: 'cyber', Forest: 'forest', Ocean: 'ocean', Sunset: 'sunset', 'Retro SNES': 'retro', Retro: 'retro' };

/** Id del tema a partir del nombre o la imageKey del artículo ("theme_ocean" → "ocean"). */
export function themeIdOf(item: { name: string; imageKey?: string }): string | null {
  const key = item.imageKey?.replace(/^theme_/, '');
  if (key && THEME_PALETTES[key]) return key;
  const byName = Object.entries(NAME_TO_ID).find(([n]) => item.name.includes(n));
  return byName ? byName[1] : null;
}
