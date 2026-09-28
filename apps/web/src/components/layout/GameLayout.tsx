import { type ReactNode, type UIEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import * as authService from '../../services/auth.service';
import { LevelUpOverlay } from '../animations/LevelUpOverlay';
import { FloatingXPLayer } from '../animations/FloatingXP';
import { ScreenFlash } from '../animations/ScreenFlash';
import { AchievementUnlockedToast } from '../achievements/AchievementUnlockedToast';
import { ToastContainer } from '../ui/ToastContainer';
import { audio } from '../../lib/audio';
import {
  Swords, Flame, BarChart3, TrendingUp, Dumbbell,
  UtensilsCrossed, Moon, Wallet, BookOpen, Heart, NotebookPen,
  ShoppingBag, Globe, Crosshair, Users, Skull, CalendarDays,
  Sparkles, Trophy, Settings, User,
  Volume2, VolumeX, UserPlus, Zap, Search, Castle, ChevronRight,
  Scroll, MapPin, LogOut,
} from 'lucide-react';
import { FocusMode } from '../ui/FocusMode';
import { FeedbackButton } from '../ui/FeedbackButton';
import { AnimatePresence as AP } from 'framer-motion';
import { CommandPalette } from '../ui/CommandPalette';
import { NotificationBell } from '../ui/NotificationPanel';
import { ScrollToTop } from '../ui/ScrollToTop';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { QuickActionsFAB } from '../ui/QuickActionsFAB';
import { MusicPlayer } from '../ui/MusicPlayer';
import { getLevelTitle, ZONE_TOOLTIPS } from '../../lib/gameProgress';
import { refreshUser } from '../../hooks/useAuth';
import { E } from '@/components/ui/glyphs';
import SkyToggle from '../ui/sky-toggle';
import { applyThemeMode, resolveIsDark, subscribeThemeMode } from '../../lib/themeMode';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '../ui/sidebar';
import { MobileNavigation } from './MobileNavigation';
import { AvatarDisplay } from '../character/AvatarDisplay';
import { Dock, DockIcon, DockItem, DockLabel } from '../ui/dock';

interface NavItem {
  to: string;
  icon: ReactNode;
  label: string;
  hint: string;
  group: 'main' | 'zones' | 'social' | 'me';
  accent?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  // Aventura
  { to: '/',            icon: <Castle size={18} />,            label: 'Castillo',    hint: 'Dashboard',     group: 'main' },
  { to: '/quests',      icon: <Swords size={18} />,            label: 'Misiones',    hint: 'Registro',      group: 'main' },
  { to: '/habits',      icon: <Flame size={18} />,             label: 'Hábitos',     hint: 'Rutina',        group: 'main' },
  { to: '/stats',       icon: <TrendingUp size={18} />,        label: 'Estadísticas',hint: 'Life Score',    group: 'main' },
  // Zonas del reino
  { to: '/finances',    icon: <Wallet size={18} />,            label: 'Bóveda',      hint: 'Finanzas',      group: 'zones' },
  { to: '/gym',         icon: <Dumbbell size={18} />,          label: 'Coliseo',     hint: 'Gym',           group: 'zones' },
  { to: '/glow-up',     icon: <Sparkles size={18} />,          label: 'El Espejo',   hint: 'Glow Up',       group: 'zones' },
  { to: '/food',        icon: <UtensilsCrossed size={18} />,   label: 'Posada',      hint: 'Comida',        group: 'zones' },
  { to: '/sleep',       icon: <Moon size={18} />,              label: 'Torre',       hint: 'Sueño',         group: 'zones' },
  { to: '/learning',    icon: <BookOpen size={18} />,          label: 'Biblioteca',  hint: 'Aprendizaje',   group: 'zones' },
  { to: '/love',        icon: <Heart size={18} />,             label: 'Jardín',      hint: 'Amor',          group: 'zones' },
  { to: '/journal',     icon: <NotebookPen size={18} />,       label: 'Diario',      hint: 'Notas',         group: 'zones' },
  { to: '/shop',        icon: <ShoppingBag size={18} />,       label: 'Mercado',     hint: 'Tienda',        group: 'zones' },
  { to: '/wisdom',        icon: <Scroll size={18} />,   label: 'Sabiduría',     hint: 'Sabiduría',     group: 'zones', accent: true },
  { to: '/custom-zones',  icon: <MapPin size={18} />,   label: 'Mis Zonas',     hint: 'Personalizadas', group: 'zones' },
  // Social
  { to: '/leaderboard', icon: <Globe size={18} />,             label: 'Mundo',       hint: 'Ranking',       group: 'social' },
  { to: '/challenges',  icon: <Crosshair size={18} />,         label: 'Retos',       hint: 'Jefes',         group: 'social' },
  { to: '/guild',       icon: <Users size={18} />,             label: 'Gremio',      hint: 'Amigos',        group: 'social' },
  { to: '/season',      icon: <Skull size={18} />,             label: 'Campaña',     hint: 'Historia',      group: 'social' },
  // Tú
  { to: '/character',   icon: <User size={18} />,              label: 'Personaje',   hint: 'Perfil',        group: 'me' },
  { to: '/achievements',icon: <Trophy size={18} />,            label: 'Logros',      hint: 'Achievements',  group: 'me' },
  { to: '/agenda',      icon: <CalendarDays size={18} />,      label: 'Agenda',      hint: 'Calendario',    group: 'me' },
  { to: '/settings',    icon: <Settings size={18} />,          label: 'Ajustes',     hint: 'Configuración', group: 'me' },
];

const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'main',   label: 'Aventura' },
  { id: 'zones',  label: 'Zonas del reino' },
  { id: 'social', label: 'Mundo' },
  { id: 'me',     label: 'Tú' },
];


function SidebarGroupLabel({ label }: { label: string }) {
  const { open, animate } = useSidebar();
  return (
    <motion.div
      animate={{ opacity: open ? 1 : 0 }}
      className="px-[10px] pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ color: 'var(--text-3)' }}
    >
      {label}
    </motion.div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="hidden lg:block font-pixel text-[var(--text-muted)] select-none" style={{ fontSize: '9px' }}>
      {time}
    </span>
  );
}

function XPSparkles({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<{ id: number; x: number }[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const newOnes = Array.from({ length: 8 }, (_, i) => ({ id: Date.now() + i, x: Math.random() * 100 }));
    setParticles(newOnes);
    const t = setTimeout(() => setParticles([]), 1500);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bottom-0 rounded-full bg-[var(--accent-gold)]"
          style={{ left: `${p.x}%`, width: 3, height: 3 }}
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{ y: -20, opacity: 0, scale: 0 }}
          transition={{ duration: 1 + Math.random() * 0.5, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function GoldCounter({ gold }: { gold: number }) {
  const prev = useRef(gold);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (gold !== prev.current) {
      setFlash(gold > prev.current ? 'up' : 'down');
      prev.current = gold;
      const t = setTimeout(() => setFlash(null), 700);
      return () => clearTimeout(t);
    }
  }, [gold]);

  const color = flash === 'up'
    ? 'text-[var(--accent-green)]'
    : flash === 'down'
      ? 'text-[var(--accent-red)]'
      : 'text-[var(--accent-gold)]';

  return (
    <motion.div
      className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2"
      animate={flash ? { scale: [1, 1.04, 1] } : {}}
      transition={{ duration: 0.25 }}
    >
      <Wallet size={16} />
      <span className={`text-sm font-semibold ${color}`}>{gold.toLocaleString('es-CO')}</span>
    </motion.div>
  );
}

function StatBarFill({
  pct,
  color,
  pulse,
  wave,
}: {
  pct: number;
  color: string;
  pulse?: boolean;
  wave?: boolean;
}) {
  return (
    <div className="stat-bar relative overflow-hidden">
      <motion.div
        className={`stat-bar-fill ${color} relative overflow-hidden`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
            backgroundSize: '60% 100%',
          }}
          animate={{ backgroundPositionX: ['-60%', '160%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
        />
        {wave && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 10px)',
            }}
            animate={{ x: [0, 10] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </motion.div>
      {pulse && pct < 30 && (
        <motion.div
          className="absolute inset-0 pointer-events-none border border-[var(--accent-pink)]"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
    </div>
  );
}

interface HeaderDockButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  color?: string;
}

function HeaderDockButton({ label, onClick, children, className, color = 'var(--text-2)' }: HeaderDockButtonProps) {
  return (
    <DockItem className={className}>
      <DockLabel placement="bottom">{label}</DockLabel>
      <DockIcon className="aspect-square">
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          title={label}
          className="flex h-full w-full items-center justify-center rounded-[10px] transition-colors hover:bg-[var(--bg-panel-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
          style={{ color }}
        >
          {children}
        </button>
      </DockIcon>
    </DockItem>
  );
}

interface Props {
  children: ReactNode;
}

export function GameLayout({ children }: Props) {
  const { user, logout: storeLogout } = useAuthStore();
  const { toggleAudio, audioEnabled, xpSparkTrigger, openSage } = useUIStore();
  const [isDarkMode, setIsDarkMode] = useState(() => resolveIsDark());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => subscribeThemeMode(() => setIsDarkMode(resolveIsDark())), []);
  const handleToggleTheme = (checked: boolean) => applyThemeMode(checked ? 'dark' : 'light');
  const navigate = useNavigate();
  const location = useLocation();
  const [showFocus, setShowFocus] = useState(false);
  const [zoneTooltipVisible, setZoneTooltipVisible] = useState(false);
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const mainRef = useRef<HTMLElement>(null);
  const mobileScrollTopRef = useRef(0);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0 });
    }
    mobileScrollTopRef.current = 0;
    setMobileHeaderVisible(true);
    const tooltip = ZONE_TOOLTIPS[location.pathname];
    if (!tooltip) return;
    const key = `lifequest_zone_tip_${location.pathname}`;
    if (localStorage.getItem(key) === 'seen') return;
    setZoneTooltipVisible(true);
    localStorage.setItem(key, 'seen');
  }, [location.pathname]);

  // Mantener XP/gold/nivel/racha frescos al navegar entre secciones y al volver
  // a la pestaña: el store de auth solo se cargaba al boot de la app, así que
  // el XP ganado durante la sesión no se reflejaba en el HUD ni en el resto de
  // pantallas (aunque el leaderboard, que lee la BD, sí lo mostraba).
  useEffect(() => {
    void refreshUser();
  }, [location.pathname]);

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') void refreshUser();
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  async function handleLogout() {
    try {
      await authService.logout();
    } catch {
      // ignore
    }
    storeLogout();
    navigate('/login');
  }

  const hpPct = user ? (user.hp / user.maxHp) * 100 : 0;
  const mpPct = user ? (user.mp / user.maxMp) * 100 : 0;
  const xpPct = user ? (user.xp / user.xpToNextLevel) * 100 : 0;

  const xpPctSide = user ? Math.round((user.xp / user.xpToNextLevel) * 100) : 0;
  const u = user as unknown as { avatarConfig?: unknown; avatarUrl?: string | null; equippedAura?: string | null; equippedFrame?: string | null };

  function handleMainScroll(event: UIEvent<HTMLElement>) {
    const nextTop = event.currentTarget.scrollTop;
    const previousTop = mobileScrollTopRef.current;
    mobileScrollTopRef.current = nextTop;

    if (nextTop < 12) {
      setMobileHeaderVisible(true);
      return;
    }

    if (Math.abs(nextTop - previousTop) > 8) {
      setMobileHeaderVisible(nextTop < previousTop);
    }
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[var(--bg-deep)] text-[var(--text-primary)] md:flex-row">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody mobile={false} className="justify-between gap-2 py-2">
          <div className="flex min-w-[252px] flex-1 flex-col overflow-y-auto overflow-x-hidden">
            {/* marca */}
            <div className="relative flex items-center gap-2.5 px-2 pt-1 pb-4">
              <img
                src="/brand/lifequest-logo.png"
                alt="LifeQuest"
                className="h-9 w-9 rounded-[12px] border border-[var(--border)] bg-white object-cover flex-shrink-0"
              />
              <motion.div animate={{ opacity: sidebarOpen ? 1 : 0 }} className="min-w-0">
                <div className="text-[17px] font-extrabold tracking-[-0.02em] leading-none">LifeQuest</div>
                <div className="mt-[2px] text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-3)' }}>
                  v0.3 · alpha
                </div>
              </motion.div>
            </div>

            {/* nav agrupada (toda la info) */}
            <nav className="flex flex-col gap-3.5 px-1">
              {NAV_GROUPS.map((g) => {
                const items = NAV_ITEMS.filter((n) => n.group === g.id);
                if (!items.length) return null;
                return (
                  <div key={g.id}>
                    <SidebarGroupLabel label={g.label} />
                    <div className="flex flex-col gap-0.5">
                      {items.map((it) => (
                        <SidebarLink
                          key={it.to}
                          link={{ label: it.label, href: it.to, icon: it.icon, hint: it.hint }}
                          end={it.to === '/'}
                          accent={it.accent}
                          onClick={() => audio.play('blip')}
                          right={
                            it.accent ? (
                              <span
                                style={{
                                  width: 6, height: 6, borderRadius: 999,
                                  background: 'var(--c-xp)',
                                  boxShadow: '0 0 8px var(--c-xp)',
                                  flexShrink: 0,
                                }}
                              />
                            ) : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          {/* perfil: el avatar nunca se recorta; los datos se revelan hacia la derecha */}
          {user && (
            <div className="relative min-w-[252px] px-1 pt-2 pb-2">
              <button
                type="button"
                onClick={() => navigate('/character')}
                title={`${user.displayName} · Ver personaje`}
                aria-label={`Ver perfil de ${user.displayName}`}
                className="block w-full text-left"
                style={{
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                }}
              >
                <div className="flex min-h-[45px] items-center gap-3">
                  {/* Al recogerse se ve solo esto: el sprite completo, sin tarjeta ni recorte. */}
                  <div
                    className="flex shrink-0 items-center justify-center"
                    style={{ width: 36, height: 45 }}
                  >
                    <AvatarDisplay
                      avatarConfig={u.avatarConfig}
                      avatarUrl={u.avatarUrl}
                      equippedAura={u.equippedAura}
                      equippedFrame={u.equippedFrame}
                      size={36}
                      animate="none"
                    />
                  </div>

                  {/* Siempre ocupa su lugar: el ancho del sidebar solo lo revela hacia la derecha. */}
                  <motion.div
                    animate={{ opacity: sidebarOpen ? 1 : 0 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className="min-w-0 flex-1 pr-1"
                    style={{ pointerEvents: sidebarOpen ? 'auto' : 'none' }}
                  >
                    <div className="flex min-w-0 items-center gap-1.5 leading-none">
                      <span className="truncate text-[14px] font-extrabold tracking-[-0.01em]">
                        {user.displayName}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          padding: '2px 5px',
                          borderRadius: 5,
                          background: 'color-mix(in oklab, var(--c-xp) 18%, transparent)',
                          color: 'var(--c-xp)',
                          fontWeight: 800,
                          letterSpacing: '.06em',
                          flexShrink: 0,
                        }}
                      >
                        NV {user.level}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[11px]" style={{ color: 'var(--text-2)' }}>
                      {getLevelTitle(user.level)}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="shrink-0 text-[9px] font-bold uppercase tracking-[0.1em]"
                        style={{ color: 'var(--text-3)' }}
                      >
                        XP
                      </span>
                      <div
                        className="min-w-0 flex-1 overflow-hidden rounded-full"
                        style={{ height: 4, background: 'var(--ring-track)' }}
                      >
                        <div
                          style={{
                            width: `${xpPctSide}%`,
                            height: '100%',
                            borderRadius: 999,
                            background:
                              'linear-gradient(90deg, var(--c-xp), color-mix(in oklab, var(--c-xp) 60%, white))',
                            boxShadow: '0 0 7px color-mix(in oklab, var(--c-xp) 55%, transparent)',
                            transition: 'width 1s cubic-bezier(.22,1,.36,1)',
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>
                        {user.xp.toLocaleString()}/{user.xpToNextLevel.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                </div>
              </button>
            </div>
          )}
        </SidebarBody>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="sticky top-0 z-[100]"
          style={{
            borderBottom: '1px solid var(--border-soft)',
            background: 'color-mix(in oklab, var(--bg) 80%, transparent)',
            backdropFilter: 'blur(18px) saturate(180%)',
            WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          }}
        >
          {/* ── MOBILE header ── */}
          {user && (
            <motion.div
              className="overflow-hidden md:hidden"
              initial={false}
              animate={mobileHeaderVisible
                ? { height: 'auto', opacity: 1, y: 0 }
                : { height: 0, opacity: 0, y: -10 }}
              transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.2, ease: 'easeOut' }}
            >
              <div className="px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/character')}
                    aria-label="Abrir personaje"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
                  >
                    <AvatarDisplay
                      avatarConfig={u.avatarConfig}
                      avatarUrl={u.avatarUrl}
                      equippedAura={u.equippedAura}
                      equippedFrame={u.equippedFrame}
                      size={34}
                      animate="none"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold leading-tight text-[var(--text-primary)]">
                        {user.displayName}
                      </span>
                      <span className="block truncate text-[11px] font-medium tabular-nums text-[var(--text-muted)]">
                        Nv {user.level} · {user.currentStreak} días de racha
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center">
                    <div
                      aria-label={`${user.gold.toLocaleString('es-CO')} monedas`}
                      className="flex h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold tabular-nums text-[var(--c-gold)]"
                    >
                      <Wallet size={14} aria-hidden="true" />
                      <span>{user.gold.toLocaleString('es-CO')}</span>
                    </div>
                    <NotificationBell variant="mobile" />
                    <motion.button
                      type="button"
                      aria-label="Buscar"
                      title="Buscar"
                      className="ml-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
                      onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}
                      whileTap={{ scale: 0.96 }}
                    >
                      <Search size={18} aria-hidden="true" />
                    </motion.button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2" aria-label={`Estado: ${user.hp} de ${user.maxHp} puntos de vida, ${user.mp} de ${user.maxMp} puntos de maná y ${user.xp} de ${user.xpToNextLevel} experiencia`}>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-semibold tabular-nums text-[var(--text-muted)]">
                      <span className="text-[var(--c-hp)]">HP</span>
                      <span>{Math.round(hpPct)}%</span>
                    </div>
                    <StatBarFill pct={hpPct} color="bg-accent-pink" pulse={!shouldReduceMotion} />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-semibold tabular-nums text-[var(--text-muted)]">
                      <span className="text-[var(--c-mp)]">MP</span>
                      <span>{Math.round(mpPct)}%</span>
                    </div>
                    <StatBarFill pct={mpPct} color="bg-accent-cyan" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-semibold tabular-nums text-[var(--text-muted)]">
                      <span className="text-[var(--c-xp)]">XP</span>
                      <span>{Math.round(xpPct)}%</span>
                    </div>
                    <StatBarFill pct={xpPct} color="bg-accent-gold" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── DESKTOP header ── */}
          <div className="hidden md:flex items-center gap-4 px-8 py-[14px]">
            <div className="min-w-0 flex-1">
              {user && (
                <>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--text-3)' }}>
                    <span>El Castillo</span>
                    <ChevronRight size={11} />
                    <span style={{ color: 'var(--text-2)' }}>Día a día</span>
                  </div>
                  <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.025em] leading-tight" style={{ color: 'var(--text)' }}>
                    Bienvenido, {user.displayName.split(' ')[0]}
                  </h1>
                  <div className="mt-[2px] text-[13px]" style={{ color: 'var(--text-2)' }}>
                    Nivel {user.level} aventurero · {user.currentStreak} días de racha
                  </div>
                </>
              )}
            </div>

            <button
              className="hidden xl:flex items-center gap-2"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}
              title="Barra de comandos (Ctrl+K)"
              style={{ height: 38, padding: '0 14px', minWidth: 280, maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-3)' }}
            >
              <Search size={16} />
              <span className="flex-1 text-left text-[13px]" style={{ color: 'var(--text-3)' }}>Buscar misión, hábito, gasto…</span>
              <kbd style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>⌘K</kbd>
            </button>

            {user && (
              <>
                <div className="flex shrink-0 items-center gap-1.5 tabular-nums" style={{ height: 38, padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--c-gold)', fontWeight: 700, fontSize: 13 }}>
                  <Wallet size={15} />{user.gold.toLocaleString('es-CO')}
                </div>
                <LiveClock />
                <div className="hidden shrink-0 items-center lg:flex">
                  <SkyToggle checked={isDarkMode} onChange={handleToggleTheme} />
                </div>

                {/* Acciones secundarias: dock compacto para no llenar la cabecera de botones. */}
                <Dock
                  containerClassName="w-[320px] shrink-0 lg:w-[404px] xl:w-[360px] 2xl:w-[372px]"
                  className="w-full justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-sm)]"
                  panelHeight={48}
                  maxHeight={60}
                  reserveHeight
                  magnification={62}
                  distance={110}
                  ariaLabel="Acciones de la barra superior"
                >
                  <HeaderDockButton
                    className="inline-flex xl:hidden"
                    label="Buscar"
                    onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'k', bubbles: true }))}
                  >
                    <Search className="h-[80%] w-[80%]" strokeWidth={1.8} />
                  </HeaderDockButton>
                  <DockItem>
                    <DockLabel placement="bottom">Feedback</DockLabel>
                    <DockIcon className="aspect-square"><FeedbackButton variant="dock" /></DockIcon>
                  </DockItem>
                  <HeaderDockButton
                    className="hidden lg:inline-flex"
                    label="Añadir amigos"
                    onClick={() => navigate('/guild')}
                  >
                    <UserPlus className="h-[80%] w-[80%]" strokeWidth={1.8} />
                  </HeaderDockButton>
                  <DockItem>
                    <DockLabel placement="bottom">Notificaciones</DockLabel>
                    <DockIcon className="aspect-square"><NotificationBell variant="dock" /></DockIcon>
                  </DockItem>
                  <HeaderDockButton
                    label={audioEnabled ? 'Silenciar audio' : 'Activar audio'}
                    onClick={toggleAudio}
                    color={audioEnabled ? 'var(--text-2)' : 'var(--accent-red)'}
                  >
                    {audioEnabled
                      ? <Volume2 className="h-[80%] w-[80%]" strokeWidth={1.8} />
                      : <VolumeX className="h-[80%] w-[80%]" strokeWidth={1.8} />}
                  </HeaderDockButton>
                  <HeaderDockButton
                    className="hidden lg:inline-flex"
                    label="Sabiduría"
                    onClick={() => navigate('/wisdom')}
                    color="var(--c-xp)"
                  >
                    <Sparkles className="h-[80%] w-[80%]" strokeWidth={1.8} />
                  </HeaderDockButton>
                  <HeaderDockButton
                    label="Modo enfoque"
                    onClick={() => setShowFocus(true)}
                    color="var(--accent-cyan)"
                  >
                    <Zap className="h-[80%] w-[80%]" strokeWidth={1.8} />
                  </HeaderDockButton>
                  <HeaderDockButton
                    label="Cerrar sesión"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-[80%] w-[80%]" strokeWidth={1.8} />
                  </HeaderDockButton>
                </Dock>
                <span className="hidden"><XPSparkles trigger={xpSparkTrigger} /></span>
              </>
            )}
          </div>

        </header>

        <main ref={mainRef} onScroll={handleMainScroll} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-none">
          <div className="mx-auto w-full max-w-[1680px] px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+8.5rem)] md:px-6 md:py-6 md:pb-6">
            {zoneTooltipVisible && ZONE_TOOLTIPS[location.pathname] && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border px-4 py-3"
                style={{
                  borderColor: 'color-mix(in oklab, var(--accent-gold) 35%, transparent)',
                  background: 'linear-gradient(135deg, color-mix(in oklab, var(--accent-gold) 12%, transparent), transparent)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--accent-gold)' }}>
                      {ZONE_TOOLTIPS[location.pathname].title}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {ZONE_TOOLTIPS[location.pathname].body}
                    </p>
                  </div>
                  <button
                    onClick={() => setZoneTooltipVisible(false)}
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            )}
            {children}
          </div>
        </main>

        <MobileNavigation
          items={NAV_ITEMS}
          groups={NAV_GROUPS}
          onNavigate={() => audio.play('blip')}
          onMoreOpenChange={setMobileMoreOpen}
          utilityContent={(closeMore) => (
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                onClick={() => {
                  toggleAudio();
                  closeMore();
                }}
                whileTap={{ scale: 0.98 }}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)]"
              >
                {audioEnabled ? <Volume2 className="h-4 w-4 text-[var(--accent-cyan)]" aria-hidden="true" /> : <VolumeX className="h-4 w-4 text-[var(--accent-red)]" aria-hidden="true" />}
                <span>{audioEnabled ? 'Audio activo' : 'Activar audio'}</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  closeMore();
                  setShowFocus(true);
                }}
                whileTap={{ scale: 0.98 }}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)]"
              >
                <Zap className="h-4 w-4 text-[var(--accent-cyan)]" aria-hidden="true" />
                <span>Modo enfoque</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  closeMore();
                  openSage('¿En qué parte de mi aventura me recomiendas enfocarme ahora?');
                }}
                whileTap={{ scale: 0.98 }}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)]"
              >
                <Sparkles className="h-4 w-4 text-[var(--accent-gold)]" aria-hidden="true" />
                <span>El Sabio</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  closeMore();
                  navigate('/settings');
                }}
                whileTap={{ scale: 0.98 }}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)]"
              >
                <Settings className="h-4 w-4 text-[var(--accent-gold)]" aria-hidden="true" />
                <span>Tema y ajustes</span>
              </motion.button>
              <FeedbackButton
                variant="inline"
                className="min-h-12 w-full justify-start border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text-secondary)] hover:border-[var(--accent-gold)]"
              />
            </div>
          )}
        />
      </div>

      <LevelUpOverlay />
      <FloatingXPLayer />
      <ScreenFlash />
      <AchievementUnlockedToast />
      <ToastContainer />
      <CommandPalette />
      <OfflineIndicator />
      <ScrollToTop />

      {/* FAB de acciones rápidas */}
      <QuickActionsFAB mobileHidden={mobileMoreOpen} />

      {/* Reproductor de música global */}
      <MusicPlayer url={user?.gymPlaylistUrl} />

      <AP>
        {showFocus && <FocusMode onClose={() => setShowFocus(false)} />}
      </AP>
    </div>
  );
}
