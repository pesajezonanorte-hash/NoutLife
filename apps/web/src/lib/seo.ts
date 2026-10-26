// Metadatos de cada página pública para Google, que ejecuta JavaScript: título, descripción, canonical y
// Open Graph, restaurados al salir. Las redes sociales no ejecutan JavaScript: para ellas valen las
// cabeceras estáticas de index.html, /en y /es, que genera scripts/seo-pages.ts al compilar.
import { useEffect } from 'react';
import type { Locale } from './locale';
import { OG_LOCALE, SITE_URL } from './seo-meta';

export const SITE = (
  import.meta.env.VITE_SITE_URL ||
  import.meta.env.NEXT_PUBLIC_SITE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '') ||
  SITE_URL
).replace(/\/+$/, '');

export interface PageMeta {
  /** Título completo, con la marca. */
  title: string;
  description: string;
  /** Ruta canónica (/en, /privacy…). */
  path: string;
  locale: Locale;
}

const TAGS = [
  ['meta[name="description"]', 'content', (m: PageMeta) => m.description],
  ['meta[property="og:title"]', 'content', (m: PageMeta) => m.title],
  ['meta[property="og:description"]', 'content', (m: PageMeta) => m.description],
  ['meta[property="og:url"]', 'content', (m: PageMeta) => SITE + m.path],
  ['meta[property="og:locale"]', 'content', (m: PageMeta) => OG_LOCALE[m.locale]],
  ['meta[name="twitter:title"]', 'content', (m: PageMeta) => m.title],
  ['meta[name="twitter:description"]', 'content', (m: PageMeta) => m.description],
  ['link[rel="canonical"]', 'href', (m: PageMeta) => SITE + m.path],
] as const;

/** Fija los metadatos de la página mientras está abierta. */
export function useDocumentMeta(meta: PageMeta): void {
  const { title, description, path, locale } = meta;
  useEffect(() => {
    const current = { title, description, path, locale };
    const previous = TAGS.map(([selector, attr]) => document.head.querySelector(selector)?.getAttribute(attr) ?? null);
    const prevTitle = document.title;
    document.title = title;
    TAGS.forEach(([selector, attr, value]) => document.head.querySelector(selector)?.setAttribute(attr, value(current)));
    return () => {
      document.title = prevTitle;
      TAGS.forEach(([selector, attr], i) => {
        const value = previous[i];
        if (value !== null) document.head.querySelector(selector)?.setAttribute(attr, value);
      });
    };
  }, [title, description, path, locale]);
}
