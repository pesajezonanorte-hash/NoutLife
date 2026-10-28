// Paleta del anuncio fuera del teléfono. Dos opciones, con la prop `palette`:
// - «brief»: la del brief (slate #0f172a, jade #10b981). Ojo: la app no usa estos dos
//   valores; su modo oscuro (Aurora) es negro verdoso con jade-400.
// - «aurora»: los tokens reales de apps/web/src/styles/tokens.css (html.dark).
// El oro champán (#d4b483) es el de la app en las dos. Dentro del teléfono la app se ve
// siempre con Aurora (Video/theme.ts), como en un móvil de verdad.
import { createContext, useContext } from 'react';

export type PaletteName = 'brief' | 'aurora';

export interface AdPalette {
  bg: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  jade: string;
  jadeBright: string;
  jadeDeep: string;
  /** Texto sobre el botón jade. */
  onJade: string;
  gold: string;
  goldLight: string;
  goldPale: string;
  goldDeep: string;
  /** Relleno del cristal (Liquid Glass): el fondo al 70 %. */
  glass: string;
  /** Luz de contorno del teléfono sobre el fondo. */
  backlight: string;
}

export const PALETTES: Record<PaletteName, AdPalette> = {
  brief: {
    bg: '#0f172a',
    ink: '#f8fafc',
    inkSoft: '#cbd5e1',
    inkMuted: '#94a3b8',
    jade: '#10b981',
    jadeBright: '#34d399',
    jadeDeep: '#047857',
    onJade: '#0f172a',
    gold: '#d4b483',
    goldLight: '#ecd7ad',
    goldPale: '#f8efdc',
    goldDeep: '#a9834d',
    glass: 'rgba(15, 23, 42, 0.7)',
    backlight: '#94a3b8',
  },
  aurora: {
    bg: '#070d0a',
    ink: '#e6f2e8',
    inkSoft: '#c4e2ca',
    inkMuted: '#8fae9c',
    jade: '#85c7a1',
    jadeBright: '#a5d2b5',
    jadeDeep: '#548f6f',
    onJade: '#0e1d16',
    gold: '#d4b483',
    goldLight: '#ecd7ad',
    goldPale: '#f8efdc',
    goldDeep: '#a9834d',
    glass: 'rgba(13, 22, 17, 0.7)',
    backlight: '#8fae9c',
  },
};

const PaletteContext = createContext<AdPalette>(PALETTES.brief);
export const PaletteProvider = PaletteContext.Provider;
export const usePalette = () => useContext(PaletteContext);
