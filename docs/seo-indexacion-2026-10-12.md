# Indexación en Google Search Console (2026-10-12)

NoutLife (https://noutlife.site) quedó indexada con éxito en Google Search Console.

## Rutas públicas rastreables
- `/`, `/login`, `/privacy`, `/terms`, `/copyright`: incluidas en `apps/web/public/sitemap.xml` y permitidas en `apps/web/public/robots.txt`.
- Las rutas privadas de la app (zonas, perfil, ajustes, etc.) siguen con `Disallow` en robots.txt.

## Meta etiquetas
- `apps/web/index.html`: `<title>`, `description`, Open Graph (`og:title`, `og:description`, `og:image` absoluta, `og:url`), Twitter Card y `canonical`, con el nombre «NoutLife».
- `apps/web/src/pages/Legal/index.tsx`: cada página legal fija su propio título, descripción, canonical y Open Graph mientras está abierta.
- Verificación del sitio: meta `google-site-verification` en `index.html` (no quitar).

## Desde 2026-10-26: portadas en español e inglés
- `/es` y `/en` son las portadas indexables (hreflang y canonical propios); `/` es `x-default` y `/login` deja de estar en el sitemap (su canonical apunta a `/es` o `/en`). Detalle en `docs/internacional-2026-10-26.md`.
