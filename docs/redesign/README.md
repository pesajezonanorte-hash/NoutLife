# Noutlife Redesign — Handoff v4 (rebrand Jade, 26 rutas)

*Grow your life like a lime.* El proyecto pasa a llamarse **Noutlife** y cambia de piel: paleta **Jade** (verdes bosque, neutros marfil con tinte verde y oro champán solo para recompensas), logo de hoja en forma de N y JetBrains Mono para los números. Especificación para `apps/web` (React 18 + Vite + Tailwind 3.4 + Framer Motion 11 + React Query + Zustand).

## Contenido

| Carpeta / archivo | Qué es | Uso |
|---|---|---|
| `design-system/README.md`, `tokens.json`, `components/` | **Noutlife Design System** (fuente de verdad de estilo) | Colores, tipografía, radios, sombras, logo, reglas. Manda sobre cualquier valor de los prototipos |
| `design-system/logos/*.svg` | Mark (light/dark), lockup horizontal (light/dark), wordmark, app icon | Copiar a `apps/web/public/brand/` y `src/assets/brand/` |
| `tokens/tokens.css` | Canales RGB `--lq-*` light/dark con los valores Jade | **Reemplazar los valores** de las variables `--lq-*` existentes en `src/styles/tokens.css` (mismos nombres) y añadir las nuevas (`jade-*`, `forest`, `success-strong`, `on-success`) |
| `tokens/tailwind.tokens.ts` | `theme.extend` (`noutlifeTheme`) | Fusionar en `tailwind.config.ts` |
| `tokens/motion.ts` | Presets Framer Motion (base + v3) + `useCountUp` + `useSpotlight` | `src/lib/motion.ts` |
| `design/*.dc.html` | 39 prototipos ya con la piel Jade (móvil, tablet, desktop) | Layout, copy, estados y animaciones |
| `design/lq.css` | CSS del prototipo, ya en Jade | Medidas, timings y keyframes exactos |

> Los `.dc.html` son prototipos de un editor de diseño (`{{holes}}`, `<sc-for>`, `<sc-if>`, `class Component extends DCLogic`). Léelos como especificación y tradúcelos a JSX + Tailwind. Los datos (Alex Rivera, cifras, otros jugadores) son de ejemplo.

## Prioridad de estilos

1. **`design-system/`** — colores, fuentes, radios, sombras, logo y reglas.
2. **`tokens/`** — ya traducidos a CSS/Tailwind con esos valores.
3. **`design/`** — estructura, jerarquía, interacción y motion.

## Rebrand Noutlife: qué cambia en toda la app

**Marca**
- Nombre visible **Noutlife** en todas partes: `<title>`, meta tags, `manifest.json` (`name`, `short_name`, `theme_color` #3d6950, `background_color` #f9f7f3), favicon (de `noutlife-mark.svg`), íconos PWA (de `noutlife-app-icon.svg`), splash/onboarding, textos ("¿Qué es Noutlife?", "Noutlife 2.4.0", FAQ, emails). No renombres paquetes, rutas, claves de storage ni identificadores de código.
- Sidebar y header: componente `<BrandLockup>` = mark SVG (34 px de alto; versión `-on-dark` en `.dark`) + "Noutlife" en Montserrat 500, 21 px, tracking −0.012em, color `on-background`. Rail de tablet y TabBar: solo el mark (32 px). Mínimos: mark 24 px; lockup 120 px de ancho. Nunca recolorear, rotar, estirar ni poner sombras/glow al logo. El degradado del logo es solo del logo; la UI usa Jade plano.

**Color**
- Fondo de página `background` marfil #f9f7f3; cards, sidebar, modales y popovers en `surface` blanco con borde `border` y `shadow-sm`. En dark: fondo jade-900, surfaces #14261d / #1c3328.
- `primary` (jade) es el único color de acción. Botón primario `bg-primary-strong text-on-primary hover:bg-primary-hover`. Texto/links/nav activo: `text-primary-text`. Barras, anillos y foco: `primary`.
- `secondary` ya no es violeta: es **oro champán solo para recompensas** (XP, oro, hitos de racha, premium, logros desbloqueados, recompensas del pase). Máximo 1–2 apariciones por pantalla.
- Todo lo que antes usaba violeta como **categoría** (Mente, meditación, servicios, rutina de noche, El Sabio, grasas, etc.) pasa al tono **`forest`** (jade-800 / dark jade-200). Sueño usa `info`. En los prototipos ya está aplicado: busca `forest` en `design/`.
- Estados: success (esmeralda), warning (ámbar), error (ladrillo), info (azul acero), cada uno con `*-text` AA. Como success y primary son verdes, **un estado siempre lleva ícono + texto**.
- Fondos con texto blanco sobre success usan `success-strong` + `on-success`. Botón peligro: `bg-error-text text-white` (dark: texto jade-900).
- Tintes de chips/badges: rol al 10 % (light) / 16 % (dark) + texto `*-text`.
- Sin hex en componentes; sin gradientes de fondo ni glow decorativo (el spotlight de las cards v3 queda en 7 % de primary, muy sutil). Portadas de libros, colores de outfits y temas de la Tienda son contenido, no UI.
- Los temas alternos de `globals.css` (cyber, forest, ocean, sunset, retro) salen del sistema: el tema por defecto es Jade; si se conservan, solo como temas comprables en la Tienda.

**Tipografía**
- Montserrat para UI, **JetBrains Mono 400/500** para números que cuentan (XP, oro, dinero, timers, contadores, stats, códigos). Cargar ambas desde Google Fonts.
- Body 15/22 −0.01em. Nada bajo 14 px salvo `caption` 12 px.
- Clases de los prototipos → Tailwind:

| Prototipo | Tailwind | Valor |
|---|---|---|
| `.t-dl` | `text-hero-lg` | 56 / 700 / −0.02em — solo título de página o número protagonista |
| `.t-dm` | `text-hero-md` | 40 / 700 |
| `.t-ds` | `text-display` | 32 / 40 / 700 / −0.02em |
| `.t-hl` | `text-heading-xl` | 24 / 32 / 700 |
| `.t-hm` | `text-heading-lg` | 20 / 28 / 600 |
| `.t-hs` | `text-heading-md` | 18 / 26 / 600 |
| `.t-bl` | `text-body-lg` | 16 / 24 |
| `.t-bm` | `text-body` | 15 / 22 / −0.01em |
| `.t-bs` | `text-body-sm` | 14 / 20 |
| `.t-ll` | `text-label-md` | 14 / 20 / 600 |
| `.t-lm` | `text-label-sm` | 12 / 18 / 600 |
| `.t-cap` | `text-caption` | 12 / 18 |
| `.num` | `font-mono tabular-nums` | JetBrains Mono 500 |

**Forma y elevación**
- Radios: chips/badges/checks 6 px (`rounded-sm`), botones e inputs 10 px (`rounded-md`), cards/paneles/modales 16 px (`rounded-lg`), pills y barras `rounded-full`.
- Sombras teñidas de verde tinta en light (`shadow-sm` reposo, `shadow-md` hover, `shadow-lg` modales y cards levantadas).
- Inputs: fondo `surface-variant`, borde `border-strong`, al enfocar fondo `surface` + anillo 3 px `primary`.
- Botón secundario: `bg-surface-variant text-on-background` + borde 1 px `border-strong`.

**Motion (ajustes del design system sobre v3)**
- Botón: hover `y −1 px` + `shadow-md` (100 ms), press `scale .97` (50 ms), disabled 55 % de opacidad.
- Card interactiva: hover `y −4 px` + `shadow-lg` + borde `primary/25` (200 ms). Se mantienen las curvas expo/spring de v3, la entrada con blur y el spotlight + tilt.
- Todo efecto respeta `prefers-reduced-motion` **y** el ajuste in-app "Reducir movimiento".

## Mapa pantalla → ruta → referencias

### Núcleo (móvil + desktop)
| Ruta | Móvil | Desktop |
|---|---|---|
| `/` | `Dashboard` (estados content/empty/loading/error) | `DashboardDesktop` (+ `DashboardTablet`, dark) |
| `/habits` | `Habits` | `HabitsDesktop` |
| `/habits/:id` | `HabitDetail` | `HabitDetailDesktop` |
| `/quests` | `Quests` | `QuestsDesktop` |
| `/colosseum` | `Colosseum` | `ColosseumDesktop` |
| `/achievements` | `Achievements` | `AchievementsDesktop` |
| `/finances` | `Finances` | `FinancesDesktop` |
| `/food` | `Food` | `FoodDesktop` |
| `/sleep` | `Sleep` | `SleepDesktop` |
| `/profile` | `Profile` | `ProfileDesktop` |

### Más zonas y comunidad (desktop; reflujo a móvil con `flex-wrap` / `auto-fill`)
| Ruta (ajustar a la real) | Referencia | Interacciones clave |
|---|---|---|
| `/gym` | `GymDesktop` | Asistencia semanal + toast; sesión con cronómetro y series; resumen con confeti; volumen semanal; rutinas; récords |
| `/glow-up` | `GlowUpDesktop` | SegmentedControl Cuidado/Estilo/Presencia; pasos con check → anillo "brillo de hoy"; outfits; estado vacío |
| `/learning` | `LearningDesktop` | KPIs count-up; estantería con portadas y filtros; Pomodoro real (anillo, sesiones, foco diario) |
| `/relationships` | `RelationsDesktop` | Cuenta atrás de fecha especial; círculo con conexión; fechas agregar/eliminar; regalos |
| `/journal` | `JournalDesktop` | Pregunta del día → editor + ánimo (5 caras SVG); filtro por ánimo; búsqueda; eliminar |
| `/agenda` | `AgendaDesktop` | Día con línea "ahora" y bloques completables; Semana; Mes; sync Google con estado |
| `/rituals` | `RitualsDesktop` | Tarjetas de pasos; modo guiado paso a paso; estado vacío "Cargar rituales sugeridos" |
| `/wisdom` | `WisdomDesktop` | Principio del día + Guardar; chips por categoría; bloqueados por nivel |
| `/zones` | `ZonesDesktop` | Composer "El Sabio" con texto de progreso; creación de zona con pop |
| `/shop` | `ShopDesktop` | Gold animado; destacado; categorías (incluye **Temas**: océano/bosque/lava con botón "Ver" → diálogo con mini-app en la paleta del tema + "Comprar tema"); confirmar compra → saldo baja animado; inventario/equipar |
| `/ranking` | `RankingDesktop` | Global/Amigos; métricas; podio que sube; tu fila resaltada; tendencias |
| `/settings` | `SettingsDesktop` | Tabs Perfil/Juego/**Zonas**/Datos/Acerca de; pestaña Zonas: 11 switches para mostrar/ocultar zonas en la navegación + badge "N de M visibles"; tema en vivo; guardar con loading + toast; zona de peligro |
| `/stats` | `StatsDesktop` | Periodo Semana/Mes/3 meses/Año (el gráfico se vuelve a dibujar al cambiar); curva XP con área; Life Score doble anillo; 10 zonas con estado; KPIs; dinero (barras agrupadas), sueño, fuerza; proyecciones; radar 8 ejes vs periodo anterior; heatmap 26 semanas |
| `/guild` | `GuildDesktop` | Sin gremio: crear (nombre + emblema radiogroup) o unirse con código de 6 casillas OTP (pegar, autoavance, backspace); ambos con loading → vista gremio + toast. En gremio: código copiable, jefe semanal con barra HP y "Atacar", miembros, meta semanal (anillo), actividad, salir |
| `/season` | `CampaignDesktop` | Cuenta atrás en vivo (dígitos con tick); pase Gratis/Premium con 10 recompensas reclamables (halo + toast); capítulos; jefe comunitario; stats de temporada. Estado sin temporada activa: cuenta atrás + switch "Avisarme" |
| `/faq` | `HelpDesktop` | Búsqueda en vivo sin tildes + chips de categoría; 10 acordeones con `aria-expanded` y "¿Te sirvió?" Sí/No; estado sin resultados; 3 tarjetas de contacto. La respuesta de privacidad lleva "[Enlazar política vigente]": enlazar a la política real |

`Main.dc.html` = fundamentos · `Components.dc.html` = componentes light/dark con estados.

## Navegación (AppShell)

- **Desktop ≥1024:** `Sidebar` w-64 con grupos *Principal* (Inicio, Hábitos, Misiones, Coliseo, Perfil) · *Bienestar* (Finanzas, Comida, Sueño, Logros) · *Más zonas* (Estadísticas, Gimnasio, Glow up, Aprendizaje, Relaciones, Diario, Agenda, Rituales, Sabiduría, Mis zonas, Tienda) · *Comunidad* (Ranking, Gremio, Campaña) · Ajustes, Ayuda · tarjeta de usuario con barra de nivel. Activo: `bg-primary/10 text-primary-text` + indicador lateral que crece (scaleY). `Topbar` h-16 sticky, translúcido, con breadcrumb.
- **Tablet 768–1023:** `Rail` con íconos + label (ver `DashboardTablet`).
- **Móvil <768:** `TabBar` (5 principales) + `FAB`; el resto de zonas desde un menú "Más".
- Las zonas ocultas en Ajustes → Zonas desaparecen de Sidebar/Rail/menú "Más" (persistir en el store de preferencias existente).

## Componentes (`src/components/ui/`)

Los del design system (Button, Card, Badge, Input/Select/Field, Switch, SegmentedControl con `layoutId`, Tabs, ProgressBar con `shine`, ProgressRing con `pathLength`, StatCard con count-up, Toast/useToast, Modal/Sheet, EmptyState, ErrorState, PageLoader, Confetti, BarChart/LineChart/Heatmap con tooltip) **más** los nuevos que aparecen en las zonas:

`Chip` / `ChipGroup` (filtros, `aria-selected`) · `StepItem` (paso con tick animado y tachado) · `DayDot` (asistencia: done/today/rest, ícono + color) · `Timer` (mm:ss, mono, `role="timer"`) · `TimelineDay` (horas, línea "ahora", bloques) · `MonthGrid` · `Podium` · `LeaderRow` · `BookCover` · `QuoteCard` (abierta/bloqueada) · `ShopItem` + `PurchaseDialog` · `MoodPicker` (5 caras SVG, `role="radiogroup"`) · `SabioComposer` (textarea + chips + loading con texto de progreso) · `UserCard` (sidebar) · `SpotCard` (spotlight + tilt) · `Accordion` · `OtpInput` · `Countdown` (dígitos con tick) · `RadarChart` · `AreaChart` (curva suave Catmull-Rom) · `SeasonPassTrack` · `BossBar` · `ThemePreviewDialog` · `ZoneToggleList`.

## Motion v3 (global — aplica a TODAS las pantallas, no solo a las nuevas)

Los valores v3 sustituyen a los del resumen anterior donde coinciden:
- Curvas: entradas con `expo` `cubic-bezier(.16,1,.3,1)`; elementos interactivos (botones, switches, checks, píldora de SegmentedControl, barras, diálogos, toasts) con spring suave con ligero rebote (`springSoft`).
- Entrada: `page3`/`item3` — y 24 px + scale .985 + blur 6 px → 0, 800 ms, stagger 60 ms. La blur es la única excepción a "solo transform/opacity" y solo en la entrada.
- Card hover: lift −4 px con spring + `shadow-lg` + borde `primary/25`. Tarjetas protagonistas (`.spot` en los prototipos) con luz que sigue al cursor + tilt 3D de 3° como máximo (`useSpotlight`); el tilt se apaga con reduced motion y en dispositivos táctiles.
- Barras 1.1 s expo, líneas/anillos 1.6 s expo. Contadores con `useCountUp` (easeOutQuart).
- Acordeón: `grid-template-rows 0fr→1fr` 450 ms (excepción permitida) + chevron 180°.
- Cuenta atrás: cada dígito entra/sale con `tick` (key por valor + AnimatePresence).

Valores base (siguen vigentes donde v3 no dice nada):

Entrada 400 ms ease-out + stagger 50–60 ms · salida 200 ms · hover botón y −1 px + shadow-md (100 ms), press 0.97 · card lift −4 px (200 ms) + ícono rota −4° · barras `scaleX` con delay 200 ms + sheen · gráficos de barras `scaleY` escalonado · líneas y anillos con `pathLength` · contadores con `useCountUp` · halo pulsante en avatares/medallas · píldora deslizante en SegmentedControl · modales con spring · toasts abajo a la derecha (móvil abajo centro) · confeti en logros grandes. **Solo `transform` y `opacity`.** Con reduced motion: sin movimiento, solo opacidad/color, valores finales directos.

## Reglas no negociables

Las reglas del design system (sin hex en componentes, AA, ≥14 px, targets ≥44 px, solo transform/opacity, reduced motion, estados loading/error/empty, ícono + texto en estados) más: `aria-current="page"` en nav, `aria-pressed` en checks, `role="progressbar"`/`timer` con valores, `aria-live` en toasts y contadores, Escape cierra modales, foco visible 3 px primary con 2 px de offset. Targets: 44 px botones-ícono, 48 px checks, 56 px TabBar, 64 px FAB.
