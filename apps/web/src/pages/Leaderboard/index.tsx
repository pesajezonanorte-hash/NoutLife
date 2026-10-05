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
import { Check, Dumbbell, Flame, HeartHandshake, PiggyBank, RefreshCw, Trophy, UserMinus, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  getLeaderboard, sendFriendRequest, getFriends, getPendingRequests, respondFriendRequest, removeFriend,
} from '@/services/social.service';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/layout/PageHeader';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import {
  AnimatedValue, Button, Card, ChipGroup, EmptyState, ErrorState, Field, Input, PageLoader, ProgressBar,
  SegmentedControl, Skeleton, type ChipOption,
} from '@/components/ui/lq';

type Category = 'xp' | 'streak' | 'gym' | 'savings';
type Scope = 'global' | 'friends';

interface Entry {
  rank: number; id: string; username: string; displayName: string; level: number; value: number;
  avatarConfig?: unknown; avatarUrl?: string | null;
}
interface Friend { friendshipId: string; friend: { id: string; username: string; displayName: string; level: number; currentStreak: number; avatarConfig?: unknown; avatarUrl?: string | null } }
interface Pending { id: string; requester: { id: string; username: string; displayName: string; level: number; avatarConfig?: unknown; avatarUrl?: string | null } }

const METRICS: Record<Category, { label: string; icon: LucideIcon; unit: [string, string]; hint: string }> = {
  xp: { label: 'XP total', icon: Trophy, unit: ['XP', 'XP'], hint: 'Nivel y experiencia acumulada.' },
  streak: { label: 'Racha activa', icon: Flame, unit: ['día', 'días'], hint: 'Días seguidos con actividad. Si alguien pasa un día entero sin actividad, su racha vuelve a 0.' },
  gym: { label: 'Entrenamiento', icon: Dumbbell, unit: ['sesión', 'sesiones'], hint: 'Sesiones de gimnasio terminadas.' },
  savings: { label: 'Ahorro', icon: PiggyBank, unit: ['%', '%'], hint: 'Parte de lo ingresado este mes que no se gastó, según los movimientos de Finanzas. Lo que registras en Ahorro o Inversión cuenta como ahorrado.' },
};
const fmtValue = (v: number, c: Category) => {
  const n = Math.round(v);
  return c === 'savings' ? `${n}%` : `${n.toLocaleString('es-CO')} ${METRICS[c].unit[n === 1 ? 0 : 1]}`;
};
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
/** Foto (o avatar) del perfil dentro del círculo del ranking. */
const avatarOf = (e: Pick<Entry, 'avatarConfig' | 'avatarUrl'>) => (size: number) => (
  <AvatarDisplay avatarConfig={e.avatarConfig} avatarUrl={e.avatarUrl} size={size} animate="none" className="rounded-full" />
);
/** Último puesto visto por métrica y alcance (para notar si subiste). */
const RANK_KEY = 'lq-rank-last';
const readRanks = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(RANK_KEY) || '{}'); } catch { return {}; } };
const errText = (e: unknown, fallback: string) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

function Friends({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, p] = await Promise.all([getFriends(), getPendingRequests()]);
      setFriends(f as Friend[]); setPending(p as Pending[]);
    } catch { setFriends([]); setPending([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function send() {
    if (!input.trim()) return;
    setSending(true); setMsg(null);
    try { await sendFriendRequest(input.trim()); setMsg({ ok: true, text: 'Solicitud enviada. Aparecerá cuando la acepten.' }); setInput(''); }
    catch (e) { setMsg({ ok: false, text: errText(e, 'No se pudo enviar la solicitud.') }); }
    finally { setSending(false); }
  }
  async function respond(id: string, accept: boolean) {
    try { await respondFriendRequest(id, accept); setPending((p) => p.filter((x) => x.id !== id)); if (accept) { await refresh(); onChanged(); } }
    catch { toast.error('No se pudo actualizar la solicitud'); }
  }
  async function remove(id: string) {
    try { await removeFriend(id); setFriends((f) => f.filter((x) => x.friendshipId !== id)); onChanged(); }
    catch { toast.error('No se pudo eliminar a este amigo'); }
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-2"><Users aria-hidden className="size-5 text-primary-text" strokeWidth={1.75} /><h2 className="text-heading-sm">Tu círculo</h2></div>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex flex-col gap-2">
        <Field label="Invitar a un amigo" error={msg && !msg.ok ? msg.text : undefined} help={msg?.ok ? msg.text : 'Su usuario o su código de invitación.'}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Usuario o código" autoCapitalize="none" />
        </Field>
        <Button type="submit" size="md" loading={sending} disabled={!input.trim()} className="self-start"><UserPlus aria-hidden className="size-4" strokeWidth={1.75} />Enviar solicitud</Button>
      </form>
      {loading ? <Skeleton className="h-24 rounded-xl" /> : (
        <>
          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-label-md uppercase text-on-surface-light">Solicitudes · {pending.length}</p>
              {pending.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
                  <AvatarDisplay avatarConfig={r.requester.avatarConfig} avatarUrl={r.requester.avatarUrl} size={36} animate="none" className="shrink-0 overflow-hidden rounded-full" />
                  <div className="min-w-0 flex-1"><p className="truncate text-label-lg">{r.requester.displayName}</p><p className="truncate text-body-sm text-on-surface-light">@{r.requester.username} · Nivel {r.requester.level}</p></div>
                  <Button variant="icon" aria-label={`Aceptar a ${r.requester.displayName}`} onClick={() => void respond(r.id, true)} className="text-success-text"><Check aria-hidden className="size-5" /></Button>
                  <Button variant="icon" aria-label={`Rechazar a ${r.requester.displayName}`} onClick={() => void respond(r.id, false)} className="text-error-text"><X aria-hidden className="size-5" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-label-md uppercase text-on-surface-light">Amigos · {friends.length}</p>
            {friends.length === 0 ? <p className="text-body-sm text-on-surface-light">Aún no tienes amigos. Invita a alguien con su usuario.</p> : friends.map(({ friendshipId, friend }) => (
              <div key={friendshipId} className="flex min-h-14 items-center gap-3">
                <AvatarDisplay avatarConfig={friend.avatarConfig} avatarUrl={friend.avatarUrl} size={36} animate="none" className="shrink-0 overflow-hidden rounded-full" />
                <div className="min-w-0 flex-1"><p className="truncate text-label-lg">{friend.displayName}</p><p className="truncate text-body-sm text-on-surface-light">Nivel {friend.level} · {friend.currentStreak} días de racha</p></div>
                <Button variant="icon" aria-label={`Quitar a ${friend.displayName}`} onClick={() => void remove(friendshipId)}><UserMinus aria-hidden className="size-5" strokeWidth={1.75} /></Button>
              </div>
            ))}
          </div>
        </>
      )}
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
  const fmt = useCallback((n: number) => fmtValue(n, category), [category]);
  const top = useMemo(() => data.slice(0, 3).map((e) => ({
    id: e.id, name: e.displayName.split(' ')[0], initials: initials(e.displayName), score: <AnimatedValue value={e.value} format={fmt} />, isYou: e.id === String(user?.id), avatar: avatarOf(e),
  })), [data, fmt, user?.id]);
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
                          <ResultRow key={e.id} id={e.id} position={j + 4} name={e.displayName} initials={initials(e.displayName)} avatar={avatarOf(e)}
                            subtitle={`@${e.username} · Nivel ${e.level}`} score={<AnimatedValue value={e.value} format={fmt} />} isYou={e.id === String(user?.id)} rose={rose} />
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
                <div className="flex justify-between gap-2"><span className="text-body-sm text-on-surface">Para alcanzar el #{ahead.rank ?? myIdx}</span><span className="font-mono text-label-lg tabular-nums">{fmtValue(gap, category)}</span></div>
                <ProgressBar value={ahead.value ? (me.value / ahead.value) * 100 : 0} shine label="Distancia al siguiente puesto" className="bg-background" />
              </div>
            ) : me ? <p className="text-body-sm text-on-surface">¡Vas en cabeza en {METRICS[category].label.toLowerCase()}!</p>
              : <p className="text-body-sm text-on-surface">Aún no apareces en esta métrica. Registra actividad para entrar.</p>}
          </Card>
          {scope === 'friends' ? <Friends onChanged={() => void load(true)} /> : (
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
