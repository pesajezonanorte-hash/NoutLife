// Temas de la Tienda. La fuente de verdad es users.equippedTheme ("theme_neon"):
// la Tienda lo guarda al comprar o equipar, y App lo aplica a <html data-theme>.
// Los colores que pinta cada tema viven en styles/skins.css; aquí está lo que
// necesita JS: si el tema es claro u oscuro, su fuente y la paleta de la vista previa.
import type { ThemePalette } from '@/components/ui/lq';

export interface Skin {
  /** Cada tema tiene un solo esquema: mientras está puesto, fija claro u oscuro. */
  scheme: 'light' | 'dark';
  /** Familia de Google Fonts que usa el tema (se carga solo al ponerlo). */
  font?: string;
  palette: ThemePalette;
}

export const SKINS: Record<string, Skin> = {
  aurora: { scheme: 'dark', palette: { background: '#070d0a', surface: '#0d1611', accent: '#85c7a1', soft: '#d4b483', text: '#e6f2e8' } },
  ocean: { scheme: 'dark', palette: { background: '#04111f', surface: '#0a1d33', accent: '#2ee6d6', soft: '#3fb0e0', text: '#e3f4ff' } },
  lava: { scheme: 'dark', palette: { background: '#120806', surface: '#1e0f0b', accent: '#ff6a1f', soft: '#ffc247', text: '#fff0e6' } },
  forest: { scheme: 'light', font: 'Nunito:wght@400;500;600;700', palette: { background: '#eef2e0', surface: '#fbfcf3', accent: '#3d7a1e', soft: '#b07a12', text: '#1f2a12' } },
  neon: { scheme: 'dark', font: 'Space+Grotesk:wght@400;500;600;700', palette: { background: '#0b0614', surface: '#150b26', accent: '#ff2bd6', soft: '#22e5ff', text: '#fbefff' } },
  galaxy: { scheme: 'dark', palette: { background: '#070617', surface: '#100d2b', accent: '#a78bfa', soft: '#f0abfc', text: '#f1edff' } },
  papyrus: { scheme: 'light', font: 'EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400', palette: { background: '#e9dcbc', surface: '#f4ead0', accent: '#7a2e1c', soft: '#a8781e', text: '#2b1d0e' } },
  mono: { scheme: 'dark', font: 'Inter:wght@400;500;600;700', palette: { background: '#000000', surface: '#0a0a0a', accent: '#fafafa', soft: '#646464', text: '#fafafa' } },
  cyber: { scheme: 'dark', font: 'Chakra+Petch:wght@400;500;600;700', palette: { background: '#0d0d0a', surface: '#16160f', accent: '#fcee0a', soft: '#ff003c', text: '#fffde0' } },
};

/** Paletas para las vistas previas (Tienda, Ajustes). */
export const THEME_PALETTES: Record<string, ThemePalette> = Object.fromEntries(Object.entries(SKINS).map(([id, s]) => [id, s.palette]));

/** Tema puesto ("theme_neon" → "neon"); null = Aurora, el tema base que sigue claro/oscuro/auto. */
export function skinOf(equippedTheme: string | null | undefined): string | null {
  const id = equippedTheme?.replace(/^theme_/, '');
  return id && id !== 'aurora' && SKINS[id] ? id : null;
}

/** Id del tema de un artículo de la Tienda ("theme_ocean" → "ocean"). */
export function themeIdOf(item: { imageKey?: string; value?: string | null }): string | null {
  const id = (item.value ?? item.imageKey)?.replace(/^theme_/, '');
  return id && SKINS[id] ? id : null;
}
