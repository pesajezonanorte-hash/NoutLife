import { Link, useLocation } from 'react-router-dom';
import { Coins, LogOut, MessageSquarePlus, Music, Sparkles, Volume2, VolumeX, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ProgressBar, SegmentedControl, Sheet } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { parseEmbed } from '@/components/ui/MusicPlayer';
import { useShellStore } from '@/store/shellStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { getLevelTitle } from '@/lib/gameProgress';
import { NAV_SECTIONS, UTILITY_NAV, matchesRoute, type NavEntry } from './nav';
import { useShellActions } from './actions';

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'auto', label: 'Auto' },
];

function Tile({ to, label, icon: Icon, onSelect }: NavEntry & { onSelect: () => void }) {
  const { pathname } = useLocation();
  const active = matchesRoute(pathname, to);
  return (
    <li>
      <Link
        to={to}
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'lq-lift flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center text-label-md',
          active ? 'border-primary/40 bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border bg-surface text-on-surface',
        )}
      >
        <span className={cn('lq-ichip flex size-10 items-center justify-center rounded-xl', active ? 'bg-background' : 'bg-primary/[var(--lq-soft-alpha)] text-primary-text')}>
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        {label}
      </Link>
    </li>
  );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-3 text-left text-label-lg text-on-surface transition-colors hover:bg-surface-variant"
    >
      <Icon aria-hidden className="size-5 shrink-0 text-primary-text" strokeWidth={1.75} />
      {label}
    </button>
  );
}

/** Menú completo (móvil y tablet): todas las zonas, herramientas y tema. */
export function MenuSheet() {
  const open = useShellStore((s) => s.menuOpen);
  const setOpen = useShellStore((s) => s.setMenuOpen);
  const setFocusOpen = useShellStore((s) => s.setFocusOpen);
  const setFeedbackOpen = useShellStore((s) => s.setFeedbackOpen);
  const setMusicOpen = useShellStore((s) => s.setMusicOpen);
  const user = useAuthStore((s) => s.user);
  const { audioEnabled, toggleAudio } = useUIStore();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const { logout, openSage } = useShellActions();
  const close = () => setOpen(false);
  const then = (fn: () => void) => () => { close(); fn(); };

  const pct = user && user.xpToNextLevel > 0 ? Math.round((user.xp / user.xpToNextLevel) * 100) : 0;

  return (
    <Sheet open={open} onClose={close} title="Menú" hideClose={false}>
      {user && (
        <Link to="/profile" onClick={close} className="lq-lift flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-heading-sm text-on-background">{user.displayName}</span>
              <span className="block truncate text-body-sm text-on-surface-light">Nivel {user.level} · {getLevelTitle(user.level)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning/[var(--lq-soft-alpha)] px-3 py-1 text-label-lg tabular-nums text-warning-text">
              <Coins aria-hidden className="size-4" strokeWidth={1.75} />
              {user.gold.toLocaleString('es-CO')}
              <span className="sr-only">monedas</span>
            </span>
          </span>
          <ProgressBar value={pct} label="Experiencia" valueText={`${user.xp} de ${user.xpToNextLevel} XP`} />
        </Link>
      )}

      <nav aria-label="Todas las zonas" className="flex flex-col gap-6">
        {NAV_SECTIONS.map((s) => (
          <section key={s.id} className="flex flex-col gap-3">
            <h3 className="text-label-md uppercase text-on-surface-light">{s.label}</h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {s.items.map((it) => <Tile key={it.to} {...it} onSelect={close} />)}
            </ul>
          </section>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h3 className="text-label-md uppercase text-on-surface-light">Herramientas</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToolButton icon={Sparkles} label="Preguntar al Sabio" onClick={then(() => openSage('¿En qué parte de mi aventura me recomiendas enfocarme ahora?'))} />
          <ToolButton icon={Zap} label="Modo enfoque" onClick={then(() => setFocusOpen(true))} />
          {parseEmbed(user?.gymPlaylistUrl).embedUrl && (
            <ToolButton icon={Music} label="Música" onClick={then(() => setMusicOpen(true))} />
          )}
          <ToolButton icon={audioEnabled ? Volume2 : VolumeX} label={audioEnabled ? 'Silenciar sonidos' : 'Activar sonidos'} onClick={toggleAudio} />
          <ToolButton icon={MessageSquarePlus} label="Enviar feedback" onClick={then(() => setFeedbackOpen(true))} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-label-md uppercase text-on-surface-light">Tema</h3>
        <SegmentedControl role="radiogroup" label="Tema" value={mode} onChange={setMode} options={THEMES} />
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {UTILITY_NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} onClick={close} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-label-lg text-on-surface hover:bg-surface-variant">
            <Icon aria-hidden className="size-5" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
        <Button variant="danger" block onClick={then(() => void logout())}>
          <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
          Cerrar sesión
        </Button>
      </div>
    </Sheet>
  );
}
