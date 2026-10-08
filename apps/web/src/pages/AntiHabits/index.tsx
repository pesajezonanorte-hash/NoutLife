import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Archive, Check, CheckCircle2, Flame, Plus, RotateCcw, Target, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Textarea } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { item } from '@/lib/motion';
import * as antiHabitService from '@/services/anti-habit.service';
import type { AntiHabit, AntiHabitLog } from '@/services/anti-habit.service';

const CATEGORIES = ['general', 'salud', 'digital', 'alimentación', 'gasto', 'descanso', 'relaciones'];
const dateLabel = (value: string) => new Date(value).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function AntiHabitCard({ habit, onRefresh }: { habit: AntiHabit; onRefresh: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const completed = habit.weeklyOccurrences;
  const target = habit.targetPerWeek;
  const pct = target ? Math.min(100, Math.round(completed / target * 100)) : 0;

  async function log(occurred: boolean) {
    setBusy(true);
    try {
      await antiHabitService.logAntiHabit(habit.id, { occurred, amount: 1 });
      await onRefresh();
      toast.success(occurred ? 'Registro guardado; mañana puedes volver a intentarlo.' : 'Impulso resistido. Ese avance también cuenta.');
    } catch { toast.error('No se pudo guardar el registro'); }
    finally { setBusy(false); }
  }
  async function removeLog(logEntry: AntiHabitLog) {
    try { await antiHabitService.deleteAntiHabitLog(logEntry.id); await onRefresh(); toast.info('Registro eliminado'); }
    catch { toast.error('No se pudo eliminar el registro'); }
  }
  async function archive() {
    if (!window.confirm(`¿Archivar “${habit.title}”? Sus registros se conservarán.`)) return;
    try { await antiHabitService.archiveAntiHabit(habit.id); await onRefresh(); toast.success('Anti-hábito archivado'); }
    catch { toast.error('No se pudo archivar'); }
  }

  return (
    <Card as="article" padding="lg" className="flex min-w-0 flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-warning/[var(--lq-soft-alpha)] text-warning-text"><Target aria-hidden className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-heading-sm">{habit.title}</h2><Badge variant="neutral">{habit.category}</Badge></div>
          {habit.cue && <p className="mt-1 text-body-sm text-on-surface-light">Desencadenante: {habit.cue}</p>}
        </div>
        <Button variant="icon" aria-label={`Archivar ${habit.title}`} onClick={() => void archive()} className="size-10 text-on-surface-light hover:text-error-text"><Archive aria-hidden className="size-5" /></Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-variant p-4"><p className="text-body-sm text-on-surface-light">Ocurrencias · 7 días</p><p className="mt-1 font-mono text-heading-lg tabular-nums">{completed}</p>{target && <p className="text-body-sm text-on-surface-light">Meta: máximo {target} por semana</p>}</div>
        <div className="rounded-2xl bg-surface-variant p-4"><p className="text-body-sm text-on-surface-light">Impulsos resistidos</p><p className="mt-1 flex items-center gap-2 font-mono text-heading-lg tabular-nums"><Flame aria-hidden className="size-5 text-success-text" />{habit.weeklyResisted}</p><p className="text-body-sm text-on-surface-light">No es una racha: cada decisión cuenta.</p></div>
      </div>
      {target && <div><div className="mb-1 flex justify-between text-body-sm text-on-surface-light"><span>Uso frente a tu meta semanal</span><span>{pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-variant"><div className="h-full rounded-full bg-warning transition-[width]" style={{ width: `${pct}%` }} /></div></div>}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void log(true)}><RotateCcw aria-hidden className="size-4" />Registrar ocurrencia</Button>
        <Button size="sm" disabled={busy} onClick={() => void log(false)}><CheckCircle2 aria-hidden className="size-4" />Resistí el impulso</Button>
      </div>

      <div className="border-t border-border pt-3">
        <h3 className="mb-2 text-label-lg">Registros recientes</h3>
        {habit.logs.length ? (
          <ul className="flex flex-col gap-1">
            {habit.logs.slice(0, 7).map((logEntry) => (
              <li key={logEntry.id} className="flex min-h-10 items-center gap-2 text-body-sm">
                {logEntry.occurred ? <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning-text" /> : <Check aria-hidden className="size-4 shrink-0 text-success-text" />}
                <span className="min-w-0 flex-1 text-on-surface-light">{dateLabel(logEntry.date)} · {logEntry.occurred ? `ocurrió${logEntry.amount > 1 ? ` (${logEntry.amount})` : ''}` : 'impulso resistido'}{logEntry.note ? ` · ${logEntry.note}` : ''}</span>
                <Button variant="icon" aria-label="Eliminar registro" onClick={() => void removeLog(logEntry)} className="size-9 text-on-surface-light"><Trash2 aria-hidden className="size-4" /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-body-sm text-on-surface-light">Aún no hay registros esta semana.</p>}
      </div>
    </Card>
  );
}

export default function AntiHabitsPage() {
  const toast = useToast();
  const [habits, setHabits] = useState<AntiHabit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [cue, setCue] = useState('');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setHabits(await antiHabitService.listAntiHabits()); setFailed(false); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reset() { setTitle(''); setCategory('general'); setCue(''); setTarget(''); }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const targetPerWeek = target ? Number(target) : undefined;
    if (targetPerWeek !== undefined && (!Number.isInteger(targetPerWeek) || targetPerWeek < 1 || targetPerWeek > 100)) { toast.error('La meta semanal debe ser un número entre 1 y 100'); return; }
    setSaving(true);
    try {
      await antiHabitService.createAntiHabit({ title: title.trim(), category: category.trim() || 'general', cue: cue.trim() || undefined, targetPerWeek });
      setCreateOpen(false); reset(); await load(); toast.success('Seguimiento creado');
    } catch { toast.error('No se pudo crear el seguimiento'); }
    finally { setSaving(false); }
  }

  const totals = habits.reduce((value, habit) => ({ occurrences: value.occurrences + habit.weeklyOccurrences, resisted: value.resisted + habit.weeklyResisted }), { occurrences: 0, resisted: 0 });
  return (
    <ZoneShell zone="habits" contentClassName="gap-6 md:gap-10" ambience={<AmbientLight tone="warning" alpha={0.09} darkAlpha={0.05} d={18} className="left-[8%] top-[7%] h-[34rem] w-[70%]" />}>
      <PageHeader eyebrow="Registro privado · semana actual" title="Anti-hábitos" description="Observa conductas que quieres reducir sin juicio. Registra lo que ocurrió y también los impulsos que lograste resistir." aside={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />Nuevo seguimiento</Button>} />

      {!loading && !failed && habits.length > 0 && <motion.div variants={item} className="grid gap-3 sm:grid-cols-2"><Card padding="md"><p className="text-body-sm text-on-surface-light">Ocurrencias esta semana</p><p className="font-mono text-heading-lg tabular-nums">{totals.occurrences}</p></Card><Card padding="md"><p className="text-body-sm text-on-surface-light">Impulsos resistidos</p><p className="font-mono text-heading-lg tabular-nums text-success-text">{totals.resisted}</p></Card></motion.div>}

      {loading ? <PageLoader label="Cargando tus registros…" /> : failed ? <ErrorState title="No pudimos cargar tus anti-hábitos" description="Vuelve a intentarlo. Tus registros se mantienen privados." onRetry={() => void load()} /> : habits.length === 0 ? (
        <EmptyState icon={Target} tone="warning" title="Un seguimiento a la vez" description="Anota un comportamiento que quieres reducir. También podrás registrar cuándo resistes el impulso, sin romper una racha." action={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />Crear seguimiento</Button>} />
      ) : <motion.div variants={item} className="grid items-start gap-5 lg:grid-cols-2">{habits.map((habit) => <AntiHabitCard key={habit.id} habit={habit} onRefresh={load} />)}</motion.div>}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); reset(); }} title="Nuevo anti-hábito">
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="Conducta que quieres reducir"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Ej. Desplazarme sin parar en el teléfono" required /></Field>
          <Field label="Categoría"><Input list="anti-habit-category-options" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={32} placeholder="general" required /></Field>
          <datalist id="anti-habit-category-options">{CATEGORIES.map((value) => <option key={value} value={value} />)}</datalist>
          <Field label="Desencadenante (opcional)" help="Por ejemplo: aburrimiento, estrés o cierta hora del día."><Textarea value={cue} onChange={(event) => setCue(event.target.value)} maxLength={200} placeholder="¿Qué suele ocurrir antes?" /></Field>
          <Field label="Meta máxima de ocurrencias por semana (opcional)"><Input type="number" inputMode="numeric" min={1} max={100} step={1} value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Sin meta por ahora" /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setCreateOpen(false); reset(); }}>Cancelar</Button><Button type="submit" loading={saving} disabled={!title.trim()}><Plus aria-hidden className="size-4" />Crear seguimiento</Button></div>
        </form>
      </Modal>
    </ZoneShell>
  );
}
