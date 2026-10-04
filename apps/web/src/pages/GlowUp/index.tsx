// Glow up — GlowUpDesktop.dc.html. "Brillo de hoy" (anillo), SegmentedControl
// Cuidado / Estilo / Presencia, rutinas con pasos que se marcan, armario con
// filtros y autoevaluación semanal. Datos: /mirror/* (sin cambios).
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Droplets, Flame, Moon, Plus, Shirt, Sparkles, Star, Sun, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { useToastStore } from '../../hooks/useToast';
import api from '../../lib/api';
import { Badge, Button, Card, ChipGroup, EmptyState, ErrorState, Field, IconChip, Input, Modal, ProgressBar, ProgressRing, Select, SegmentedControl, StepItem, Textarea, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CareRoutine {
  id: string; name: string; timeOfDay: string;
  currentStreak: number; longestStreak: number; lastDoneAt?: string;
  steps: { id: string; name: string; product?: string; order: number }[];
}

interface ClothingItem {
  id: string; name: string; category: string; color?: string;
  brand?: string; cost?: number; timesWorn: number; isFavorite: boolean;
}

interface PresenceCheckin {
  id: string; week: string;
  posture: number; voice: number; confidence: number; communication: number;
}

type Tab = 'care' | 'style' | 'presence';
const TABS = [
  { value: 'care' as const, label: 'Cuidado personal' },
  { value: 'style' as const, label: 'Estilo' },
  { value: 'presence' as const, label: 'Presencia' },
];

const CATEGORIES = ['tops', 'bottoms', 'shoes', 'outerwear', 'accessories'];
const CATEGORY_LABELS: Record<string, string> = {
  tops: 'Camisas y tops', bottoms: 'Pantalones', shoes: 'Zapatos', outerwear: 'Abrigos', accessories: 'Accesorios',
};
const TIME_OF_DAY = ['morning', 'night', 'weekly', 'custom'];
const TIME_META: Record<string, { label: string; tone: Tone; icon: typeof Sun }> = {
  morning: { label: 'Mañana', tone: 'warning', icon: Sun },
  night: { label: 'Noche', tone: 'forest', icon: Moon },
  weekly: { label: 'Semanal', tone: 'info', icon: Droplets },
  custom: { label: 'Personalizada', tone: 'primary', icon: Sparkles },
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

// TODO(api): no hay endpoint para marcar pasos sueltos; se guardan en el dispositivo
// por día y, al completar todos, se llama a /mirror/routines/:id/complete.
const STEPS_KEY = 'lq-glow-steps';
function readSteps(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(STEPS_KEY) ?? '{}');
    return raw.day === todayKey() ? raw.done ?? {} : {};
  } catch { return {}; }
}
function writeSteps(done: Record<string, boolean>) {
  try { localStorage.setItem(STEPS_KEY, JSON.stringify({ day: todayKey(), done })); } catch { /* sin storage */ }
}

// ─── Care Section ────────────────────────────────────────────────────────────

interface CareProps { onProgress: (done: number, total: number, streak: number) => void }

function CareSection({ onProgress }: CareProps) {
  const toast = useToastStore();
  const [routines, setRoutines] = useState<CareRoutine[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', timeOfDay: 'morning', steps: [''] });
  const [completing, setCompleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ticks, setTicks] = useState<Record<string, boolean>>(readSteps);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const { data } = await api.get('/mirror/routines');
      setRoutines(data);
      setState('ready');
    } catch {
      if (!silent) setState('error');
      else toast.error('Error cargando rutinas');
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const doneOf = useCallback((r: CareRoutine) => (
    isToday(r.lastDoneAt) ? r.steps.length : r.steps.filter((s) => ticks[`${r.id}:${s.id}`]).length
  ), [ticks]);

  useEffect(() => {
    const total = routines.reduce((a, r) => a + r.steps.length, 0);
    const done = routines.reduce((a, r) => a + doneOf(r), 0);
    onProgress(done, total, Math.max(0, ...routines.map((r) => r.currentStreak)));
  }, [routines, doneOf, onProgress]);

  async function handleComplete(id: string) {
    setCompleting(id);
    try {
      const { data } = await api.post(`/mirror/routines/${id}/complete`);
      if (data.alreadyDone) toast.info('¡Ya completaste esta rutina hoy!');
      else { toast.success('¡Rutina completada! +20 XP'); void load(true); }
    } catch { toast.error('No se pudo completar la rutina'); }
    finally { setCompleting(null); }
  }

  function toggleStep(r: CareRoutine, stepId: string) {
    if (isToday(r.lastDoneAt)) return;
    const key = `${r.id}:${stepId}`;
    const next = { ...ticks, [key]: !ticks[key] };
    setTicks(next);
    writeSteps(next);
    if (r.steps.every((s) => next[`${r.id}:${s.id}`])) void handleComplete(r.id);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post('/mirror/routines', {
        name: form.name,
        timeOfDay: form.timeOfDay,
        steps: form.steps.filter(Boolean).map((s, i) => ({ name: s, order: i })),
      });
      setShowNew(false);
      setForm({ name: '', timeOfDay: 'morning', steps: [''] });
      void load(true);
      toast.success('Rutina creada');
    } catch { toast.error('No se pudo crear la rutina'); }
    finally { setSaving(false); }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="glow-care">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="glow-care" className="text-heading-lg">Tus rutinas de cuidado</h2>
        <div className="flex items-center gap-3">
          <span className="hidden text-body-sm text-on-surface-light sm:inline">Toca un paso para marcarlo</span>
          <Button size="md" onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />Nueva rutina</Button>
        </div>
      </div>

      {state === 'loading' ? (
        <PageLoader label="Preparando tus rituales…" words={LOADING_COPY.glowUpRoutines} />
      ) : state === 'error' ? (
        <ErrorState title="No pudimos cargar tus rutinas" onRetry={() => void load()} />
      ) : routines.length === 0 ? (
        <Card variant="elevated" padding="lg">
          <EmptyState icon={Droplets} tone="forest" title="Sin rutinas aún" description="Crea tu primera rutina de cuidado y marca sus pasos cada día."
            action={<Button onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />Nueva rutina</Button>} className="py-6" />
        </Card>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {routines.map((r) => {
            const meta = TIME_META[r.timeOfDay] ?? TIME_META.custom;
            const n = doneOf(r);
            const full = r.steps.length > 0 && n === r.steps.length;
            const pct = r.steps.length ? Math.round((n / r.steps.length) * 100) : isToday(r.lastDoneAt) ? 100 : 0;
            return (
              <motion.li key={r.id} variants={item}>
                <Card as="article" padding="lg" interactive aria-labelledby={`r-${r.id}`} className="flex h-full flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <IconChip icon={meta.icon} tone={meta.tone} />
                    <div className="min-w-0 flex-1">
                      <h3 id={`r-${r.id}`} className="truncate text-heading-sm">{r.name}</h3>
                      <p className="text-body-sm text-on-surface-light">
                        {meta.label}
                        {r.currentStreak > 0 && <span className="ml-2 inline-flex items-center gap-1 text-warning-text"><Flame aria-hidden className="size-3.5" /><span className="font-mono tabular-nums">{r.currentStreak}</span> {r.currentStreak === 1 ? 'día' : 'días'}</span>}
                      </p>
                    </div>
                    {r.steps.length > 0 && <Badge variant={full ? 'success' : 'neutral'} icon={full ? Check : undefined}><span className="font-mono tabular-nums">{n}/{r.steps.length}</span></Badge>}
                  </div>
                  <ProgressBar value={pct} tone={full ? 'success' : 'primary'} label={`Progreso de ${r.name}`} />
                  {r.steps.length > 0 && (
                    <div className="flex flex-col">
                      {[...r.steps].sort((a, b) => a.order - b.order).map((s) => (
                        <StepItem key={s.id} checked={isToday(r.lastDoneAt) || !!ticks[`${r.id}:${s.id}`]} onToggle={() => toggleStep(r, s.id)} disabled={completing === r.id || isToday(r.lastDoneAt)} meta={s.product}>
                          {s.name}
                        </StepItem>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    {isToday(r.lastDoneAt) ? (
                      <Badge variant="success" size="lg" icon={Check}>Completada hoy</Badge>
                    ) : (
                      <Button variant="secondary" size="md" block loading={completing === r.id} onClick={() => void handleComplete(r.id)}>
                        <Check aria-hidden className="size-4" />Marcar rutina completa
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva rutina">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <Field label="Nombre de la rutina"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Rutina de mañana" autoFocus /></Field>
          <Field label="Momento">
            <Select value={form.timeOfDay} onChange={(e) => setForm((f) => ({ ...f, timeOfDay: e.target.value }))}>
              {TIME_OF_DAY.map((t) => <option key={t} value={t}>{TIME_META[t].label}</option>)}
            </Select>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-lg text-on-surface">Pasos</legend>
            {form.steps.map((s, i) => (
              <Input key={i} aria-label={`Paso ${i + 1}`} placeholder={`Paso ${i + 1}…`} value={s}
                onChange={(e) => setForm((f) => { const steps = [...f.steps]; steps[i] = e.target.value; return { ...f, steps }; })} />
            ))}
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, ''] }))}><Plus aria-hidden className="size-4" />Agregar paso</Button>
          </fieldset>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!form.name.trim()} loading={saving}>Crear</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

// ─── Style Section ────────────────────────────────────────────────────────────

function StyleSection() {
  const toast = useToastStore();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'tops', color: '', brand: '', cost: '' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const { data } = await api.get('/mirror/wardrobe');
      setItems(data);
      setState('ready');
    } catch {
      if (!silent) setState('error');
      else toast.error('No se pudo actualizar el armario');
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const displayed = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const options = useMemo(() => [
    { value: 'all', label: 'Todas', count: items.length },
    ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], count: items.filter((i) => i.category === c).length })),
  ], [items]);

  async function handleCreate() {
    setSaving(true);
    try {
      await api.post('/mirror/wardrobe', { ...form, cost: form.cost ? Number(form.cost) : undefined });
      setShowNew(false);
      setForm({ name: '', category: 'tops', color: '', brand: '', cost: '' });
      void load(true);
      toast.success('Prenda añadida');
    } catch { toast.error('No se pudo añadir la prenda'); }
    finally { setSaving(false); }
  }

  async function handleWorn(id: string) {
    try { await api.post(`/mirror/wardrobe/${id}/worn`); void load(true); } catch { toast.error('No se pudo registrar el uso'); }
  }

  async function handleDelete(id: string) {
    try { await api.delete(`/mirror/wardrobe/${id}`); void load(true); } catch { toast.error('No se pudo eliminar la prenda'); }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="glow-style">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="glow-style" className="text-heading-lg">Armario cápsula</h2>
        <Button size="md" onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />Prenda</Button>
      </div>
      {/* TODO(api): el prototipo incluye "Outfits de la semana"; no existe endpoint de outfits. */}
      <ChipGroup label="Categoría de prenda" options={options} value={activeCategory} onChange={setActiveCategory} />

      {state === 'loading' ? (
        <PageLoader label="Abriendo tu armario…" words={LOADING_COPY.glowUpWardrobe} />
      ) : state === 'error' ? (
        <ErrorState title="No pudimos cargar tu armario" onRetry={() => void load()} />
      ) : displayed.length === 0 ? (
        <Card variant="elevated" padding="lg">
          <EmptyState icon={Shirt} tone="info" title="Tu armario está vacío" description="Añade tus prendas para saber cuánto uso le das a cada una."
            action={<Button onClick={() => setShowNew(true)}><Plus aria-hidden className="size-4" />Añadir prenda</Button>} className="py-6" />
        </Card>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {displayed.map((it) => (
            <motion.li key={it.id} variants={item}>
              <Card as="article" padding="sm" interactive className="flex h-full flex-col gap-2">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="min-w-0 truncate text-label-lg">{it.name}</h3>
                  <Button variant="icon" size="sm" aria-label={`Eliminar ${it.name}`} onClick={() => void handleDelete(it.id)} className="-mr-2 -mt-2 size-11 md:size-9">
                    <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                  </Button>
                </div>
                <p className="text-body-sm text-on-surface">{CATEGORY_LABELS[it.category] ?? it.category}</p>
                {it.brand && <p className="text-body-sm text-on-surface-light">{it.brand}</p>}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body-sm text-on-surface-light">
                    <span className="font-mono tabular-nums">{it.timesWorn}</span> {it.timesWorn === 1 ? 'uso' : 'usos'}
                    {it.cost && it.timesWorn > 0 ? <> · <span className="font-mono tabular-nums">${Math.round(Number(it.cost) / it.timesWorn).toLocaleString('es-CO')}</span>/uso</> : null}
                  </p>
                  {it.isFavorite && <Star aria-label="Favorita" className="size-4 shrink-0 fill-warning text-warning" />}
                </div>
                <Button variant="secondary" size="sm" block className="mt-auto" onClick={() => void handleWorn(it.id)}>Usar hoy</Button>
              </Card>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nueva prenda">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <Field label="Nombre"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Camiseta azul" autoFocus /></Field>
          <Field label="Categoría">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca"><Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Zara, Nike…" /></Field>
            <Field label="Color"><Input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Azul marino" /></Field>
          </div>
          <Field label="Precio (COP)"><Input type="number" inputMode="numeric" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} placeholder="50000" /></Field>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!form.name.trim()} loading={saving}>Añadir</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

// ─── Presence Section ─────────────────────────────────────────────────────────

const AREAS = [
  { key: 'posture', label: 'Postura' },
  { key: 'voice', label: 'Voz' },
  { key: 'confidence', label: 'Confianza' },
  { key: 'communication', label: 'Comunicación' },
] as const;

function Rating({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="flex w-full items-center justify-between text-label-lg">
        <span>{label}</span><span className="font-mono tabular-nums text-primary-text">{value}/5</span>
      </legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v} type="button" role="radio" aria-checked={value === v} aria-label={`${v} de 5`} onClick={() => onChange(v)}
            className={cn('min-h-11 rounded-md font-mono text-label-lg tabular-nums transition-colors', value >= v ? 'bg-primary-strong text-on-primary' : 'bg-surface-variant text-on-surface hover:bg-border')}
          >{v}</button>
        ))}
      </div>
    </fieldset>
  );
}

function PresenceSection() {
  const toast = useToastStore();
  const [checkins, setCheckins] = useState<PresenceCheckin[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [form, setForm] = useState({ posture: 3, voice: 3, confidence: 3, communication: 3, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const { data } = await api.get('/mirror/checkins');
      setCheckins(data);
      setState('ready');
    } catch { if (!silent) setState('error'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const week = new Date();
      week.setHours(0, 0, 0, 0);
      week.setDate(week.getDate() - week.getDay());
      await api.post('/mirror/checkins', { week: week.toISOString(), ...form });
      toast.success('Autoevaluación guardada');
      void load(true);
    } catch { toast.error('No se pudo guardar la evaluación'); }
    finally { setSaving(false); }
  }

  let history: ReactNode = null;
  if (state === 'loading') history = <PageLoader label="Cargando tu evolución…" words={LOADING_COPY.glowUpRoutines} size="sm" />;
  else if (state === 'error') history = <ErrorState title="No pudimos cargar tu evolución" onRetry={() => void load()} />;
  else if (checkins.length === 0) history = <EmptyState icon={Sparkles} tone="forest" title="Tu presencia empieza aquí" description="Guarda tu primera autoevaluación para ver cómo evolucionas semana a semana." className="py-4" />;
  else history = (
    <ul className="flex flex-col">
      {checkins.slice(0, 6).map((c) => {
        const avg = Math.round((c.posture + c.voice + c.confidence + c.communication) / 4 * 20);
        return (
          <li key={c.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-0">
            <span className="w-16 shrink-0 text-body-sm text-on-surface-light">{new Date(c.week).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}</span>
            <div className="grid flex-1 grid-cols-4 gap-1 text-center">
              {AREAS.map((a) => (
                <div key={a.key}>
                  <div className="font-mono text-label-lg tabular-nums text-primary-text">{c[a.key]}</div>
                  <div className="text-label-md text-on-surface-light">{a.label.slice(0, 3)}</div>
                </div>
              ))}
            </div>
            <Badge variant={avg >= 60 ? 'success' : 'warning'}><span className="font-mono tabular-nums">{avg}%</span></Badge>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-labelledby="glow-presence">
      <Card as="form" padding="lg" className="flex flex-col gap-5" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void handleSave(); }}>
        <h2 id="glow-presence" className="text-heading-lg">Autoevaluación semanal</h2>
        {AREAS.map((a) => <Rating key={a.key} label={a.label} value={form[a.key]} onChange={(v) => setForm((f) => ({ ...f, [a.key]: v }))} />)}
        <Field label="Notas de la semana"><Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Qué te funcionó esta semana…" /></Field>
        <Button type="submit" loading={saving}>Guardar evaluación</Button>
      </Card>
      <Card as="section" padding="lg" aria-labelledby="glow-evol" className="flex flex-col gap-3">
        <h2 id="glow-evol" className="text-heading-lg">Evolución</h2>
        {history}
      </Card>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GlowUpPage() {
  const [tab, setTab] = useState<Tab>('care');
  const [progress, setProgress] = useState({ done: 0, total: 0, streak: 0 });
  const onProgress = useCallback((done: number, total: number, streak: number) => {
    setProgress((p) => (p.done === done && p.total === total && p.streak === streak ? p : { done, total, streak }));
  }, []);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-6 md:gap-8">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">El espejo</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Glow up</h1>
          <p className="max-w-[540px] text-body-lg text-on-surface-light">Cuídate, vístete y preséntate. Pequeños rituales que cambian cómo te ves y cómo te sientes.</p>
        </div>
        <div className="flex items-center gap-5">
          <ProgressRing value={pct} tone="primary" size={120} stroke={10} label="Brillo de hoy" valueText={`${pct}%`}>
            <span className="flex flex-col items-center" aria-live="polite">
              <span className="font-mono text-heading-md font-bold tabular-nums">{pct}%</span>
              <span className="text-body-sm text-on-surface-light">hoy</span>
            </span>
          </ProgressRing>
          <div className="flex flex-col gap-1">
            <span className="text-label-lg">Brillo de hoy</span>
            <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{progress.done} de {progress.total} pasos</span>
            {progress.streak > 0 && (
              <span className="flex items-center gap-1.5 text-body-sm text-warning-text"><Flame aria-hidden className="size-4" /><span className="font-mono tabular-nums">{progress.streak}</span> {progress.streak === 1 ? 'día' : 'días'} de racha</span>
            )}
          </div>
        </div>
      </motion.section>

      <motion.div variants={item}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} label="Área" className="max-w-[560px]" />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'care' && <CareSection onProgress={onProgress} />}
          {tab === 'style' && <StyleSection />}
          {tab === 'presence' && <PresenceSection />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
