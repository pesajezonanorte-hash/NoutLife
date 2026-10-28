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
  Root.tsx                     composiciones «NoutLifePromoVertical», «NoutLifeProTrial», «NoutLifeProKeynote» y «NoutLifeProStudio» (abajo)
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
scripts/build-music.mjs        sintetiza la música (build-music-pro-trial.mjs, la del anuncio de 15 s)
blender/studio.py              el teléfono 3D del anuncio «Pro Studio» (Blender 4.5 LTS)
public/                        fuentes (OFL), música y efectos (CC0)
```

Todo se anima en función del fotograma (`useCurrentFrame`, `spring`, `interpolate`): cualquier fotograma se puede renderizar suelto y en cualquier orden.

## Guion

La rejilla es de 120 BPM: 1 pulso = 15 fotogramas. Los cambios grandes caen en el primer pulso del compás y la tipografía en corcheas. La hoja completa, con el sonido de cada momento, está al principio de `src/Video/timeline.ts`.

| Tiempo | Escena | Qué pasa |
|---|---|---|
| 0–3 s | Gancho | «Tu rutina.», «Tu cuerpo.», «Tu mente.»: cada palabra cae de golpe con su color |
| 3–6 s | Gancho | «Todo en un solo lugar.» palabra a palabra, con un muelle sin rebote (escala, opacidad y desenfoque a la vez); la frase se encoge hacia el isotipo mientras tres luces de color convergen en él |
| 6–8 s | Marca | la luz se vuelve núcleo y resplandor jade; de él se posan las tres hojas del isotipo, cada una con el color de una palabra, y se funden en jade; «Noutlife» letra a letra |
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

## Anuncio «7 días de Pro» (15 s)

Segunda composición, `NoutLifeProTrial`: anuncio de 15 s (1080 × 1920, 30 fps, 450 fotogramas) para la prueba inversa, con estética minimalista tipo Apple.

```bash
npx remotion render NoutLifeProTrial out/noutlife-pro-trial.mp4   # o `npm run render:pro-trial`
npm run music:pro-trial                                            # vuelve a generar su música
```

| Tiempo | Escena | Qué pasa |
|---|---|---|
| 0–3 s | Gancho | «¿Y si tu vida real / tuviera un / modo Pro?» se abre desde el centro con rebote elástico; corte a plano corto con fundido de 3 fotogramas; «modo Pro» parpadea en oro; zoom out rápido mientras el fondo absorbe una malla de puntos dorados |
| 3–8 s | Desbloqueo | el teléfono (titanio negro) entra desde abajo con inercia y flota; tres anillos de oro giran a su alrededor; un haz jade abre Coliseo, Recreación y Analíticas (cada zona sale de la pantalla), los hábitos pasan a «Ilimitados» y la racha se enciende; el teléfono gira 18° en Y y la pantalla se transforma en el panel de Pro |
| 8–13 s | Oferta | el teléfono sube y una tarjeta de cristal esmerilado con borde de oro se posa sobre su pie: cinta de 7 días, «7 DÍAS DE PRO. GRATIS.», «Sin tarjeta de crédito.», la letra pequeña y el botón de Google «Empieza ahora con 1 clic», que recibe un toque |
| 13–15 s | Cierre | fundido a negro con el logo y la URL |

- Código en `src/ProTrial/`: `timeline.ts` (guion en fotogramas, sobre 120 BPM), `brand.ts` (paleta y muelles), `pose.ts` (el teléfono en cada fotograma), `scenes/`, `screens/` (Inicio en Lite con la ventana del cielo y el panel de Pro) y `components/` (anillos y gemas 3D proyectados a mano en `lib/space.ts`, malla dorada, cristal, botón de Google, revelado elástico). Reutiliza el teléfono, el logo, las fuentes y el kit de pantallas de `src/Video/`.
- Paleta: fuera del teléfono, la del brief (slate `#0f172a`, jade `#10b981`, oro `#d4af37`); dentro, la app con sus tokens reales (Aurora oscuro), como se ve de verdad. Para pasar todo a Aurora basta con cambiar `AD` en `brand.ts`.
- Lo que dice está comprobado en el código: 7 días sin medio de pago (`TRIAL_DAYS`, prueba inversa), Coliseo y Recreación son zonas Pro, Lite ve 5 días de historial, se entra solo con Google. La prueba es una por persona, por eso la letra pequeña dice «cuentas Lite que aún no han probado Pro».
- Locución: los huecos están en `VO_CUES` (`src/ProTrial/timeline.ts`), igual que en el promo; se añade con la prop `voiceoverSrc`.

## Anuncio «Modo Pro» (15 s, estilo keynote)

Tercera composición, `NoutLifeProKeynote`: el mismo «7 días de Pro» rehecho desde cero con un brief de dirección de arte tipo Apple. Fondo mate y plano, Montserrat Light y Bold, cristal líquido, muelles sin rebote, nada flotando al azar y texto que nunca tiembla.

```bash
npx remotion render NoutLifeProKeynote out/noutlife-pro-keynote.mp4   # o `npm run render:pro-keynote`
npm run music:pro-keynote    # vuelve a generar su música
npm run type:pro-keynote     # recompone los textos después de cambiar src/ProKeynote/copy.json
```

| Tiempo | Escena | Qué pasa |
|---|---|---|
| 0–3 s | Gancho | «¿Y si tu vida real / tuviera un modo Pro?» aparece con un fundido y 18 px de subida; la cámara empuja sin parar de 1 a 1,05; a 1,5 s «Pro» pasa a oro champán, con un halo tenue y un brillo que lo cruza una vez |
| 3–8 s | Teléfono y cristal | cambio de foco: el texto se desenfoca y el teléfono (titanio negro) sale del centro mientras la cámara retrocede, hasta quedar girado 3° en Y. En su pantalla, Inicio; se abre el menú de la app con las zonas Pro con candado. Recreación y Coliseo salen de su casilla como tarjetas de cristal y flotan delante del teléfono, con paralaje. Un haz jade baja por la escena y abre cada candado a su paso; las tarjetas pasan a «DESBLOQUEADA» |
| 8–13 s | Oferta | el menú se cierra (la cabecera ya dice «Pro · Regalo 1/7», como en la app), el teléfono sube y su base se funde con una tarjeta de cristal: «7 DÍAS DE PRO. GRATIS.», «Sin tarjeta de crédito.», la letra pequeña y el botón «Empieza ahora» con el isotipo. El texto entra y se queda quieto |
| 13–15 s | Cierre | fundido a negro y, ya en negro, el logo de NoutLife y la dirección |

- Código en `src/ProKeynote/`: `timeline.ts` (el guion, sobre 120 BPM), `camera.ts` (la cámara, con profundidad por capa), `device.ts` (el teléfono en cada fotograma), `beam.ts` (el haz: cada candado se abre cuando la banda lo cruza), `palette.ts`, `motion.ts` (curvas y muelles), `copy.json`/`copy.ts` (los textos), `type/` (texto vectorial), `screens/` (la app dentro del teléfono), `components/` (cristal, tarjetas de zona, botón) y `scenes/`. Reutiliza de `src/Video/` el teléfono, el logo, las fuentes, la barra de estado y la banda sonora.
- **Texto vectorial.** Chrome dibuja el texto HTML con la línea base ajustada al píxel entero: medido en su navegador sin interfaz, un desplazamiento de 0,1–0,4 px sale igual que 0 y uno de 0,6 px salta un píxel entero. Un texto que sube despacio o crece con la cámara avanza así a saltos y parece temblar. Por eso todo el texto fuera del teléfono se dibuja con los contornos reales de Montserrat (`type/outlines.ts`), que se mueven en fracciones de píxel y no cambian de forma al escalar. Los compone `scripts/build-keynote-type.mjs` con fontkit desde Montserrat Light y Bold (`scripts/fonts`, las instancias estáticas que sirve Google Fonts, licencia OFL). Anchos y kerning medidos contra Chrome: diferencia < 0,01 %.
- **La app dentro del teléfono** se reconstruye con sus tokens de modo oscuro (Aurora) y sus medidas (1 pt = 1,43 px): la cabecera móvil, la ventana de Inicio con los colores de `ambience.css`, el saludo con la letra de la marca (`letteringGlyphs.ts` es copia de la app), el menú con el orden de Lite (primero lo que se puede usar, las zonas Pro con el candado `NavLock`) y el indicador de la prueba `TrialPill`. El teléfono nunca queda plano del todo (le queda 1° en Y): plano, Chrome también ajustaría al píxel el texto de la app.
- **Paleta.** La prop `palette` elige `brief` (por defecto: slate `#0f172a` y jade `#10b981`, como pide el brief) o `aurora` (los tokens reales de la app). El brief dice que son los colores de la web, pero la app no usa esos dos valores: su modo oscuro es negro verdoso (`#070d0a`) con jade-400 (`#85c7a1`). Dentro del teléfono la app se ve siempre con Aurora.
- **Copy comprobado en el código.** 7 días (`TRIAL_DAYS`), sin medio de pago (prueba inversa), Coliseo y Recreación son zonas Pro (`PRO_ZONES`). La letra pequeña del brief («Disponible para nuevos usuarios y cuentas Lite.») dice aquí «… y cuentas Lite que aún no han probado Pro.»: la prueba es una por correo y el regalo solo llega a cuentas Lite sin prueba previa.
- **HyperFrames y OpenMontage.** El brief los nombra como herramientas para el teléfono y la cámara. HyperFrames es otro motor de render (vídeo desde HTML con GSAP) y OpenMontage un orquestador de producción que usa Remotion o HyperFrames; no se combinan dentro de un proyecto de Remotion. Todo está hecho en Remotion siguiendo sus recetas: cámara de varias fases con deriva (*multi-phase camera*), mundo transformado por una sola cámara (*viewport change*), cambio de foco (*depth of field*) y la tarjeta que recibe al objeto (*card morph anchor*).
- Locución opcional: los huecos están en `VO_CUES` (`src/ProKeynote/timeline.ts`), con la prop `voiceoverSrc`.

## Anuncio «Pro Studio» (15 s, teléfono fotorrealista en Blender)

Cuarta composición, `NoutLifeProStudio`: el mismo «7 días de Pro», ahora con el lenguaje de los anuncios de producto de Apple (las referencias «Apple 1» y «Apple 2»), entero sobre papel crema (#FAF6F0) liso, sin viñetas ni cambios de fondo, como un estudio claro: tipografía negra que se revela letra a letra y un teléfono de titanio oscuro modelado, iluminado y renderizado en **Blender** que flota sobre el papel con su sombra, con la app en modo oscuro; luz que resbala por el metal y el cristal y una sola cámara, sin cortes, que lo rodea y se acerca a las zonas. Remotion pone encima el texto vectorial, el cristal líquido, la sombra y el sonido.

```bash
npm run studio:screen       # 1. la pantalla del teléfono (la app) como textura: blender/cache/screen
npm run studio:blender      # 2. el teléfono en Blender: public/studio/phone/0080.png … y src/ProStudio/track.json
npm run music:pro-studio    # 3. música y efectos
npm run render:pro-studio   # 4. el anuncio: out/noutlife-pro-studio.mp4
```

Los pasos 1 y 2 solo hacen falta si cambia la pantalla, el teléfono o el guion (`timeline.json`); sus resultados (~1 GB) no se suben a git. El paso 2 retoma donde se quedó si se corta (salta los fotogramas que ya existen), así que después de cambiar la escena o el guion hay que forzarlo: `npm run studio:blender -- --force` (o un tramo: `-- --from 178 --to 270 --force`). Blender 4.5 LTS: `scripts/blender.mjs` lo busca en `BLENDER_PATH`, en `~/Tools/Blender/<versión>/` (la versión portable, sin instalador), en Archivos de programa o en el PATH.

| Tiempo | Escena | Qué pasa | Sonido |
|---|---|---|---|
| 0–3 s | Gancho | papel crema: «¿Y si tu vida real / tuviera un / modo Pro?» en negro (Montserrat Light), ya entrando en el primer fotograma; cada letra sube desde una máscara, opaca en cuanto asoma, mientras el interletrado de su línea se cierra, y el bloque se recentra al sumar una línea. «Pro» en SemiBold y oro champán hondo, con un destello. La cámara empuja de 1 a 1,05 | zumbido ambiental cálido desde el primer fotograma; una nota de mazo por línea; tres campanas de cristal en el oro |
| 2,8–5 s | Teléfono | el texto se apaga (sus letras se invierten donde pasan sobre el teléfono) y emerge el teléfono sobre el mismo crema, flotando con su sombra de contacto y girando de −12° a 0° en Y. Frena como un objeto pesado: un rebote mínimo (se pasa un 2 % hacia la cámara y vuelve), medio grado de más en el giro y un cabeceo de inercia de 1°; la cámara lo rodea despacio (órbita) | el zumbido baja a la octava grave; aire y, al frenar, un golpe sub muy suave; entra el pad |
| 4,4–6 s | Cristal | Coliseo y Recreación salen de su baldosa como tarjetas de cristal líquido claro (texto #111111, borde contrastado, sombras finas) y flotan delante del teléfono, con paralaje («ZONA PRO» y el candado champán) | dos toques de cristal |
| 5,9–7,9 s | Primer plano | sin cortes, la cámara se acerca a las zonas hasta que el teléfono ocupa ~85 % del ancho (el crema sigue a los lados) mientras las tarjetas se apartan y salen del cuadro; el candado del Coliseo se abre y la zona se ilumina en jade, luego Recreación y el resto en cadena; la cámara vuelve | el pad baja y se cierra; pestillos finísimos con campanitas jade; clics mínimos en cadena |
| 7,8–8,7 s | Desbloqueado | vuelven las tarjetas: luz jade en el canto de abajo del teléfono, el ícono de cada tarjeta se enciende en jade y pasan a «DESBLOQUEADA» | dos notas |
| 8,7–11 s | Oferta | las tarjetas salen por los lados y el teléfono se eleva y sale por arriba (su sombra se abre y se desvanece). Entra la tarjeta de cristal entera, con todo su texto sólido desde su primer fotograma (nada letra a letra ni a medio fundir): «7 DÍAS DE PRO. GRATIS.» en negro, «Sin tarjeta de crédito.» en jade y la letra pequeña; sube 56 px y se posa. Luego brilla el oro de «PRO.» | acorde punteado; un brillo en el oro |
| 11,3–12,4 s | Botón | la píldora oscura «Empieza ahora» con su rótulo, con filo jade; a los 11,9 s se pulsa y brilla en jade | un clic al llegar; al pulsarla, el de bajar y el de subir; el acorde respira hacia dentro |
| 12,4–13 s | Silencio | nada se mueve | silencio digital (también las colas del eco y la reverb) |
| 13–15 s | Cierre | la tarjeta se va y, cuando ya no está, en el centro del crema queda el logo de NoutLife en sus colores para fondo claro (una luz recorre el isotipo) y la dirección | acorde de Do mayor 9 y tres campanas; fundido largo que acaba en silencio antes del último fotograma |

- **El pipeline.** `timeline.json` es el guion para todos: lo leen Remotion, `blender/studio.py` y la música. (1) `NoutLifeProStudioScreen` dibuja la app (el menú de Lite con sus zonas Pro, los candados que se abren) a escala 3 (1686 × 3570). (2) `blender/studio.py` construye la escena por código, sin nada modelado a mano: cuerpo de titanio con cantos redondeados, cristal frontal con su filo de titanio, la pantalla con la secuencia como textura emisiva, botones y bandas de antena; un estudio claro pintado en el mundo (blanco cálido detrás y encima, para que el titanio refleje luz como en una foto de producto sobre blanco, y una bandera negra del lado de la cámara, para que la pantalla refleje oscuridad y la app no se lave), tiras que dibujan el contorno del canto, dos contraluces, la tira fina que cruza el cristal y una luz jade casi debajo que tiñe el canto inferior sin reflejarse en la pantalla; una sola cámara a 85 mm que rodea el teléfono y se acerca a las zonas (sin cortes: el macro de antes llenaba el cuadro con la pantalla oscura). Renderiza con EEVEE Next sobre fondo transparente y exporta en `track.json` dónde caen las esquinas de las tarjetas y dónde está el teléfono en cada fotograma. (3) Remotion pone el papel, la sombra de contacto del teléfono (EEVEE no tiene *shadow catcher*: sale de `track.json`, y cuando el teléfono se eleva el suelo se queda y la sombra se abre y se apaga), el teléfono con su resplandor (el mismo fotograma desenfocado en modo *screen*), las tarjetas en ese cuadrilátero (una homografía en `matrix3d`, así comparten el espacio 3D del teléfono), la oferta, el texto y el sonido.
- **Rendimiento.** En este equipo (i5-10500, Intel UHD 630) EEVEE tarda ~7 s por fotograma y el teléfono entero (f80–330) ~30 min. Sin desenfoque de movimiento: en EEVEE multiplicaba por 9 el tiempo (vuelve a evaluar la escena con la textura en cada paso del obturador) y los movimientos son lentos.
- **Texto.** Todo el texto fuera del teléfono es vectorial (contornos de Montserrat Light, Regular, Medium y SemiBold compuestos por `npm run type:pro-studio`), así que nunca tiembla. Las letras negras del gancho van en modo `difference` con el color papel − #111111: sobre el crema se ven #111111 y, donde pasan sobre el teléfono, se vuelven claras. Los degradados de oro van en un rectángulo recortado por cada letra: un degradado puesto en los glifos se resuelve en el espacio de cada glifo y no cruza la palabra.
- **Cristal líquido claro.** `backdrop-filter: blur(24px)` con saturación, blanco esmerilado espeso (el texto #111111 se lee también cuando la tarjeta pasa sobre la pantalla oscura), borde de cristal contrastado (filo blanco por dentro y un hilo oscuro muy fino por fuera), sombras ultrafinas y un brillo de refracción que resbala con la órbita; las zonas abiertas tiñen de jade su canto. La tarjeta de la oferta lleva además un aura tenue de jade y champán recortada a la tarjeta (para que el cristal tenga algo que desenfocar sin cambiar el papel de fuera) y una sombra suave hecha con degradados; entra entera, cristal y texto a la vez. Ningún contenedor de las tarjetas lleva `opacity` ni `filter` (si no, el desenfoque no ve lo de detrás): la opacidad va en cada capa.
- **Paleta y copy.** Papel crema `#FAF6F0` y texto `#111111`; el jade del brief, `#10b981`, ilumina las zonas, los íconos y el filo del botón, y para texto sobre el crema se usa `#059669` («Sin tarjeta de crédito.», «DESBLOQUEADA»: el `#10b981` da 2,5:1 de contraste); un oro champán hondo de punta a punta para «Pro» (de 8,7:1 a 4,3:1; el `#d4b483` de la app da 1,8:1 y con un oro claro el final de la palabra parecía a medio aparecer). Dentro del teléfono, la app con sus tokens reales en modo oscuro (Aurora). El logo del cierre usa los colores de la marca para fondo claro (`noutlife-mark.svg`, logotipo `#0e1d16`). Lo que dice está comprobado en el código: 7 días (`TRIAL_DAYS`), sin medio de pago, Coliseo y Recreación en `PRO_ZONES`. La letra pequeña del brief («… y cuentas Lite.») dice aquí «… y cuentas Lite que aún no han probado Pro.»: la prueba es una por persona y el regalo solo llega a cuentas Lite sin prueba previa (`giftEligible`).
- **Sonido.** `scripts/build-music-studio.mjs` sintetiza una pista mínima: zumbido cálido desde el primer fotograma, pad lento con un bajo suave, clics de interfaz finísimos (un tic afinado de 1 ms con un cuerpo breve, sin ruido), campanas de cristal hechas con parciales (sin FM, que en notas agudas sonaba metálica), silencio digital antes del cierre (dos mezclas: lo de antes no vuelve, ni sus colas) y un fundido final en coseno que llega a cero 40 ms antes del último fotograma. Sin saturación: el máster solo normaliza a −14 LUFS y limita los picos a −1,5 dBTP.
- **HyperFrames y OpenMontage.** El brief los nombra como herramientas del teléfono y de la cámara, pero no lo son: HyperFrames es otro motor de render (vídeo desde HTML con GSAP) y OpenMontage el sistema de producción que orquesta Remotion o HyperFrames. El teléfono es de Blender y la cámara, de Blender y Remotion.

## Notas

- Coliseo y El Sabio llevan la insignia **PRO** porque en la app son de Pro: en NoutLife Lite se ven con candado.
- El consejo de El Sabio cruza el sueño y el Coliseo, como hace la IA de la app; las señales que le llegan son de zonas que de verdad ve (sueño, Coliseo, hábitos, comida). El Ciclo no está entre ellas porque la IA no lo lee.
- Los datos de las pantallas son de ejemplo («Hola, Ana», 1RM de 102,5 kg, día 14 del ciclo). El vídeo no afirma cifras de usuarios ni valoraciones.
- Los colores de cada zona son los tonos de la app (fatiga, menstruación, éxito, info) más saturados para el vídeo.
- El teléfono es 3D de verdad (`transform-style: preserve-3d`): en sus capas no puede haber `filter`, `overflow` ni `opacity`, porque aplanan la escena. Los efectos van dentro de la pantalla, que es plana.
- Nada de `box-shadow` con desenfoque grande en elementos que se escalan con `transform`: Chrome deja una costura cuadrada alrededor. Para halos, un `radial-gradient`.
- Remotion está fijado en 4.0.530. La 4.0.531 se publicó con `@remotion/cli/dist/render-queue/queue.js` vacío y el Studio no abre («getRenderQueue is not a function»), aunque el render funciona. Al actualizar, todos los paquetes `remotion` y `@remotion/*` deben ir a la misma versión exacta.
- Remotion es gratis para personas y equipos de hasta 3 personas; una empresa más grande necesita su licencia de empresa ([remotion.pro](https://www.remotion.pro)).
