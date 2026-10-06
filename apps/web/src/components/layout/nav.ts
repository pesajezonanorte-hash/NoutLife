// Mapa de navegación del AppShell (docs/redesign/README.md). La navegación
// principal (TabBar/Sidebar) es Inicio + las 3 zonas que elige el usuario
// (onboarding o Ajustes → Zonas) + Perfil; el resto queda en Bienestar, "Más
// zonas" y Comunidad.
import {
  BarChart3, BookOpen, CalendarDays, HelpCircle, Dumbbell, Flag, Globe, Heart, Home,
  MapPin, Moon, NotebookPen, Scroll, Settings, ShoppingBag, Skull, Sparkles, Sun,
  Trophy, User, UtensilsCrossed, Wallet, CheckCircle2, MessageCircle, Mail, NotebookTabs, Tent, Album, type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_ORDER, PINNED_COUNT, useNavStore } from '@/store/navStore';

export interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavEntry[];
  /** Plegable en el sidebar (zonas sin prototipo). */
  collapsible?: boolean;
}

const HOME: NavEntry = { to: '/', label: 'Inicio', icon: Home };
const PROFILE: NavEntry = { to: '/profile', label: 'Perfil', icon: User };

/** Secciones con todas las zonas; las zonas principales del usuario se sacan de aquí. */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'wellness',
    label: 'Bienestar',
    items: [
      { to: '/finances', label: 'Finanzas', icon: Wallet },
      { to: '/food', label: 'Comida', icon: UtensilsCrossed },
      { to: '/sleep', label: 'Sueño', icon: Moon },
      { to: '/achievements', label: 'Logros', icon: Trophy },
    ],
  },
  {
    id: 'zones',
    label: 'Más zonas',
    collapsible: true,
    items: [
      { to: '/habits', label: 'Hábitos', icon: CheckCircle2 },
      { to: '/quests', label: 'Misiones', icon: Flag },
      { to: '/stats', label: 'Estadísticas', icon: BarChart3 },
      { to: '/gym', label: 'Gimnasio', icon: Dumbbell },
      { to: '/glow-up', label: 'Glow up', icon: Sparkles },
      { to: '/learning', label: 'Aprendizaje', icon: BookOpen },
      { to: '/love', label: 'Relaciones', icon: Heart },
      { to: '/journal', label: 'Diario', icon: NotebookPen },
      { to: '/agenda', label: 'Agenda', icon: CalendarDays },
      { to: '/rituals', label: 'Rituales', icon: Sun },
      { to: '/wisdom', label: 'Sabiduría', icon: Scroll },
      { to: '/custom-zones', label: 'Mis zonas', icon: MapPin },
      { to: '/shop', label: 'Tienda', icon: ShoppingBag },
    ],
  },
  {
    id: 'community',
    label: 'Comunidad',
    collapsible: true,
    items: [
      // Amigos, cartas y gremios en un mismo sitio.
      { to: '/social', label: 'Social', icon: MessageCircle },
      { to: '/gallery', label: 'Galería', icon: Album },
      { to: '/leaderboard', label: 'Ranking', icon: Globe },
      { to: '/season', label: 'Campaña', icon: Skull },
    ],
  },
];

/** Atajos a cada parte de Social (búsqueda rápida). */
export const SOCIAL_SHORTCUTS: NavEntry[] = [
  { to: '/social?tab=directorio', label: 'Directorio', icon: NotebookTabs },
  { to: '/social?tab=cartas', label: 'Cartas', icon: Mail },
  { to: '/social?tab=gremios', label: 'Gremios', icon: Tent },
];

/** Rutas que se unieron en otra (zonas fijadas o escondidas guardadas antes). */
const MERGED: Record<string, string> = { '/friends': '/social', '/guild': '/social' };

/** Todas las zonas que pueden ir en la navegación principal (entre Inicio y Perfil). */
export const ZONES: NavEntry[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Orden válido y completo: quita rutas desconocidas o repetidas y añade las que falten. */
export function resolveOrder(order: string[] | undefined): string[] {
  const known = new Set(ZONES.map((z) => z.to));
  const valid = [...new Set((order ?? DEFAULT_ORDER).map((to) => MERGED[to] ?? to).filter((to) => known.has(to)))];
  return [...valid, ...ZONES.map((z) => z.to).filter((to) => !valid.includes(to))];
}

export function buildNav(order: string[] | undefined, hidden: string[] = []) {
  const pinned = resolveOrder(order).slice(0, PINNED_COUNT);
  const off = new Set(hidden.map((to) => MERGED[to] ?? to).filter((to) => !pinned.includes(to)));
  const byTo = new Map(ZONES.map((z) => [z.to, z]));
  return {
    primary: [HOME, ...pinned.map((to) => byTo.get(to)!), PROFILE],
    sections: NAV_SECTIONS
      .map((s) => ({ ...s, items: s.items.filter((it) => !pinned.includes(it.to) && !off.has(it.to)) }))
      .filter((s) => s.items.length > 0),
  };
}

/** Navegación del usuario actual: Inicio + sus zonas principales + Perfil, y el resto por secciones. */
export function useNav() {
  const userId = String(useAuthStore((s) => s.user?.id) ?? 'anon');
  const order = useNavStore((s) => s.byUser[userId]);
  const hidden = useNavStore((s) => s.hiddenByUser?.[userId]);
  return useMemo(() => buildNav(order, hidden), [order, hidden]);
}

/** Navegación por defecto (búsqueda rápida y breadcrumb). */
export const PRIMARY_NAV: NavEntry[] = buildNav(undefined).primary;

export const UTILITY_NAV: NavEntry[] = [
  { to: '/settings', label: 'Ajustes', icon: Settings },
  { to: '/faq', label: 'Ayuda', icon: HelpCircle },
];

/** Rutas sin entrada propia en la navegación (solo para el breadcrumb). */
const EXTRA_LABELS: Record<string, string> = {
  '/history': 'Historial',
  '/life': 'Life Score',
  '/about': 'Acerca de',
  '/quests/new': 'Nueva misión',
};

const ALL_NAV = [HOME, PROFILE, ...ZONES, ...UTILITY_NAV];

export function matchesRoute(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

/** Entrada de navegación que contiene la ruta actual (la más específica). */
export function findNavEntry(pathname: string): NavEntry | undefined {
  return ALL_NAV.filter((n) => matchesRoute(pathname, n.to)).sort((a, b) => b.to.length - a.to.length)[0];
}

export interface Crumb { label: string; to?: string }

/**
 * Breadcrumb "Noutlife › Sección › Detalle". El último tramo puede venir de
 * la página (p. ej. el nombre del hábito) vía `usePageCrumb`.
 */
export function buildCrumbs(pathname: string, detail?: string | null): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Noutlife', to: '/' }];
  const entry = findNavEntry(pathname);
  if (EXTRA_LABELS[pathname]) {
    if (entry && entry.to !== '/') crumbs.push({ label: entry.label, to: entry.to });
    crumbs.push({ label: EXTRA_LABELS[pathname] });
    return crumbs;
  }
  // Perfiles sociales (su DNI): Noutlife › Social › @usuario
  if (pathname.startsWith('/u/')) {
    crumbs.push({ label: 'Social', to: '/social' });
    crumbs.push({ label: detail ?? `@${decodeURIComponent(pathname.slice(3))}` });
    return crumbs;
  }
  if (!entry) {
    crumbs.push({ label: detail ?? 'Página' });
    return crumbs;
  }
  const isDetail = pathname !== entry.to;
  crumbs.push({ label: entry.label, to: isDetail ? entry.to : undefined });
  if (isDetail) crumbs.push({ label: detail ?? 'Detalle' });
  return crumbs;
}
