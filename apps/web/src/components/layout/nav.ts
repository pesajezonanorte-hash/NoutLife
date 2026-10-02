// Mapa de navegación del AppShell (docs/redesign/README.md). Las 5 secciones
// principales van en TabBar/Rail/Sidebar; "Bienestar" replica la sección del
// sidebar de DashboardDesktop; el resto de zonas existentes (sin prototipo)
// conservan su ruta y se agrupan en "Más zonas" y "Comunidad".
import {
  BarChart3, BookOpen, CalendarDays, HelpCircle, Dumbbell, Flag, Globe, Heart, Home,
  MapPin, Moon, NotebookPen, Scroll, Settings, ShoppingBag, Skull, Sparkles, Sun,
  Swords, Trophy, User, Users, UtensilsCrossed, Wallet, CheckCircle2, type LucideIcon,
} from 'lucide-react';

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

export const PRIMARY_NAV: NavEntry[] = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/habits', label: 'Hábitos', icon: CheckCircle2 },
  { to: '/quests', label: 'Misiones', icon: Flag },
  { to: '/colosseum', label: 'Coliseo', icon: Swords },
  { to: '/profile', label: 'Perfil', icon: User },
];

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
      { to: '/leaderboard', label: 'Ranking', icon: Globe },
      { to: '/guild', label: 'Gremio', icon: Users },
      { to: '/season', label: 'Campaña', icon: Skull },
    ],
  },
];

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

const ALL_NAV = [...PRIMARY_NAV, ...NAV_SECTIONS.flatMap((s) => s.items), ...UTILITY_NAV];

export function matchesRoute(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

/** Entrada de navegación que contiene la ruta actual (la más específica). */
export function findNavEntry(pathname: string): NavEntry | undefined {
  return ALL_NAV.filter((n) => matchesRoute(pathname, n.to)).sort((a, b) => b.to.length - a.to.length)[0];
}

export interface Crumb { label: string; to?: string }

/**
 * Breadcrumb "LifeQuest › Sección › Detalle". El último tramo puede venir de
 * la página (p. ej. el nombre del hábito) vía `usePageCrumb`.
 */
export function buildCrumbs(pathname: string, detail?: string | null): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'LifeQuest', to: '/' }];
  const entry = findNavEntry(pathname);
  if (EXTRA_LABELS[pathname]) {
    if (entry && entry.to !== '/') crumbs.push({ label: entry.label, to: entry.to });
    crumbs.push({ label: EXTRA_LABELS[pathname] });
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
