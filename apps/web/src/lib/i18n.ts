// Idioma de la app: español o inglés. Manda, en este orden:
//   1. la cuenta (users.language), si hay sesión: la app se ve igual en todos tus dispositivos;
//   2. la elección guardada en este navegador (el selector de idioma o entrar por /en o /es);
//   3. el idioma del navegador: español si lo prefiere; si no, inglés (el idioma internacional).
// Hoy están en inglés la portada, los textos legales, los planes y el pago; el resto de la app sigue en
// español. Por eso <html lang> solo cambia en las páginas públicas (useDocumentLang) y cada bloque
// traducido dentro de la app lleva su propio atributo lang (lectores de pantalla y traductores).
//
// Los textos viven junto a cada pantalla como { es, en } con la misma forma (`const en: typeof es`), así
// TypeScript avisa si a un idioma le falta un texto. Glosario de nombres de zonas en lib/plan (PRO_ZONES).
// El núcleo puro (tipos, detección, formatos) está en lib/locale; aquí, el store, los hooks y el provider.
import { createContext, useContext, useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/store/authStore';
import { resolveLocale, type Copy, type Locale } from './locale';

export * from './locale';

interface LocaleState {
  /** Idioma elegido en este navegador (selector, /en o /es). null: se sigue al navegador. */
  choice: Locale | null;
  /** Último idioma con que se vio la app: el splash de index.html lo lee antes de que cargue React. */
  last: Locale | null;
  choose: (locale: Locale) => void;
  remember: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      choice: null,
      last: null,
      choose: (choice) => set({ choice, last: choice }),
      remember: (last) => set({ last }),
    }),
    { name: 'lq-locale', partialize: ({ choice, last }) => ({ choice, last }) },
  ),
);

/**
 * Idioma fijo para un trozo de la interfaz: la portada en /en o /es se ve en su idioma desde el primer
 * render, aunque el navegador prefiera el otro; una página legal puede mostrarse en el otro idioma.
 */
const LocaleOverride = createContext<Locale | null>(null);
export const LocaleProvider = LocaleOverride.Provider;

export function useLocale(): Locale {
  const forced = useContext(LocaleOverride);
  const account = useAuthStore((s) => s.user?.language);
  const choice = useLocaleStore((s) => s.choice);
  return forced ?? resolveLocale(account, choice);
}

/** Los textos de un componente en el idioma de la persona: `const t = useText(COPY)`. */
export function useText<T>(copy: Copy<T>): T {
  return copy[useLocale()];
}

/** Lo mismo fuera de React (servicios, avisos que llegan después de una petición). */
export function getLocale(): Locale {
  return resolveLocale(useAuthStore.getState().user?.language, useLocaleStore.getState().choice);
}

/**
 * <html lang> de una página pública traducida entera (portada, legales). Al salir vuelve al español:
 * el resto de la app aún no está traducido.
 */
export function useDocumentLang(locale: Locale): void {
  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    return () => { html.lang = 'es'; };
  }, [locale]);
}
