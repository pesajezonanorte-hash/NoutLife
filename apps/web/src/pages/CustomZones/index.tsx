// Mis zonas (ZonesDesktop): composer «El Sabio» con texto de progreso → revisión
// de la propuesta → la zona aparece con pop. Cada zona: hábitos, misiones y acciones.
// Zona ambientada: un taller de pintura. El Sabio trabaja sobre un lienzo en su
// caballete; cada zona es un cuadro enmarcado colgado de un clavo, pintado con una
// pincelada de su color que se dibuja despacio, y se mece al pasar. Elegir color
// mezcla la pintura y crear una zona la pinta con una salpicadura. La paleta es el
// selector de color de la propuesta.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen, Brain, Check, ChevronDown, Code2, Dumbbell, Flame, Heart, Leaf, MapPin, Moon, Music, NotebookPen, Plus, Sparkles, Star, Target, Trash2, Wallet,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { item, pop3, stagger } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { BrushStroke, Easel, HungFrame, PaintSplash } from '@/components/zones/Brush';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageLoader, ProgressBar, SabioComposer, SegmentedControl, SpotCard, Switch,
} from '@/components/ui/lq';

interface ZoneQuest { id: string; title: string; status: string; xpReward: number; difficulty: string }
interface ZoneHabit { id: string; title: string; currentStreak: number; icon: string; xpReward: number }
interface CustomZone {
  id: string; name: string; description?: string; icon: string; accentColor: string; isMeasurable: boolean;
  sections?: { type: string; title: string; description: string }[];
  actions?: { label: string; type: string }[];
  quests: ZoneQuest[]; habits: ZoneHabit[];
}
interface Suggestion {
  name: string; description: string; icon: string; color: string; isMeasurable: boolean; measureReason: string;
  sections: { type: string; title: string; description: string }[];
  habits: { title: string; frequency: string }[];
  actions: { label: string; type: string }[];
}

const MAX_ZONES = 10;
const ICONS: Record<string, LucideIcon> = {
  target: Target, book: BookOpen, brain: Brain, money: Wallet, heart: Heart, leaf: Leaf,
  music: Music, star: Star, gym: Dumbbell, notes: NotebookPen, code: Code2, moon: Moon,
};
const iconOf = (k: string) => ICONS[k] ?? Target;
/** Colores de acento de zona: dato de la zona (se guarda en la API), no estilo de componente. */
const ZONE_COLORS = ['#548f6f', '#b08d57', '#3a9b67', '#d4952a', '#c8463f', '#3b7ea6', '#70b48d', '#6b8a78'];
const IDEAS = [
  { label: 'Música', text: 'Quiero aprender guitarra: practicar 20 minutos al día y tocar una canción completa en 2 meses.' },
  { label: 'Idiomas', text: 'Quiero mejorar mi inglés conversacional: 15 minutos de práctica oral al día y una conversación por semana.' },
  { label: 'Meditación', text: 'Quiero meditar 10 minutos cada mañana durante 30 días y notar más calma.' },
  { label: 'Escritura', text: 'Quiero escribir un relato: 500 palabras al día hasta terminar el primer borrador.' },
];
const PROGRESS = ['Analizando tu objetivo', 'Diseñando hábitos', 'Creando misiones', 'Preparando tu zona'];
const createsHabit = (t: string) => /habit|habito|hábito|rutina/i.test(t);
const categoryOf = (t: string) => (/lesson|leccion|lección|study|estudio/i.test(t) ? 'LEARNING' : 'PERSONAL');
/** Tinte de la zona con su color de acento (variable CSS en el contenedor). */
const zoneVars = (color: string) => ({ '--zone': color }) as CSSProperties;

function ZoneIcon({ zone, size = 'md' }: { zone: { icon: string; accentColor: string }; size?: 'md' | 'lg' }) {
  const Icon = iconOf(zone.icon);
  return (
    <span style={zoneVars(zone.accentColor)}
      className={cn('lq-ichip relative flex shrink-0 items-center justify-center overflow-hidden text-[color:var(--zone)] before:absolute before:inset-0 before:bg-[var(--zone)] before:opacity-15',
        size === 'lg' ? 'size-14 rounded-2xl' : 'size-12 rounded-[14px]')}>
      <Icon aria-hidden className={cn('relative', size === 'lg' ? 'size-8' : 'size-6')} strokeWidth={1.75} />
    </span>
  );
}

function ActionForm({ action, zone, onDone }: { action: { label: string; type: string }; zone: CustomZone; onDone: () => void }) {
  const toast = useToast();
  const isHabit = createsHabit(action.type);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD'>('NORMAL');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isHabit) await api.post(`/custom-zones/${zone.id}/habits`, { title: title.trim() });
      else await api.post(`/custom-zones/${zone.id}/quests`, { title: title.trim(), type: 'SIDE', difficulty, category: categoryOf(action.type) });
      toast.success(isHabit ? 'Hábito creado en la zona' : 'Misión creada en la zona');
      setTitle('');
      onDone();
    } catch { toast.error('No se pudo crear. Inténtalo de nuevo.'); }
    finally { setSaving(false); }
  }

  return (
    <motion.form variants={pop3} initial="initial" animate="animate" onSubmit={save} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
      <Field label={isHabit ? 'Nuevo hábito' : 'Nueva misión'}>
        <Input ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={action.label} />
      </Field>
      {!isHabit && (
        <SegmentedControl label="Dificultad" value={difficulty} onChange={setDifficulty}
          options={[{ value: 'EASY', label: 'Fácil' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HARD', label: 'Difícil' }]} />
      )}
      <Button type="submit" size="md" loading={saving} disabled={!title.trim()} className="self-end">Crear</Button>
    </motion.form>
  );
}

function ZoneCard({ zone: initial, onDeleted, index = 0, fresh }: { zone: CustomZone; onDeleted: () => void; index?: number; fresh?: boolean }) {
  const toast = useToast();
  const [zone, setZone] = useState(initial);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<{ label: string; type: string } | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setZone(initial), [initial]);

  const refresh = async () => { try { setZone((await api.get<CustomZone>(`/custom-zones/${zone.id}`)).data); } catch { /* silencioso */ } };
  async function complete(id: string) {
    setCompleting(id);
    try { await api.post(`/quests/${id}/complete`); toast.success('¡Misión completada!'); await refresh(); }
    catch { toast.error('No se pudo completar la misión'); }
    finally { setCompleting(null); }
  }
  async function remove() {
    setDeleting(true);
    try { await api.delete(`/custom-zones/${zone.id}`); toast.success('Zona eliminada'); onDeleted(); }
    catch { toast.error('No se pudo eliminar la zona'); setDeleting(false); }
  }

  const done = zone.quests.filter((q) => q.status === 'COMPLETED').length;
  const pct = zone.quests.length ? Math.round((done / zone.quests.length) * 100) : 0;
  const panelId = `zone-${zone.id}`;

  return (
    <HungFrame>
    <Card as="article" interactive padding="lg" style={zoneVars(zone.accentColor)} className="lq-tex-linen relative isolate flex h-full flex-col gap-4 overflow-hidden rounded-[3px]">
      {/* La zona está pintada en el lienzo */}
      <BrushStroke seed={index} delay={fresh ? 0.1 : 0.35 + index * 0.12} />
      {fresh && <PaintSplash />}
      <div className="flex items-start gap-4">
        <ZoneIcon zone={zone} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-heading-sm">{zone.name}</h3>
          <Badge variant="success" icon={Check}>Activa</Badge>
        </div>
        <Button variant="icon" aria-label={`Eliminar ${zone.name}`} onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </div>
      {zone.description && <p className="text-body-md text-on-surface">{zone.description}</p>}
      <div className="grid grid-cols-3 gap-2">
        {[['Hábitos', zone.habits.length], ['Misiones', zone.quests.length], ['Progreso', `${pct}%`]].map(([l, v]) => (
          <Card key={l} padding="sm" className="bg-background px-3"><div className="font-mono text-heading-sm tabular-nums">{v}</div><div className="text-body-sm text-on-surface-light">{l}</div></Card>
        ))}
      </div>
      <ProgressBar value={pct} tone="success" label={`Progreso de ${zone.name}`} valueText={`${pct}%`} />
      <Button variant="secondary" block aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="mt-auto">
        {open ? 'Cerrar zona' : 'Abrir zona'}<ChevronDown aria-hidden className={cn('size-4 transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]', open && 'rotate-180')} strokeWidth={1.75} />
      </Button>
      <div id={panelId} className="lq-acc-panel" data-open={open}>
        <div>
          <div className="lq-acc-body flex flex-col gap-4 pt-2" {...({ inert: open ? undefined : '' } as object)}>
            {zone.habits.length > 0 && (
              <section className="flex flex-col gap-1">
                <h4 className="text-label-md uppercase text-on-surface-light">Hábitos</h4>
                {zone.habits.map((h) => (
                  <div key={h.id} className="flex min-h-11 items-center gap-3">
                    <span className="min-w-0 flex-1 text-body-md">{h.title}</span>
                    <span className="flex items-center gap-1 text-body-sm text-warning-text"><Flame aria-hidden className="size-4" /><span className="font-mono">{h.currentStreak}</span></span>
                  </div>
                ))}
              </section>
            )}
            {zone.quests.length > 0 && (
              <section className="flex flex-col gap-1">
                <h4 className="text-label-md uppercase text-on-surface-light">Misiones</h4>
                {zone.quests.map((q) => {
                  const isDone = q.status === 'COMPLETED';
                  return (
                    <div key={q.id} className="flex min-h-11 items-center gap-3">
                      <span className={cn('min-w-0 flex-1 text-body-md', isDone && 'text-on-surface-light line-through')}>{q.title}</span>
                      <span className="font-mono text-body-sm text-primary-text">+{q.xpReward} XP</span>
                      {!isDone && (
                        <Button variant="icon" aria-label={`Completar ${q.title}`} disabled={completing === q.id} onClick={() => void complete(q.id)}>
                          <Check aria-hidden className="size-5" strokeWidth={2} />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
            {(zone.actions?.length ?? 0) > 0 && (
              <section className="flex flex-col gap-2">
                <h4 className="text-label-md uppercase text-on-surface-light">Acciones</h4>
                <div className="flex flex-wrap gap-2">
                  {zone.actions!.map((a) => {
                    const on = action?.label === a.label && action?.type === a.type;
                    return <Button key={a.label + a.type} size="sm" variant={on ? 'primary' : 'secondary'} aria-pressed={on} onClick={() => setAction(on ? null : a)}><Plus aria-hidden className="size-4" />{a.label}</Button>;
                  })}
                </div>
                <AnimatePresence initial={false}>
                  {action && <ActionForm key={action.label} action={action} zone={zone} onDone={() => { setAction(null); void refresh(); }} />}
                </AnimatePresence>
              </section>
            )}
          </div>
        </div>
      </div>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`¿Eliminar «${zone.name}»?`}>
        <p className="text-body-md text-on-surface">Se borrarán la zona y su configuración. Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={deleting} onClick={remove}>Eliminar</Button>
        </div>
      </Modal>
    </Card>
    </HungFrame>
  );
}

/** Revisión de la propuesta del Sabio antes de crear la zona. */
function Review({ s, onCancel, onCreated }: { s: Suggestion; onCancel: () => void; onCreated: (z: CustomZone) => void }) {
  const toast = useToast();
  const [name, setName] = useState(s.name);
  const [color, setColor] = useState(ZONE_COLORS.includes(s.color) ? s.color : ZONE_COLORS[0]);
  const [measurable, setMeasurable] = useState(s.isMeasurable);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);
    try {
      const { data } = await api.post<CustomZone>('/custom-zones', {
        name: name.trim() || s.name, description: s.description, icon: s.icon, accentColor: color, isMeasurable: measurable,
        sections: s.sections, actions: s.actions,
      });
      toast.success(`Zona «${name}» creada`);
      onCreated(data);
    } catch { toast.error('No se pudo crear la zona'); setSaving(false); }
  }

  return (
    <motion.div variants={pop3} initial="initial" animate="animate" className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="relative">
          {/* La pintura se mezcla al cambiar de color (--zone registrada como color) */}
          <span aria-hidden="true" style={zoneVars(color)} className="lq-mix absolute -inset-3 rounded-[40%_60%_55%_45%] bg-[var(--zone)] opacity-20 blur-[2px]" />
          <ZoneIcon zone={{ icon: s.icon, accentColor: color }} size="lg" />
        </span>
        <div className="min-w-0 flex-1"><span className="text-label-lg text-primary-text">Propuesta del Sabio</span><p className="text-body-md text-on-surface">{s.description}</p></div>
      </div>
      <Field label="Nombre de la zona"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Color</legend>
        <div role="radiogroup" aria-label="Color de la zona" className="flex flex-wrap gap-2">
          {ZONE_COLORS.map((c, i) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Color ${i + 1}`} onClick={() => setColor(c)}
              style={{ background: c }}
              className={cn('size-11 rounded-[46%_54%_50%_50%] border-2 transition-transform duration-500 ease-[var(--lq-ease-heavy)] hover:-rotate-6 hover:scale-105', color === c ? 'scale-110 border-on-background' : 'border-transparent')} />
          ))}
        </div>
      </fieldset>
      {s.sections.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {s.sections.map((sec) => <li key={sec.title} className="rounded-xl border border-border bg-background p-3"><div className="text-label-lg">{sec.title}</div><div className="text-body-sm text-on-surface-light">{sec.description}</div></li>)}
        </ul>
      )}
      <div className="flex items-center gap-4 rounded-xl bg-surface-variant p-3">
        <div className="flex-1"><label htmlFor="z-measure" className="text-label-lg">Zona medible</label><p className="text-body-sm text-on-surface-light">{s.measureReason}</p></div>
        <Switch id="z-measure" checked={measurable} onChange={(e) => setMeasurable(e.target.checked)} />
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Volver</Button>
        <Button onClick={create} loading={saving}><Sparkles aria-hidden className="size-4" strokeWidth={1.75} />Crear zona</Button>
      </div>
    </motion.div>
  );
}

export default function CustomZonesPage() {
  const toast = useToast();
  const [zones, setZones] = useState<CustomZone[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  /** Zona recién creada: el pincel la pinta con salpicadura. */
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try { setZones((await api.get<CustomZone[]>('/custom-zones')).data); setState('ready'); }
    catch { if (!silent) setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setStep((s) => s + 1), 900);
    return () => window.clearInterval(id);
  }, [busy]);

  async function ask() {
    if (!text.trim()) return;
    setBusy(true); setStep(0);
    try { setSuggestion((await api.post<Suggestion>('/custom-zones/suggest', { description: text.trim() })).data); }
    catch { toast.error('El Sabio no pudo proponer la zona. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={() => void load()} />;
  const full = zones.length >= MAX_ZONES;

  return (
    <ZoneShell
      zone="custom-zones"
      contentClassName="gap-8 md:gap-12"
      ambience={<span className="lq-tex-linen absolute inset-0 block opacity-60 [mask-image:radial-gradient(120%_70%_at_50%_0%,#000_30%,transparent_75%)]" />}
    >
      <PageHeader
        eyebrow="Mis zonas"
        title="Crea tu propio espacio"
        description="Describe lo que quieres trabajar y El Sabio construye una zona a tu medida, con hábitos, misiones y métricas."
        aside={<Badge size="lg"><span className="font-mono">{zones.length}/{MAX_ZONES}</span> zonas activas</Badge>}
      />

      <motion.div variants={item}>
        {/* El lienzo de El Sabio, sobre su caballete */}
        <Easel className="mx-auto w-full max-w-5xl">
        <SpotCard aria-label="El Sabio" className="lq-canvas lq-tex-linen">
          <AnimatePresence mode="wait">
            {suggestion ? (
              <motion.div key="review" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                <Review s={suggestion} onCancel={() => setSuggestion(null)} onCreated={(z) => { setSuggestion(null); setText(''); setFresh(z.id); setZones((p) => [z, ...p]); void load(true); }} />
              </motion.div>
            ) : (
              <motion.div key="compose" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                {full ? (
                  <p className="text-body-md text-on-surface">Tienes el máximo de {MAX_ZONES} zonas. Elimina una para crear otra.</p>
                ) : (
                  <SabioComposer
                    subtitle="Cuéntale qué zona quieres crear"
                    value={text} onChange={setText} ideas={IDEAS} busy={busy}
                    progressText={PROGRESS[step % PROGRESS.length]}
                    submitLabel="Crear zona" onSubmit={ask}
                    placeholder="Ej. Quiero aprender guitarra: practicar 20 minutos al día y tocar una canción completa en 2 meses."
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </SpotCard>
        </Easel>
      </motion.div>

      <motion.section variants={item} className="flex flex-col gap-6" aria-labelledby="z-list">
        <h2 id="z-list" className="text-heading-lg">Tus zonas</h2>
        {zones.length === 0 ? (
          <EmptyState icon={MapPin} tone="muted" title="Aún no tienes zonas personalizadas" description="Escribe una idea arriba o elige una sugerencia para crear la primera." />
        ) : (
          <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-8 xl:grid-cols-3">
            {zones.map((z, i) => (
              <motion.li key={z.id} variants={item} layout="position">
                <ZoneCard zone={z} index={i} fresh={fresh === z.id} onDeleted={() => setZones((p) => p.filter((x) => x.id !== z.id))} />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </motion.section>
    </ZoneShell>
  );
}
