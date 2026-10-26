import { Link, useLocation } from 'react-router-dom';
import { Coins, LogOut, MessageSquarePlus, Music, Sparkles, Volume2, VolumeX, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ProgressBar, SegmentedControl, Sheet } from '@/components/ui/lq';
import { SkinModeNote } from '@/components/settings/SkinModeNote';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { parseEmbed } from '@/components/ui/MusicPlayer';
import { useShellStore } from '@/store/shellStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { getLevelTitle } from '@/lib/gameProgress';
import { INTL_LOCALE, useLocale, type Copy } from '@/lib/i18n';
import { matchesRoute, useNav, type NavEntry } from './nav';
import { NavLock } from './NavLock';
import { useShellActions } from './actions';

const es = {
  title: 'Menú',
  level: (level: number, name: string) => `Nivel ${level} · ${name}`,
  coins: 'monedas',
  xp: 'Experiencia',
  xpOf: (xp: number, next: number) => `${xp} de ${next} XP`,
  allZones: 'Todas las zonas',
  tools: 'Herramientas',
  sage: 'Preguntar al Sabio',
  sageQuestion: '¿En qué parte de mi aventura me recomiendas enfocarme ahora?',
  focus: 'Modo enfoque',
  music: 'Música',
  mute: 'Silenciar sonidos',
  unmute: 'Activar sonidos',
  feedback: 'Enviar feedback',
  theme: 'Tema',
  themes: { light: 'Claro', dark: 'Oscuro', auto: 'Auto' } as Record<ThemeMode, string>,
  logout: 'Cerrar sesión',
};

const en: typeof es = {
  title: 'Menu',
  level: (level, name) => `Level ${level} · ${name}`,
  coins: 'coins',
  xp: 'Experience',
  xpOf: (xp, next) => `${xp} of ${next} XP`,
  allZones: 'All zones',
  tools: 'Tools',
  sage: 'Ask the Sage',
  sageQuestion: 'Where should I focus in my journey right now?',
  focus: 'Focus mode',
  music: 'Music',
  mute: 'Mute sounds',
  unmute: 'Turn on sounds',
  feedback: 'Send feedback',
  theme: 'Theme',
  themes: { light: 'Light', dark: 'Dark', auto: 'Auto' },
  logout: 'Log out',
};

const COPY: Copy<typeof es> = { es, en };

function Tile({ to, label, icon: Icon, locked, onSelect }: NavEntry & { onSelect: () => void }) {
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
        <span className={cn('lq-ichip relative flex size-10 items-center justify-center rounded-xl', active ? 'bg-background' : 'bg-primary/[var(--lq-soft-alpha)] text-primary-text')}>
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
          {locked && <NavLock />}
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
  const locale = useLocale();
  const t = COPY[locale];
  const open = useShellStore((s) => s.menuOpen);
  const setOpen = useShellStore((s) => s.setMenuOpen);
  const setFocusOpen = useShellStore((s) => s.setFocusOpen);
  const setFeedbackOpen = useShellStore((s) => s.setFeedbackOpen);
  const setMusicOpen = useShellStore((s) => s.setMusicOpen);
  const user = useAuthStore((s) => s.user);
  const nav = useNav();
  const { audioEnabled, toggleAudio } = useUIStore();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const skin = useThemeStore((s) => s.skin);
  const { logout, openSage } = useShellActions();
  const close = () => setOpen(false);
  const then = (fn: () => void) => () => { close(); fn(); };
  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t.themes.light }, { value: 'dark', label: t.themes.dark }, { value: 'auto', label: t.themes.auto },
  ];

  const pct = user && user.xpToNextLevel > 0 ? Math.round((user.xp / user.xpToNextLevel) * 100) : 0;

  return (
    <Sheet open={open} onClose={close} title={t.title} hideClose={false}>
      {user && (
        <Link to="/profile" onClick={close} className="lq-lift flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-heading-sm text-on-background">{user.displayName}</span>
              <span className="block truncate text-body-sm text-on-surface-light">{t.level(user.level, getLevelTitle(user.level, locale))}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning/[var(--lq-soft-alpha)] px-3 py-1 text-label-lg font-mono tabular-nums text-warning-text">
              <Coins aria-hidden className="size-4" strokeWidth={1.75} />
              {user.gold.toLocaleString(INTL_LOCALE[locale])}
              <span className="sr-only">{t.coins}</span>
            </span>
          </span>
          <ProgressBar value={pct} label={t.xp} valueText={t.xpOf(user.xp, user.xpToNextLevel)} />
        </Link>
      )}

      <nav aria-label={t.allZones} className="flex flex-col gap-6">
        {nav.sections.map((s) => (
          <section key={s.id} className="flex flex-col gap-3">
            <h3 className="text-label-md uppercase text-on-surface-light">{s.label}</h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {s.items.map((it) => <Tile key={it.to} {...it} onSelect={close} />)}
            </ul>
          </section>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h3 className="text-label-md uppercase text-on-surface-light">{t.tools}</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToolButton icon={Sparkles} label={t.sage} onClick={then(() => openSage(t.sageQuestion))} />
          <ToolButton icon={Zap} label={t.focus} onClick={then(() => setFocusOpen(true))} />
          {parseEmbed(user?.coliseoPlaylistUrl).embedUrl && (
            <ToolButton icon={Music} label={t.music} onClick={then(() => setMusicOpen(true))} />
          )}
          <ToolButton icon={audioEnabled ? Volume2 : VolumeX} label={audioEnabled ? t.mute : t.unmute} onClick={toggleAudio} />
          <ToolButton icon={MessageSquarePlus} label={t.feedback} onClick={then(() => setFeedbackOpen(true))} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-label-md uppercase text-on-surface-light">{t.theme}</h3>
        {skin ? <SkinModeNote /> : <SegmentedControl role="radiogroup" label={t.theme} value={mode} onChange={setMode} options={themes} />}
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        {nav.utility.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} onClick={close} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-label-lg text-on-surface hover:bg-surface-variant">
            <Icon aria-hidden className="size-5" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
        <Button variant="danger" block onClick={then(() => void logout())}>
          <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
          {t.logout}
        </Button>
      </div>
    </Sheet>
  );
}
