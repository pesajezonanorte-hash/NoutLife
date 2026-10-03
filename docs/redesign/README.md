# LifeQuest Redesign — Handoff v2 (completo)

Especificación para implementar el rediseño completo en `apps/web` (React 18 + Vite + Tailwind 3.4 + Framer Motion 11 + React Query + Zustand).

## Contenido

| Carpeta / archivo | Qué es | Uso |
|---|---|---|
| `design-system/README.md`, `design-system/tokens.json` | **LifeQuest Design System** (fuente de verdad de estilo) | Colores, tipografía, radios, sombras, reglas. Manda sobre cualquier valor de los prototipos |
| `tokens/tokens.css` | Variables light/dark en canales RGB, con los valores del design system | Fusionar en `src/styles/tokens.css` |
| `tokens/tailwind.tokens.ts` | `theme.extend` para Tailwind | Fusionar en `tailwind.config.ts` |
| `tokens/motion.ts` | Presets Framer Motion + `useCountUp` | `src/lib/motion.ts` |
| `design/*.dc.html` | 35 prototipos (móvil, tablet, desktop) | Especificación de layout, copy, estados y animaciones |
| `design/lq.css` | CSS del prototipo (`.btn`, `.card`, `.seg.slide`, `.lift`, `.rise`, `.draw`, `.halo`…) | Medidas, timings y keyframes exactos |

> Los `.dc.html` son prototipos de un editor de diseño: usan `{{holes}}`, `<sc-for>`, `<sc-if>` y `class Component extends DCLogic`. Léelos como especificación y tradúcelos a JSX + Tailwind. Los datos (Alex Rivera, cifras, rankings) son de ejemplo: se reemplazan por los de la API.

## Prioridad de estilos

1. **`design-system/`** — colores, fuentes, radios, sombras, espaciado y reglas.
2. **`tokens/`** — ya traducidos a CSS/Tailwind con esos valores.
3. **`design/`** — estructura, jerarquía, interacción y motion. Si un valor de `lq.css` difiere del design system, gana el design system.

Diferencias concretas a respetar sobre los prototipos:
- Botones e inputs con radio **10 px** (`rounded-md`), cards 16 px, chips/anillos 999 px.
- `warning-text` en light es **amber-800**; `error-text` e `info-text` en dark son red-300 / blue-300.
- **JetBrains Mono** (`font-mono tabular-nums`) para cifras de juego: XP, Gold, cronómetros, contadores y stats.
- Tipografía: escala del design system para toda la UI (`display`, `heading-*`, `body-*`, `label-*`, `caption`). Los tamaños grandes del rediseño quedan solo como `hero-lg/md/sm` para el título de página y los números protagonistas (saldo, horas de sueño, cronómetro). Si el equipo prefiere no usarlos, reemplazar por `display`.

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
| `/shop` | `ShopDesktop` | Gold animado; destacado; categorías; confirmar compra → saldo baja animado; inventario/equipar |
| `/ranking` | `RankingDesktop` | Global/Amigos; métricas; podio que sube; tu fila resaltada; tendencias |
| `/settings` | `SettingsDesktop` | Tabs Perfil/Juego/Datos/Acerca de; tema en vivo; guardar con loading + toast; zona de peligro |

`Main.dc.html` = fundamentos · `Components.dc.html` = componentes light/dark con estados.

## Navegación (AppShell)

- **Desktop ≥1024:** `Sidebar` w-64 con grupos *Principal* (Inicio, Hábitos, Misiones, Coliseo, Perfil) · *Bienestar* (Finanzas, Comida, Sueño, Logros) · *Más zonas* (Estadísticas, Gimnasio, Glow up, Aprendizaje, Relaciones, Diario, Agenda, Rituales, Sabiduría, Mis zonas, Tienda) · *Comunidad* (Ranking, Gremio, Campaña) · Ajustes, Ayuda · tarjeta de usuario con barra de nivel. Activo: `bg-primary/10 text-primary-text` + indicador lateral que crece (scaleY). `Topbar` h-16 sticky, translúcido, con breadcrumb.
- **Tablet 768–1023:** `Rail` con íconos + label (ver `DashboardTablet`).
- **Móvil <768:** `TabBar` (5 principales) + `FAB`; el resto de zonas desde un menú "Más".
- Estadísticas, Gremio, Campaña y Ayuda no tienen diseño todavía: mantener la pantalla actual aplicando tokens y componentes.

## Componentes (`src/components/ui/`)

Los del design system (Button, Card, Badge, Input/Select/Field, Switch, SegmentedControl con `layoutId`, Tabs, ProgressBar con `shine`, ProgressRing con `pathLength`, StatCard con count-up, Toast/useToast, Modal/Sheet, EmptyState, ErrorState, PageLoader, Confetti, BarChart/LineChart/Heatmap con tooltip) **más** los nuevos que aparecen en las zonas:

`Chip` / `ChipGroup` (filtros, `aria-selected`) · `StepItem` (paso con tick animado y tachado) · `DayDot` (asistencia: done/today/rest, ícono + color) · `Timer` (mm:ss, mono, `role="timer"`) · `TimelineDay` (horas, línea "ahora", bloques) · `MonthGrid` · `Podium` · `LeaderRow` · `BookCover` · `QuoteCard` (abierta/bloqueada) · `ShopItem` + `PurchaseDialog` · `MoodPicker` (5 caras SVG, `role="radiogroup"`) · `SabioComposer` (textarea + chips + loading con texto de progreso) · `UserCard` (sidebar).

## Motion (resumen; detalle en `lq.css` y `motion.ts`)

Entrada 400 ms ease-out + stagger 50–60 ms · salida 200 ms · hover botón scale 1.02 (100 ms) · card lift −4 px (200 ms) + ícono rota −4° · barras `scaleX` con delay 200 ms + sheen · gráficos de barras `scaleY` escalonado · líneas y anillos con `pathLength` · contadores con `useCountUp` · halo pulsante en avatares/medallas · píldora deslizante en SegmentedControl · modales con spring · toasts abajo a la derecha (móvil abajo centro) · confeti en logros grandes. **Solo `transform` y `opacity`.** Con reduced motion: sin movimiento, solo opacidad/color, valores finales directos.

## Reglas no negociables

Las 8 del design system (sin hex en componentes, AA, ≥14 px, targets ≥44 px, solo transform/opacity, reduced motion, estados loading/error/empty, ícono + texto en estados) más: `aria-current="page"` en nav, `aria-pressed` en checks, `role="progressbar"`/`timer` con valores, `aria-live` en toasts y contadores, Escape cierra modales, foco visible 3 px primary.
