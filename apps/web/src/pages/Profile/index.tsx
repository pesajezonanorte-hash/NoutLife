// Perfil — Profile.dc.html (móvil) / ProfileDesktop.dc.html (desktop).
// Héroe con XP, estadísticas, logros recientes, atributos y ajustes rápidos
// (notificaciones, tema en vivo, idioma, reducir movimiento) + cuenta.
// Zona ambientada: documento de identidad + perfil social. El documento sale de
// la cartera, recibe el sello y se gira para ver el reverso con estadísticas;
// debajo, métricas tipo red social y los logros como publicaciones.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell, ChevronRight, Coins, Globe, Heart, LogOut, Shield, SlidersHorizontal, Sun, UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtNumber, item, stagger, zoneExit } from '@/lib/motion';
import { getLevelTitle } from '@/lib/gameProgress';
import { useAuthStore } from '@/store/authStore';
import { refreshUser } from '@/hooks/useAuth';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { useShellActions } from '@/components/layout/actions';
import { AnimatedValue, Button, Card, IconChip, ProgressBar, SegmentedControl, Select, Skeleton, Switch } from '@/components/ui/lq';
import { SkinModeNote } from '@/components/settings/SkinModeNote';
import { softTone } from '@/components/ui/lq/tones';
import { AvatarCustomizer } from '@/components/character/AvatarCustomizer';
import { PixelAvatar } from '@/components/character/pixel/PixelAvatar';
import { lookFrom } from '@/components/character/pixel/look';
import { getStatsSummary } from '@/services/stats.service';
import { fetchAchievements, type Achievement } from '@/services/achievement.service';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '@/services/notification.service';
import * as userService from '@/services/user.service';
import { IdCard, documentNumber } from '@/components/profile/IdCard';
import { AchievementPosts } from '@/components/profile/AchievementPosts';
import { ZoneAmbience } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { INTL_LOCALE, useLocale, useLocaleStore, useText, type Copy, type Locale } from '@/lib/i18n';

const es = {
  themes: { light: 'Claro', dark: 'Oscuro', auto: 'Auto' } as Record<ThemeMode, string>,
  languages: { es: 'Español', en: 'English' } as Record<string, string>,
  avatarOf: (n: string) => `Avatar de ${n}`,
  savedLang: 'Idioma guardado',
  langFailed: 'No se pudo cambiar el idioma',
  notifFailed: 'No se pudieron guardar las notificaciones',
  levelRow: 'Nivel',
  dayStreak: (n: number): string => (n === 1 ? 'Día de racha' : 'Días de racha'),
  achievement: (n: number): string => (n === 1 ? 'Logro' : 'Logros'),
  memberSince: (d: string) => `Miembro desde ${d}`,
  playerDoc: 'Documento del jugador',
  summary: 'Resumen',
  progressTo: (n: number) => `Progreso al nivel ${n}`,
  xpOf: (xp: string, next: string) => `${xp} de ${next} XP`,
  experience: 'Experiencia',
  tapDoc: 'Toca el documento para ver el reverso.',
  statsHolder: 'Estadísticas del titular',
  quests: 'Misiones', bestStreak: 'Mejor racha', consecutive: 'Días seguidos', strength: 'Fuerza', intellect: 'Intelecto', charisma: 'Carisma',
  issued: (d: string) => `Expedido el ${d}`,
  logs: 'Logros',
  seeAll: 'Ver todos',
  loading: 'Cargando…',
  unlockedOf: (u: number, total: number) => `${u} de ${total} desbloqueados`,
  attributes: 'Atributos',
  goldSr: ' de oro',
  life: 'Vida',
  ofMax: (v: number, max: number) => `${v} de ${max}`,
  settings: 'Ajustes',
  notifications: 'Notificaciones',
  notifHint: 'Recordatorios de hábitos y misiones',
  theme: 'Tema',
  themeHint: 'Se aplica al instante',
  themeGroup: 'Tema',
  language: 'Idioma',
  languageHint: 'Preferencia de tu cuenta',
  languageGroup: 'Idioma',
  reduceMotion: 'Reducir movimiento',
  reduceMotionHint: 'Quita todas las animaciones de la app',
  moreSettings: 'Más ajustes',
  moreSettingsHint: 'Perfil, zona horaria, notificaciones por categoría y datos',
  account: 'Cuenta',
  customizeAvatar: 'Personalizar avatar',
  logout: 'Cerrar sesión',
  characterSummary: 'Resumen del personaje',
};

const en: typeof es = {
  themes: { light: 'Light', dark: 'Dark', auto: 'Auto' },
  languages: { es: 'Español', en: 'English' },
  avatarOf: (n) => `${n}’s avatar`,
  savedLang: 'Language saved',
  langFailed: "We couldn't change the language",
  notifFailed: "We couldn't save the notifications",
  levelRow: 'Level',
  dayStreak: (n: number): string => (n === 1 ? 'Day streak' : 'Days in a row'),
  achievement: (n: number): string => (n === 1 ? 'Achievement' : 'Achievements'),
  memberSince: (d) => `Member since ${d}`,
  playerDoc: 'Player ID',
  summary: 'Summary',
  progressTo: (n) => `Progress to level ${n}`,
  xpOf: (xp, next) => `${xp} of ${next} XP`,
  experience: 'Experience',
  tapDoc: 'Tap the card to see the back.',
  statsHolder: 'Holder stats',
  quests: 'Goals', bestStreak: 'Best streak', consecutive: 'Days in a row', strength: 'Strength', intellect: 'Intellect', charisma: 'Charisma',
  issued: (d) => `Issued ${d}`,
  logs: 'Achievements',
  seeAll: 'See all',
  loading: 'Loading…',
  unlockedOf: (u, total) => `${u} of ${total} unlocked`,
  attributes: 'Attributes',
  goldSr: ' gold',
  life: 'Health',
  ofMax: (v, max) => `${v} of ${max}`,
  settings: 'Settings',
  notifications: 'Notifications',
  notifHint: 'Habit and goal reminders',
  theme: 'Theme',
  themeHint: 'Applies instantly',
  themeGroup: 'Theme',
  language: 'Language',
  languageHint: 'Your account preference',
  languageGroup: 'Language',
  reduceMotion: 'Reduce motion',
  reduceMotionHint: 'Turns off all the app’s animations',
  moreSettings: 'More settings',
  moreSettingsHint: 'Profile, time zone, notifications by category and data',
  account: 'Account',
  customizeAvatar: 'Customize avatar',
  logout: 'Log out',
  characterSummary: 'Character summary',
};

const COPY: Copy<typeof es> = { es, en };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

/** Foto si el usuario eligió foto; si no, su personaje pixel (busto). */
function Avatar({ name, url, config, className }: { name: string; url?: string | null; config?: unknown; className?: string }) {
  const t = useText(COPY);
  const mode = (config as { avatarMode?: string } | undefined)?.avatarMode;
  const photo = url && (mode === 'photo' || !mode);
  return (
    <div
      role="img"
      aria-label={t.avatarOf(name)}
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
  const t = useText(COPY);
  const locale: Locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const skin = useThemeStore((s) => s.skin);
  const reduce = useMotionStore((s) => s.reduce);
  const setReduce = useMotionStore((s) => s.setReduce);
  const { logout } = useShellActions();
  const [stats, setStats] = useState<{ quests: number; best: number; current: number } | null | undefined>(undefined);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [customizer, setCustomizer] = useState(false);

  useEffect(() => {
    // Nivel, XP y racha recién leídos de la base: los mismos que ve el Ranking.
    void refreshUser();
    getStatsSummary('all')
      .then((s) => setStats({ quests: s.totals.questsCompleted, best: s.bestStreak, current: s.currentStreak }))
      .catch(() => setStats(null));
    fetchAchievements().then(setAchievements).catch(() => setAchievements([]));
    getNotificationPreferences().then(setPrefs).catch(() => null);
  }, []);

  if (!user) return null;

  const pct = user.xpToNextLevel > 0 ? Math.min(100, Math.round((user.xp / user.xpToNextLevel) * 100)) : 0;
  const title = getLevelTitle(user.level, locale);
  const since = new Date(user.createdAt).toLocaleDateString(INTL_LOCALE[locale], { month: 'long', year: 'numeric' });
  const unlocked = (achievements ?? []).filter((a) => a.unlocked);
  const achText = achievements ? t.unlockedOf(unlocked.length, achievements.length) : t.loading;
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
      useToastStore.getState().error(t.notifFailed);
    }
  }

  async function changeLanguage(language: string) {
    const prev = user!.language;
    updateUser({ language });
    try {
      updateUser(await userService.updateProfile({ language }));
      if (language === 'es' || language === 'en') useLocaleStore.getState().choose(language);
      useToastStore.getState().success(t.savedLang);
    } catch {
      updateUser({ language: prev });
      useToastStore.getState().error(t.langFailed);
    }
  }

  const metrics: { to: string; value: number | undefined; label: string }[] = [
    { to: '/stats', value: user.level, label: t.levelRow },
    { to: '/habits', value: current, label: t.dayStreak(current) },
    { to: '/achievements', value: achievements ? unlocked.length : undefined, label: t.achievement(unlocked.length) },
  ];
  const doc = documentNumber(user.id);
  const issued = new Date(user.createdAt).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric' });

  // Reverso del documento: estadísticas y código de barras.
  const bars = Array.from({ length: 46 }, (_, i) => ((doc.raw.charCodeAt(i % 10) * (i + 7)) % 5) + 1);
  const back = (
    <div className="lq-tex-paper relative flex size-full flex-col rounded-[inherit] p-3.5 sm:p-5">
      <span aria-hidden="true" className="lq-guilloche" />
      <div className="relative pr-24">
        <h2 className="text-label-lg text-on-background">{t.statsHolder}</h2>
        <p className="font-mono text-label-md text-on-surface-light">{doc.pretty}</p>
      </div>
      <dl className="relative mt-2.5 grid flex-1 grid-cols-3 content-start gap-x-3 gap-y-2 sm:mt-4 sm:gap-y-4">
        {([[t.quests, quests], [t.bestStreak, best], [t.consecutive, current], [t.strength, user.strength], [t.intellect, user.intelligence], [t.charisma, user.charisma]] as const).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="truncate text-label-md text-on-surface-light">{k}</dt>
            <dd className="font-mono text-heading-sm tabular-nums text-on-background sm:text-heading-md">{v === undefined ? '—' : fmtNumber(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="relative flex items-end justify-between gap-3">
        <span className="text-label-md text-on-surface-light">{t.issued(issued)}</span>
        <span aria-hidden="true" className="flex h-7 items-end gap-px sm:h-9">
          {bars.map((w, i) => <span key={i} className="block h-full bg-on-background/80" style={{ width: w * 0.9 }} />)}
        </span>
      </div>
    </div>
  );

  const hero = (
    <motion.section variants={item} aria-label={t.playerDoc} className="grid items-center gap-8 md:gap-10 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <IdCard
        user={user}
        title={title}
        photo={<Avatar name={user.displayName} url={user.avatarUrl} config={user.avatarConfig} className="size-full rounded-none text-heading-lg shadow-none" />}
        back={back}
      />
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-label-lg text-primary-text">{t.memberSince(since)}</span>
          <h1 className="text-display-sm md:text-display-md"><Lettering text={user.displayName} /></h1>
          <p className="text-body-lg text-on-surface-light">@{user.username} · {t.levelRow} {user.level} · {title}</p>
        </div>
        {/* Métricas al estilo de un perfil social */}
        <ul aria-label={t.summary} className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface">
          {metrics.map((m) => (
            <li key={m.to}>
              <Link to={m.to} className="group flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-3 text-center transition-colors hover:bg-surface-variant/60">
                <span className="text-heading-lg font-mono tabular-nums transition-transform duration-[560ms] ease-[var(--lq-ease-heavy)] group-hover:-translate-y-0.5 md:text-display-sm">
                  {m.value === undefined ? <Skeleton className="inline-block h-8 w-10 rounded-md" /> : <AnimatedValue value={m.value} />}
                </span>
                <span className="text-body-sm text-on-surface-light">{m.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-label-lg">{t.progressTo(user.level + 1)}</span>
            <span className="text-body-sm text-on-surface-light font-mono tabular-nums"><AnimatedValue value={user.xp} /> / {fmtNumber(user.xpToNextLevel)} XP</span>
          </div>
          <ProgressBar value={pct} size="lg" shine label={t.experience} valueText={t.xpOf(fmtNumber(user.xp), fmtNumber(user.xpToNextLevel))} className="h-3.5" />
        </div>
        <p className="text-body-sm text-on-surface-light">{t.tapDoc}</p>
      </div>
    </motion.section>
  );

  const posts = (
    <motion.section variants={item} aria-labelledby="pf-posts" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pf-posts" className="text-heading-sm md:text-heading-lg">{t.logs}</h2>
        <Link to="/achievements" className="inline-flex min-h-11 items-center gap-1 rounded-md text-label-lg text-primary-text hover:underline hover:underline-offset-4">
          {t.seeAll}<ChevronRight aria-hidden className="size-5" strokeWidth={1.75} />
        </Link>
      </div>
      {achievements === null
        ? <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:gap-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl md:rounded-2xl" />)}</div>
        : <AchievementPosts achievements={achievements} />}
      <span className="text-body-sm text-on-surface-light">{achText}</span>
    </motion.section>
  );

  const attributes = (
    <Card as="section" aria-labelledby="pf-attr" padding="none" className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pf-attr" className="text-heading-sm">{t.attributes}</h2>
        <span className="flex items-center gap-1.5 text-label-lg text-warning-text font-mono tabular-nums"><Coins aria-hidden className="size-5" strokeWidth={1.75} />{fmtNumber(user.gold)}<span className="sr-only">{t.goldSr}</span></span>
      </div>
      {([[t.life, Heart, user.hp, user.maxHp, 'error']] as const).map(([name, Icon, v, max, tone]) => (
        <div key={name} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-body-sm">
            <span className="flex items-center gap-2 text-label-lg"><Icon aria-hidden className={cn('size-4', softTone[tone].split(' ')[1])} strokeWidth={1.75} />{name}</span>
            <span className="text-on-surface font-mono tabular-nums">{v} / {max}</span>
          </div>
          <ProgressBar value={max > 0 ? (v / max) * 100 : 0} tone={tone} label={name} valueText={t.ofMax(v, max)} />
        </div>
      ))}
      <dl className="grid grid-cols-3 gap-2">
        {([[t.strength, user.strength], [t.intellect, user.intelligence], [t.charisma, user.charisma]] as const).map(([k, v]) => (
          <div key={k} className="flex flex-col items-center gap-0.5 rounded-xl bg-surface-variant px-2 py-3">
            <dd className="text-heading-sm font-mono tabular-nums">{v}</dd>
            <dt className="text-label-md text-on-surface">{k}</dt>
          </div>
        ))}
      </dl>
    </Card>
  );

  const settings = (
    <Card as="section" aria-labelledby="pf-settings" padding="none" className="flex flex-col px-4 py-1 md:p-6 lg:p-8">
      <h2 id="pf-settings" className="mb-2 hidden text-heading-lg md:block">{t.settings}</h2>
      <SettingRow icon={Bell} title={t.notifications} hint={t.notifHint} htmlFor="pf-notif">
        <Switch id="pf-notif" checked={notifOn} disabled={!prefs} onChange={(e) => void toggleNotifications(e.target.checked)} />
      </SettingRow>
      <SettingRow icon={Sun} title={t.theme} hint={t.themeHint} labelId="pf-theme" stack className="md:flex-nowrap">
        {skin ? <SkinModeNote className="md:max-w-[300px]" /> : (
          <SegmentedControl
            role="radiogroup" label={t.themeGroup} value={mode} onChange={setMode}
            options={(['light', 'dark', 'auto'] as ThemeMode[]).map((value) => ({ value, label: t.themes[value] }))}
            className="w-full md:w-[300px] md:shrink-0"
          />
        )}
      </SettingRow>
      <SettingRow icon={Globe} title={t.language} hint={t.languageHint} htmlFor="pf-lang">
        <div className="w-40 shrink-0 sm:w-[220px]">
          <Select id="pf-lang" value={user.language || locale} onChange={(e) => void changeLanguage(e.target.value)} className="w-full" aria-label={t.languageGroup}>
            {(['es', 'en'] as const).map((value) => <option key={value} value={value} lang={value}>{t.languages[value]}</option>)}
          </Select>
        </div>
      </SettingRow>
      <SettingRow icon={Shield} title={t.reduceMotion} hint={t.reduceMotionHint} htmlFor="pf-motion">
        <Switch id="pf-motion" checked={reduce} onChange={(e) => setReduce(e.target.checked)} />
      </SettingRow>
      <Link to="/settings" className="group flex min-h-16 items-center gap-3 py-3 md:min-h-20 md:gap-4">
        <IconChip icon={SlidersHorizontal} tone="muted" size="sm" className="hidden md:inline-flex" />
        <SlidersHorizontal aria-hidden className="size-6 shrink-0 text-on-surface md:hidden" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-body-md group-hover:text-primary-text md:text-body-lg md:font-semibold">{t.moreSettings}</span>
          <span className="hidden text-body-sm text-on-surface-light md:block">{t.moreSettingsHint}</span>
        </span>
        <ChevronRight aria-hidden className="size-6 text-on-surface-light" strokeWidth={1.75} />
      </Link>
    </Card>
  );

  const account = (
    <Card as="section" aria-labelledby="pf-account" padding="none" className="flex flex-col gap-3 p-4 md:p-6">
      <h2 id="pf-account" className="text-heading-sm">{t.account}</h2>
      <p className="truncate text-body-sm text-on-surface-light">{user.email}</p>
      <Button variant="secondary" block onClick={() => setCustomizer(true)}><UserRound aria-hidden className="size-5" strokeWidth={1.75} />{t.customizeAvatar}</Button>
      <Button variant="danger" block onClick={() => void logout()}><LogOut aria-hidden className="size-5" strokeWidth={1.75} />{t.logout}</Button>
    </Card>
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" exit={zoneExit} className="relative">
      {/* Ventanilla de documentos: una luz suave cae sobre el mostrador */}
      <ZoneAmbience zone="profile">
        <span className="lq-amb-breathe absolute left-[2%] top-[-4%] block h-[34rem] w-[min(44rem,92%)] rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-jade-200)/.28),transparent)] [--d:13s] [--hi:1] [--lo:.55] dark:bg-[radial-gradient(closest-side,rgb(var(--lq-jade-400)/.07),transparent)]" />
      </ZoneAmbience>
      <div className="relative flex flex-col gap-8 md:gap-12">
      {hero}
      {posts}
      <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-heading-sm md:hidden">{t.settings}</h2>
            {settings}
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-6" aria-label={t.characterSummary}>
          {attributes}
          {account}
        </aside>
      </motion.div>
      </div>
      <AvatarCustomizer isOpen={customizer} onClose={() => setCustomizer(false)} />
    </motion.div>
  );
}
