// Obstáculos (anti-hábitos) dentro de la libreta de Hábitos: lo que quieres
// dejar o evitar, anotado en su propia hoja. Cada línea registra una tentación
// resistida o una caída con un toque; al abrirla se ven las caídas de hoy, la
// semana y el mes, la serie de 30 días, y se edita, deshace o archiva sin salir
// de la libreta.
import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Archive, ChevronDown, Pencil, Plus, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useToast } from '@/hooks/useToast';
import * as antiHabits from '@/services/antiHabit.service';
import type { AntiHabit } from '@/services/antiHabit.service';
import { Badge, BarChart, Button, EmptyState, ErrorState, Field, IconChip, Input, Modal, PageLoader, SegmentedControl, type BarDatum } from '@/components/ui/lq';
import { NotebookSheet } from './NotebookSheet';

export type ObstaclePeriod = 'today' | 'week' | 'month';
export const OBSTACLE_PERIODS: { value: ObstaclePeriod; label: string }[] = [
  { value: 'today', label: 'Hoy' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const row: Variants = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.12 } } };

type FormState = { title: string; category: string; cue: string; limit: string };
const EMPTY: FormState = { title: '', category: 'general', cue: '', limit: '' };
const formOf = (o: AntiHabit): FormState => ({ title: o.title, category: o.category, cue: o.cue ?? '', limit: o.targetPerWeek ? String(o.targetPerWeek) : '' });

/** Crear o editar un obstáculo (mismo formulario). */
export function ObstacleFormDialog({ open, obstacle, onClose, onSaved }: { open: boolean; obstacle: AntiHabit | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  // Al abrir, el formulario arranca con el obstáculo (o vacío).
  const key = open ? obstacle?.id ?? 'new' : null;
  if (key !== seen) { setSeen(key); if (key) setForm(obstacle ? formOf(obstacle) : EMPTY); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const limit = Number(form.limit);
    const targetPerWeek = form.limit.trim() && Number.isInteger(limit) && limit >= 1 ? limit : null;
    try {
      if (obstacle) {
        await antiHabits.updateAntiHabit(obstacle.id, { title: form.title.trim(), category: form.category.trim() || 'general', cue: form.cue.trim() || null, targetPerWeek });
        toast.success('Obstáculo guardado');
      } else {
        await antiHabits.createAntiHabit({ title: form.title.trim(), category: form.category.trim() || 'general', cue: form.cue.trim() || undefined, targetPerWeek: targetPerWeek ?? undefined });
        toast.success('Obstáculo anotado', 'Registra cada tentación que resistas.');
      }
      await onSaved();
      onClose();
    } catch { toast.error(obstacle ? 'No se pudo guardar el obstáculo' : 'No se pudo crear el obstáculo'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={obstacle ? 'Editar obstáculo' : 'Nuevo obstáculo'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="¿Qué quieres evitar?"><Input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={100} placeholder="Ej. Redes sociales después de las 23:00" required /></Field>
        <Field label="Categoría"><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} maxLength={32} placeholder="salud, dinero, pantallas…" /></Field>
        <Field label="Detonante (opcional)"><Input value={form.cue} onChange={(e) => setForm((f) => ({ ...f, cue: e.target.value }))} maxLength={200} placeholder="Aburrimiento, estrés, después de cenar…" /></Field>
        <Field label="Límite semanal (opcional)" help="Cuántas caídas a la semana aceptas como máximo."><Input type="number" inputMode="numeric" min={1} max={100} value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))} placeholder="Ej. 2" /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving} disabled={!form.title.trim()}>{obstacle ? 'Guardar' : <><Plus aria-hidden className="size-4" />Crear</>}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Una línea de la hoja: el obstáculo, sus registros rápidos y, al abrirla, su detalle. */
function ObstacleRow({ obstacle, period, onChanged, onEdit }: { obstacle: AntiHabit; period: ObstaclePeriod; onChanged: () => Promise<void>; onEdit: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'fall' | 'resist' | null>(null);
  const [open, setOpen] = useState(false);
  const m = obstacle.metrics;
  const current = m[period];
  const over = obstacle.targetPerWeek != null && m.week.falls > obstacle.targetPerWeek;
  const detailId = `obstacle-${obstacle.id}`;
  const bars: BarDatum[] = m.daily.map((d, i) => ({
    label: i % 5 === 0 || i === m.daily.length - 1 ? new Date(`${d.date}T12:00:00`).getDate().toString() : '',
    value: d.falls,
    tip: `${new Date(`${d.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}: ${plural(d.falls, 'caída', 'caídas')}, ${plural(d.resisted, 'tentación resistida', 'tentaciones resistidas')}`,
    highlight: i === m.daily.length - 1,
  }));

  async function log(occurred: boolean) {
    setBusy(occurred ? 'fall' : 'resist');
    try {
      await antiHabits.logAntiHabit(obstacle.id, { occurred });
      await onChanged();
      if (occurred) toast.info('Caída anotada', 'Mañana es otro intento. Fíjate en qué la provocó.');
      else toast.success('Tentación resistida', 'Cada vez que dices que no, se vuelve más fácil.');
    } catch { toast.error('No se pudo registrar'); }
    finally { setBusy(null); }
  }
  async function undoLast() {
    const last = obstacle.logs[0];
    if (!last) return;
    try { await antiHabits.deleteAntiHabitLog(last.id); await onChanged(); toast.info('Último registro deshecho'); }
    catch { toast.error('No se pudo deshacer'); }
  }
  async function archive() {
    if (!window.confirm(`¿Archivar «${obstacle.title}»? Sus registros se conservan.`)) return;
    try { await antiHabits.archiveAntiHabit(obstacle.id); await onChanged(); toast.info('Obstáculo archivado'); }
    catch { toast.error('No se pudo archivar'); }
  }

  return (
    <motion.li variants={row} className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-info/25" />
      <div className="grid min-h-[calc(var(--lq-rule)*2)] grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 py-2 pr-2 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:gap-x-5 md:pr-4">
        <span className="flex justify-center"><IconChip icon={over ? ShieldAlert : ShieldCheck} tone={over ? 'error' : 'warning'} size="sm" /></span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <button
            type="button" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((o) => !o)}
            className="group flex min-h-11 min-w-0 items-center gap-1.5 self-start rounded-md text-left"
          >
            <span className="truncate text-body-md font-semibold text-on-background md:text-heading-sm">{obstacle.title}</span>
            <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-on-surface-light transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)]', open && 'rotate-180')} strokeWidth={1.75} />
            <span className="sr-only">{open ? 'Ocultar detalle' : 'Ver detalle'}</span>
          </button>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-light">
            <span className="capitalize">{obstacle.category}</span>
            {obstacle.cue && <span className="truncate">· {obstacle.cue}</span>}
            {m.daysClean !== null && <Badge variant={m.daysClean >= 7 ? 'success' : 'neutral'}>{plural(m.daysClean, 'día', 'días')} sin caer</Badge>}
            {over && <span className="text-error-text">· superaste tu límite semanal</span>}
          </span>
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 pl-[3.75rem] md:col-span-1 md:pl-0">
          <Button variant="secondary" size="sm" loading={busy === 'resist'} onClick={() => void log(false)}><ShieldCheck aria-hidden className="size-4" />Resistí</Button>
          <Button variant="ghost" size="sm" loading={busy === 'fall'} onClick={() => void log(true)} className="text-error-text"><ShieldAlert aria-hidden className="size-4" />Caí</Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailId}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: springs.natural }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="flex flex-col gap-4 pb-4 pl-[3.75rem] pr-3 md:pl-[6rem] md:pr-4"
          >
            <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-xl bg-error/[var(--lq-soft-alpha)] p-3">
                <dt className="text-body-sm text-error-text">Caídas · {OBSTACLE_PERIODS.find((p) => p.value === period)?.label.toLowerCase()}</dt>
                <dd className="font-mono text-heading-lg tabular-nums">{current.falls}</dd>
              </div>
              <div className="rounded-xl bg-success/[var(--lq-soft-alpha)] p-3">
                <dt className="text-body-sm text-success-text">Resistidas</dt>
                <dd className="font-mono text-heading-lg tabular-nums">{current.resisted}</dd>
              </div>
            </dl>
            <p className="text-body-sm text-on-surface-light">
              Hoy {m.today.falls} · semana {m.week.falls}{obstacle.targetPerWeek != null ? `/${obstacle.targetPerWeek}` : ''} · mes {m.month.falls} caídas
            </p>
            <BarChart data={bars} label={`Caídas diarias de ${obstacle.title} en los últimos 30 días`} tone="warning" highlightTone="error" height={80} />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit}><Pencil aria-hidden className="size-4" />Editar</Button>
              {obstacle.logs.length > 0 && <Button variant="ghost" size="sm" onClick={() => void undoLast()}><Undo2 aria-hidden className="size-4" />Deshacer el último</Button>}
              <Button variant="ghost" size="sm" onClick={() => void archive()} className="ml-auto"><Archive aria-hidden className="size-4" />Archivar</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** La hoja de obstáculos. El estado vive en Hábitos (resumen del aside y contador de la pestaña). */
export function ObstaclesSheet({ list, state, period, onPeriod, onReload, onNew, onEdit, panelId, labelledBy }: {
  list: AntiHabit[];
  state: 'loading' | 'error' | 'ready';
  period: ObstaclePeriod;
  onPeriod: (p: ObstaclePeriod) => void;
  onReload: () => Promise<void>;
  onNew: () => void;
  onEdit: (o: AntiHabit) => void;
  panelId: string;
  labelledBy: string;
}) {
  return (
    <NotebookSheet
      id={panelId} labelledBy={labelledBy} tabbed
      header={(
        <>
          <SegmentedControl label="Periodo" value={period} onChange={onPeriod} options={OBSTACLE_PERIODS} className="w-full md:max-w-[360px]" />
          <Button size="md" onClick={onNew}><Plus aria-hidden className="size-4" />Nuevo obstáculo</Button>
        </>
      )}
    >
      {state === 'loading' ? <PageLoader size="sm" label="Cargando tus obstáculos…" /> : state === 'error' ? (
        <ErrorState title="No pudimos cargar tus obstáculos" onRetry={() => void onReload()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ShieldAlert} tone="muted" className="py-12"
          title="Sin obstáculos anotados"
          description="Anota algo que quieras dejar (redes de noche, azúcar, fumar…) y registra cada tentación que resistas."
          action={<Button onClick={onNew}><Plus aria-hidden className="size-4" />Anotar un obstáculo</Button>}
        />
      ) : (
        <motion.ul key={period} initial="initial" animate="animate" variants={{ animate: { transition: { staggerChildren: 0.05 } } }} className="flex flex-col">
          {list.map((o) => <ObstacleRow key={o.id} obstacle={o} period={period} onChanged={onReload} onEdit={() => onEdit(o)} />)}
        </motion.ul>
      )}
    </NotebookSheet>
  );
}
