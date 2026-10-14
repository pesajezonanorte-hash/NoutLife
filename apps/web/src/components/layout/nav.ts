// Mapa de navegación del AppShell (docs/redesign/README.md). La navegación
// principal (TabBar/Sidebar) es Inicio + las 3 zonas que elige el usuario
// (onboarding o Ajustes → Zonas) + Perfil; el resto queda en Bienestar, "Más
// zonas" y Comunidad.
import {
  BarChart3, BookOpen, CalendarDays, Clapperboard, Gem, HelpCircle, Flag, Globe, Heart, Home,
  MapPin, Moon, NotebookPen, Scroll, Settings, ShoppingBag, Skull, Sun,
  Sparkles, Swords, Trophy, User, UtensilsCrossed, Wallet, CheckCircle2, MessageCircle, Mail, NotebookTabs, Tent, Album, ListChecks, ShieldAlert, type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCustomZoneStore, type CustomZoneNav } from '@/store/customZoneStore';
import { zoneIconOf } from '@/components/zones/zoneIcons';
import { DEFAULT_ORDER, PINNED_COUNT, useNavStore } from '@/store/navStore';
import { proZoneOf } from '@/lib/plan';

export interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Zona Pro vista desde NoutLife Lite: se muestra con candado. */
  locked?: boolean;
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
      { to: '/recreacion', label: 'Recreación', icon: Clapperboard },
      { to: '/achievements', label: 'Logros', icon: Trophy },
    ],
  },
  {
    id: 'zones',
    label: 'Más zonas',
    collapsible: true,
    items: [
      { to: '/habits', label: 'Hábitos', icon: CheckCircle2 },
      { to: '/checklists', label: 'Checklists', icon: ListChecks },
      { to: '/obstaculos', label: 'Obstáculos', icon: ShieldAlert },
      { to: '/quests', label: 'Misiones', icon: Flag },
      { to: '/stats', label: 'Estadísticas', icon: BarChart3 },
      // Coliseo (antes Gimnasio): cualquier entrenamiento físico, no solo el gimnasio.
      { to: '/coliseo', label: 'Coliseo', icon: Swords },
      { to: '/espejo', label: 'Espejo', icon: Sparkles },
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
const MERGED: Record<string, string> = { '/friends': '/social', '/guild': '/social', '/glow-up': '/espejo', '/armario': '/espejo', '/gym': '/coliseo' };

/** Todas las zonas que pueden ir en la navegación principal (entre Inicio y Perfil). */
export const ZONES: NavEntry[] = NAV_SECTIONS.flatMap((s) => s.items);

// ─── Zonas dinámicas ─────────────────────────────────────────────────────────
// Además de las zonas fijas, la navegación admite zonas que se crean en tiempo de
// ejecución (las zonas personalizadas del usuario, /zonas/:id). Entran en su propia
// sección, se pueden fijar entre las principales, ordenar y ocultar como las demás.

export const CUSTOM_ZONE_PREFIX = '/zonas/';

export function customZoneEntries(zones: CustomZoneNav[]): NavEntry[] {
  return zones.map((z) => ({ to: `${CUSTOM_ZONE_PREFIX}${z.id}`, label: z.name, icon: zoneIconOf(z.icon) }));
}

/** Orden válido y completo: quita rutas desconocidas o repetidas y añade las que falten. */
export function resolveOrder(order: string[] | undefined, extra: NavEntry[] = []): string[] {
  const all = [...ZONES, ...extra];
  const known = new Set(all.map((z) => z.to));
  const valid = [...new Set((order ?? DEFAULT_ORDER).map((to) => MERGED[to] ?? to).filter((to) => known.has(to)))];
  return [...valid, ...all.map((z) => z.to).filter((to) => !valid.includes(to))];
}

export function buildNav(order: string[] | undefined, hidden: string[] = [], extra: NavEntry[] = []) {
  const pinned = resolveOrder(order, extra).slice(0, PINNED_COUNT);
  const off = new Set(hidden.map((to) => MERGED[to] ?? to).filter((to) => !pinned.includes(to)));
  const byTo = new Map([...ZONES, ...extra].map((z) => [z.to, z]));
  const sections: NavSection[] = extra.length
    ? [...NAV_SECTIONS, { id: 'custom', label: 'Mis zonas', collapsible: true, items: extra }]
    : NAV_SECTIONS;
  return {
    primary: [HOME, ...pinned.map((to) => byTo.get(to)!), PROFILE],
    sections: sections
      .map((s) => ({ ...s, items: s.items.filter((it) => !pinned.includes(it.to) && !off.has(it.to)) }))
      .filter((s) => s.items.length > 0),
  };
}

/**
 * Entradas de las zonas personalizadas (las carga una vez por sesión). «Mis
 * zonas» es de Pro: en Lite no se piden (la API respondería 402).
 */
export function useCustomZoneEntries(): NavEntry[] {
  const userId = useAuthStore((s) => s.user?.id);
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  const zones = useCustomZoneStore((s) => s.zones);
  const ensure = useCustomZoneStore((s) => s.ensure);
  useEffect(() => { if (userId && !lite) ensure(String(userId)); }, [userId, lite, ensure]);
  return useMemo(() => (lite ? [] : customZoneEntries(zones)), [zones, lite]);
}

/** En Lite, las zonas Pro llevan candado (siguen visibles: así se sabe qué abre Pro). */
function withLocks(nav: ReturnType<typeof buildNav>, lite: boolean): ReturnType<typeof buildNav> {
  if (!lite) return nav;
  const lock = (entry: NavEntry): NavEntry => (proZoneOf(entry.to) ? { ...entry, locked: true } : entry);
  return { primary: nav.primary.map(lock), sections: nav.sections.map((s) => ({ ...s, items: s.items.map(lock) })) };
}

/** Navegación del usuario actual: Inicio + sus zonas principales + Perfil, y el resto por secciones. */
export function useNav() {
  const userId = String(useAuthStore((s) => s.user?.id) ?? 'anon');
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  const order = useNavStore((s) => s.byUser[userId]);
  const hidden = useNavStore((s) => s.hiddenByUser?.[userId]);
  const extra = useCustomZoneEntries();
  return useMemo(() => withLocks(buildNav(order, hidden, extra), lite), [order, hidden, extra, lite]);
}

/** Navegación por defecto (búsqueda rápida y breadcrumb). */
export const PRIMARY_NAV: NavEntry[] = buildNav(undefined).primary;

export const UTILITY_NAV: NavEntry[] = [
  { to: '/plan', label: 'Plan', icon: Gem },
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
  // Zonas personalizadas: Noutlife › Mis zonas › Nombre de la zona
  if (pathname.startsWith(CUSTOM_ZONE_PREFIX)) {
    crumbs.push({ label: 'Mis zonas', to: '/custom-zones' });
    crumbs.push({ label: detail ?? 'Zona' });
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
