# NoutLife · vídeo promocional vertical

Vídeo de 25 s en 9:16 (1080 × 1920, 30 fps) para Reels, TikTok y Shorts, hecho con [Remotion](https://www.remotion.dev) (React).
Usa la marca real de la app: isotipo y logotipo de `apps/web/public/brand`, la paleta Jade oscura de `tokens.css`, Montserrat, el mapa muscular del Coliseo y la rueda del Ciclo.

Es un proyecto aparte: no forma parte de los workspaces de npm de la raíz, así que Vercel no lo instala ni lo construye.

## Uso

```bash
cd promo
npm install
npx remotion preview      # o `npm run dev`: abre Remotion Studio para verlo y editarlo
npx remotion render NoutLifePromoVertical out/noutlife-promo.mp4
```

`remotion.config.ts` ya fija la máxima calidad, así que el comando corto basta: fotogramas PNG sin pérdida, H.264 con CRF 14 y preset `slow`, yuv420p, color bt709 y audio AAC a 320 kbps. El MP4 sale en `out/` (ignorado por git).

Otros comandos:

- `npm run still -- --frame=300`: un fotograma suelto en `out/still.png`.
- `npm run music`: vuelve a generar la música.
- `npm run typecheck`: comprueba los tipos.

## Estructura

```
src/
  Root.tsx                     composición «NoutLifePromoVertical»
  Video/
    NoutLifePromo.tsx          composición principal: capas, escenas y audio
    timeline.ts                guion en fotogramas: escenas, tarjetas, efectos y locución
    layout.ts                  geometría compartida entre escenas y zona segura
    theme.ts                   colores, fuentes y muelles (spring)
    Scenes/
      HookScene.tsx            1 · gancho (0–4 s)
      BrandRevealScene.tsx     2 · revelación de marca (4–8 s)
      ZonesScene.tsx           3 · zonas y ecosistema (8–18 s)
      zones/                   tarjetas: Coliseo, Ciclo, Hábitos y Rituales, El Sabio
      CtaScene.tsx             4 · llamada a la acción (18–25 s)
    components/                fondo, logo, mapa muscular, rueda del ciclo, ondas, teléfono
    audio/Soundtrack.tsx       música, efectos y huecos de locución
scripts/build-music.mjs        sintetiza la música
public/                        fuentes (OFL), música y efectos (CC0)
```

Todo se anima en función del fotograma (`useCurrentFrame`, `spring`, `interpolate`): cualquier fotograma se puede renderizar suelto y en cualquier orden.

## Guion

La rejilla es de 120 BPM: 1 pulso = 15 fotogramas. Los cortes caen en pulsos y la tipografía en corcheas. La hoja completa, con el sonido de cada momento, está al principio de `src/Video/timeline.ts`.

| Tiempo | Escena | Qué pasa |
|---|---|---|
| 0–4 s | Gancho | «Tu vida no es una lista de tareas aburrida.» palabra a palabra; un trazo jade tacha «aburrida» y la cámara entra en el punto final |
| 4–8 s | Marca | el punto es una luz; las tres hojas del isotipo salen de ella, «Noutlife» sube letra a letra y aparece «Evoluciona en todas tus áreas con NoutLife.» |
| 8–18 s | Zonas | el punto de la «i» se vuelve un nodo; Coliseo, Ciclo Menstrual, Hábitos y Rituales y El Sabio entran como tarjetas 3D; al final, las cuatro alrededor del nodo |
| 18–25 s | CTA | las zonas entran al teléfono, que sube de nivel; «Toma el control de tu leyenda personal.» y el botón «Empieza gratis en NoutLife Lite» |

## Audio

- **Música**: `public/audio/noutlife-music.wav`, original y sintetizada por `scripts/build-music.mjs` (120 BPM, La menor) con los mismos cortes del guion. No tiene samples ni licencias de terceros.
- **Efectos**: 12 sonidos CC0 en `public/audio/sfx`, colocados en `SFX_CUES`. Créditos en `public/audio/CREDITS.md`.
- **Locución**: los huecos están en `VO_CUES` y se ven en el Studio como barras «Locución · …» con el texto de cada frase. Para añadirla, graba un solo archivo alineado con esos tiempos, déjalo en `public/audio/` y pásalo como prop. La música baja sola mientras suena cada frase:

```bash
npx remotion render NoutLifePromoVertical out/noutlife-promo.mp4 --props='{"voiceoverSrc":"audio/locucion.mp3"}'
```

Props de la composición (se editan en el panel Inspector del Studio, que las guarda en `src/Root.tsx`, o se pasan con `--props` en JSON):

| Prop | Por defecto | Para qué |
|---|---|---|
| `musicSrc` | `audio/noutlife-music.wav` | otra música (ruta en `public/` o URL); `null` la quita |
| `voiceoverSrc` | `null` | archivo de locución |
| `musicVolume`, `sfxVolume` | `1` | volumen de la música y de los efectos |
| `showGuides` | `false` | muestra las zonas que tapa la interfaz de las redes y la frase de locución de cada momento |

## Notas

- Coliseo y El Sabio llevan la insignia **PRO** porque en la app son de Pro: en NoutLife Lite se ven con candado. Así el vídeo no promete gratis lo que no lo es.
- Los datos de las tarjetas son de ejemplo (12.480 kg de volumen, día 14 del ciclo, «Hola, Ana»). El vídeo no afirma cifras de usuarios ni valoraciones.
- Remotion está fijado en 4.0.530. La 4.0.531 se publicó con `@remotion/cli/dist/render-queue/queue.js` vacío y el Studio no abre («getRenderQueue is not a function»), aunque el render funciona. Al actualizar, todos los paquetes `remotion` y `@remotion/*` deben ir a la misma versión exacta.
- Nada de `box-shadow` con desenfoque grande en elementos que se escalan con `transform`: Chrome deja una costura cuadrada alrededor (pasaba en la luz de la escena 2). Para halos, un `radial-gradient`.
- Remotion es gratis para personas y equipos de hasta 3 personas; una empresa más grande necesita su licencia de empresa ([remotion.pro](https://www.remotion.pro)).
