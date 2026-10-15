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
import { PageHeader } from '@/components/layout/PageHeader';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import {
  AnimatedValue, Badge, Button, Card, ChipGroup, EmptyState, ErrorState, PageLoader, ProgressBar,
  SegmentedControl, type ChipOption,
} from '@/components/ui/lq';

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

const METRICS: Record<Category, { label: string; icon: LucideIcon; unit: [string, string]; hint: string }> = {
  xp: { label: 'Nivel y XP', icon: Trophy, unit: ['XP', 'XP'], hint: 'El nivel y la XP de cada perfil: primero el nivel y, con el mismo nivel, quien lleva más XP dentro de él.' },
  streak: { label: 'Racha activa', icon: Flame, unit: ['día', 'días'], hint: 'Días seguidos con actividad. Si alguien pasa un día entero sin actividad, su racha vuelve a 0 y sale de la tabla.' },
  coliseo: { label: 'Entrenamiento', icon: Swords, unit: ['sesión', 'sesiones'], hint: 'Sesiones terminadas en el Coliseo.' },
};
const fmtValue = (v: number, c: Category) => {
  const n = Math.round(v);
  return `${n.toLocaleString('es-CO')} ${METRICS[c].unit[n === 1 ? 0 : 1]}`;
};
/** Nivel primero y la XP dentro de ese nivel (ranking de XP). */
function LevelScore({ e, compact = false }: { e: Entry; compact?: boolean }) {
  const pct = e.xpToNextLevel ? Math.min(100, Math.round((e.value / e.xpToNextLevel) * 100)) : 0;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-mono text-label-lg tabular-nums">Nv {e.level}</span>
        <span className="font-mono text-body-sm tabular-nums text-on-surface-light">· <AnimatedValue value={e.value} format={(n) => `${Math.round(n).toLocaleString('es-CO')} XP`} /></span>
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
  const navigate = useNavigate();
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <Users aria-hidden className="size-8 text-primary-text" strokeWidth={1.5} />
      <h2 className="text-heading-sm">Tu círculo</h2>
      <p className="text-body-md text-on-surface-light">Anota amigos en tu directorio de Social y escríbanse: al tercer día seguido se enciende su racha.</p>
      <Button variant="secondary" size="md" className="self-start" onClick={() => navigate('/social?tab=directorio&view=search')}><UserPlus aria-hidden className="size-4" strokeWidth={1.75} />Buscar amigos</Button>
    </Card>
  );
}

/** Quién entra en la tabla: la regla, dicha una vez. */
function WhoCompetes() {
  return (
    <Card padding="lg" className="flex flex-col gap-3">
      <Flame aria-hidden className="size-8 text-warning-text" strokeWidth={1.5} />
      <h2 className="text-heading-sm">Quién entra en la tabla</h2>
      <p className="text-body-md text-on-surface-light">Solo compiten quienes mantienen su racha activa: al menos un día con actividad, hoy o ayer. Con la racha en 0 se sale de la tabla hasta volver a sumar un día.</p>
    </Card>
  );
}

/** Amigos en pausa: sin racha activa, sin puesto. Siguen a la vista para animarlos. */
function PausedFriends({ list, category, youId }: { list: Entry[]; category: Category; youId: string }) {
  if (!list.length) return null;
  return (
    <section aria-labelledby="lb-paused" className="flex flex-col gap-2">
      <h2 id="lb-paused" className="flex items-center gap-2 text-label-lg text-on-surface"><Moon aria-hidden className="size-4" strokeWidth={1.75} />En pausa · sin racha activa</h2>
      <Card padding="none" className="p-2">
        <ul className="flex flex-col">
          {list.map((e) => (
            <li key={e.id} className="relative flex min-h-14 items-center gap-3 rounded-xl px-3 opacity-80 md:gap-4">
              <span aria-hidden className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md bg-surface-variant text-label-lg text-on-surface-light">—</span>
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-variant text-label-lg font-bold">{avatarOf(e)(40)}</span>
              <span className="min-w-0 flex-1">
                <Link to={`/u/${encodeURIComponent(e.username)}`} className="block truncate text-label-lg md:text-body-md md:font-semibold">{e.displayName}</Link>
                <span className="block truncate text-body-sm text-on-surface-light">@{e.username} · Nivel {e.level}</span>
              </span>
              {e.id === youId ? <Badge variant="secondary">Tú</Badge> : category !== 'xp' && <span className="shrink-0 font-mono text-body-sm tabular-nums text-on-surface-light">{fmtValue(e.value, category)}</span>}
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
  return (
    <motion.aside variants={item} aria-labelledby="lb-oath" className="lq-marble lq-oath relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl px-6 py-8 text-center md:px-12 md:py-10">
      <span aria-hidden="true" className="flex items-center gap-2">
        <LaurelBranch className="h-10 w-5 opacity-80" />
        <span className="block h-px w-10 bg-secondary/60" />
        <LaurelBranch flip className="h-10 w-5 opacity-80" />
      </span>
      <h2 id="lb-oath" className="lq-engraved max-w-[30ch] text-balance text-heading-md font-semibold md:text-heading-lg">El verdadero progreso es contigo mismo.</h2>
      <p className="max-w-[58ch] text-balance text-body-md text-on-surface">
        NoutLife es una herramienta para tu vida real: no hay premios externos por engañar al sistema, solo el valor intrínseco de tus propios hábitos.
      </p>
    </motion.aside>
  );
}

export default function LeaderboardPage() {
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
      const t = window.setTimeout(() => setView(ranked), 1100);
      return () => window.clearTimeout(t);
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
  const fmt = useCallback((n: number) => fmtValue(n, category), [category]);
  const top = useMemo(() => ranked.slice(0, 3).map((e) => ({
    id: e.id, username: e.username, name: e.displayName.split(' ')[0], initials: initials(e.displayName),
    score: category === 'xp' ? <LevelScore e={e} compact /> : <AnimatedValue value={e.value} format={fmt} />,
    isYou: e.id === youId, avatar: avatarOf(e),
  })), [category, ranked, fmt, youId]);
  const options: ChipOption<Category>[] = (Object.keys(METRICS) as Category[]).map((c) => ({ value: c, label: METRICS[c].label, icon: METRICS[c].icon }));

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
        eyebrow="Comunidad"
        title="Tabla de líderes"
        description="Una lectura clara del progreso global o de las personas que tienes cerca."
        aside={<>
          <div className="w-full max-w-[300px] sm:w-[300px]"><SegmentedControl label="Alcance" value={scope} onChange={setScope} options={[{ value: 'global', label: 'Global' }, { value: 'friends', label: 'Amigos' }]} /></div>
          <Button variant="ghost" size="md" onClick={() => void load(true)} aria-label="Actualizar ranking">
            <RefreshCw aria-hidden className={cn('size-4', refreshing && 'animate-spin')} strokeWidth={1.75} />Actualizar
          </Button>
        </>}
      />

      <motion.div variants={item} className="flex flex-col gap-3">
        <ChipGroup label="Métrica" options={options} value={category} onChange={setCategory} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={category} className="max-w-[68ch] text-body-sm text-on-surface-light"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3 }}
          >
            {METRICS[category].hint}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <motion.section variants={item} className="flex min-w-0 flex-[2_1_520px] flex-col gap-6" aria-label="Clasificación">
          {state === 'loading' ? <PageLoader size="sm" /> : state === 'error' ? <ErrorState onRetry={() => void load()} /> : ranked.length === 0 && paused.length === 0 ? (
            <EmptyState icon={Users} title={scope === 'friends' ? 'Tu círculo está vacío' : 'Aún no hay clasificación'} description={scope === 'friends' ? 'Invita a amigos para compararte con ellos.' : 'Hoy nadie tiene una racha activa todavía. Suma un día y estrena la tabla.'} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${scope}-${category}`} variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-6">
                {ranked.length > 0 ? (
                  <motion.div variants={item}>
                    <CeremonyPodium top={top} />
                  </motion.div>
                ) : (
                  <motion.div variants={item}>
                    <EmptyState icon={Flame} tone="muted" title="Hoy nadie de tu círculo compite" description="Cuando alguien sume un día de actividad, el podio se enciende." className="py-8" />
                  </motion.div>
                )}
                {view.length > 3 && (
                  <motion.div variants={item}>
                    <Card padding="none" className="p-2">
                      <ol className="flex flex-col">
                        {view.slice(3).map((e, j) => (
                          <ResultRow key={e.id} id={e.id} username={e.username} position={j + 4} name={e.displayName} initials={initials(e.displayName)} avatar={avatarOf(e)}
                            subtitle={category === 'xp' ? `@${e.username}` : `@${e.username} · Nivel ${e.level}`}
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
            <span className="text-label-lg text-on-surface">Tu posición</span>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex items-center"><LaurelBranch className="h-16 w-7" /></span>
              <span className="font-mono text-[4rem] font-bold leading-none tracking-[-2px] text-secondary-text">{me ? `#${me.rank ?? myIdx + 1}` : '—'}</span>
              <span aria-hidden="true" className="flex items-center"><LaurelBranch flip className="h-16 w-7" /></span>
              <span className="text-body-md text-on-surface">de <span className="font-mono">{ranked.length}</span></span>
            </div>
            {rose > 0 && <p className="text-label-lg text-success-text">Subiste {rose} {rose === 1 ? 'puesto' : 'puestos'} desde tu última visita</p>}
            {me && ahead ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-2"><span className="text-body-sm text-on-surface">Para alcanzar el #{ahead.rank ?? myIdx}</span><span className="font-mono text-label-lg tabular-nums">{levelGap > 0 ? `${levelGap} ${levelGap === 1 ? 'nivel' : 'niveles'}` : fmtValue(gap, category)}</span></div>
                <ProgressBar value={levelGap > 0 ? (me.xpToNextLevel ? (me.value / me.xpToNextLevel) * 100 : 0) : ahead.value ? (me.value / ahead.value) * 100 : 0} shine label="Distancia al siguiente puesto" className="bg-background" />
                {levelGap > 0 && <span className="text-body-sm text-on-surface-light">Tu nivel {me.level}: <span className="font-mono">{me.value.toLocaleString('es-CO')}/{(me.xpToNextLevel ?? 0).toLocaleString('es-CO')}</span> XP</span>}
              </div>
            ) : me ? <p className="text-body-sm text-on-surface">¡Vas en cabeza en {METRICS[category].label.toLowerCase()}!</p>
              : pausedMe ? (
                <div className="flex flex-col gap-2">
                  <p className="text-body-sm text-on-surface">Hoy no estás en la tabla: tu racha está en 0. Completa un hábito o una misión y vuelves a competir.</p>
                  <Link to="/habits" className="inline-flex min-h-11 items-center self-start font-semibold text-primary-text underline-offset-4 hover:underline">Ir a mis hábitos</Link>
                </div>
              )
              : <p className="text-body-sm text-on-surface">Aún no apareces en esta métrica. Registra actividad para entrar.</p>}
          </Card>
          {scope === 'friends' ? <FriendsLink /> : <WhoCompetes />}
        </motion.aside>
      </div>

      <Oath />
    </ZoneShell>
  );
}
