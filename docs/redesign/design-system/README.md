# LifeQuest Design System

LifeQuest is a gamified life-management app built with React 18, Tailwind CSS 3.4, and Framer Motion. This design system synced from the production codebase (`apps/web`) in the [lifequest2](https://github.com/pesajezonanorte-hash/lifequest2) repository.

## Overview

The design system uses a **light/dark theme structure** with RGB channel-based color tokens for Tailwind opacity modifiers (`bg-primary/10`, `ring-warning/25`). Typography is built on **Montserrat** (UI) and **JetBrains Mono** (code/data). Motion follows a consistent 400ms entrance → 50–60ms stagger → 200ms exit pattern.

## Color Palette

### Semantic Colors
- **Primary (Indigo)**: Bars, rings, accents, and button fills. Light: indigo-600 for strong contrast. Dark: indigo-400.
- **Secondary (Violet)**: Supporting accent for secondary states and emphasis.
- **Success (Emerald)**: Quest completion, habit checks, positive states.
- **Warning (Amber)**: XP gains, achievements, notifications. Gold tint for legacy gold currency.
- **Error (Red)**: Destructive actions, health loss, failure states.
- **Info (Blue)**: Information, mana points, status updates.

### Neutral Scale (Gray)
- **Background**: Pure white (light) / gray-900 (dark).
- **Surface**: Gray-50 (light) / gray-800 (dark) for cards and panels.
- **Border**: Gray-200 (light) / gray-700 (dark). Strong: gray-500 (light) / gray-400 (dark) for inputs.
- **Text**: Gray-800 on light, gray-50 on dark. Muted: gray-500 (light) / gray-400 (dark).

## Typography

### Typeface
- **Montserrat**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold) for all UI.
- **JetBrains Mono**: 400, 500 for data displays and in-game currency/stats.

### Type Scales
- **Display**: 32px / 40px, bold (headers, hero stats)
- **Heading**: XL (24px), LG (20px), MD (18px), all bold or semibold
- **Body**: LG (16px), MD (15px), SM (14px), all regular
- **Caption**: 12px regular (timestamps, hints)
- **Label**: MD (14px semibold), SM (12px semibold)

**Minimum body text: 14px.** Caption (10px) reserved only for timestamps to maintain legibility.

## Spacing & Rhythm

Consistent 4px grid with scale: 4, 8, 12, 16, 24, 32 px.
- **space-4 (16px)**: Standard card padding and gap.
- **space-6 (24px)**: Section separation.
- **space-8 (32px)**: Major layout blocks.

## Radius

- **6px**: Small elements (badges, tiny toggles)
- **10px**: Buttons, inputs, smaller containers
- **16px**: Cards, major containers
- **999px**: Fully rounded (progress rings, chips)

## Shadows

Three-level system, applied with motion on hover:
- **shadow-sm**: Rest state (cards, panels at 1px offset)
- **shadow-md**: Hover state (cards lift, buttons pressed)
- **shadow-lg**: Modals, FAB, maximally elevated

Shadows include dark overlay on dark theme for depth.

## Motion

- **Enter**: 400ms ease-out for page transitions
- **Stagger**: 50–60ms per item (list/grid animations)
- **Exit**: 200ms for dismissal
- **Hover**: 100ms scale/transform for buttons (1.02x), cards lift −4px (200ms)
- **Animate only**: `transform` and `opacity`. Never animate `width`/`height`.
- **Reduced motion**: Respects `prefers-reduced-motion` and app-level `useReducedMotion()` store.

Motion effects: confetti on quest completion, shimmer/skeleton loaders, count-up animations on stats, shine effect on progress bars, glow halos on achievements.

## Components at Scale

### Core UI Library
**Button**: 5 variants (primary, secondary, ghost, danger, icon) × 3 sizes (sm/md/lg) = 15 compositions.
**Card**: Base + elevated, with optional `interactive` lift on hover.
**Badge/Chip**: Icon + text, color-coded (success/warning/error/info/primary/secondary/neutral), sizes md/lg.
**Input/Select/Field**: Label above, help text, error states, touch target ≥44px (mobile).
**Switch / Toggle**: Animated with MotionConfig, 48px touch target.
**SegmentedControl**: Sliding pill indicator with Framer `layoutId` for smooth animation.
**Tabs**: Underline indicator, `aria-selected`, keyboard nav.
**ProgressBar / ProgressRing**: ScaleX / pathLength animations, optional shine on bars.
**StatCard**: Icon + count-up number + label + optional link (used in finances, achievements, dashboard).
**Toast**: `useToast` hook, auto-dismiss, stacked vertically, aria-live announcements.
**Modal / Sheet**: Focus trap, Escape to close, `aria-modal`, scrim overlay.
**EmptyState / ErrorState**: Distinct messaging and retry button. ErrorState auto-retries after 5s.
**PageLoader**: Skeleton shimmer + spinner overlay for async data.
**Confetti**: Particle burst on big wins (quests, achievements). Respects reduced motion.
**Charts**: BarChart, LineChart, Heatmap with tooltips. Bars use success/warning/error colors.

### Layout Components
- **AppShell**: Viewport wrapper managing responsive layouts
- **TabBar**: 56px height, 44px touch targets (mobile, `<768px`)
- **FAB** (Floating Action Button): 64px circle at bottom-right (mobile)
- **Rail**: 20rem width with labels (tablet, 768–1023px)
- **Sidebar**: 16rem width + top bar with breadcrumb (desktop, `≥1024px`)
- **Topbar**: 16rem (4rem on 24px grid), sticky, navigation + title

Icons: Lucide React (if available) or inline SVG strokes. Sizes: 16/24/32/48px. Never emoji.

## Accessibility

- **Contrast**: AA minimum (4.5:1 body, 3:1 large). Primary-strong + on-primary hits 6.3:1.
- **Touch targets**: 44px minimum for buttons/icons, 48px for checkboxes, 56px for tab bar.
- **Color + Icon**: Never signal state by color alone (badges, state indicators, heatmap days all pair icon + color).
- **ARIA**: `aria-current="page"` on nav, `role="tablist"` + `aria-selected` on filters, `aria-pressed` on toggles, `role="progressbar"` on meters.
- **Keyboard**: Tab order, Escape closes modals, arrow keys in menus. `aria-live` on toasts and count-ups.
- **Focus ring**: 3px solid primary, 2px offset, visible in all themes.

## Dark Theme

Applied via `.dark` class on `<html>`. All colors auto-switch; no per-theme CSS overrides needed. Shadows darken. Soft alpha for tints adjusts (0.10 light → 0.16 dark for badge backgrounds).

## Brand Personality

LifeQuest is minimalist and gamified without gradient washes or decorative noise. The interface uses **solid, honest UI** with playful motion and color for feedback. Defaults to light theme; respects system preference or user override. Gold/amber accents signal rewards; indigo is the primary action color.

## Component Migration Checklist

From `src/components/ui/`:
- [ ] Button (6 variants + sizes)
- [ ] Card (base, elevated)
- [ ] Badge (5 color groups)
- [ ] Input, Select, Field
- [ ] Switch, SegmentedControl
- [ ] Tabs, Breadcrumb
- [ ] ProgressBar, ProgressRing
- [ ] StatCard with count-up
- [ ] Toast + useToast hook
- [ ] Modal, Sheet, Drawer
- [ ] EmptyState, ErrorState, PageLoader
- [ ] Confetti (Framer Motion particle)
- [ ] Charts (Bar, Line, Heatmap)
- [ ] AppShell, TabBar, FAB, Rail, Sidebar, Topbar

## Key Rules (Non-negotiable)

1. **No hex colors in components.** Only token classes (e.g., `bg-primary-strong`, `text-on-surface-light`, `border-border-strong`).
2. **AA contrast on all text and interactive elements.**
3. **14px minimum body text** (caption 12px only for metadata).
4. **Touch targets ≥44px** (icons, buttons).
5. **Animations use `transform`/`opacity` only.** No width/height animations.
6. **Reduced motion support mandatory:** Motion classes respect `prefers-reduced-motion` CSS media query + app-level store.
7. **State-aware renders:** `if (isLoading) <PageLoader/>; if (error) <ErrorState/>; if (empty) <EmptyState/>;`.
8. **Icons + text for state signals** (badges always have icon + label, never color alone).

## Source

Synced from [github.com/pesajezonanorte-hash/lifequest2](https://github.com/pesajezonanorte-hash/lifequest2) on 2026-10-03.
- Token source: `apps/web/src/styles/tokens.css` + `globals.css`
- Component reference: `docs/redesign/` (handoff specs, design files, Figma exports)
- Implementation: React 18 + Vite + Tailwind 3.4 + Framer Motion 11 + React Query + Zustand
