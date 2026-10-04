// Perfil — Profile.dc.html (móvil) / ProfileDesktop.dc.html (desktop).
// Héroe con XP, estadísticas, logros recientes, atributos y ajustes rápidos
// (notificaciones, tema en vivo, idioma, reducir movimiento) + cuenta.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell, CalendarCheck, ChevronRight, Coins, Flag, Flame, Globe, Heart, Lock, LogOut, Shield, SlidersHorizontal, Sun, Trophy, UserRound, Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtNumber, item, stagger } from '@/lib/motion';
import { getLevelTitle } from '@/lib/gameProgress';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { useShellActions } from '@/components/layout/actions';
import { AnimatedValue, Button, Card, IconChip, ProgressBar, SegmentedControl, Select, Skeleton, Switch } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { AvatarCustomizer } from '@/components/character/AvatarCustomizer';
import { PixelAvatar } from '@/components/character/pixel/PixelAvatar';
import { lookFrom } from '@/components/character/pixel/look';
import { getStatsSummary } from '@/services/stats.service';
import { fetchAchievements, type Achievement } from '@/services/achievement.service';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '@/services/notification.service';
import * as userService from '@/services/user.service';
import { achievementCategory, achievementIcon } from '@/components/achievements/achievementMeta';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'auto', label: 'Auto' },
];
// TODO(i18n): la interfaz aún no tiene traducciones; se guarda la preferencia en la cuenta.
const LANGUAGES = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Foto si el usuario eligió foto; si no, su personaje pixel (busto). */
function Avatar({ name, url, config, className }: { name: string; url?: string | null; config?: unknown; className?: string }) {
  const mode = (config as { avatarMode?: string } | undefined)?.avatarMode;
  const photo = url && (mode === 'photo' || !mode);
  return (
    <div
      role="img"
      aria-label={`Avatar de ${name}`}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/[var(--lq-soft-alpha)] text-primary-text',
        'shadow-[0_0_0_4px_rgb(var(--lq-background)),0_0_0_6px_rgb(var(--lq-primary))]',
        className,
      )}
    >
      {photo ? <img src={url!} alt="" className="size-full object-cover" /> : config ? (
        <motion.span key={JSON.stringify((config as { pixel?: unknown }).pixel ?? null)} aria-hidden initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }} className="flex size-full items-end justify-center bg-surface-variant"><PixelAvatar look={lookFrom(config)} size={200} crop="head" className="!h-auto !w-full" /></motion.span>
      ) : <span aria-hidden>{initials(name)}</span>}
    </div>
  );
}

/** Fila de ajuste: ícono + texto + control. */
function SettingRow({ icon: Icon, title, hint, htmlFor, labelId, stack, children, className }: {
  icon: LucideIcon; title: string; hint?: string; htmlFor?: string; labelId?: string;
  /** El control baja a su propia línea en móvil (tema). */
  stack?: boolean;
  children: React.ReactNode; className?: string;
}) {
  const Title = htmlFor ? 'label' : 'span';
  return (
    <div className={cn('flex min-h-16 flex-wrap items-center gap-x-3 gap-y-3 border-b border-border py-3 last:border-0 md:min-h-20 md:gap-x-4 md:py-4', className)}>
      <IconChip icon={Icon} tone="muted" size="sm" className="hidden md:inline-flex" />
      <Icon aria-hidden className="size-6 shrink-0 text-on-surface md:hidden" strokeWidth={1.75} />
      <div className={cn('min-w-0', stack ? 'flex-[1_1_160px]' : 'flex-1')}>
        <Title id={labelId} {...(htmlFor ? { htmlFor } : {})} className="block text-body-md md:text-body-lg md:font-semibold">{title}</Title>
        {hint && <span className="hidden text-body-sm text-on-surface-light md:block">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const reduce = useMotionStore((s) => s.reduce);
  const setReduce = useMotionStore((s) => s.setReduce);
  const { logout } = useShellActions();
  const [stats, setStats] = useState<{ quests: number; best: number; current: number } | null | undefined>(undefined);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [customizer, setCustomizer] = useState(false);

  useEffect(() => {
    getStatsSummary('all')
      .then((s) => setStats({ quests: s.totals.questsCompleted, best: s.bestStreak, current: s.currentStreak }))
      .catch(() => setStats(null));
    fetchAchievements().then(setAchievements).catch(() => setAchievements([]));
    getNotificationPreferences().then(setPrefs).catch(() => null);
  }, []);

  if (!user) return null;

  const pct = user.xpToNextLevel > 0 ? Math.min(100, Math.round((user.xp / user.xpToNextLevel) * 100)) : 0;
  const title = getLevelTitle(user.level);
  const since = new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const unlocked = (achievements ?? []).filter((a) => a.unlocked);
  const recent = [...unlocked].sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '')).slice(0, 3);
  const nextLocked = (achievements ?? []).find((a) => !a.unlocked);
  const achText = achievements ? `${unlocked.length} de ${achievements.length} desbloqueados` : 'Cargando…';
  const notifOn = Boolean(prefs && (prefs.habitReminders || prefs.questDeadlineAlerts));

  // Fallback a los datos del usuario si /stats/summary falla.
  const quests = stats?.quests;
  const best = stats?.best ?? user.longestStreak;
  const current = stats?.current ?? user.currentStreak;

  async function toggleNotifications(on: boolean) {
    if (!prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, habitReminders: on, questDeadlineAlerts: on });
    try {
      setPrefs(await updateNotificationPreferences({ habitReminders: on, questDeadlineAlerts: on }));
    } catch {
      setPrefs(prev);
      useToastStore.getState().error('No se pudieron guardar las notificaciones');
    }
  }

  async function changeLanguage(language: string) {
    const prev = user!.language;
    updateUser({ language });
    try {
      updateUser(await userService.updateProfile({ language }));
      useToastStore.getState().success('Idioma guardado');
    } catch {
      updateUser({ language: prev });
      useToastStore.getState().error('No se pudo cambiar el idioma');
    }
  }

  const statItems: { to: string; icon: LucideIcon; tone: 'primary' | 'warning' | 'success'; value: number | undefined; short: string; long: string }[] = [
    { to: '/quests', icon: Flag, tone: 'primary', value: quests, short: 'Misiones', long: 'Misiones completadas' },
    { to: '/habits', icon: Flame, tone: 'warning', value: best, short: 'Mejor racha', long: 'Mejor racha de hábito' },
    { to: '/stats', icon: CalendarCheck, tone: 'success', value: current, short: 'Días seguidos', long: 'Días seguidos activo' },
  ];

  const hero = (
    <motion.section variants={item}>
      {/* Móvil: centrado */}
      <div className="flex flex-col items-center gap-4 text-center md:hidden">
        <Avatar name={user.displayName} url={user.avatarUrl} config={user.avatarConfig} className="size-24 text-heading-lg" />
        <div>
          <h1 className="text-heading-lg">{user.displayName}</h1>
          <p className="text-body-md text-on-surface-light">Nivel {user.level} · {title}</p>
        </div>
        <div className="flex w-full flex-col gap-1.5">
          <ProgressBar value={pct} size="lg" label="Experiencia" valueText={`${fmtNumber(user.xp)} de ${fmtNumber(user.xpToNextLevel)} XP`} />
          <div className="flex justify-between text-body-sm text-on-surface-light tabular-nums"><span>{fmtNumber(user.xp)} XP</span><span>{fmtNumber(user.xpToNextLevel)} XP</span></div>
        </div>
      </div>
      {/* Desktop: tarjeta */}
      <Card variant="elevated" padding="none" className="hidden flex-wrap items-center gap-8 p-10 md:flex">
        <Avatar name={user.displayName} url={user.avatarUrl} config={user.avatarConfig} className="lq-halo size-28 animate-float text-display-sm motion-reduce:animate-none" />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">Miembro desde {since}</span>
          <h1 className="text-display-md">{user.displayName}</h1>
          <p className="text-body-lg text-on-surface-light">Nivel {user.level} · {title}</p>
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label-lg">Progreso al nivel {user.level + 1}</span>
            <span className="text-body-sm text-on-surface-light tabular-nums"><AnimatedValue value={user.xp} /> / {fmtNumber(user.xpToNextLevel)} XP</span>
          </div>
          <ProgressBar value={pct} size="lg" shine label="Experiencia" valueText={`${fmtNumber(user.xp)} de ${fmtNumber(user.xpToNextLevel)} XP`} className="h-3.5" />
        </div>
      </Card>
    </motion.section>
  );

  const statsGrid = (
    <motion.section variants={item} aria-label="Estadísticas" className="grid grid-cols-3 gap-3 md:gap-6">
      {statItems.map((s) => (
        <Card key={s.to} as={Link} to={s.to} interactive padding="none" className="flex min-w-0 flex-col gap-1 px-3 py-4 md:gap-3 md:p-6">
          <s.icon aria-hidden className={cn('size-6 md:hidden', softTone[s.tone].split(' ')[1])} strokeWidth={1.75} />
          <IconChip icon={s.icon} tone={s.tone} className="hidden md:inline-flex" />
          <span className="text-heading-lg tabular-nums md:text-display-md">
            {stats === undefined ? <Skeleton className="inline-block h-8 w-12 rounded-lg" /> : s.value === undefined ? '—' : <AnimatedValue value={s.value} />}
          </span>
          <span className="text-body-sm text-on-surface-light md:text-body-md"><span className="md:hidden">{s.short}</span><span className="hidden md:inline">{s.long}</span></span>
        </Card>
      ))}
    </motion.section>
  );

  const achievementsRow = (
    <Card as={Link} to="/achievements" interactive className="flex items-center gap-4 md:hidden">
      <IconChip icon={Trophy} tone="warning" />
      <div className="min-w-0 flex-1"><div className="text-body-lg font-semibold">Logros</div><div className="text-body-sm text-on-surface-light">{achText}</div></div>
      <ChevronRight aria-hidden className="size-6 text-on-surface-light" strokeWidth={1.75} />
    </Card>
  );

  const achievementsCard = (
    <Card as={Link} to="/achievements" interactive padding="lg" className="hidden flex-col gap-4 md:flex">
      <div className="flex items-center justify-between"><h2 className="text-heading-sm">Logros recientes</h2><ChevronRight aria-hidden className="size-6 text-on-surface-light" strokeWidth={1.75} /></div>
      {achievements === null ? (
        <div className="flex gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="size-14 rounded-2xl" />)}</div>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-wrap gap-3">
          {recent.map((a) => {
            const Icon = achievementIcon(a);
            return (
              <motion.li key={a.id} variants={item} title={a.title} className={cn('flex size-14 items-center justify-center rounded-2xl', softTone[achievementCategory(a.category).tone])}>
                <Icon aria-hidden className="size-8" strokeWidth={1.5} /><span className="sr-only">{a.title}</span>
              </motion.li>
            );
          })}
          {nextLocked && (
            <motion.li variants={item} title={`Bloqueado: ${nextLocked.title}`} className={cn('flex size-14 items-center justify-center rounded-2xl', softTone.muted)}>
              <Lock aria-hidden className="size-6" strokeWidth={1.75} /><span className="sr-only">Siguiente, bloqueado: {nextLocked.title}</span>
            </motion.li>
          )}
          {!recent.length && !nextLocked && <li className="text-body-sm text-on-surface-light">Aún no hay logros.</li>}
        </motion.ul>
      )}
      <span className="text-body-sm text-on-surface-light">{achText}</span>
    </Card>
  );

  const attributes = (
    <Card as="section" aria-labelledby="pf-attr" padding="none" className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pf-attr" className="text-heading-sm">Atributos</h2>
        <span className="flex items-center gap-1.5 text-label-lg text-warning-text tabular-nums"><Coins aria-hidden className="size-5" strokeWidth={1.75} />{fmtNumber(user.gold)}<span className="sr-only"> de oro</span></span>
      </div>
      {([['Vida', Heart, user.hp, user.maxHp, 'error'], ['Maná', Zap, user.mp, user.maxMp, 'info']] as const).map(([name, Icon, v, max, tone]) => (
        <div key={name} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-body-sm">
            <span className="flex items-center gap-2 text-label-lg"><Icon aria-hidden className={cn('size-4', softTone[tone].split(' ')[1])} strokeWidth={1.75} />{name}</span>
            <span className="text-on-surface tabular-nums">{v} / {max}</span>
          </div>
          <ProgressBar value={max > 0 ? (v / max) * 100 : 0} tone={tone} label={name} valueText={`${v} de ${max}`} />
        </div>
      ))}
      <dl className="grid grid-cols-3 gap-2">
        {([['Fuerza', user.strength], ['Intelecto', user.intelligence], ['Carisma', user.charisma]] as const).map(([k, v]) => (
          <div key={k} className="flex flex-col items-center gap-0.5 rounded-xl bg-surface-variant px-2 py-3">
            <dd className="text-heading-sm tabular-nums">{v}</dd>
            <dt className="text-label-md text-on-surface">{k}</dt>
          </div>
        ))}
      </dl>
    </Card>
  );

  const settings = (
    <Card as="section" aria-labelledby="pf-settings" padding="none" className="flex flex-col px-4 py-1 md:p-6 lg:p-8">
      <h2 id="pf-settings" className="mb-2 hidden text-heading-lg md:block">Ajustes</h2>
      <SettingRow icon={Bell} title="Notificaciones" hint="Recordatorios de hábitos y misiones" htmlFor="pf-notif">
        <Switch id="pf-notif" checked={notifOn} disabled={!prefs} onChange={(e) => void toggleNotifications(e.target.checked)} />
      </SettingRow>
      <SettingRow icon={Sun} title="Tema" hint="Se aplica al instante" labelId="pf-theme" stack className="md:flex-nowrap">
        <SegmentedControl
          role="radiogroup" label="Tema" value={mode} onChange={setMode} options={THEME_OPTIONS}
          className="w-full md:w-[300px] md:shrink-0"
        />
      </SettingRow>
      <SettingRow icon={Globe} title="Idioma" hint="Preferencia de tu cuenta" htmlFor="pf-lang">
        <div className="w-40 shrink-0 sm:w-[220px]">
          <Select id="pf-lang" value={user.language || 'es'} onChange={(e) => void changeLanguage(e.target.value)} className="w-full">
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        </div>
      </SettingRow>
      <SettingRow icon={Shield} title="Reducir movimiento" hint="Quita todas las animaciones de la app" htmlFor="pf-motion">
        <Switch id="pf-motion" checked={reduce} onChange={(e) => setReduce(e.target.checked)} />
      </SettingRow>
      <Link to="/settings" className="group flex min-h-16 items-center gap-3 py-3 md:min-h-20 md:gap-4">
        <IconChip icon={SlidersHorizontal} tone="muted" size="sm" className="hidden md:inline-flex" />
        <SlidersHorizontal aria-hidden className="size-6 shrink-0 text-on-surface md:hidden" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-body-md group-hover:text-primary-text md:text-body-lg md:font-semibold">Más ajustes</span>
          <span className="hidden text-body-sm text-on-surface-light md:block">Perfil, zona horaria, notificaciones por categoría y datos</span>
        </span>
        <ChevronRight aria-hidden className="size-6 text-on-surface-light" strokeWidth={1.75} />
      </Link>
    </Card>
  );

  const account = (
    <Card as="section" aria-labelledby="pf-account" padding="none" className="flex flex-col gap-3 p-4 md:p-6">
      <h2 id="pf-account" className="text-heading-sm">Cuenta</h2>
      <p className="truncate text-body-sm text-on-surface-light">{user.email}</p>
      <Button variant="secondary" block onClick={() => setCustomizer(true)}><UserRound aria-hidden className="size-5" strokeWidth={1.75} />Personalizar avatar</Button>
      <Button variant="danger" block onClick={() => void logout()}><LogOut aria-hidden className="size-5" strokeWidth={1.75} />Cerrar sesión</Button>
    </Card>
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      {hero}
      {statsGrid}
      <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {achievementsRow}
          <section className="flex flex-col gap-3">
            <h2 className="text-heading-sm md:hidden">Ajustes</h2>
            {settings}
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-6" aria-label="Resumen del personaje">
          {achievementsCard}
          {attributes}
          {account}
        </aside>
      </motion.div>
      <AvatarCustomizer isOpen={customizer} onClose={() => setCustomizer(false)} />
    </motion.div>
  );
}
