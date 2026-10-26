# NoutLife en inglés y en dólares (2026-10-26)

Base técnica para abrir NoutLife fuera de Colombia, empezando por Estados Unidos.

## Mercados y precios

- Cada cuenta tiene un mercado (`users.market`): `CO` paga la lista en pesos de siempre; `INTL` (todo lo que no es Colombia) ve la lista en dólares: **US$4,99/mes o US$39,99/año** (33 % menos, casi 4 meses gratis, unos 11¢ al día).
- Constantes: `apps/api/src/lib/pricing.ts` y `apps/web/src/lib/plan.ts` (`PRO_PRICE_USD_CENTS`, `PRO_ANNUAL_PRICE_USD_CENTS`). Las dos deben ser iguales; los textos se calculan desde ellas.
- El mercado se fija **al crear la cuenta** por la zona horaria del dispositivo (`America/Bogota` → `CO`; cualquier otra → `INTL`; sin zona → `CO`). La portada usa la misma regla para mostrar precios sin sesión. Las cuentas anteriores son `CO` (valor por defecto de la columna). Cambiar el mercado de una cuenta es una operación manual en la base.
- La API manda la lista de cada cuenta en `subscription.pricing` y el próximo cobro en esa moneda en `subscription.nextChargeInCents`.

## Cobro en COP con Wompi

- Wompi acepta tarjetas Visa, Mastercard y Amex del exterior, pero **solo cobra en pesos**. Un precio en USD se convierte a COP con la **TRM vigente** (datos.gov.co, conjunto `32sa-8pi3`) justo antes de crear el cobro (`lib/fx.ts`, `wompiAmounts` en `billing.service`).
- La tasa se guarda en memoria 6 h; si la fuente falla, sirve la última conocida (hasta 7 días) y luego `USD_COP_FALLBACK_RATE` si existe. Sin ninguna tasa **no se cobra**: el cobro no se crea, el cron lo reintenta y la cuenta conserva el margen de renovación; «Activar Pro» responde `FX_UNAVAILABLE` (503).
- Cada cobro guarda lo que cobró Wompi (`amountInCents`, `currency` = COP) y el precio que vio la persona (`priceCurrency`, `priceAmountInCents`). El libro de creadores y las métricas de admin siguen en COP (lo cobrado de verdad).
- Nequi solo se ofrece en el mercado `CO`. El checkout en dólares dice antes de pagar que Wompi cobra en pesos, con la cifra aproximada del día (`GET /billing/fx`).

## Idioma (es / en)

- `users.language` manda con sesión. Sin sesión: lo elegido en el navegador (`lq-locale`), la portada `/en` o `/es`, o el idioma del navegador (español si lo prefiere; si no, inglés). Se guarda al registrarse y se cambia en Ajustes → Perfil → Idioma.
- Traducido hoy: portada, textos legales, planes, checkout, diálogo de Pro, zonas con candado, avisos de prueba y de regalo, Plan. **El interior de la app sigue en español.**
- Patrón para traducir una pantalla: los textos van junto al componente como `const es = {…}; const en: typeof es = {…}` (TypeScript avisa si falta uno) y se eligen con `useLocale()`. Montos y precio por día: `useOffer()` (`lib/useOffer`), nunca `formatCop` a mano. Errores de la API: `apiErrorMessage` / `localizeBillingMessage` (`lib/billing-messages`). Los módulos de reglas puras importan de `lib/locale` (no de `lib/i18n`, que trae React y los stores).
- Glosario de zonas en `PRO_ZONES` (`lib/plan`): Coliseo → Coliseum, Espejo → Mirror, el Sabio → the Sage, misiones → goals.

## SEO

- `/es` y `/en` son las portadas indexables, con `hreflang` y canonical propios; `/` es `x-default`; `/login` sigue al idioma de la persona y su canonical apunta a `/es` o `/en`.
- `scripts/seo-pages.ts` (plugin de Vite) escribe `dist/en/index.html` y `dist/es/index.html` desde el `index.html` compilado, con título, descripción, Open Graph, Twitter, JSON-LD (precios de cada lista) y el eslogan del splash. Los textos están en `src/lib/seo-meta.ts`; una prueba compara la cabecera en español de `index.html` con ellos.
- `og-image-en.png` se genera con `node scripts/brand-assets.mjs public --og=en`.
- `vercel.json` sirve `/en` y `/es` desde sus HTML antes de la regla general. `sitemap.xml` incluye las dos portadas con sus alternativas y `/health-data`.

## Legales

- `/privacy`, `/terms`, `/copyright` en español (`pages/Legal/content.ts`) e inglés (`content.en.ts`), con un botón para leer el otro idioma. `/health-data` (política de datos de salud de consumidores de EE. UU.) solo en inglés, enlazada desde el pie en inglés.
- El aviso «al continuar aceptas» con sus enlaces va antes del botón de Google. La casilla del checkout acepta los Términos y la Privacidad de NoutLife, la renovación automática descrita encima y los documentos de Wompi.

## Despliegue

1. **API primero.** La build crea las columnas (`users.market`, `subscription_payments.priceCurrency` y `priceAmountInCents`; migración `20261105120000_markets_usd_pricing` y su espejo en `lib/market-migrations.ts`).
2. Opcional: `USD_COP_FALLBACK_RATE` en el proyecto `noutlife-api`.
3. Web después. Reenviar `sitemap.xml` en Search Console.
