// Rituales dentro de la libreta de Hábitos (antes una zona aparte: /rituals llega
// aquí). Tarjetas con pasos numerados, modo guiado paso a paso (anillo + cronómetro
// por paso) y estado vacío «Cargar rituales sugeridos». Cada ritual es una bandeja
// de arena con marco de bambú: sus pasos son piedras que caen y se asientan; hecho
// hoy, a las piedras les crece musgo. Completar el ritual enciende todas las piedras
// y una onda recorre la arena.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Flame, Moon, Play, Plus, Sun, Trash2, X, Zap, type LucideIcon } from 'lucide-react';
import { item, pop3, springs, stagger } from '@/lib/motion';
import { BreathCircle, StonePath } from '@/components/rituals/StonePath';
import { ZenGarden } from '@/components/rituals/ZenGarden';
import { cn } from '@/lib/utils';
import * as ritualsService from '@/services/rituals.service';
import type { Ritual } from '@/services/rituals.service';
import { LiteNotice } from '@/components/billing/LiteNotice';
import { LITE_LIMITS, isProRequired } from '@/lib/plan';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { useToast } from '@/hooks/useToast';
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, IconChip, Input, PageLoader, ProgressRing, ResponsiveDialog,
  SegmentedControl, SpotCard, Timer, type Tone,
} from '@/components/ui/lq';
import { NotebookSheet } from './NotebookSheet';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  types: { morning: 'Mañana', night: 'Noche', custom: 'Personal' } as Record<string, string>,
  runningLabel: 'Ritual en curso',
  progressLabel: 'Progreso del ritual',
  stepOf: (n: number, of: number) => `Paso ${n} de ${of}`,
  steps: 'pasos',
  stepOfName: (name: string, n: number) => `${name} · paso ${n}`,
  timeLeft: 'Tiempo restante del paso',
  timeDone: 'Tiempo cumplido',
  noTime: 'Sin tiempo fijo: respira con el círculo y márcalo cuando lo termines.',
  exit: 'Salir',
  finish: 'Terminar',
  nextStep: 'Siguiente paso',
  completeFailed: 'No se pudo completar el ritual',
  stepsCount: (n: number) => `${n} pasos`,
  minutes: (m: number) => ` · ${m} min`,
  doneToday: 'Hecho hoy',
  pending: 'Pendiente',
  streakDays: 'días de racha',
  thisMonth: 'este mes',
  repeat: 'Repetir',
  start: 'Comenzar',
  newRitual: 'Nuevo ritual',
  nameLabel: 'Nombre',
  namePh: 'Ej. Ritual de enfoque',
  nameErr: 'Ponle un nombre',
  moment: 'Momento',
  stepsLegend: 'Pasos',
  stepLabel: (n: number) => `Paso ${n}`,
  stepPh: 'Ej. Vaso de agua',
  stepErr: 'Añade al menos un paso',
  minShort: 'Min',
  removeStep: (n: number) => `Quitar paso ${n}`,
  addStep: 'Añadir paso',
  cancel: 'Cancelar',
  createRitual: 'Crear ritual',
  created: 'Ritual creado',
  createFailed: 'No se pudo crear el ritual',
  listLoading: 'Preparando tus rituales…',
  listFailed: 'No pudimos cargar tus rituales',
  listSaved: 'Tus rituales siguen guardados.',
  emptyTitle: 'Sin rituales todavía',
  emptyBody: 'Un ritual es una secuencia de pasos que haces cada día, uno detrás de otro. Empieza con los sugeridos o crea el tuyo.',
  createMine: 'Crear el mío',
  seedBtn: 'Cargar rituales sugeridos',
  seedOk: 'Rituales sugeridos listos',
  seedFailed: 'No se pudieron cargar los sugeridos',
  liteOver: (max: number, n: number) => `NoutLife Lite admite ${max} rutinas activas. Tus ${n} rituales siguen aquí; para crear más, pasa a Pro.`,
  liteCount: (n: number, max: number, atLimit: boolean) => `Tienes ${n} de ${max} rutinas activas de NoutLife Lite.${atLimit ? ' Con Pro, sin límite.' : ''}`,
  headerNote: 'Pasos encadenados, uno detrás de otro',
  newBtn: 'Nuevo ritual',
  sessionDone: 'Sin tiempo fijo',
  noTimeHint: 'Sin tiempo fijo',
  breath: 'Respira',
};

const en: typeof es = {
  types: { morning: 'Morning', night: 'Night', custom: 'Personal' },
  runningLabel: 'Ritual in progress',
  progressLabel: 'Ritual progress',
  stepOf: (n, of) => `Step ${n} of ${of}`,
  steps: 'steps',
  stepOfName: (name, n) => `${name} · step ${n}`,
  timeLeft: 'Time left for this step',
  timeDone: 'Time is up',
  noTime: 'No fixed time: breathe with the circle and mark it when you are done.',
  exit: 'Exit',
  finish: 'Finish',
  nextStep: 'Next step',
  completeFailed: "We couldn't complete the ritual",
  stepsCount: (n) => `${n} steps`,
  minutes: (m) => ` · ${m} min`,
  doneToday: 'Done today',
  pending: 'Pending',
  streakDays: 'day streak',
  thisMonth: 'this month',
  repeat: 'Repeat',
  start: 'Start',
  newRitual: 'New ritual',
  nameLabel: 'Name',
  namePh: 'E.g. Focus ritual',
  nameErr: 'Give it a name',
  moment: 'Time of day',
  stepsLegend: 'Steps',
  stepLabel: (n) => `Step ${n}`,
  stepPh: 'E.g. Glass of water',
  stepErr: 'Add at least one step',
  minShort: 'Min',
  removeStep: (n) => `Remove step ${n}`,
  addStep: 'Add step',
  cancel: 'Cancel',
  createRitual: 'Create ritual',
  created: 'Ritual created',
  createFailed: "We couldn't create the ritual",
  listLoading: 'Preparing your rituals…',
  listFailed: "We couldn't load your rituals",
  listSaved: 'Your rituals are still saved.',
  emptyTitle: 'No rituals yet',
  emptyBody: 'A ritual is a sequence of steps you do every day, one after another. Start with the suggested ones or create your own.',
  createMine: 'Create my own',
  seedBtn: 'Load suggested rituals',
  seedOk: 'Suggested rituals ready',
  seedFailed: "We couldn't load the suggestions",
  liteOver: (max, n) => `NoutLife Lite includes ${max} active routines. Your ${n} rituals are still here; to create more, go Pro.`,
  liteCount: (n, max, atLimit) => `You have ${n} of ${max} active NoutLife Lite routines.${atLimit ? ' With Pro, no limit.' : ''}`,
  headerNote: 'Steps in a chain, one after another',
  newBtn: 'New ritual',
  sessionDone: 'No fixed time',
  noTimeHint: 'No fixed time',
  breath: 'Breathe',
};

const COPY: Copy<typeof es> = { es, en };

type RitualType = Ritual['type'];
const TYPE_STYLE: Record<RitualType, { tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  morning: { tone: 'warning', icon: Sun },
  night: { tone: 'forest', icon: Moon },
  custom: { tone: 'primary', icon: Zap },
};
const TYPE_ORDER: RitualType[] = ['morning', 'night', 'custom'];
const typeOf = (t: string, labels: Record<string, string>) => {
  const key = (t in TYPE_STYLE ? t : 'custom') as RitualType;
  return { label: labels[key], ...TYPE_STYLE[key] };
};
const minutes = (r: Ritual) => r.steps.reduce((s, st) => s + (st.durationMin ?? 0), 0);

/** Modo guiado: paso actual con anillo de progreso y cronómetro si el paso tiene duración. */
function Runner({ ritual, onExit, onDone }: { ritual: Ritual; onExit: () => void; onDone: (msg: string, already: boolean) => void }) {
  const t = useText(COPY);
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const step = ritual.steps[idx];
  const last = idx === ritual.steps.length - 1;
  const total = (step?.durationMin ?? 0) * 60;
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setElapsed(0); titleRef.current?.focus(); }, [idx]);
  useEffect(() => {
    if (!total) return;
    const id = window.setInterval(() => setElapsed((e) => (e >= total ? e : e + 1)), 1000);
    return () => window.clearInterval(id);
  }, [total, idx]);

  async function next() {
    if (!last) { setIdx((i) => i + 1); return; }
    setBusy(true);
    try {
      const r = await ritualsService.completeRitual(ritual.id);
      onDone(r.message, r.alreadyDone);
    } catch { toast.error(t.completeFailed); }
    finally { setBusy(false); }
  }

  const k = typeOf(ritual.type, t.types);
  return (
    <SpotCard aria-label={t.runningLabel} className="lq-zen-tray flex flex-wrap items-center gap-6 md:gap-10">
      <ProgressRing value={((idx + 1) / ritual.steps.length) * 100} size={150} stroke={8} label={t.progressLabel} valueText={t.stepOf(idx + 1, ritual.steps.length)}>
        <span className="font-mono text-display-sm tabular-nums">{idx + 1}/{ritual.steps.length}</span>
        <span className="text-body-sm text-on-surface-light">{t.steps}</span>
      </ProgressRing>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-3" aria-live="polite">
        <StonePath total={ritual.steps.length} current={idx} />
        <span className="text-label-lg text-primary-text">{t.stepOfName(ritual.name, idx + 1)}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h3 key={step?.id} ref={titleRef} tabIndex={-1} variants={pop3} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="text-display-sm outline-none">{step?.title}</motion.h3>
        </AnimatePresence>
        {total > 0 ? (
          <div className="flex items-center gap-3">
            <Timer seconds={Math.max(0, total - elapsed)} size="lg" label={t.timeLeft} className={cn(elapsed >= total && 'text-success-text')} />
            {elapsed >= total && <Badge variant="success" icon={CheckCircle2}>{t.timeDone}</Badge>}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <BreathCircle />
            <p className="text-body-lg text-on-surface-light">{t.noTime}</p>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onExit}><X aria-hidden className="size-4" strokeWidth={1.75} />{t.exit}</Button>
          <Button onClick={next} loading={busy}>
            {last ? <><CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />{t.finish}</> : <>{t.nextStep}<ChevronRight aria-hidden className="size-4" strokeWidth={1.75} /></>}
          </Button>
        </div>
      </div>
      <Badge variant={k.tone} icon={k.icon} className="self-start">{k.label}</Badge>
    </SpotCard>
  );
}

function RitualCard({ ritual, doneToday, playing, onPlay, celebrate }: { ritual: Ritual; doneToday: boolean; playing: boolean; onPlay: () => void; celebrate?: boolean }) {
  const t = useText(COPY);
  const k = typeOf(ritual.type, t.types);
  const [stats, setStats] = useState<{ streak: number; thisMonth: number } | null>(null);
  useEffect(() => {
    ritualsService.getRitualStats(ritual.id).then((s) => setStats({ streak: s.streak, thisMonth: s.thisMonth })).catch(() => null);
  }, [ritual.id]);
  const mins = minutes(ritual);
  return (
    <Card as="article" interactive padding="lg" className="lq-zen-tray relative flex h-full flex-col gap-5 overflow-hidden p-4 sm:p-6">
      {/* Ritual completo: una onda de calma se expande desde el camino */}
      {celebrate && <span key="calm" aria-hidden="true" className="lq-calm-wave pointer-events-none absolute left-8 top-1/2 block size-80 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-success/50 bg-[radial-gradient(closest-side,rgb(var(--lq-success)/.16),transparent)]" />}
      <div className="flex items-start gap-4">
        <IconChip icon={k.icon} tone={k.tone} />
        <div className="min-w-0 flex-1">
          <h3 className="text-heading-sm">{ritual.name}</h3>
          <p className="text-body-sm text-on-surface-light">{t.stepsCount(ritual.steps.length)}{mins ? t.minutes(mins) : ''} · {k.label}</p>
        </div>
        <Badge variant={doneToday ? 'success' : 'neutral'} icon={doneToday ? CheckCircle2 : undefined} className="hidden sm:inline-flex">{doneToday ? t.doneToday : t.pending}</Badge>
      </div>
      {/* El jardín de piedras del ritual: una por paso */}
      <ZenGarden steps={ritual.steps.length} done={doneToday} celebrate={celebrate} seed={[...ritual.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 7} className="h-24" />
      <ol className="relative flex flex-col">
        {/* El sendero que une las piedras */}
        <span aria-hidden="true" className="pointer-events-none absolute bottom-5 left-3 top-5 border-l border-dashed border-border-strong/50" />
        {/* Cada paso en su renglón: la piedra y los minutos se alinean con la primera línea y
            un paso largo baja con su propio interlineado, sin pisar el siguiente. */}
        {ritual.steps.map((st, i) => (
          <li key={st.id} className="relative flex min-h-10 items-start gap-3 py-2">
            <motion.span
              // Las piedras se encienden una a una; al completar el ritual brillan todas juntas.
              className={cn('relative flex size-6 shrink-0 items-center justify-center rounded-[45%_55%_50%_50%] text-label-md transition-colors duration-700', doneToday ? 'bg-success text-background' : 'bg-surface-variant text-on-surface')}
              initial={{ opacity: 0.3, scale: 0.7 }}
              animate={{ opacity: 1, scale: celebrate ? [1, 1.25, 1] : 1, transition: celebrate ? { duration: 0.9, delay: 0.05 * i } : { ...springs.gentle, delay: 0.35 + i * 0.16 } }}
            >
              {(doneToday || celebrate) && <span aria-hidden="true" className="absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-success)/.4),transparent)]" />}
              <span className="relative">{i + 1}</span>
            </motion.span>
            <span className={cn('min-w-0 flex-1 text-body-md leading-6 [overflow-wrap:anywhere]', doneToday ? 'text-on-surface-light' : 'text-on-background')}>{st.title}</span>
            {st.durationMin ? <span className="shrink-0 whitespace-nowrap font-mono text-body-sm leading-6 tabular-nums text-on-surface-light">{st.durationMin} min</span> : null}
          </li>
        ))}
      </ol>
      {stats && (
        <div className="flex flex-wrap items-center gap-3 text-body-sm">
          {stats.streak > 0 && <span className="flex items-center gap-1 text-warning-text"><Flame aria-hidden className="size-4" strokeWidth={1.75} /><span className="font-mono">{stats.streak}</span> {t.streakDays}</span>}
          <span className="text-on-surface-light"><span className="font-mono">{stats.thisMonth}</span> {t.thisMonth}</span>
        </div>
      )}
      <Button variant={doneToday ? 'secondary' : 'primary'} block disabled={playing} onClick={onPlay} className="mt-auto">
        <Play aria-hidden className="size-4" strokeWidth={1.75} />{doneToday ? t.repeat : t.start}
      </Button>
    </Card>
  );
}

/** Crear ritual: nombre, tipo y pasos (título + minutos opcionales). */
export function NewRitualDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const t = useText(COPY);
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<RitualType>('morning');
  const [steps, setSteps] = useState([{ title: '', min: '' }]);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => { if (open) { setName(''); setType('morning'); setSteps([{ title: '', min: '' }]); setTried(false); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const valid = steps.filter((s) => s.title.trim());
    if (!name.trim() || valid.length === 0) { setTried(true); return; }
    setSaving(true);
    try {
      await ritualsService.createRitual({
        name: name.trim(), type,
        steps: valid.map((s, i) => ({ title: s.title.trim(), durationMin: s.min ? Number(s.min) : undefined, order: i })),
      });
      toast.success(t.created);
      onCreated();
    } catch (error) {
      // Límite de Lite: el diálogo de Pro ya explica el motivo.
      if (isProRequired(error)) onClose();
      else toast.error(t.createFailed);
    }
    finally { setSaving(false); }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={t.newRitual}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t.nameLabel} error={tried && !name.trim() ? t.nameErr : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.moment}</span>
          <SegmentedControl role="radiogroup" label={t.moment} value={type} onChange={setType}
            options={TYPE_ORDER.map((value) => ({ value, label: t.types[value] }))} />
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label-lg text-on-surface">{t.stepsLegend}</legend>
          {steps.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={t.stepLabel(i + 1)} className="flex-1" error={tried && i === 0 && !steps.some((x) => x.title.trim()) ? t.stepErr : undefined}>
                <Input value={s.title} onChange={(e) => setSteps((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={t.stepPh} />
              </Field>
              <Field label={t.minShort} className="w-20">
                <Input inputMode="numeric" value={s.min} onChange={(e) => setSteps((p) => p.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/\D/g, '').slice(0, 3) } : x)))} />
              </Field>
              <Button variant="icon" aria-label={t.removeStep(i + 1)} disabled={steps.length === 1} onClick={() => setSteps((p) => p.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="md" className="self-start" onClick={() => setSteps((p) => [...p, { title: '', min: '' }])}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />{t.addStep}
          </Button>
        </fieldset>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" size="md" loading={saving}>{t.createRitual}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

/** Hoja «Rituales» de la libreta: la lista la carga Hábitos (su separador muestra cuántos hay). */
export function RitualsSheet({ list, state, onReload, panelId, labelledBy }: {
  list: Ritual[];
  state: 'loading' | 'error' | 'ready';
  onReload: () => Promise<void>;
  panelId: string;
  labelledBy: string;
}) {
  const t = useText(COPY);
  const loading = useLoadingCopy();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);
  const [playing, setPlaying] = useState<Ritual | null>(null);
  const [creating, setCreating] = useState(false);
  // TODO(api): la API no expone si el ritual ya se hizo hoy; se marca al completarlo en esta sesión.
  const [doneIds, setDoneIds] = useState<string[]>([]);
  /** Ritual recién completado: todas sus piedras brillan y se expande la onda de calma. */
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const runnerRef = useRef<HTMLDivElement>(null);
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const activeCount = list.filter((r) => r.isActive).length;
  const atLiteLimit = lite && activeCount >= LITE_LIMITS.activeRoutines;
  const openNew = () => (atLiteLimit ? openUpgrade('routines') : setCreating(true));

  async function seed() {
    setSeeding(true);
    try { await ritualsService.seedPresets(); await onReload(); toast.success(t.seedOk); }
    catch { toast.error(t.seedFailed); }
    finally { setSeeding(false); }
  }

  const ordered = TYPE_ORDER.flatMap((type) => list.filter((r) => r.type === type));

  let content;
  if (state === 'loading') content = <PageLoader size="sm" label={t.listLoading} words={loading.habits} />;
  else if (state === 'error') content = <ErrorState title={t.listFailed} description={t.listSaved} onRetry={() => void onReload()} />;
  else if (list.length === 0) {
    content = (
      <EmptyState
        icon={Zap} tone="warning"
        title={t.emptyTitle}
        description={t.emptyBody}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={openNew}>{t.createMine}</Button>
            <Button onClick={seed} loading={seeding}><Zap aria-hidden className="size-4" strokeWidth={1.75} />{t.seedBtn}</Button>
          </div>
        }
        // Escrito a la derecha del margen rojo, como el resto de la hoja: en el móvil el texto centrado lo cruzaba.
        className="py-12 pl-[3.75rem] pr-3 md:pl-[6rem] md:pr-4"
      />
    );
  } else {
    // En móvil las bandejas tapan el margen de la hoja: así tienen todo el ancho.
    content = (
      <div className="flex flex-col gap-6 px-3 py-4 md:pl-[6rem] md:pr-4">
        {lite && (
          <LiteNotice feature="routines">
            {activeCount > LITE_LIMITS.activeRoutines
              ? t.liteOver(LITE_LIMITS.activeRoutines, activeCount)
              : t.liteCount(activeCount, LITE_LIMITS.activeRoutines, atLiteLimit)}
          </LiteNotice>
        )}
        <AnimatePresence initial={false}>
          {playing && (
            <motion.div key="runner" ref={runnerRef} variants={pop3} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.2 } }} className="scroll-mt-24">
              <Runner
                ritual={playing}
                onExit={() => setPlaying(null)}
                onDone={(msg, already) => {
                  if (already) toast.info(msg); else toast.success(msg);
                  setDoneIds((d) => [...new Set([...d, playing.id])]);
                  setCelebrating(playing.id);
                  window.setTimeout(() => setCelebrating(null), 2400);
                  setPlaying(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Una columna hasta pantallas muy anchas: en dos, títulos y pasos se partían en tres líneas. */}
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 md:gap-6 2xl:grid-cols-2">
          {ordered.map((r) => (
            <motion.li key={r.id} variants={item}>
              <RitualCard ritual={r} doneToday={doneIds.includes(r.id)} playing={playing?.id === r.id} celebrate={celebrating === r.id}
                onPlay={() => { setPlaying(r); window.setTimeout(() => runnerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }} />
            </motion.li>
          ))}
        </motion.ul>
      </div>
    );
  }

  return (
    <NotebookSheet
      id={panelId} labelledBy={labelledBy} tabbed lines={2}
      header={(
        <>
          <span className="text-body-md text-on-surface-light">{t.headerNote}</span>
          {list.length > 0 && <Button size="sm" onClick={openNew}><Plus aria-hidden className="size-4" strokeWidth={1.75} />{t.newBtn}</Button>}
        </>
      )}
    >
      {content}
      <NewRitualDialog open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void onReload(); }} />
    </NotebookSheet>
  );
}
