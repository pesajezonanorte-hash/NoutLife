import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SKINS } from '@/lib/shopThemes';

// Tema claro/oscuro y tema de la Tienda. Fuente de verdad única: este store
// (persistido en localStorage['lq-theme']). Aplica `.dark` / `.light` y
// data-theme en <html>. Auto = sigue prefers-color-scheme.
// Un tema de la Tienda (skin) fija su propio esquema mientras está puesto;
// el modo elegido se conserva y vuelve al quitarlo. La cuenta guarda el tema
// (users.equippedTheme); aquí solo se recuerda para pintarlo antes del primer render.
export type ThemeMode = 'light' | 'dark' | 'auto';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Valor previo a este store: localStorage['theme'] = light | dark | system. */
function legacyMode(): ThemeMode {
  const v = localStorage.getItem('theme');
  return v === 'dark' ? 'dark' : v === 'system' ? 'auto' : 'light';
}

export function resolveDark(mode: ThemeMode, systemDark = media().matches, skin: string | null = null): boolean {
  const scheme = skin ? SKINS[skin]?.scheme : undefined;
  if (scheme) return scheme === 'dark';
  return mode === 'auto' ? systemDark : mode === 'dark';
}

const loadedFonts = new Set<string>();
function loadFont(skin: string | null) {
  const font = skin ? SKINS[skin]?.font : undefined;
  if (!font || loadedFonts.has(font)) return;
  loadedFonts.add(font);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font}&display=swap`;
  document.head.appendChild(link);
}

function apply(mode: ThemeMode, systemDark: boolean, skin: string | null) {
  const dark = resolveDark(mode, systemDark, skin);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.setAttribute('data-theme', skin ?? 'aurora');
  // Barra de estado del móvil (app instalada): el fondo del tema, no el del sistema.
  const bar = (skin && SKINS[skin]?.palette.background) || (dark ? '#070d0a' : '#f9f7f3');
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bar));
  loadFont(skin);
}

interface ThemeState {
  mode: ThemeMode;
  systemDark: boolean;
  /** Tema de la Tienda puesto (null = Aurora). */
  skin: string | null;
  setMode: (mode: ThemeMode) => void;
  setSkin: (skin: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: legacyMode(),
      systemDark: media().matches,
      skin: null,
      setMode: (mode) => {
        apply(mode, get().systemDark, get().skin);
        set({ mode });
      },
      setSkin: (skin) => {
        const next = skin && skin !== 'aurora' && SKINS[skin] ? skin : null;
        apply(get().mode, get().systemDark, next);
        if (next !== get().skin) set({ skin: next });
      },
    }),
    // skinDark: lo lee el script de index.html para pintar sin parpadeo.
    { name: 'lq-theme', partialize: (s) => ({ mode: s.mode, skin: s.skin, skinDark: s.skin ? SKINS[s.skin]?.scheme === 'dark' : null }) },
  ),
);

/** `true` si el tema efectivo es oscuro. */
export const useIsDark = () => useThemeStore((s) => resolveDark(s.mode, s.systemDark, s.skin));

// Aplica el tema al cargar el módulo (antes del primer render: sin parpadeo)
// y sigue al sistema mientras el modo sea Auto.
{ const s = useThemeStore.getState(); apply(s.mode, s.systemDark, s.skin); }
media().addEventListener('change', (e) => {
  useThemeStore.setState({ systemDark: e.matches });
  const s = useThemeStore.getState();
  apply(s.mode, e.matches, s.skin);
});
