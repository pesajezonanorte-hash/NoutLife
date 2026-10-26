// Metadatos de la portada por idioma. Una sola fuente para dos lectores:
//   · la portada en React (useDocumentMeta), que es lo que Google ve al ejecutar JavaScript;
//   · el build (scripts/seo-pages.ts), que escribe el HTML estático de /en y /es, lo único que leen
//     WhatsApp, X, LinkedIn o iMessage al mostrar un enlace (no ejecutan JavaScript).
// index.html (la raíz, x-default) lleva a mano los valores en español; una prueba unitaria los compara
// con estos. Puro: sin import.meta.env ni React, para que vite.config pueda importarlo.
import type { Locale } from './locale';

export const SITE_URL = 'https://noutlife.site';

/** Open Graph usa idioma_PAÍS. */
export const OG_LOCALE: Record<Locale, string> = { es: 'es_CO', en: 'en_US' };

export interface LandingMeta {
  /** <title>: la marca y lo que se busca (máximo 60 caracteres para que no se corte en Google). */
  title: string;
  /** Meta description: máximo 160 caracteres. */
  description: string;
  /** Título y texto de la tarjeta al compartir el enlace. */
  ogTitle: string;
  ogDescription: string;
  /** Ruta de la og-image (1200×630) del idioma y su texto alternativo. */
  image: string;
  imageAlt: string;
  /** Splash de index.html antes de React: eslogan y etiqueta de carga. */
  tagline: string;
  loading: string;
}

export const LANDING_META: Record<Locale, LandingMeta> = {
  es: {
    title: 'NoutLife — Tu rutina, tu mente y tus ideas en un solo lugar',
    description: 'Hábitos, libreta, bienestar y metas en un espacio en calma para ganar enfoque y claridad mental. Empieza gratis con 7 días de Pro, sin tarjeta.',
    ogTitle: 'NoutLife — Tu rutina, tu mente y tus ideas en un solo lugar',
    ogDescription: 'Hábitos, libreta, bienestar y metas en un espacio en calma para ganar enfoque y claridad mental. Empieza gratis con 7 días de Pro, sin tarjeta.',
    image: '/og-image.png',
    imageAlt: 'NoutLife: tu rutina, tu mente y tus ideas en un solo lugar.',
    tagline: 'Orden en calma',
    loading: 'Cargando Noutlife',
  },
  en: {
    title: 'NoutLife — Calm Habit Tracker, Notebook & Life Planner',
    description: 'Habits, notebook, wellbeing and goals in one calm space. Build routines that last and think with clarity. Start free with 7 days of Pro, no card required.',
    ogTitle: 'NoutLife — Your routine, your mind and your ideas in one place',
    ogDescription: 'Habits, notebook, wellbeing and goals in one calm, beautifully simple space. Start free with 7 days of Pro, no card required.',
    image: '/og-image-en.png',
    imageAlt: 'NoutLife: your routine, your mind and your ideas in one place.',
    tagline: 'Calm, in order',
    loading: 'Loading NoutLife',
  },
};
