// Ranking (RankingDesktop): Global/Amigos, chips de métrica, podio que sube,
// tu fila resaltada, tu posición con la distancia al siguiente y gestión de amigos.
// Zona ambientada: una ceremonia olímpica. El podio de mármol sube desde el suelo
// de un escenario nocturno con los focos del estadio; las medallas caen colgadas y
// se mecen, el primero lleva laurel y las cifras cuentan. Los resultados son un
// marcador donde tu fila brilla. Si subiste de puesto desde tu última visita, tu
// fila asciende desde donde estabas hasta su nuevo lugar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LaurelBranch, CeremonyPodium, ResultRow } from '@/components/leaderboard/Ceremony';
import { ZoneShell } from '@/components/ambience';
import { useMotionStore } from '@/store/motionStore';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Flame, HeartHandshake, RefreshCw, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { getLeaderboard } from '@/services/social.service';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import {
  AnimatedValue, Button, Card, ChipGroup, EmptyState, ErrorState, PageLoader, ProgressBar,
  SegmentedControl, type ChipOption,
} from '@/components/ui/lq';

type Category = 'xp' | 'streak' | 'gym';
type Scope = 'global' | 'friends';

interface Entry {
  rank: number; id: string; username: string; displayName: string; level: number; value: number;
  /** Ranking de XP: lo que pide su nivel y su XP total de las zonas online. */
  xpToNextLevel?: number; totalXp?: number;
  nameColor?: string | null;
  avatarConfig?: unknown; avatarUrl?: string | null; equippedAura?: string | null; equippedFrame?: string | null;
}

/** Zonas cuya XP cuenta para el ranking (las que participan en el online). */
const ONLINE_ZONES = 'Hábitos, Misiones, Gimnasio y Aprendizaje';

const METRICS: Record<Category, { label: string; icon: LucideIcon; unit: [string, string]; hint: string }> = {
  xp: { label: 'Nivel y XP', icon: Trophy, unit: ['XP', 'XP'], hint: `Primero el nivel; con el mismo nivel, quien lleva más XP dentro de él. Solo cuenta la XP de las zonas online: ${ONLINE_ZONES}.` },
  streak: { label: 'Racha activa', icon: Flame, unit: ['día', 'días'], hint: 'Días seguidos con actividad. Si alguien pasa un día entero sin actividad, su racha vuelve a 0.' },
  gym: { label: 'Entrenamiento', icon: Dumbbell, unit: ['sesión', 'sesiones'], hint: 'Sesiones de gimnasio terminadas.' },
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

export default function LeaderboardPage() {
  const user = useAuthStore((s) => s.user);
  const [category, setCategory] = useState<Category>('xp');
  const [scope, setScope] = useState<Scope>('global');
  const [data, setData] = useState<Entry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setState('loading');
    try { setData((await getLeaderboard(category, scope === 'friends')) as Entry[]); setState('ready'); }
    catch { if (!silent) setState('error'); }
    finally { setRefreshing(false); }
  }, [category, scope]);
  useEffect(() => { void load(); }, [load]);

  /** Orden que se muestra: si subiste, primero estás donde estabas y después asciendes. */
  const [view, setView] = useState<Entry[]>([]);
  const [rose, setRose] = useState(0);
  const reduce = useMotionStore((s) => s.reduce);
  useEffect(() => {
    if (state !== 'ready') return;
    const key = `${scope}:${category}`;
    const ranks = readRanks();
    const prev = ranks[key];
    const idx = data.findIndex((e) => e.id === String(user?.id));
    if (idx >= 0) { try { localStorage.setItem(RANK_KEY, JSON.stringify({ ...ranks, [key]: idx })); } catch { /* sin almacenamiento */ } }
    if (idx >= 3 && prev != null && prev > idx && !reduce) {
      const staged = [...data];
      const [mine] = staged.splice(idx, 1);
      staged.splice(Math.min(prev, staged.length), 0, mine);
      setView(staged); setRose(prev - idx);
      const t = window.setTimeout(() => setView(data), 1100);
      return () => window.clearTimeout(t);
    }
    setView(data); setRose(idx >= 0 && prev != null && prev > idx ? prev - idx : 0);
    return undefined;
  }, [data, state, scope, category, user?.id, reduce]);

  const myIdx = data.findIndex((e) => e.id === String(user?.id));
  const me = myIdx >= 0 ? data[myIdx] : null;
  const ahead = myIdx > 0 ? data[myIdx - 1] : null;
  const gap = me && ahead ? Math.max(0, ahead.value - me.value) : 0;
  const levelGap = category === 'xp' && me && ahead ? ahead.level - me.level : 0;
  const fmt = useCallback((n: number) => fmtValue(n, category), [category]);
  const top = useMemo(() => data.slice(0, 3).map((e) => ({
    id: e.id, username: e.username, name: e.displayName.split(' ')[0], initials: initials(e.displayName),
    score: category === 'xp' ? <LevelScore e={e} compact /> : <AnimatedValue value={e.value} format={fmt} />,
    isYou: e.id === String(user?.id), avatar: avatarOf(e),
  })), [category, data, fmt, user?.id]);
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
          {state === 'loading' ? <PageLoader size="sm" /> : state === 'error' ? <ErrorState onRetry={() => void load()} /> : data.length === 0 ? (
            <EmptyState icon={Users} title={scope === 'friends' ? 'Tu círculo está vacío' : 'Aún no hay clasificación'} description={scope === 'friends' ? 'Invita a amigos para compararte con ellos.' : 'Vuelve más tarde.'} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${scope}-${category}`} variants={stagger} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-6">
                <motion.div variants={item}>
                  <CeremonyPodium top={top} />
                </motion.div>
                {view.length > 3 && (
                  <motion.div variants={item}>
                    <Card padding="none" className="p-2">
                      <ol className="flex flex-col">
                        {view.slice(3).map((e, j) => (
                          <ResultRow key={e.id} id={e.id} username={e.username} position={j + 4} name={e.displayName} initials={initials(e.displayName)} avatar={avatarOf(e)}
                            subtitle={category === 'xp' ? `@${e.username}` : `@${e.username} · Nivel ${e.level}`}
                            score={category === 'xp' ? <LevelScore e={e} /> : <AnimatedValue value={e.value} format={fmt} />} isYou={e.id === String(user?.id)} rose={rose} />
                        ))}
                      </ol>
                    </Card>
                  </motion.div>
                )}
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
              <span className="text-body-md text-on-surface">de <span className="font-mono">{data.length}</span></span>
            </div>
            {rose > 0 && <p className="text-label-lg text-success-text">Subiste {rose} {rose === 1 ? 'puesto' : 'puestos'} desde tu última visita</p>}
            {me && ahead ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-2"><span className="text-body-sm text-on-surface">Para alcanzar el #{ahead.rank ?? myIdx}</span><span className="font-mono text-label-lg tabular-nums">{levelGap > 0 ? `${levelGap} ${levelGap === 1 ? 'nivel' : 'niveles'}` : fmtValue(gap, category)}</span></div>
                <ProgressBar value={levelGap > 0 ? (me.xpToNextLevel ? (me.value / me.xpToNextLevel) * 100 : 0) : ahead.value ? (me.value / ahead.value) * 100 : 0} shine label="Distancia al siguiente puesto" className="bg-background" />
                {levelGap > 0 && <span className="text-body-sm text-on-surface-light">Tu nivel {me.level}: <span className="font-mono">{me.value.toLocaleString('es-CO')}/{(me.xpToNextLevel ?? 0).toLocaleString('es-CO')}</span> XP</span>}
              </div>
            ) : me ? <p className="text-body-sm text-on-surface">¡Vas en cabeza en {METRICS[category].label.toLowerCase()}!</p>
              : <p className="text-body-sm text-on-surface">Aún no apareces en esta métrica. Registra actividad para entrar.</p>}
          </Card>
          {scope === 'friends' ? <FriendsLink /> : (
            <Card padding="lg" className="flex flex-col gap-3">
              <HeartHandshake aria-hidden className="size-8 text-success-text" strokeWidth={1.5} />
              <h2 className="text-heading-sm">Compite con calma</h2>
              <p className="text-body-md text-on-surface-light">La tabla es solo una referencia. Tu avance más importante es el que puedes sostener.</p>
              <Button variant="ghost" size="md" className="self-start" onClick={() => setScope('friends')}>Ver amigos</Button>
            </Card>
          )}
        </motion.aside>
      </div>
    </ZoneShell>
  );
}
