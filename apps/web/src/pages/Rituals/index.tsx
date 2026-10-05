// Rituales (RitualsDesktop): tarjetas con pasos numerados, modo guiado paso a paso
// (anillo + cronómetro por paso) y estado vacío «Cargar rituales sugeridos».
// Zona ambientada: un lugar de paz. Los pasos son un camino de piedras que se
// encienden una a una; en el modo guiado cada paso hecho se ilumina con una onda
// como en el agua y hay un círculo para respirar. Completar el ritual entero
// enciende todas las piedras a la vez y expande una onda de calma.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Flame, Moon, Play, Plus, Sun, Trash2, X, Zap, type LucideIcon } from 'lucide-react';
import { item, pop3, springs, stagger } from '@/lib/motion';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { BreathCircle, StonePath } from '@/components/rituals/StonePath';
import { cn } from '@/lib/utils';
import * as ritualsService from '@/services/rituals.service';
import type { Ritual } from '@/services/rituals.service';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/useToast';
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, IconChip, Input, PageLoader, ProgressRing, ResponsiveDialog,
  SegmentedControl, SpotCard, Timer, type Tone,
} from '@/components/ui/lq';

type RitualType = Ritual['type'];
const TYPES: Record<RitualType, { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon }> = {
  morning: { label: 'Mañana', tone: 'warning', icon: Sun },
  night: { label: 'Noche', tone: 'forest', icon: Moon },
  custom: { label: 'Personal', tone: 'primary', icon: Zap },
};
const typeOf = (t: string) => TYPES[t as RitualType] ?? TYPES.custom;
const minutes = (r: Ritual) => r.steps.reduce((s, st) => s + (st.durationMin ?? 0), 0);

/** Modo guiado: paso actual con anillo de progreso y cronómetro si el paso tiene duración. */
function Runner({ ritual, onExit, onDone }: { ritual: Ritual; onExit: () => void; onDone: (msg: string, already: boolean) => void }) {
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
    } catch { toast.error('No se pudo completar el ritual'); }
    finally { setBusy(false); }
  }

  const k = typeOf(ritual.type);
  return (
    <SpotCard aria-label="Ritual en curso" className="flex flex-wrap items-center gap-8 border-primary/25 md:gap-10">
      <ProgressRing value={((idx + 1) / ritual.steps.length) * 100} size={180} stroke={8} label="Progreso del ritual" valueText={`Paso ${idx + 1} de ${ritual.steps.length}`}>
        <span className="font-mono text-display-sm tabular-nums">{idx + 1}/{ritual.steps.length}</span>
        <span className="text-body-sm text-on-surface-light">pasos</span>
      </ProgressRing>
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3" aria-live="polite">
        <StonePath total={ritual.steps.length} current={idx} />
        <span className="text-label-lg text-primary-text">{ritual.name} · paso {idx + 1}</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.h2 key={step?.id} ref={titleRef} tabIndex={-1} variants={pop3} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="text-display-sm outline-none">{step?.title}</motion.h2>
        </AnimatePresence>
        {total > 0 ? (
          <div className="flex items-center gap-3">
            <Timer seconds={Math.max(0, total - elapsed)} size="lg" label="Tiempo restante del paso" className={cn(elapsed >= total && 'text-success-text')} />
            {elapsed >= total && <Badge variant="success" icon={CheckCircle2}>Tiempo cumplido</Badge>}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <BreathCircle />
            <p className="text-body-lg text-on-surface-light">Sin tiempo fijo: respira con el círculo y márcalo cuando lo termines.</p>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onExit}><X aria-hidden className="size-4" strokeWidth={1.75} />Salir</Button>
          <Button onClick={next} loading={busy}>
            {last ? <><CheckCircle2 aria-hidden className="size-4" strokeWidth={1.75} />Terminar</> : <>Siguiente paso<ChevronRight aria-hidden className="size-4" strokeWidth={1.75} /></>}
          </Button>
        </div>
      </div>
      <Badge variant={k.tone} icon={k.icon} className="self-start">{k.label}</Badge>
    </SpotCard>
  );
}

function RitualCard({ ritual, doneToday, playing, onPlay, celebrate }: { ritual: Ritual; doneToday: boolean; playing: boolean; onPlay: () => void; celebrate?: boolean }) {
  const k = typeOf(ritual.type);
  const [stats, setStats] = useState<{ streak: number; thisMonth: number } | null>(null);
  useEffect(() => {
    ritualsService.getRitualStats(ritual.id).then((s) => setStats({ streak: s.streak, thisMonth: s.thisMonth })).catch(() => null);
  }, [ritual.id]);
  const mins = minutes(ritual);
  return (
    <Card as="article" interactive padding="lg" className="relative flex h-full flex-col gap-5 overflow-hidden">
      {/* Ritual completo: una onda de calma se expande desde el camino */}
      {celebrate && <span key="calm" aria-hidden="true" className="lq-calm-wave pointer-events-none absolute left-8 top-1/2 block size-80 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-success/50 bg-[radial-gradient(closest-side,rgb(var(--lq-success)/.16),transparent)]" />}
      <div className="flex items-start gap-4">
        <IconChip icon={k.icon} tone={k.tone} />
        <div className="min-w-0 flex-1">
          <h2 className="text-heading-sm">{ritual.name}</h2>
          <p className="text-body-sm text-on-surface-light">{ritual.steps.length} pasos{mins ? ` · ${mins} min` : ''} · {k.label}</p>
        </div>
        <Badge variant={doneToday ? 'success' : 'neutral'} icon={doneToday ? CheckCircle2 : undefined}>{doneToday ? 'Hecho hoy' : 'Pendiente'}</Badge>
      </div>
      <ol className="relative flex flex-col">
        {/* El sendero que une las piedras */}
        <span aria-hidden="true" className="pointer-events-none absolute bottom-5 left-3 top-5 border-l border-dashed border-border-strong/50" />
        {ritual.steps.map((st, i) => (
          <li key={st.id} className="relative flex min-h-10 items-center gap-3">
            <motion.span
              // Las piedras se encienden una a una; al completar el ritual brillan todas juntas.
              className={cn('relative flex size-6 shrink-0 items-center justify-center rounded-[45%_55%_50%_50%] text-label-md transition-colors duration-700', doneToday ? 'bg-success text-background' : 'bg-surface-variant text-on-surface')}
              initial={{ opacity: 0.3, scale: 0.7 }}
              animate={{ opacity: 1, scale: celebrate ? [1, 1.25, 1] : 1, transition: celebrate ? { duration: 0.9, delay: 0.05 * i } : { ...springs.gentle, delay: 0.35 + i * 0.16 } }}
            >
              {(doneToday || celebrate) && <span aria-hidden="true" className="absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-success)/.4),transparent)]" />}
              <span className="relative">{i + 1}</span>
            </motion.span>
            <span className={cn('min-w-0 flex-1 text-body-md', doneToday ? 'text-on-surface-light' : 'text-on-background')}>{st.title}</span>
            {st.durationMin ? <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{st.durationMin} min</span> : null}
          </li>
        ))}
      </ol>
      {stats && (
        <div className="flex flex-wrap items-center gap-3 text-body-sm">
          {stats.streak > 0 && <span className="flex items-center gap-1 text-warning-text"><Flame aria-hidden className="size-4" strokeWidth={1.75} /><span className="font-mono">{stats.streak}</span> días de racha</span>}
          <span className="text-on-surface-light"><span className="font-mono">{stats.thisMonth}</span> este mes</span>
        </div>
      )}
      <Button variant={doneToday ? 'secondary' : 'primary'} block disabled={playing} onClick={onPlay} className="mt-auto">
        <Play aria-hidden className="size-4" strokeWidth={1.75} />{doneToday ? 'Repetir' : 'Comenzar'}
      </Button>
    </Card>
  );
}

/** Crear ritual: nombre, tipo y pasos (título + minutos opcionales). */
function NewRitualDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
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
      toast.success('Ritual creado');
      onCreated();
    } catch { toast.error('No se pudo crear el ritual'); }
    finally { setSaving(false); }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Nuevo ritual">
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Nombre" error={tried && !name.trim() ? 'Ponle un nombre' : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ritual de enfoque" />
        </Field>
        <div className="flex flex-col gap-2">
          <span id="rt-type" className="text-label-lg text-on-surface">Momento</span>
          <SegmentedControl role="radiogroup" label="Momento" value={type} onChange={setType}
            options={(Object.keys(TYPES) as RitualType[]).map((t) => ({ value: t, label: TYPES[t].label }))} />
        </div>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-label-lg text-on-surface">Pasos</legend>
          {steps.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={`Paso ${i + 1}`} className="flex-1" error={tried && i === 0 && !steps.some((x) => x.title.trim()) ? 'Añade al menos un paso' : undefined}>
                <Input value={s.title} onChange={(e) => setSteps((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Ej. Vaso de agua" />
              </Field>
              <Field label="Min" className="w-20">
                <Input inputMode="numeric" value={s.min} onChange={(e) => setSteps((p) => p.map((x, j) => (j === i ? { ...x, min: e.target.value.replace(/\D/g, '').slice(0, 3) } : x)))} />
              </Field>
              <Button variant="icon" aria-label={`Quitar paso ${i + 1}`} disabled={steps.length === 1} onClick={() => setSteps((p) => p.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="md" className="self-start" onClick={() => setSteps((p) => [...p, { title: '', min: '' }])}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />Añadir paso
          </Button>
        </fieldset>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="md" loading={saving}>Crear ritual</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

export default function RitualsPage() {
  const toast = useToast();
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [seeding, setSeeding] = useState(false);
  const [playing, setPlaying] = useState<Ritual | null>(null);
  const [creating, setCreating] = useState(false);
  // TODO(api): la API no expone si el ritual ya se hizo hoy; se marca al completarlo en esta sesión.
  const [doneIds, setDoneIds] = useState<string[]>([]);
  /** Ritual recién completado: todas sus piedras brillan y se expande la onda de calma. */
  const [celebrating, setCelebrating] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try { setRituals(await ritualsService.listRituals()); setState('ready'); }
    catch { if (!silent) setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function seed() {
    setSeeding(true);
    try { await ritualsService.seedPresets(); await load(true); toast.success('Rituales sugeridos listos'); }
    catch { toast.error('No se pudieron cargar los sugeridos'); }
    finally { setSeeding(false); }
  }

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={() => void load()} />;

  const ordered = (['morning', 'custom', 'night'] as RitualType[]).flatMap((t) => rituals.filter((r) => r.type === t));

  return (
    <ZoneShell
      zone="rituals"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        // Un gradiente que se mueve muy despacio.
        <span className="lq-amb-wander absolute -left-[15%] top-[-10%] block h-[40rem] w-[70%] [--d:40s]">
          <AmbientLight tone="info" alpha={0.1} darkAlpha={0.06} d={20} className="inset-0" />
          <AmbientLight tone="jade-300" alpha={0.18} darkAlpha={0.05} d={26} className="inset-[20%]" />
        </span>
      )}
    >
      <PageHeader
        eyebrow="Rituales"
        title="Secuencias que te construyen"
        description="Pasos encadenados que ejecutas cada día. Uno detrás de otro, sin pensar."
        aside={<Button onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" strokeWidth={1.75} />Nuevo ritual</Button>}
      />

      {rituals.length === 0 ? (
        <motion.div variants={item}>
          <EmptyState
            icon={Zap} tone="warning"
            title="Sin rituales todavía"
            description="Los rituales son secuencias de pasos que ejecutas cada día. Empieza con los sugeridos o crea los tuyos."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" onClick={() => setCreating(true)}>Crear el mío</Button>
                <Button onClick={seed} loading={seeding}><Zap aria-hidden className="size-4" strokeWidth={1.75} />Cargar rituales sugeridos</Button>
              </div>
            }
          />
        </motion.div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {playing && (
              <motion.div key="runner" variants={pop3} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
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
          <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {ordered.map((r) => (
              <motion.li key={r.id} variants={item}>
                <RitualCard ritual={r} doneToday={doneIds.includes(r.id)} playing={playing?.id === r.id} celebrate={celebrating === r.id}
                  onPlay={() => { setPlaying(r); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}

      <NewRitualDialog open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load(true); }} />
    </ZoneShell>
  );
}
