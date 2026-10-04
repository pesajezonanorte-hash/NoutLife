# Noutlife

*Grow your life like a lime.* Noutlife (formerly LifeQuest) is a gamified life-management app (habits, quests, finances, food, sleep, achievements) built with React 18, Vite, Tailwind 3.4 and Framer Motion 11. This system was synced from [lifequest2](https://github.com/pesajezonanorte-hash/lifequest2) (`apps/web/src/styles/tokens.css`, `globals.css`, `docs/redesign/`) and rebranded to the **Jade** palette.

## Brand direction

Calm, focused, premium. Noutlife should feel like a well-made journal rather than an arcade: deep forest greens, quiet green-tinted neutrals, and one warm accent, champagne gold, reserved for rewards. Colour carries meaning and is never decoration. No gradient washes, no glow behind everything, no emoji. Motion is where the game lives: confetti on a finished quest, a count-up on XP, a halo on a new achievement.

The premium feel comes from restraint: large calm surfaces in `background` and `surface`, text in ink green (`on-background`) instead of pure black, and the jade scale used in a few deliberate places (primary button, progress, active nav).

## Colour

### The Jade scale

Ten steps from `jade-50` (#e6f2e8) to `jade-900` (#0e1d16). They match the greens of the leaf-N mark. Every brand role is an alias of a step, so the scale is the single source of truth.

| Step | Hex | Light theme role | Dark theme role |
|---|---|---|---|
| jade-50 | #e6f2e8 | surface-variant, soft fills | on-background (text) |
| jade-100 | #dcf3e1 | chip / badge grounds | — |
| jade-200 | #c4e2ca | dividers on tint | on-surface (body text) |
| jade-300 | #a5d2b5 | — | primary-hover, primary-text |
| jade-400 | #85c7a1 | — | primary, primary-strong |
| jade-500 | #70b48d | charts, illustration | charts, illustration |
| jade-600 | #548f6f | primary (bars, rings) | — |
| jade-700 | #3d6950 | primary-strong, primary-text | — |
| jade-800 | #234433 | primary-hover | border |
| jade-900 | #0e1d16 | on-background (text) | background, on-primary |

### Roles

- **Primary** (jade): the one action colour. Button fill is `primary-strong` with `on-primary` text (6.3:1 light, 8.9:1 dark). Bars, rings and focus outlines use `primary`.
- **Secondary** (champagne gold, `#b08d57` / `#d4b483`): rewards only, i.e. XP, gold, streak milestones, premium badges. Text uses `secondary-text`. This replaces the old violet.
- **Status**: `success` is a brighter emerald than the brand jade, `warning` is amber, `error` is a muted brick red, `info` is a steel blue. Each has a `*-text` token tuned for 4.5:1. Because success and primary are both green, **a status is always icon + label**, never colour alone.
- **Neutrals** are green-tinted or warm, never grey: `background` #f9f7f3 (the ivory of the brand board), `surface` #ffffff, `border` #dbe7de, muted text `on-surface-light` #4f6b5c. In dark mode the ground is `jade-900` with surfaces #14261d and #1c3328.

### Rules

1. Components use tokens, never hex (`bg-primary-strong`, `text-on-surface-light`, `bg-success/10`).
2. Gold appears at most once or twice per screen. If everything is a reward, nothing is.
3. `jade-500` and `jade-600` fail 4.5:1 as text on white; use `primary-text` for text.
4. Soft tints for chips and badges: the role colour at 10% (light) / 16% (dark) over surface, text in the matching `*-text`.

## Typography

**Montserrat** (400/500/600/700, Google Fonts) for all UI, **JetBrains Mono** (400/500) for numbers that count: XP, gold, money, timers. Body is 15px / 22px with −0.01em tracking. Display is 32px bold at −0.02em. Nothing below 14px except `caption` (12px) for timestamps and meta.

## Spacing, radius, elevation

A 4px grid: 4, 8, 12, 16, 24, 32. Cards pad 16px (24px for hero stats). Radii: 6px chips, 10px buttons and inputs, 16px cards, full for pills and bars. Shadows are tinted with ink green in light mode so they feel soft rather than grey: `shadow-sm` at rest, `shadow-md` on hover, `shadow-lg` for modals and lifted cards.

## Motion

Enter 400ms ease-out, stagger 50–60ms, exit 200ms. Button hover scale 1.02 (100ms); interactive card lift −4px (200ms) with `shadow-lg` and a `primary`/25% border. Animate only `transform` and `opacity`. Every effect (confetti, count-up, shimmer, halo, sheen) respects `prefers-reduced-motion` and the in-app "Reduce motion" setting.

## Iconography

Lucide-style stroke icons at 16 / 24 / 32 / 48px, coloured with the role token they represent. Never emoji.

## Logo

The mark is a leaf-shaped **N**: a rising leaf, a falling leaf and a stem, overlapping in a jade gradient, reading as growth and renewal. The wordmark "Noutlife" is set in **Montserrat Medium** with −12 units of tracking, in ink green (#0e1d16) on light grounds and ivory (#f9f7f3) on dark, so logo and UI share one typeface.

All logo files are SVG with transparent backgrounds, in the Logos group:

| File | Use |
|---|---|
| noutlife-logo-horizontal.svg | Default lockup: web header, sidebar, documents, email. Light grounds. |
| noutlife-logo-horizontal-on-dark.svg | The same on `jade-900` and dark mode. |
| noutlife-logo-stacked.svg | Splash, onboarding, centred layouts. Light grounds. |
| noutlife-logo-stacked-on-dark.svg | The same on dark. |
| noutlife-mark.svg | The mark alone: tab bar, avatar slots, favicon, loaders. Light grounds. |
| noutlife-mark-on-dark.svg | The mark alone on dark (lighter gradient so it holds contrast). |
| noutlife-mark-mono-ink.svg / -mono-ivory.svg | One-colour mark for print, embossing, watermarks, single-ink contexts. |
| noutlife-wordmark.svg | Wordmark alone, for when the mark already appears nearby. |
| noutlife-app-icon.svg | 1024 × 1024 app icon: deep-forest tile (229px corners), on-dark mark at 56% height. Export PNGs for iOS / Android from this. |

**Proportions.** Horizontal: mark height = 2.35 × the wordmark cap height, with half a cap height between mark and word, and the word centred on the mark. Stacked: mark height = 4 × cap height, with 0.9 cap heights between them.

**Logo colours.** The gradient is the logo's own and is not used in UI: leaf highlights #8ec7ad / #5fae97, mid #2f7565, depth #05302b (on dark: #c4e6d4 → #1a5547). UI uses the flat Jade tokens.

**Rules.** Keep clear space equal to the width of the right leaf on every side. Minimum size: 24px height for the mark, 20px cap height (about 120px wide) for the horizontal lockup; below that use the mark alone. Never recolour, outline, rotate, stretch or add shadows, glows or bevels. On photos, place the logo on a solid ivory or `jade-900` plate. Use the mono files when gradients can't reproduce.

The vectors were redrawn from the brand board: the leaves are fitted to the original outlines (within about half a pixel at 200px), and the wordmark was reset in Montserrat instead of tracing the raster letters.

## Accessibility

AA everywhere: 4.5:1 text, 3:1 large text, control borders and focus rings (3px `primary`, 2px offset). Touch targets: 44px icon buttons, 48px checks, 56px tab bar, 64px FAB. `aria-current="page"` in nav, `aria-pressed` on checks, `role="progressbar"` with values, `aria-live` on toasts and counters, Escape closes modals.

## Components

From `docs/redesign/`: Button (primary / secondary / ghost / danger / icon × lg / md / sm), Card (base, elevated, interactive), Badge, Input / Select / Field, Switch, SegmentedControl, Tabs, ProgressBar, ProgressRing, StatCard, IconChip, Toast, Modal / Sheet, EmptyState, ErrorState, PageLoader, Confetti, BarChart, LineChart, Heatmap. Layout: TabBar + FAB on mobile (<768px), a 5rem Rail on tablet, a 16rem Sidebar with a 4rem Topbar on desktop (≥1024px). Guidelines for Button, Card, StatCard and ProgressBar are written here so far.

## Migrating the code

The app reads RGB channels from `apps/web/src/styles/tokens.css` (`--lq-primary: 99 102 241`). Replacing those channel values with the tokens here rebrands the whole app without touching components. The alternate visual themes in `globals.css` (cyber, forest, ocean, sunset, retro) are not part of this system.
