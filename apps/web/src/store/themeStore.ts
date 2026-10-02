import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Tema claro/oscuro. Fuente de verdad única: este store (persistido en
// localStorage['lq-theme']). Aplica `.dark` / `.light` en <html>.
// Auto = sigue prefers-color-scheme y reacciona cuando el sistema cambia.
export type ThemeMode = 'light' | 'dark' | 'auto';

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** Valor previo a este store: localStorage['theme'] = light | dark | system. */
function legacyMode(): ThemeMode {
  const v = localStorage.getItem('theme');
  return v === 'dark' ? 'dark' : v === 'system' ? 'auto' : 'light';
}

export function resolveDark(mode: ThemeMode, systemDark = media().matches): boolean {
  return mode === 'auto' ? systemDark : mode === 'dark';
}

function applyClass(mode: ThemeMode, systemDark: boolean) {
  const dark = resolveDark(mode, systemDark);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
}

interface ThemeState {
  mode: ThemeMode;
  systemDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: legacyMode(),
      systemDark: media().matches,
      setMode: (mode) => {
        applyClass(mode, get().systemDark);
        set({ mode });
      },
    }),
    { name: 'lq-theme', partialize: (s) => ({ mode: s.mode }) },
  ),
);

/** `true` si el tema efectivo es oscuro. */
export const useIsDark = () => useThemeStore((s) => resolveDark(s.mode, s.systemDark));

// Aplica el tema al cargar el módulo (antes del primer render: sin parpadeo)
// y sigue al sistema mientras el modo sea Auto.
applyClass(useThemeStore.getState().mode, useThemeStore.getState().systemDark);
media().addEventListener('change', (e) => {
  useThemeStore.setState({ systemDark: e.matches });
  applyClass(useThemeStore.getState().mode, e.matches);
});
