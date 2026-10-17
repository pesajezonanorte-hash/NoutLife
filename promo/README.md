# NoutLife · vídeo promocional vertical

Vídeo de 24 s en 9:16 (1080 × 1920, 30 fps) para Reels, TikTok y Shorts, hecho con [Remotion](https://www.remotion.dev) (React).
Usa la marca real de la app: el isotipo y el logotipo de `apps/web/public/brand`, la paleta Jade oscura de `tokens.css`, Montserrat, el mapa muscular del Coliseo, la rueda del Ciclo y los atajos de El Sabio. Cada zona lleva su color: rojo y naranja (Coliseo), rosa (Ciclo), menta (Hábitos) y azul y violeta (El Sabio).

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
    timeline.ts                guion en fotogramas: escenas, zonas, efectos y locución
    layout.ts                  geometría compartida: logo, poses del teléfono, títulos, botón
    palette.ts                 la luz de color de cada momento (fondo y halo del teléfono)
    theme.ts                   colores de la app y de cada zona, fuentes y muelles (spring)
    Scenes/
      HookScene.tsx            1 · gancho tipográfico (0–6 s)
      BrandScene.tsx           2 · el isotipo nace del punto de luz (6–8 s)
      DeviceScene.tsx          3 · el teléfono 3D, las zonas y El Sabio (8–20 s; sigue hasta el final)
      CtaScene.tsx             4 · titular, botón y URL (20–24 s)
    screens/                   pantallas de la app dentro del teléfono: inicio, Coliseo, Ciclo,
                               Hábitos, El Sabio, y las piezas que se levantan en 3D
    components/                teléfono, logo, mapa muscular, rueda del ciclo, fondo
    audio/Soundtrack.tsx       música, efectos y huecos de locución
scripts/build-music.mjs        sintetiza la música
public/                        fuentes (OFL), música y efectos (CC0)
```

Todo se anima en función del fotograma (`useCurrentFrame`, `spring`, `interpolate`): cualquier fotograma se puede renderizar suelto y en cualquier orden.

## Guion

La rejilla es de 120 BPM: 1 pulso = 15 fotogramas. Los cambios grandes caen en el primer pulso del compás y la tipografía en corcheas. La hoja completa, con el sonido de cada momento, está al principio de `src/Video/timeline.ts`.

| Tiempo | Escena | Qué pasa |
|---|---|---|
| 0–3 s | Gancho | «Tu rutina.», «Tu cuerpo.», «Tu mente.»: cada palabra cae de golpe con su color |
| 3–6 s | Gancho | «Todo en un solo lugar.» palabra a palabra, con los tres colores juntos; la frase se encoge hasta un punto de luz |
| 6–8 s | Marca | del punto salen las tres hojas del isotipo, cada una con el color de una palabra, y se funden en jade; «Noutlife» letra a letra |
| 8–10 s | Teléfono | la cámara se aleja: el logo era la pantalla de arranque de un teléfono; el logo vuela a la cabecera, aparece el inicio y el teléfono se inclina |
| 10–16 s | Zonas | un toque abre el Coliseo (mapa de calor y 1RM); luego Ciclo Menstrual y Hábitos y Rituales. Con cada zona el teléfono gira, el fondo se tiñe de su color y sus tarjetas se levantan de la pantalla |
| 16–20 s | El Sabio | el teléfono gira, una onda violeta lo envuelve, el borde de la pantalla brilla y las zonas le mandan su señal; la IA responde y su consejo se levanta para leerse grande; al final, «Y muchas zonas más...» |
| 20–24 s | Cierre | «Diseña tu versión Pro.», el teléfono sube de nivel, el botón «Empieza ahora en NoutLife» y la URL; un toque en el botón |

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

- Coliseo y El Sabio llevan la insignia **PRO** porque en la app son de Pro: en NoutLife Lite se ven con candado.
- El consejo de El Sabio cruza el sueño y el Coliseo, como hace la IA de la app; las señales que le llegan son de zonas que de verdad ve (sueño, Coliseo, hábitos, comida). El Ciclo no está entre ellas porque la IA no lo lee.
- Los datos de las pantallas son de ejemplo («Hola, Ana», 1RM de 102,5 kg, día 14 del ciclo). El vídeo no afirma cifras de usuarios ni valoraciones.
- Los colores de cada zona son los tonos de la app (fatiga, menstruación, éxito, info) más saturados para el vídeo.
- El teléfono es 3D de verdad (`transform-style: preserve-3d`): en sus capas no puede haber `filter`, `overflow` ni `opacity`, porque aplanan la escena. Los efectos van dentro de la pantalla, que es plana.
- Nada de `box-shadow` con desenfoque grande en elementos que se escalan con `transform`: Chrome deja una costura cuadrada alrededor. Para halos, un `radial-gradient`.
- Remotion está fijado en 4.0.530. La 4.0.531 se publicó con `@remotion/cli/dist/render-queue/queue.js` vacío y el Studio no abre («getRenderQueue is not a function»), aunque el render funciona. Al actualizar, todos los paquetes `remotion` y `@remotion/*` deben ir a la misma versión exacta.
- Remotion es gratis para personas y equipos de hasta 3 personas; una empresa más grande necesita su licencia de empresa ([remotion.pro](https://www.remotion.pro)).
