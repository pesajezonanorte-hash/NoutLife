// Plugin de Vite: escribe dist/en/index.html y dist/es/index.html a partir del index.html ya compilado,
// cada uno con la cabecera de su idioma (título, descripción, canonical, Open Graph, Twitter, JSON-LD y el
// eslogan del splash). Las redes sociales no ejecutan JavaScript: solo así un enlace a /en se ve en inglés
// en WhatsApp, X o LinkedIn. Los textos salen de src/lib/seo-meta y los precios de src/lib/plan (una sola
// fuente con la app). La raíz (/) no se toca: es el x-default, con su cabecera en español escrita a mano.
// vercel.json sirve /en y /es desde estos archivos; el resto de rutas sigue en /index.html.
import type { Plugin } from 'vite';
import type { Locale } from '../src/lib/locale';
import { LANDING_META, OG_LOCALE, SITE_URL } from '../src/lib/seo-meta';
import { PRICE_LISTS } from '../src/lib/plan';

const LOCALES: Locale[] = ['es', 'en'];

const attr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Cambia el content de la meta con ese name/property; si falta, falla el build (mejor que una cabecera a medias). */
function setMeta(html: string, key: 'name' | 'property', id: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${key}="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content=")[^"]*(")`);
  if (!pattern.test(html)) throw new Error(`[seo-pages] index.html no tiene <meta ${key}="${id}">`);
  return html.replace(pattern, `$1${attr(value)}$2`);
}

function replaceOnce(html: string, pattern: RegExp, value: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`[seo-pages] index.html no tiene ${what}`);
  return html.replace(pattern, value);
}

/** Datos estructurados: la marca, el sitio y la app con los precios de la lista de ese idioma. */
export function landingJsonLd(locale: Locale): string {
  const meta = LANDING_META[locale];
  const list = locale === 'en' ? PRICE_LISTS.INTL : PRICE_LISTS.CO;
  const price = (cents: number) => (cents / 100).toFixed(list.currency === 'COP' ? 0 : 2);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'NoutLife', url: `${SITE_URL}/`, logo: `${SITE_URL}/icon.png` },
      {
        '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'NoutLife', alternateName: ['Noutlife'], url: `${SITE_URL}/`,
        inLanguage: ['es', 'en'], publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebApplication', name: 'NoutLife', url: `${SITE_URL}/${locale}`, inLanguage: locale,
        applicationCategory: 'LifestyleApplication', operatingSystem: 'Web, iOS, Android',
        description: meta.description, image: `${SITE_URL}${meta.image}`, publisher: { '@id': `${SITE_URL}/#organization` },
        offers: [
          { '@type': 'Offer', name: 'NoutLife Lite', price: '0', priceCurrency: list.currency },
          { '@type': 'Offer', name: locale === 'en' ? 'NoutLife Pro Monthly' : 'NoutLife Pro Mensual', price: price(list.monthInCents), priceCurrency: list.currency },
          { '@type': 'Offer', name: locale === 'en' ? 'NoutLife Pro Annual' : 'NoutLife Pro Anual', price: price(list.yearInCents), priceCurrency: list.currency },
        ],
      },
    ],
  };
  // «</script>» dentro del JSON cerraría la etiqueta: se escapa el «<».
  return JSON.stringify(graph, null, 2).replace(/</g, '\\u003c');
}

/** El index.html compilado, con la cabecera y el splash de la portada en `locale`. */
export function landingHtml(html: string, locale: Locale): string {
  const meta = LANDING_META[locale];
  const other: Locale = locale === 'en' ? 'es' : 'en';
  const url = `${SITE_URL}/${locale}`;
  const image = `${SITE_URL}${meta.image}`;
  let out = replaceOnce(html, /<html lang="[^"]*"/, `<html lang="${locale}" data-fixed-locale="${locale}"`, '<html lang>');
  out = replaceOnce(out, /<title>[^<]*<\/title>/, `<title>${text(meta.title)}</title>`, '<title>');
  out = replaceOnce(out, /<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${url}"`, 'link canonical');
  out = setMeta(out, 'name', 'title', meta.title);
  out = setMeta(out, 'name', 'description', meta.description);
  out = setMeta(out, 'property', 'og:locale', OG_LOCALE[locale]);
  out = setMeta(out, 'property', 'og:locale:alternate', OG_LOCALE[other]);
  out = setMeta(out, 'property', 'og:url', url);
  out = setMeta(out, 'property', 'og:title', meta.ogTitle);
  out = setMeta(out, 'property', 'og:description', meta.ogDescription);
  out = setMeta(out, 'property', 'og:image', image);
  out = setMeta(out, 'property', 'og:image:secure_url', image);
  out = setMeta(out, 'property', 'og:image:alt', meta.imageAlt);
  out = setMeta(out, 'name', 'twitter:title', meta.ogTitle);
  out = setMeta(out, 'name', 'twitter:description', meta.ogDescription);
  out = setMeta(out, 'name', 'twitter:image', image);
  out = setMeta(out, 'name', 'twitter:image:alt', meta.imageAlt);
  out = replaceOnce(
    out,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${landingJsonLd(locale)}\n    </script>`,
    'JSON-LD',
  );
  out = replaceOnce(out, /(<div id="lq-boot" role="status" aria-label=")[^"]*(")/, `$1${attr(meta.loading)}$2`, 'el splash');
  out = replaceOnce(out, /(<div class="tg" aria-hidden="true">)[^<]*(<\/div>)/, `$1${text(meta.tagline)}$2`, 'el eslogan del splash');
  return out;
}

export function seoPages(): Plugin {
  return {
    name: 'noutlife-seo-pages',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') throw new Error('[seo-pages] el build no produjo index.html');
      const html = String(index.source);
      for (const locale of LOCALES) {
        this.emitFile({ type: 'asset', fileName: `${locale}/index.html`, source: landingHtml(html, locale) });
      }
    },
  };
}
