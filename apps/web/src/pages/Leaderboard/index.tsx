// Ranking (RankingDesktop): Global/Amigos, chips de métrica, podio que sube,
// tu fila resaltada, tu posición con la distancia al siguiente y gestión de amigos.
// Zona ambientada: una ceremonia olímpica. El podio de mármol sube desde el suelo
// de un escenario nocturno con los focos del estadio; las medallas caen colgadas y
// se mecen, el primero lleva laurel y las cifras cuentan. Los resultados son un
// marcador donde tu fila brilla. Si subiste de puesto desde tu última visita, tu
// fila asciende desde donde estabas hasta su nuevo lugar.
// Solo compite quien mantiene su racha activa (la API los ordena); entre amigos,
// los que están en pausa aparecen aparte, sin puesto. Al pie, el juramento: el
// progreso real es contigo mismo.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LaurelBranch, CeremonyPodium, ResultRow } from '@/components/leaderboard/Ceremony';
import { ZoneShell } from '@/components/ambience';
import { useMotionStore } from '@/store/motionStore';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Swords, RefreshCw, Trophy, UserPlus, Users, Moon, type LucideIcon } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { getLeaderboard } from '@/services/social.service';
import { useAuthStore } from '@/store/authStore';
import { refreshUser } from '@/hooks/useAuth';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';
import { PageHeader } from '@/components/layout/PageHeader';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import {
  AnimatedValue, Badge, Button, Card, ChipGroup, EmptyState, ErrorState, PageLoader, ProgressBar,
  SegmentedControl, type ChipOption,
} from '@/components/ui/lq';

const es = {
  metrics: {
    xp: { label: 'Nivel y XP', unit: ['XP', 'XP'] as [string, string], hint: 'El nivel y la XP de cada perfil: primero el nivel y, con el mismo nivel, quien lleva más XP dentro de él.' },
    streak: { label: 'Racha activa', unit: ['día', 'días'] as [string, string], hint: 'Días seguidos con actividad. Si alguien pasa un día entero sin actividad, su racha vuelve a 0 y sale de la tabla.' },
    coliseo: { label: 'Entrenamiento', unit: ['sesión', 'sesiones'] as [string, string], hint: 'Sesiones terminadas en el Coliseo.' },
  },
  levelShort: 'Nv',
  level: 'Nivel',
  levelWord: (n: number): string => (n === 1 ? 'nivel' : 'niveles'),
  xp: 'XP',
  circleTitle: 'Tu círculo',
  circleBody: 'Anota amigos en tu directorio de Social y escríbanse: al tercer día seguido se enciende su racha.',
  searchFriends: 'Buscar amigos',
  whoTitle: 'Quién entra en la tabla',
  whoBody: 'Solo compiten quienes mantienen su racha activa: al menos un día con actividad, hoy o ayer. Con la racha en 0 se sale de la tabla hasta volver a sumar un día.',
  pausedTitle: 'En pausa · sin racha activa',
  you: 'Tú',
  oathTitle: 'El verdadero progreso es contigo mismo.',
  oathBody: 'NoutLife es una herramienta para tu vida real: no hay premios externos por engañar al sistema, solo el valor intrínseco de tus propios hábitos.',
  eyebrow: 'Comunidad',
  title: 'Tabla de líderes',
  desc: 'Una lectura clara del progreso global o de las personas que tienes cerca.',
  scope: 'Alcance',
  global: 'Global',
  friends: 'Amigos',
  refreshLabel: 'Actualizar ranking',
  refresh: 'Actualizar',
  metric: 'Métrica',
  standings: 'Clasificación',
  emptyFriendsTitle: 'Tu círculo está vacío',
  emptyGlobalTitle: 'Aún no hay clasificación',
  emptyFriendsDesc: 'Invita a amigos para compararte con ellos.',
  emptyGlobalDesc: 'Hoy nadie tiene una racha activa todavía. Suma un día y estrena la tabla.',
  noneCompete: 'Hoy nadie de tu círculo compite',
  noneCompeteDesc: 'Cuando alguien sume un día de actividad, el podio se enciende.',
  rose: (n: number): string => `Subiste ${n} ${n === 1 ? 'puesto' : 'puestos'} desde tu última visita`,
  yourPosition: 'Tu posición',
  of: 'de',
  toReach: (rank: number): string => `Para alcanzar el #${rank}`,
  distanceLabel: 'Distancia al siguiente puesto',
  yourLevel: (level: number, value: string, next: string): string => `Tu nivel ${level}: ${value}/${next} XP`,
  inLead: (label: string): string => `¡Vas en cabeza en ${label}!`,
  pausedMe: 'Hoy no estás en la tabla: tu racha está en 0. Completa un hábito o una misión y vuelves a competir.',
  goHabits: 'Ir a mis hábitos',
  notShown: 'Aún no apareces en esta métrica. Registra actividad para entrar.',
  pausedDisplay: (level: number): string => `· Nivel ${level}`,
};

const en: typeof es = {
  metrics: {
    xp: { label: 'Level and XP', unit: ['XP', 'XP'] as [string, string], hint: 'Each profile’s level and XP: level first and, at the same level, whoever has more XP within it.' },
    streak: { label: 'Active streak', unit: ['day', 'days'] as [string, string], hint: 'Days in a row with activity. If someone goes a whole day without activity, their streak resets to 0 and they leave the table.' },
    coliseo: { label: 'Training', unit: ['session', 'sessions'] as [string, string], hint: 'Sessions completed at the Coliseum.' },
  },
  levelShort: 'Lv',
  level: 'Level',
  levelWord: (n: number): string => (n === 1 ? 'level' : 'levels'),
  xp: 'XP',
  circleTitle: 'Your circle',
  circleBody: 'Add friends to your Social directory and write to each other: their streak lights up on the third day in a row.',
  searchFriends: 'Find friends',
  whoTitle: 'Who makes the table',
  whoBody: 'Only those who keep an active streak compete: at least one active day, today or yesterday. With a streak at 0 you leave the table until you add a day again.',
  pausedTitle: 'Paused · no active streak',
  you: 'You',
  oathTitle: 'Real progress is with yourself.',
  oathBody: 'NoutLife is a tool for your real life: there are no outside prizes for gaming the system, just the value of your own habits.',
  eyebrow: 'Community',
  title: 'Leaderboard',
  desc: 'A clear view of global progress or of the people close to you.',
  scope: 'Scope',
  global: 'Global',
  friends: 'Friends',
  refreshLabel: 'Refresh ranking',
  refresh: 'Refresh',
  metric: 'Metric',
  standings: 'Standings',
  emptyFriendsTitle: 'Your circle is empty',
  emptyGlobalTitle: 'No standings yet',
  emptyFriendsDesc: 'Invite friends to compare yourself with them.',
  emptyGlobalDesc: 'Nobody has an active streak yet today. Add a day and open the table.',
  noneCompete: 'Nobody in your circle is competing today',
  noneCompeteDesc: 'When someone adds a day of activity, the podium lights up.',
  rose: (n: number): string => `You moved up ${n} ${n === 1 ? 'place' : 'places'} since your last visit`,
  yourPosition: 'Your position',
  of: 'of',
  toReach: (rank: number): string => `To reach #${rank}`,
  distanceLabel: 'Distance to the next place',
  yourLevel: (level: number, value: string, next: string): string => `Your level ${level}: ${value}/${next} XP`,
  inLead: (label: string): string => `You’re in the lead in ${label}!`,
  pausedMe: 'You are not on the table today: your streak is 0. Complete a habit or a quest and you can compete again.',
  goHabits: 'Go to my habits',
  notShown: "You don't appear in this metric yet. Log activity to get in.",
  pausedDisplay: (level: number): string => `· Level ${level}`,
};

const COPY: Copy<typeof es> = { es, en };

type Category = 'xp' | 'streak' | 'coliseo';
type Scope = 'global' | 'friends';

interface Entry {
  /** null: en pausa (sin racha activa), sin puesto. */
  rank: number | null;
  id: string; username: string; displayName: string; level: number; value: number;
  /** Ranking de XP: lo que pide su nivel actual (la misma XP que su perfil). */
  xpToNextLevel?: number;
  /** Racha general vigente y si compite hoy (APIs anteriores no los mandan: cuenta como activo). */
  streak?: number; active?: boolean;
  nameColor?: string | null;
  avatarConfig?: unknown; avatarUrl?: string | null; equippedAura?: string | null; equippedFrame?: string | null;
}

type Dict = typeof es;
const METRIC_ICON: Record<Category, LucideIcon> = { xp: Trophy, streak: Flame, coliseo: Swords };
const fmtValue = (v: number, c: Category, t: Dict, locale: Locale) => {
  const n = Math.round(v);
  return `${n.toLocaleString(INTL_LOCALE[locale])} ${t.metrics[c].unit[n === 1 ? 0 : 1]}`;
};
/** Nivel primero y la XP dentro de ese nivel (ranking de XP). */
function LevelScore({ e, compact = false }: { e: Entry; compact?: boolean }) {
  const t = useText(COPY);
  const locale = useLocale();
  const pct = e.xpToNextLevel ? Math.min(100, Math.round((e.value / e.xpToNextLevel) * 100)) : 0;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-mono text-label-lg tabular-nums">{t.levelShort} {e.level}</span>
        <span className="font-mono text-body-sm tabular-nums text-on-surface-light">· <AnimatedValue value={e.value} format={(n) => `${Math.round(n).toLocaleString(INTL_LOCALE[locale])} ${t.xp}`} /></span>
      </span>
      {!compact && e.xpToNextLevel ? (
        <span aria-hidden="true" className="block h-1 w-20 overflow-hidden rounded-full bg-on-background/10">
          <span className="block h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </span>
  );
}
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
/** Foto (o avatar) del perfil dentro del círculo del ranking. */
const avatarOf = (e: Pick<Entry, 'avatarConfig' | 'avatarUrl' | 'equippedAura' | 'equippedFrame'>) => (size: number) => (
  <AvatarDisplay avatarConfig={e.avatarConfig} avatarUrl={e.avatarUrl} equippedAura={e.equippedAura} equippedFrame={e.equippedFrame} size={size} animate="none" className="rounded-full" />
);
/** Último puesto visto por métrica y alcance (para notar si subiste). */
const RANK_KEY = 'lq-rank-last';
const readRanks = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(RANK_KEY) || '{}'); } catch { return {}; } };

/** El círculo de amigos vive en su propia zona: aquí solo se enlaza. */
function FriendsLink() {
  const t = useText(COPY);
  const navigate = useNavigate();
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <Users aria-hidden className="size-8 text-primary-text" strokeWidth={1.5} />
      <h2 className="text-heading-sm">{t.circleTitle}</h2>
      <p className="text-body-md text-on-surface-light">{t.circleBody}</p>
      <Button variant="secondary" size="md" className="self-start" onClick={() => navigate('/social?tab=directorio&view=search')}><UserPlus aria-hidden className="size-4" strokeWidth={1.75} />{t.searchFriends}</Button>
    </Card>
  );
}

/** Quién entra en la tabla: la regla, dicha una vez. */
function WhoCompetes() {
  const t = useText(COPY);
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <Flame aria-hidden className="size-8 text-warning-text" strokeWidth={1.5} />
      <h2 className="text-heading-sm">{t.whoTitle}</h2>
      <p className="text-body-md text-on-surface-light">{t.whoBody}</p>
    </Card>
  );
}

/** Amigos en pausa: sin racha activa, sin puesto. Siguen a la vista para animarlos. */
function PausedFriends({ list, category, youId }: { list: Entry[]; category: Category; youId: string }) {
  const t = useText(COPY);
  const locale = useLocale();
  if (!list.length) return null;
  return (
    <section aria-labelledby="lb-paused" className="flex flex-col gap-2">
      <h2 id="lb-paused" className="flex items-center gap-2 text-label-lg text-on-surface"><Moon aria-hidden className="size-4" strokeWidth={1.75} />{t.pausedTitle}</h2>
      <Card padding="none" className="p-2">
        <ul className="flex flex-col">
          {list.map((e) => (
            <li key={e.id} className="relative flex min-h-14 items-center gap-3 rounded-xl px-3 opacity-80 md:gap-4">
              <span aria-hidden className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md bg-surface-variant text-label-lg text-on-surface-light">—</span>
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-variant text-label-lg font-bold">{avatarOf(e)(40)}</span>
              <span className="min-w-0 flex-1">
                <Link to={`/u/${encodeURIComponent(e.username)}`} className="block truncate text-label-lg md:text-body-md md:font-semibold">{e.displayName}</Link>
                <span className="block truncate text-body-sm text-on-surface-light">@{e.username} {t.pausedDisplay(e.level)}</span>
              </span>
              {e.id === youId ? <Badge variant="secondary">{t.you}</Badge> : category !== 'xp' && <span className="shrink-0 font-mono text-body-sm tabular-nums text-on-surface-light">{fmtValue(e.value, category, t, locale)}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/**
 * El juramento: una inscripción grabada en el mármol del estadio. Recuerda que
 * la tabla no da premios fuera de la app: el valor está en los hábitos de verdad.
 */
function Oath() {
  const t = useText(COPY);
  return (
    <motion.aside variants={item} aria-labelledby="lb-oath" className="lq-marble lq-oath relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl px-6 py-8 text-center md:px-12 md:py-10">
      <span aria-hidden="true" className="flex items-center gap-2">
        <LaurelBranch className="h-10 w-5 opacity-80" />
        <span className="block h-px w-10 bg-secondary/60" />
        <LaurelBranch flip className="h-10 w-5 opacity-80" />
      </span>
      <h2 id="lb-oath" className="lq-engraved max-w-[30ch] text-balance text-heading-md font-semibold md:text-heading-lg">{t.oathTitle}</h2>
      <p className="max-w-[58ch] text-balance text-body-md text-on-surface">{t.oathBody}</p>
    </motion.aside>
  );
}

export default function LeaderboardPage() {
  const t = useText(COPY);
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const [category, setCategory] = useState<Category>('xp');
  const [scope, setScope] = useState<Scope>('global');
  const [data, setData] = useState<Entry[]>([]);
  /** Alcance y métrica de `data`: al cambiar de pestaña, la tabla anterior no cuenta como «subiste». */
  const [loadedKey, setLoadedKey] = useState('');
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setState('loading');
    try { setData((await getLeaderboard(category, scope === 'friends')) as Entry[]); setLoadedKey(`${scope}:${category}`); setState('ready'); }
    catch { if (!silent) setState('error'); }
    finally { setRefreshing(false); }
    // La tabla lee la base: el HUD y el perfil se ponen al día con la misma fuente.
    void refreshUser();
  }, [category, scope]);
  useEffect(() => { void load(); }, [load]);

  /** Quienes compiten (con puesto) y, entre amigos, quienes están en pausa. */
  const ranked = useMemo(() => data.filter((e) => e.active !== false), [data]);
  const paused = useMemo(() => data.filter((e) => e.active === false), [data]);
  const youId = String(user?.id ?? '');

  /** Orden que se muestra: si subiste, primero estás donde estabas y después asciendes. */
  const [view, setView] = useState<Entry[]>([]);
  const [rose, setRose] = useState(0);
  const reduce = useMotionStore((s) => s.reduce);
  useEffect(() => {
    const key = `${scope}:${category}`;
    if (state !== 'ready' || loadedKey !== key) return;
    const ranks = readRanks();
    const prev = ranks[key];
    const idx = ranked.findIndex((e) => e.id === youId);
    if (idx >= 0) { try { localStorage.setItem(RANK_KEY, JSON.stringify({ ...ranks, [key]: idx })); } catch { /* sin almacenamiento */ } }
    if (idx >= 3 && prev != null && prev > idx && !reduce) {
      const staged = [...ranked];
      const [mine] = staged.splice(idx, 1);
      staged.splice(Math.min(prev, staged.length), 0, mine);
      setView(staged); setRose(prev - idx);
      const timer = window.setTimeout(() => setView(ranked), 1100);
      return () => window.clearTimeout(timer);
    }
    setView(ranked); setRose(idx >= 0 && prev != null && prev > idx ? prev - idx : 0);
    return undefined;
  }, [ranked, state, loadedKey, scope, category, youId, reduce]);

  const myIdx = ranked.findIndex((e) => e.id === youId);
  const me = myIdx >= 0 ? ranked[myIdx] : null;
  const ahead = myIdx > 0 ? ranked[myIdx - 1] : null;
  const gap = me && ahead ? Math.max(0, ahead.value - me.value) : 0;
  const levelGap = category === 'xp' && me && ahead ? ahead.level - me.level : 0;
  /** Sin puesto porque su racha está en 0 (no porque le falten datos en esta métrica). */
  const pausedMe = !me && ((user?.currentStreak ?? 0) === 0 || paused.some((e) => e.id === youId));
  const fmt = useCallback((n: number) => fmtValue(n, category, t, locale), [category, t, locale]);
  const top = useMemo(() => ranked.slice(0, 3).map((e) => ({
    id: e.id, username: e.username, name: e.displayName.split(' ')[0], initials: initials(e.displayName),
    score: category === 'xp' ? <LevelScore e={e} compact /> : <AnimatedValue value={e.value} format={fmt} />,
    isYou: e.id === youId, avatar: avatarOf(e),
  })), [category, ranked, fmt, youId]);
  const options: ChipOption<Category>[] = (Object.keys(METRIC_ICON) as Category[]).map((c) => ({ value: c, label: t.metrics[c].label, icon: METRIC_ICON[c] }));

  return (
    <ZoneShell
      zone="leaderboard"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        // Laureles discretos que enmarcan la tabla de honor
        <>
          <LaurelBranch className="absolute -left-3 top-2 hidden h-44 w-16 opacity-[.16] md:block lg:-left-6" />
          <LaurelBranch flip className="absolute -right-3 top-2 hidden h-44 w-16 opacity-[.16] md:block lg:-right-6" />
        </>
      )}
    >
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.desc}
        aside={<>
          <div className="w-full max-w-[300px] sm:w-[300px]"><SegmentedControl label={t.scope} value={scope} onChange={setScope} options={[{ value: 'global', label: t.global }, { value: 'friends', label: t.friends }]} /></div>
          <Button variant="ghost" size="md" onClick={() => void load(true)} aria-label={t.refreshLabel}>
            <RefreshCw aria-hidden className={cn('size-4', refreshing && 'animate-spin')} strokeWidth={1.75} />{t.refresh}
          </Button>
        </>}
      />

      <motion.div variants={item} className="flex flex-col gap-3">
        <ChipGroup label={t.metric} options={options} value={category} onChange={setCategory} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={category} className="max-w-[68ch] text-body-sm text-on-surface-light"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3 }}
          >
            {t.metrics[category].hint}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <motion.section variants={item} className="flex min-w-0 flex-[2_1_520px] flex-col gap-6" aria-label={t.standings}>
          {state === 'loading' ? <PageLoader size="sm" /> : state === 'error' ? <ErrorState onRetry={() => void load()} /> : ranked.length === 0 && paused.length === 0 ? (
            <EmptyState icon={Users} title={scope === 'friends' ? t.emptyFriendsTitle : t.emptyGlobalTitle} description={scope === 'friends' ? t.emptyFriendsDesc : t.emptyGlobalDesc} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${scope}-${category}`} variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-6">
                {ranked.length > 0 ? (
                  <motion.div variants={item}>
                    <CeremonyPodium top={top} />
                  </motion.div>
                ) : (
                  <motion.div variants={item}>
                    <EmptyState icon={Flame} tone="muted" title={t.noneCompete} description={t.noneCompeteDesc} className="py-8" />
                  </motion.div>
                )}
                {view.length > 3 && (
                  <motion.div variants={item}>
                    <Card padding="none" className="p-2">
                      <ol className="flex flex-col">
                        {view.slice(3).map((e, j) => (
                          <ResultRow key={e.id} id={e.id} username={e.username} position={j + 4} name={e.displayName} initials={initials(e.displayName)} avatar={avatarOf(e)}
                            subtitle={category === 'xp' ? `@${e.username}` : `@${e.username} · ${t.level} ${e.level}`}
                            score={category === 'xp' ? <LevelScore e={e} /> : <AnimatedValue value={e.value} format={fmt} />} isYou={e.id === youId} rose={rose} />
                        ))}
                      </ol>
                    </Card>
                  </motion.div>
                )}
                {scope === 'friends' && <motion.div variants={item}><PausedFriends list={paused} category={category} youId={youId} /></motion.div>}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.section>

        <motion.aside variants={item} className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <Card padding="lg" className="lq-rank-plaque relative flex flex-col gap-4 overflow-hidden border-transparent">
            {/* La placa de honor: tu puesto entre laureles */}
            <span className="text-label-lg text-on-surface">{t.yourPosition}</span>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex items-center"><LaurelBranch className="h-16 w-7" /></span>
              <span className="font-mono text-[4rem] font-bold leading-none tracking-[-2px] text-secondary-text">{me ? `#${me.rank ?? myIdx + 1}` : '—'}</span>
              <span aria-hidden="true" className="flex items-center"><LaurelBranch flip className="h-16 w-7" /></span>
              <span className="text-body-md text-on-surface">{t.of} <span className="font-mono">{ranked.length}</span></span>
            </div>
            {rose > 0 && <p className="text-label-lg text-success-text">{t.rose(rose)}</p>}
            {me && ahead ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-2"><span className="text-body-sm text-on-surface">{t.toReach(ahead.rank ?? myIdx)}</span><span className="font-mono text-label-lg tabular-nums">{levelGap > 0 ? `${levelGap} ${t.levelWord(levelGap)}` : fmtValue(gap, category, t, locale)}</span></div>
                <ProgressBar value={levelGap > 0 ? (me.xpToNextLevel ? (me.value / me.xpToNextLevel) * 100 : 0) : ahead.value ? (me.value / ahead.value) * 100 : 0} shine label={t.distanceLabel} className="bg-background" />
                {levelGap > 0 && <span className="text-body-sm text-on-surface-light">{t.yourLevel(me.level, me.value.toLocaleString(INTL_LOCALE[locale]), (me.xpToNextLevel ?? 0).toLocaleString(INTL_LOCALE[locale]))}</span>}
              </div>
            ) : me ? <p className="text-body-sm text-on-surface">{t.inLead(t.metrics[category].label.toLowerCase())}</p>
              : pausedMe ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm text-on-surface">{t.pausedMe}</p>
                  <Link to="/habits" className="inline-flex min-h-11 items-center self-start font-semibold text-primary-text underline-offset-4 hover:underline">{t.goHabits}</Link>
                </div>
              )
              : <p className="text-body-sm text-on-surface">{t.notShown}</p>}
          </Card>
          {scope === 'friends' ? <FriendsLink /> : <WhoCompetes />}
        </motion.aside>
      </div>

      <Oath />
    </ZoneShell>
  );
}
