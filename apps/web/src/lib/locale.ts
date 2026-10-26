// Núcleo puro del idioma (sin React ni stores): tipos, detección y formatos. Lo importan los módulos de
// reglas puras (lib/plan, lib/offer, lib/planPreview…), que también corren en las pruebas unitarias.
// La capa de React (store, hooks y LocaleProvider) vive en lib/i18n, que reexporta todo esto.

export type Locale = 'es' | 'en';
export const LOCALES: readonly Locale[] = ['es', 'en'];
export const isLocale = (value: unknown): value is Locale => value === 'es' || value === 'en';

/** Nombre de cada idioma en su propio idioma (selectores). */
export const LOCALE_NAMES: Record<Locale, string> = { es: 'Español', en: 'English' };
/** Etiqueta BCP 47 para Intl (fechas y números) y para Google Sign-In. */
export const INTL_LOCALE: Record<Locale, string> = { es: 'es-CO', en: 'en-US' };

/** Textos de una pantalla en los dos idiomas, con la misma forma. */
export type Copy<T> = Record<Locale, T>;

/** Primer idioma del navegador que sea español o inglés. Si no prefiere ninguno de los dos, inglés. */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'es') return 'es';
    if (base === 'en') return 'en';
  }
  return 'en';
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** El idioma del navegador no cambia durante la visita. */
export const DETECTED_LOCALE: Locale = detectLocale(browserLanguages());

/** La cuenta manda; sin sesión, lo elegido en el navegador y, si no, el idioma del navegador. */
export function resolveLocale(account: string | null | undefined, choice: Locale | null, detected: Locale = DETECTED_LOCALE): Locale {
  if (isLocale(account)) return account;
  return choice ?? detected;
}
