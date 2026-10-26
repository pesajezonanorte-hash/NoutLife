import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { landingHtml, landingJsonLd } from '../../scripts/seo-pages';
import { LANDING_META } from '../../src/lib/seo-meta';

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const content = (html: string, key: 'name' | 'property', id: string) =>
  html.match(new RegExp(`<meta\\s+${key}="${id}"\\s+content="([^"]*)"`))?.[1];
const decode = (value: string | undefined) => value?.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

test('the root page (x-default) keeps the Spanish head of lib/seo-meta, with hreflang to /es and /en', () => {
  const es = LANDING_META.es;
  assert.match(index, /<html lang="es">/);
  assert.equal(index.match(/<title>([^<]*)<\/title>/)?.[1], es.title);
  assert.equal(content(index, 'name', 'description'), es.description);
  assert.equal(content(index, 'property', 'og:title'), es.ogTitle);
  assert.equal(content(index, 'property', 'og:description'), es.ogDescription);
  assert.equal(content(index, 'property', 'og:image:alt'), es.imageAlt);
  assert.equal(content(index, 'name', 'twitter:title'), es.ogTitle);
  assert.match(index, /<link rel="alternate" hreflang="es" href="https:\/\/noutlife\.site\/es" \/>/);
  assert.match(index, /<link rel="alternate" hreflang="en" href="https:\/\/noutlife\.site\/en" \/>/);
  assert.match(index, /<link rel="alternate" hreflang="x-default" href="https:\/\/noutlife\.site\/" \/>/);
  // El splash de la raíz cambia al inglés con los mismos textos de seo-meta.
  assert.ok(index.includes(`'${LANDING_META.en.tagline}'`));
  assert.ok(index.includes(`'${LANDING_META.en.loading}'`));
});

test('/en gets an English head: language, title, canonical, image, cards, splash and USD offers', () => {
  const html = landingHtml(index, 'en');
  const en = LANDING_META.en;
  assert.match(html, /<html lang="en" data-fixed-locale="en">/);
  assert.equal(html.match(/<title>([^<]*)<\/title>/)?.[1], en.title.replace(/&/g, '&amp;'));
  assert.equal(decode(content(html, 'name', 'description')), en.description);
  assert.match(html, /<link rel="canonical" href="https:\/\/noutlife\.site\/en"/);
  assert.equal(content(html, 'property', 'og:url'), 'https://noutlife.site/en');
  assert.equal(content(html, 'property', 'og:locale'), 'en_US');
  assert.equal(content(html, 'property', 'og:locale:alternate'), 'es_CO');
  assert.equal(content(html, 'property', 'og:image'), 'https://noutlife.site/og-image-en.png');
  assert.equal(content(html, 'name', 'twitter:image'), 'https://noutlife.site/og-image-en.png');
  assert.equal(decode(content(html, 'property', 'og:title')), en.ogTitle);
  assert.match(html, /aria-label="Loading NoutLife"/);
  assert.match(html, /<div class="tg" aria-hidden="true">Calm, in order<\/div>/);
  assert.doesNotMatch(html, /Tu rutina, tu mente/, 'no Spanish left in the English head');
  // La verificación de Google y el resto de la cabecera siguen intactos.
  assert.match(html, /google-site-verification/);
});

test('/es gets the Spanish head with its own canonical and peso offers', () => {
  const html = landingHtml(index, 'es');
  assert.match(html, /<html lang="es" data-fixed-locale="es">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/noutlife\.site\/es"/);
  assert.equal(content(html, 'property', 'og:image'), 'https://noutlife.site/og-image.png');
  assert.match(html, /<div class="tg" aria-hidden="true">Orden en calma<\/div>/);
});

test('structured data lists Lite and both Pro plans with the real prices of each market', () => {
  const en = JSON.parse(landingJsonLd('en'));
  const app = en['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebApplication');
  assert.deepEqual(app.offers.map((o: { price: string; priceCurrency: string }) => `${o.price} ${o.priceCurrency}`), ['0 USD', '4.99 USD', '39.99 USD']);
  assert.equal(app.url, 'https://noutlife.site/en');
  const es = JSON.parse(landingJsonLd('es'));
  const appEs = es['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebApplication');
  assert.deepEqual(appEs.offers.map((o: { price: string; priceCurrency: string }) => `${o.price} ${o.priceCurrency}`), ['0 COP', '9900 COP', '89900 COP']);
  // Sin valoraciones inventadas: no hay aggregateRating ni review.
  assert.doesNotMatch(landingJsonLd('en'), /aggregateRating|review/i);
});

test('a missing tag fails the build instead of shipping a half-translated head', () => {
  assert.throws(() => landingHtml(index.replace(/<meta property="og:image:alt"[^>]*>/, ''), 'en'), /og:image:alt/);
});
