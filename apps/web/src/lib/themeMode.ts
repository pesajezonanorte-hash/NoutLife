// themeMode.ts — Fachada de compatibilidad sobre store/themeStore (Zustand).
// Settings sigue usando 'light' | 'dark' | 'system';
// internamente 'system' equivale al modo 'auto' del store.
import { resolveDark, useThemeStore, type ThemeMode as StoreMode } from '../store/themeStore';

export type ThemeMode = 'light' | 'dark' | 'system';

const toStore = (m: ThemeMode): StoreMode => (m === 'system' ? 'auto' : m);
const fromStore = (m: StoreMode): ThemeMode => (m === 'auto' ? 'system' : m);

export function readThemeMode(): ThemeMode {
  return fromStore(useThemeStore.getState().mode);
}

export function resolveIsDark(mode: ThemeMode = readThemeMode()): boolean {
  return resolveDark(toStore(mode), useThemeStore.getState().systemDark);
}

export function applyThemeMode(mode: ThemeMode) {
  useThemeStore.getState().setMode(toStore(mode));
}

export function subscribeThemeMode(cb: () => void): () => void {
  return useThemeStore.subscribe(cb);
}
