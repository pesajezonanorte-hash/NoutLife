# De consumidores a creadores

Presentación animada para las charlas del proyecto de grado (Colegio Jorge Isaacs, grado 11°), con NoutLife como caso real. Está hecha con Remotion: 1920 × 1080 a 60 fps, siete diapositivas enlazadas con `<TransitionSeries>`.

Es un proyecto aparte, fuera de los `workspaces` de la raíz (igual que `promo/`), para que Vercel nunca instale Remotion.

## Dar la charla

```bash
npm install
npm run dev        # abre http://localhost:5190
```

Cada «siguiente» reproduce la animación de un paso y se detiene sola al terminar. Si lo pulsas mientras anima, salta al final del paso. Un control remoto de diapositivas también funciona, porque envía las mismas teclas.

| Tecla | Acción |
| --- | --- |
| → ↓ Espacio Enter AvPág, o clic | Siguiente paso |
| ← ↑ RePág Retroceso | Paso anterior |
| 1–7 | Ir a una diapositiva (ya completa) |
| Inicio / Fin | Principio / final |
| F | Pantalla completa |
| N | Notas del expositor en otra ventana. Llévala a la pantalla del portátil; desde ahí también puedes avanzar y retroceder. |
| T | Cronómetro de 2 minutos (para la actividad del aula) |
| P | Reproducir o pausar sin detenerse en los pasos |

La barra de controles se esconde sola tras 2,5 s sin mover el ratón. Las fuentes van incluidas en `public/fonts`, así que la charla funciona sin internet. Para llevarla en una memoria USB, ejecuta `npm run build` y luego `npx vite preview`.

## Editar y exportar

```bash
npm run studio     # Remotion Studio, para editar viendo cada fotograma
npm run render     # out/presentacion.mp4 (avanza solo, sin pausas)
```

- `src/timeline.ts`: orden de las diapositivas, transición de entrada, paradas y notas de cada una.
- `src/slides/Slide1Portada.tsx` … `Slide7Cierre.tsx`: una diapositiva por archivo (portada, problema, brecha, caso NoutLife, conexión, actividad, cierre). Cada una exporta sus paradas (los fotogramas locales donde termina cada paso) y sus notas del expositor, una lista por paso. En pantalla va poco texto; lo analítico va en las notas.
- `src/theme.ts`: la paleta oscura de NoutLife, con los valores de `apps/web/src/styles/tokens.css`.
- `src/components/`: `GlassCard`, `AnimatedText`, `PhoneMockup`, `Lettering` (la letra monolínea del logo y del splash; `letteringGlyphs.ts` es copia de `apps/web`), la marca y el splash (`Brand`), la transición `zoomBlur` y el fondo (`Backdrop`).
- `src/screens/AppScreens.tsx`: pantallas de NoutLife dentro del teléfono (inicio, libreta y hábitos) con las piezas de la PWA y datos de ejemplo.
- `src/app/`: el Player en modo presentación (`App.tsx`) y la ventana de notas (`Notes.tsx`, en `?notas`).

Mantén todos los paquetes `remotion` y `@remotion/*` en la misma versión exacta (4.0.530, como `promo/`).
