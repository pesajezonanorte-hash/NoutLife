# LifeQuest Redesign — Handoff para implementación

Paquete de referencia para implementar el rediseño en `apps/web` (React 18 + Vite + Tailwind 3.4 + Framer Motion 11 + React Query + Zustand).

## Contenido

| Carpeta / archivo | Qué es | Cómo usarlo |
|---|---|---|
| `tokens/tokens.css` | Variables CSS light/dark en canales RGB | Fuente de verdad de color, sombra y foco. Pegar en `src/index.css` |
| `tokens/tailwind.tokens.ts` | `theme.extend` para Tailwind | Fusionar en `tailwind.config.ts` |
| `tokens/motion.ts` | Presets Framer Motion + `useCountUp` | Copiar a `src/lib/motion.ts` |
| `design/*.dc.html` | Las 23 pantallas/artboards del diseño | **Solo referencia visual y de estructura.** No copiar el markup tal cual |
| `design/lq.css` | CSS del prototipo (clases `.btn`, `.card`, `.bar`…) | Referencia de medidas, estados y animaciones exactas |

> Los `.dc.html` son prototipos de un editor de diseño: usan `{{holes}}`, `<sc-for>`, `<sc-if>` y una clase `Component extends DCLogic`. Léelos como especificación (layout, copy, jerarquía, estados, datos de ejemplo) y tradúcelos a JSX + Tailwind. Para verlos abiertos en el navegador no funcionan sin el runtime del editor; para verlos, usa el canvas en Claude.

## Mapa pantalla → ruta → referencias

| Ruta | Móvil (375) | Desktop (1440) | Notas |
|---|---|---|---|
| `/` | `Dashboard.dc.html` | `DashboardDesktop.dc.html` (+ `DashboardTablet.dc.html`, dark) | Estados content / empty / loading / error en el móvil |
| `/habits` | `Habits.dc.html` | `HabitsDesktop.dc.html` | Toggle con check rotando, confeti, toast +10 XP |
| `/habits/:id` | `HabitDetail.dc.html` | `HabitDetailDesktop.dc.html` | Heatmap 12 semanas, modal eliminar |
| `/quests` | `Quests.dc.html` | `QuestsDesktop.dc.html` | Tabs, modal confirmar → éxito + XP |
| `/colosseum` | `Colosseum.dc.html` | `ColosseumDesktop.dc.html` | Duelo: entrada lateral, resultado victoria/derrota |
| `/achievements` | `Achievements.dc.html` | `AchievementsDesktop.dc.html` | Grid 2 col (móvil) / auto-fill (desktop), hover y focus despliegan la descripción |
| `/finances` | `Finances.dc.html` | `FinancesDesktop.dc.html` | KPIs con count-up, barras 7 días, categorías, estado vacío |
| `/food` | `Food.dc.html` | `FoodDesktop.dc.html` | Anillo kcal, macros, CTA Analizar con loading |
| `/sleep` | `Sleep.dc.html` | `SleepDesktop.dc.html` | Línea que se dibuja, selector calidad 1–5 (caras SVG) |
| `/profile` | `Profile.dc.html` | `ProfileDesktop.dc.html` | Selector de tema Claro/Oscuro/Auto en vivo |
| — | `Main.dc.html` | — | Fundamentos: tipografía, color, espaciado, motion |
| — | `Components.dc.html` | — | Todos los componentes en light + dark con estados |

## Componentes a crear (`src/components/ui/`)

`Button` (primary/secondary/ghost/danger/icon × lg/md/sm) · `Card` (base/elevated, `interactive` = lift) · `Badge` (success/warning/error/info/primary/secondary/neutral × md/lg, siempre ícono + texto en estados) · `Input` / `Select` / `Field` (label visible, help, error) · `Switch` · `SegmentedControl` (píldora deslizante con `layoutId`) · `Tabs` (indicador) · `ProgressBar` (scaleX, `shine`) · `ProgressRing` (pathLength) · `StatCard` (ícono + número count-up + label + link) · `IconChip` · `Toast` + `useToast` · `Modal` / `Sheet` (focus trap, Escape, `aria-modal`) · `EmptyState` · `ErrorState` (retry + auto-retry 5 s) · `PageLoader` (skeleton shimmer + spinner) · `Confetti` · `BarChart` (con tooltip) · `LineChart` · `Heatmap`.

Layout (`src/components/layout/`): `AppShell` → `<TabBar>` + `<Fab>` en móvil (<768), `<Rail>` w-20 con labels en tablet (768–1023), `<Sidebar>` w-64 + `<Topbar>` h-16 con breadcrumb en desktop (≥1024, sin FAB).

Íconos: trazos SVG estilo Lucide (`lucide-react` si ya está, si no SVG inline). Tamaños 16/24/32/48. Nunca emojis.

## Reglas que no se negocian

1. **Sin hex en componentes.** Solo clases de token (`bg-primary-strong`, `text-on-surface-light`, `bg-success/10`).
2. **Contraste AA:** botones con `bg-primary-strong text-on-primary`. Texto de estado con `*-text` (`text-success-text`). Bordes de input `border-border-strong`.
3. **Tipografía ≥14 px** en contenido y controles. `caption` (10 px) solo en timestamps.
4. **Touch targets ≥44 px** (botones ícono 44, checks 48, FAB 64, tab bar 56).
5. **Color nunca es la única señal:** ícono + texto en badges, estados y días del heatmap.
6. **Motion:** entrada 400 ms ease-out, stagger 50–60 ms, salida 200 ms, hover botón scale 1.02 (100 ms), card lift −4 px (200 ms). Animar `transform`/`opacity`, nunca `width`/`height`. `MotionConfig reducedMotion="user"` + `useReducedMotion` para confeti, count-up, shimmer, halo.
7. **Estados por pantalla:** `if (isLoading) <PageLoader/>; if (error) <ErrorState onRetry={refetch}/>; if (empty) <EmptyState/>`.
8. **Accesibilidad:** `aria-current="page"` en nav, `role="tablist"/aria-selected` en filtros, `aria-pressed` en checks, `role="progressbar"` con valores, `aria-live` en contadores y toasts, Escape cierra modales.

## Desviaciones del brief original (intencionales)

- Botón primario indigo-600 (indigo-500 + blanco = 4.47:1, falla AA). Indigo-500 queda para acentos.
- Borde de card gray-200 (gray-100 era invisible); borde de input gray-500 (≥3:1).
- Icon button 44 px (no 40) por touch target.
- Calidad de sueño con caras SVG en vez de emojis.
- Filtro de logros en móvil: “Obtenidos” (no cabe “Desbloqueados” a 375 px).
