// Coliseo (/colosseum) — Colosseum.dc.html / ColosseumDesktop.dc.html.
// La API no tiene duelos contra enemigos: el Coliseo usa lo que sí existe.
//   · Personaje: HP/MP reales y récord de retos ganados/perdidos.
//   · Jefe de temporada (/seasons/active): tu XP le hace daño.
//   · "Duelos" = retos entre aventureros (/social/challenges): unirse, progreso, historial.
// TODO(api): duelos 1-vs-1 contra enemigos del prototipo (lista, pelear, resultado) no existen.
// TODO(api): la API no actualiza el progreso de los retos (currentValue), no los cierra (FINISHED)
// ni marca ganadores ni reparte el oro apostado; el historial mostrará lo que llegue cuando exista.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CalendarClock, Check, Coins, Dumbbell, Flag, Flame, HelpCircle, Heart, Minus, PiggyBank, Plus, Skull, Swords, Trophy, Users, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease, item, stagger } from '@/lib/motion';
import { getLevelTitle } from '@/lib/gameProgress';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import api from '@/lib/api';
import {
  Badge, Button, Card, Confetti, EmptyState, ErrorState, Field, IconChip, Input, Modal, ProgressBar, ResponsiveDialog, Select,
  Skeleton, Spinner, Switch, Textarea, type Tone,
} from '@/components/ui/lq';
import { getChallenges, createChallenge, joinChallenge } from '@/services/social.service';

interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  type: string;
  targetValue: number;
  goldWager: number;
  startDate: string;
  endDate: string;
  status: string;
  isParticipant: boolean;
  myProgress: number | null;
  participants: Array<{ userId: string; currentValue: number; isWinner: boolean; user: { id: string; displayName: string; level: number } }>;
}

interface SeasonData {
  season: {
    name: string; bossName: string; bossHp: number; currentHp: number; endDate: string;
    events: { id: string; name: string; description: string; bonusXpMult: number }[];
    participants: { userId: string; damageDealt: number; user: { displayName: string } }[];
  };
  userDamage: number;
}

const TYPES: Record<string, { label: string; unit: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  quests_completed: { label: 'Misiones completadas', unit: 'misiones', icon: Flag, tone: 'primary' },
  habits_streak: { label: 'Racha de hábitos', unit: 'días', icon: Flame, tone: 'warning' },
  gym_sessions: { label: 'Sesiones de gimnasio', unit: 'sesiones', icon: Dumbbell, tone: 'success' },
  savings_percent: { label: '% de ahorro', unit: '%', icon: PiggyBank, tone: 'info' },
};
const typeMeta = (t: string) => TYPES[t] ?? { label: t, unit: '', icon: Swords, tone: 'secondary' as const };
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const CLASS_NAMES: Record<string, string> = { warrior: 'Guerrero', mage: 'Mago', merchant: 'Mercader', paladin: 'Paladín' };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

// ── Duelo (unirse a un reto) ─────────────────────────────────────────────────

type DuelPhase = 'rolling' | 'won' | 'failed';

function DuelDialog({ challenge, phase, error, me, onClose }: {
  challenge: Challenge | null; phase: DuelPhase; error: string | null; me: { name: string; level: number }; onClose: () => void;
}) {
  const t = challenge ? typeMeta(challenge.type) : null;
  const rivals = challenge?.participants.length ?? 0;
  const continueRef = useRef<HTMLButtonElement>(null);
  // Durante el combate no hay botones; al resolverse, el foco va a Continuar.
  useEffect(() => { if (challenge && phase !== 'rolling') continueRef.current?.focus(); }, [challenge, phase]);
  return (
    <Modal open={Boolean(challenge)} onClose={onClose} title={<span className="block text-center text-label-md uppercase tracking-[2px] text-on-surface-light">Duelo</span>} hideClose dismissible={phase !== 'rolling'} className="md:max-w-[560px] md:gap-6 md:p-10">
      {challenge && t && (
        <>
          <div className="flex items-center justify-between gap-4">
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.4, ease } }} className="flex flex-1 flex-col items-center gap-3">
              <span className="flex size-20 items-center justify-center rounded-3xl bg-primary/[var(--lq-soft-alpha)] text-heading-lg text-primary-text lq-halo md:size-24">{initials(me.name)}</span>
              <span className="text-label-lg">{me.name.split(' ')[0]} · Nv {me.level}</span>
            </motion.div>
            <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.1, 1], opacity: 1 }} transition={{ delay: 0.35, duration: 0.45 }} className="text-display-sm text-on-surface-light md:text-display-md">vs</motion.span>
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.4, ease } }} className="flex flex-1 flex-col items-center gap-3">
              <IconChip icon={t.icon} tone={t.tone} className="size-20 rounded-3xl md:size-24 [&>svg]:size-10" />
              <span className="text-center text-label-lg">{challenge.title}{rivals ? ` · ${rivals} rival${rivals === 1 ? '' : 'es'}` : ''}</span>
            </motion.div>
          </div>
          <AnimatePresence mode="wait">
            {phase === 'rolling' ? (
              <motion.div key="r" exit={{ opacity: 0 }} className="flex items-center justify-center gap-3 py-4">
                <Spinner /><span className="text-body-md text-on-surface" aria-live="polite">Entrando a la arena…</span>
              </motion.div>
            ) : (
              <motion.div key="d" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2 text-center" aria-live="polite">
                <Badge size="lg" variant={phase === 'won' ? 'success' : 'error'} icon={phase === 'won' ? Check : X}>
                  {phase === 'won' ? 'Reto aceptado' : 'No pudiste unirte'}
                </Badge>
                <span className={cn('text-heading-lg tabular-nums md:text-display-md', phase === 'won' ? 'text-primary-text' : 'text-error-text')}>
                  {phase === 'won' ? `Meta: ${challenge.targetValue} ${t.unit}` : 'Inténtalo más tarde'}
                </span>
                <span className="text-body-md text-on-surface-light">
                  {phase === 'won'
                    ? `${daysLeft(challenge.endDate)} días para lograrlo${challenge.goldWager ? ` · en juego ${challenge.goldWager} de oro` : ''}.`
                    : error}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {phase !== 'rolling' && <Button ref={continueRef} block onClick={onClose}>Continuar</Button>}
        </>
      )}
    </Modal>
  );
}

// ── Nuevo reto ───────────────────────────────────────────────────────────────

const iso = (d: Date) => d.toISOString().slice(0, 10);

function NewChallengeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const init = () => ({ title: '', description: '', type: 'quests_completed', targetValue: '10', goldWager: '0', startDate: iso(new Date()), endDate: iso(new Date(Date.now() + 7 * 86_400_000)), isPublic: true });
  const [f, setF] = useState(init);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setF(init()); setTouched(false); setError(null); } }, [open]);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setF((x) => ({ ...x, [k]: v }));
  const datesOk = f.endDate > f.startDate;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!f.title.trim() || !(Number(f.targetValue) > 0) || !datesOk) return;
    setSaving(true);
    setError(null);
    try {
      await createChallenge({ ...f, title: f.title.trim(), description: f.description.trim() || undefined, targetValue: Number(f.targetValue), goldWager: Number(f.goldWager) || 0 });
      useToastStore.getState().success('Reto creado', f.isPublic ? 'Otros aventureros ya pueden unirse' : undefined);
      onCreated();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'No se pudo crear el reto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Nuevo reto" className="md:max-w-[560px]">
      <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Nombre" error={touched && !f.title.trim() ? 'Ponle un nombre al reto' : undefined}>
          <Input data-autofocus value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Semana de hierro" />
        </Field>
        <Field label="Descripción" help="Opcional">
          <Textarea rows={2} className="min-h-20" value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={f.type} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label={`Meta (${typeMeta(f.type).unit})`} error={touched && !(Number(f.targetValue) > 0) ? 'Debe ser mayor que 0' : undefined}>
            <Input type="number" min="1" value={f.targetValue} onChange={(e) => set('targetValue', e.target.value)} />
          </Field>
          <Field label="Inicio"><Input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="Fin" error={touched && !datesOk ? 'Debe ser posterior al inicio' : undefined}>
            <Input type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
          <Field label="Oro en juego" help="Opcional · apuesta simbólica">
            <Input type="number" min="0" value={f.goldWager} onChange={(e) => set('goldWager', e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-border p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-label-lg text-on-background">Reto público</span>
            <span className="block text-body-sm text-on-surface-light">Cualquier aventurero puede unirse (máximo 10).</span>
          </span>
          <Switch checked={f.isPublic} onChange={(e) => set('isPublic', e.target.checked)} />
        </label>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Crear reto</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

function ColosseumSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando el coliseo">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-3 md:gap-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
      <div className="flex items-center justify-center gap-3"><Spinner /><span className="text-body-sm text-on-surface-light">Preparando la arena…</span></div>
    </div>
  );
}

export default function ColosseumPage() {
  const user = useAuthStore((s) => s.user);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [creating, setCreating] = useState(false);
  const [rules, setRules] = useState(false);
  const [duel, setDuel] = useState<{ c: Challenge; phase: DuelPhase; error: string | null } | null>(null);
  const [burst, setBurst] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [c, s] = await Promise.all([
        getChallenges() as Promise<Challenge[]>,
        api.get<SeasonData | null>('/seasons/active').then((r) => r.data).catch(() => null),
      ]);
      setChallenges(c);
      setSeason(s?.season ? s : null);
      setState('ready');
    } catch {
      if (!silent) setState('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function join(c: Challenge) {
    setDuel({ c, phase: 'rolling', error: null });
    const started = Date.now();
    try {
      await joinChallenge(c.id);
      // La animación de entrada dura ~1 s; no cortarla aunque la API responda antes.
      await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - started))));
      setDuel({ c, phase: 'won', error: null });
      setBurst((b) => b + 1);
      void refreshUser();
      void load(true);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'El reto ya no está disponible.';
      setDuel({ c, phase: 'failed', error: msg });
    }
  }

  if (!user) return null;

  const me = user.id;
  const finished = challenges.filter((c) => c.isParticipant && c.status !== 'ACTIVE');
  const wins = finished.filter((c) => c.participants.find((p) => p.userId === me)?.isWinner).length;
  const losses = finished.filter((c) => c.status === 'FINISHED').length - wins;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : null;
  const available = challenges.filter((c) => c.status === 'ACTIVE' && !c.isParticipant);
  const mine = challenges.filter((c) => c.status === 'ACTIVE' && c.isParticipant);
  const playerClass = (user as unknown as { playerClass?: string }).playerClass;
  const hpPct = user.maxHp ? (user.hp / user.maxHp) * 100 : 0;
  const mpPct = user.maxMp ? (user.mp / user.maxMp) * 100 : 0;

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 md:gap-2">
        <span className="text-body-sm text-on-surface-light md:text-label-lg md:text-primary-text">{season ? season.season.name : 'Arena'}</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Coliseo</h1>
        <p className="hidden max-w-[560px] text-body-lg text-on-surface-light md:block">
          Tu disciplina es tu poder. Cada XP que ganas golpea al jefe de temporada, y los retos te miden contra otros aventureros.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {season && <Badge size="lg" variant="neutral" icon={CalendarClock}>{daysLeft(season.season.endDate)} días restantes</Badge>}
        <Button variant="icon" aria-label="Reglas del coliseo" aria-haspopup="dialog" onClick={() => setRules(true)}>
          <HelpCircle aria-hidden className="size-6" strokeWidth={1.75} />
        </Button>
        <Button size="md" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Nuevo reto</Button>
      </div>
    </motion.section>
  );

  let body;
  if (state === 'loading') body = <ColosseumSkeleton />;
  else if (state === 'error') body = <ErrorState title="No pudimos abrir el coliseo" onRetry={() => void load()} />;
  else {
    body = (
      <div className="flex flex-col gap-6 md:gap-12">
        {/* Personaje */}
        <Card as="section" variant="elevated" padding="none" aria-label="Tu personaje" className="flex flex-wrap items-center gap-6 p-6 md:gap-8 md:p-8">
          <div className="flex min-w-0 flex-[1_1_320px] items-center gap-4 md:gap-6">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-primary/[var(--lq-soft-alpha)] text-heading-md text-primary-text md:size-28 md:animate-float md:rounded-[32px] md:text-display-sm motion-reduce:animate-none">
              {initials(user.displayName)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-heading-sm md:text-heading-lg">{user.displayName.split(' ')[0]} · Nivel {user.level}</span>
              <span className="text-body-sm text-on-surface-light md:text-body-md">{playerClass ? `Clase: ${CLASS_NAMES[playerClass] ?? playerClass}` : getLevelTitle(user.level)}</span>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="success" icon={Trophy}>{wins} V</Badge>
                <Badge variant="error" icon={X}>{Math.max(0, losses)} D</Badge>
                {winRate !== null && <Badge variant="primary">{winRate}% victorias</Badge>}
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-label-lg text-error-text"><Heart aria-hidden className="size-4" strokeWidth={1.75} />Vida</span>
                <span className="text-heading-sm tabular-nums">{user.hp}<span className="text-body-md text-on-surface-light"> / {user.maxHp}</span></span>
              </div>
              <ProgressBar value={hpPct} tone="error" size="lg" shine label="Puntos de vida" valueText={`${user.hp} de ${user.maxHp}`} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-label-lg text-info-text"><Zap aria-hidden className="size-4" strokeWidth={1.75} />Maná</span>
                <span className="text-heading-sm tabular-nums">{user.mp}<span className="text-body-md text-on-surface-light"> / {user.maxMp}</span></span>
              </div>
              <ProgressBar value={mpPct} tone="info" size="lg" shine label="Puntos de maná" valueText={`${user.mp} de ${user.maxMp}`} />
            </div>
          </div>
        </Card>

        {/* Jefe de temporada */}
        {season && (() => {
          const s = season.season;
          const bossPct = s.bossHp ? (s.currentHp / s.bossHp) * 100 : 0;
          return (
            <Card as="section" padding="lg" aria-labelledby="boss-title" className="flex flex-col gap-5 border-error/30">
              <div className="flex flex-wrap items-center gap-4">
                <IconChip icon={Skull} tone="error" size="md" className="animate-float motion-reduce:animate-none" />
                <div className="min-w-0 flex-1">
                  <span className="text-label-md uppercase text-error-text">Jefe de temporada</span>
                  <h2 id="boss-title" className="text-heading-md md:text-heading-lg">{s.bossName}</h2>
                </div>
                <Link to="/season" className="inline-flex min-h-11 items-center text-label-lg text-primary-text hover:underline">Ver campaña</Link>
              </div>
              <div className="flex flex-col gap-2">
                <ProgressBar value={bossPct} tone="error" size="lg" label={`Vida de ${s.bossName}`} valueText={`${s.currentHp} de ${s.bossHp}`} />
                <div className="flex flex-wrap justify-between gap-2 text-body-sm tabular-nums">
                  <span className="text-on-surface-light">{s.currentHp.toLocaleString('es-CO')} / {s.bossHp.toLocaleString('es-CO')} HP</span>
                  <span className="text-primary-text">Tu daño: {season.userDamage.toLocaleString('es-CO')}</span>
                </div>
              </div>
              <p className="text-body-sm text-on-surface">Cada 5 XP que ganas le quitan 1 HP. Completa hábitos y misiones para atacarlo.</p>
              {s.events.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {s.events.map((e) => <Badge key={e.id} variant="warning" icon={Zap}>{e.name} · ×{e.bonusXpMult} XP</Badge>)}
                </div>
              )}
              {s.participants.length > 0 && (
                <ol className="grid gap-2 sm:grid-cols-3">
                  {s.participants.slice(0, 3).map((p, i) => (
                    <li key={p.userId} className={cn('flex items-center gap-3 rounded-xl border p-3', p.userId === me ? 'border-primary/40 bg-primary/[var(--lq-soft-alpha)]' : 'border-border')}>
                      <span className="text-heading-sm text-on-surface-light tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-label-lg">{p.user.displayName}</span>
                      <span className="text-body-sm tabular-nums">{p.damageDealt.toLocaleString('es-CO')}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })()}

        {/* Retos disponibles = duelos */}
        <section aria-labelledby="avail-title" className="flex flex-col gap-4 md:gap-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="avail-title" className="text-heading-sm md:text-heading-lg">Duelos disponibles</h2>
            <span className="text-body-sm text-on-surface-light">{available.length} {available.length === 1 ? 'reto abierto' : 'retos abiertos'}</span>
          </div>
          {available.length === 0 ? (
            <EmptyState
              icon={Swords}
              tone="muted"
              title="No hay retos abiertos"
              description="Crea uno y desafía a otros aventureros."
              action={<Button variant="secondary" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Nuevo reto</Button>}
              className="py-10"
            />
          ) : (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-6">
              {available.map((c) => {
                const t = typeMeta(c.type);
                const left = daysLeft(c.endDate);
                return (
                  <motion.li key={c.id} variants={item} className="lq-lift flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm md:flex-col md:items-stretch md:gap-5 md:p-6">
                    <div className="flex items-center justify-between md:w-full">
                      <IconChip icon={t.icon} tone={t.tone} className="md:size-16 md:rounded-[20px]" />
                      <Badge size="lg" variant={left <= 2 ? 'error' : left <= 5 ? 'warning' : 'success'} className="hidden md:inline-flex">{left} días</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-body-md font-semibold md:text-heading-sm">{c.title}</h3>
                      <p className="text-body-sm text-on-surface-light">
                        Meta {c.targetValue} {t.unit} · <Users aria-hidden className="inline size-4 align-[-3px]" strokeWidth={1.75} /> {c.participants.length}
                        <span className="md:hidden"> · {left} d</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 md:border-t md:border-border md:pt-4">
                      {c.goldWager > 0 && (
                        <span className="hidden items-center gap-1 text-label-lg text-warning-text tabular-nums md:flex"><Coins aria-hidden className="size-4" strokeWidth={1.75} />{c.goldWager}</span>
                      )}
                      <Button size="md" aria-label={`Unirse al reto ${c.title}`} onClick={() => void join(c)} className="md:ml-auto">
                        <Swords aria-hidden className="size-4" strokeWidth={1.75} />Unirse
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </section>

        {/* Mis retos */}
        {mine.length > 0 && (
          <section aria-labelledby="mine-title" className="flex flex-col gap-4 md:gap-6">
            <h2 id="mine-title" className="text-heading-sm md:text-heading-lg">Tus retos en curso</h2>
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
              {mine.map((c) => {
                const t = typeMeta(c.type);
                const mineP = c.myProgress ?? 0;
                const rank = [...c.participants].sort((a, b) => b.currentValue - a.currentValue).findIndex((p) => p.userId === me) + 1;
                return (
                  <Card key={c.id} as="li" padding="lg" className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <IconChip icon={t.icon} tone={t.tone} size="sm" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-heading-sm">{c.title}</h3>
                        <p className="text-body-sm text-on-surface-light">{t.label} · termina en {daysLeft(c.endDate)} días</p>
                      </div>
                      {rank > 0 && <Badge variant={rank === 1 ? 'success' : 'neutral'}>#{rank} de {c.participants.length}</Badge>}
                    </div>
                    <ProgressBar value={(mineP / Math.max(1, c.targetValue)) * 100} label={`Progreso en ${c.title}`} valueText={`${mineP} de ${c.targetValue} ${t.unit}`} />
                    <span className="text-body-sm text-on-surface-light tabular-nums">{mineP} de {c.targetValue} {t.unit}{c.goldWager ? ` · ${c.goldWager} de oro en juego` : ''}</span>
                  </Card>
                );
              })}
            </ul>
          </section>
        )}

        {/* Historial */}
        <Card as="section" padding="lg" aria-labelledby="hist-title" className="flex flex-col gap-2">
          <h2 id="hist-title" className="mb-2 text-heading-sm md:text-heading-lg">Últimos {Math.min(5, finished.length) || ''} duelos</h2>
          {finished.length === 0 ? (
            <p className="py-4 text-body-md text-on-surface-light">Aún no terminaste ningún reto.</p>
          ) : (
            <div role="table" aria-label="Historial de duelos" className="flex flex-col">
              <div role="row" className="hidden grid-cols-[140px_minmax(0,1fr)_120px_120px] gap-4 border-b border-border py-2 md:grid">
                {['Resultado', 'Reto', 'Fecha', 'Oro'].map((h, i) => (
                  <span key={h} role="columnheader" className={cn('text-label-md uppercase text-on-surface-light', i === 3 && 'text-right')}>{h}</span>
                ))}
              </div>
              {finished.slice(0, 5).map((c, i, arr) => {
                const win = Boolean(c.participants.find((p) => p.userId === me)?.isWinner);
                const cancelled = c.status === 'CANCELLED';
                return (
                  <div role="row" key={c.id} className={cn('grid min-h-14 grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[140px_minmax(0,1fr)_120px_120px] md:gap-4', i < arr.length - 1 && 'border-b border-border')}>
                    <span role="cell">
                      <Badge variant={cancelled ? 'neutral' : win ? 'success' : 'error'} icon={cancelled ? Minus : win ? Check : X}>
                        {cancelled ? 'Anulado' : win ? 'Victoria' : 'Derrota'}
                      </Badge>
                    </span>
                    <span role="cell" className="truncate text-body-md">{c.title}</span>
                    <span role="cell" className="hidden text-body-sm text-on-surface-light md:block">{fmtDate(c.endDate)}</span>
                    <span role="cell" className={cn('text-right text-label-lg tabular-nums', win ? 'text-primary-text' : 'text-on-surface-light')}>
                      {c.goldWager ? `${win ? '+' : '−'}${c.goldWager} oro` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      {header}
      <motion.div variants={item}>{body}</motion.div>

      <DuelDialog challenge={duel?.c ?? null} phase={duel?.phase ?? 'rolling'} error={duel?.error ?? null} me={{ name: user.displayName, level: user.level }} onClose={() => setDuel(null)} />
      {burst > 0 && <Confetti burst={burst} />}
      <NewChallengeDialog open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load(true); }} />
      <Modal open={rules} onClose={() => setRules(false)} title="Reglas del coliseo">
        <ul className="flex flex-col gap-3 text-body-md text-on-surface">
          <li className="flex gap-3"><Skull aria-hidden className="mt-0.5 size-5 shrink-0 text-error-text" strokeWidth={1.75} />El jefe de temporada pierde 1 HP por cada 5 XP que gana la comunidad. Tu daño cuenta para el ranking.</li>
          <li className="flex gap-3"><Swords aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-text" strokeWidth={1.75} />Los retos enfrentan hasta 10 aventureros con una meta y una fecha límite.</li>
          <li className="flex gap-3"><Coins aria-hidden className="mt-0.5 size-5 shrink-0 text-warning-text" strokeWidth={1.75} />El oro en juego es, por ahora, una apuesta simbólica entre participantes.</li>
        </ul>
        <Button block onClick={() => setRules(false)}>Entendido</Button>
      </Modal>
    </motion.div>
  );
}
