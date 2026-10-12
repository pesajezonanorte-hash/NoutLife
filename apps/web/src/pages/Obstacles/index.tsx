// Obstáculos (anti-hábitos): lo que quieres dejar o evitar. Se registra cada
// caída y cada tentación resistida, con métricas de frecuencia diaria, semanal
// y mensual, la serie de los últimos 30 días y los días que llevas sin caer.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Archive, Plus, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Badge, BarChart, Button, Card, EmptyState, ErrorState, Field, IconChip, Input, Modal, PageLoader, SegmentedControl, type BarDatum } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { item } from '@/lib/motion';
import * as antiHabits from '@/services/antiHabit.service';
import type { AntiHabit } from '@/services/antiHabit.service';

type Period = 'today' | 'week' | 'month';
const PERIODS = [
  { value: 'today' as const, label: 'Hoy' },
  { value: 'week' as const, label: 'Semana' },
  { value: 'month' as const, label: 'Mes' },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ObstacleCard({ obstacle, period, onChanged }: { obstacle: AntiHabit; period: Period; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'fall' | 'resist' | null>(null);
  const m = obstacle.metrics;
  const current = m[period];
  const over = obstacle.targetPerWeek != null && m.week.falls > obstacle.targetPerWeek;
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
      if (occurred) toast.info('Caída registrada', 'Mañana es otro intento. Fíjate en qué la provocó.');
      else toast.success('¡Tentación resistida!', 'Cada vez que dices que no, se vuelve más fácil.');
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
    try { await antiHabits.archiveAntiHabit(obstacle.id); await onChanged(); }
    catch { toast.error('No se pudo archivar'); }
  }

  return (
    <Card as="article" padding="lg" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-start gap-3">
        <IconChip icon={ShieldAlert} tone={over ? 'error' : 'warning'} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-heading-sm">{obstacle.title}</h2>
          <p className="text-body-sm text-on-surface-light">
            <span className="capitalize">{obstacle.category}</span>
            {obstacle.cue && <> · Detonante: {obstacle.cue}</>}
          </p>
        </div>
        {m.daysClean !== null && <Badge variant={m.daysClean >= 7 ? 'success' : 'neutral'}>{plural(m.daysClean, 'día', 'días')} sin caer</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-error/[var(--lq-soft-alpha)] p-3">
          <dt className="text-body-sm text-error-text">Caídas</dt>
          <dd className="font-mono text-heading-lg tabular-nums">{current.falls}</dd>
        </div>
        <div className="rounded-xl bg-success/[var(--lq-soft-alpha)] p-3">
          <dt className="text-body-sm text-success-text">Resistidas</dt>
          <dd className="font-mono text-heading-lg tabular-nums">{current.resisted}</dd>
        </div>
      </dl>
      <p className="text-body-sm text-on-surface-light">
        Hoy {m.today.falls} · semana {m.week.falls}{obstacle.targetPerWeek != null ? `/${obstacle.targetPerWeek}` : ''} · mes {m.month.falls} caídas
        {over && <span className="text-error-text"> · superaste tu límite semanal</span>}
      </p>

      <BarChart data={bars} label={`Caídas diarias de ${obstacle.title} en los últimos 30 días`} tone="warning" highlightTone="error" height={80} />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={busy === 'resist'} onClick={() => void log(false)}><ShieldCheck aria-hidden className="size-4" />Resistí</Button>
        <Button variant="ghost" size="sm" loading={busy === 'fall'} onClick={() => void log(true)} className="text-error-text"><ShieldAlert aria-hidden className="size-4" />Caí</Button>
        {obstacle.logs.length > 0 && <Button variant="ghost" size="sm" onClick={() => void undoLast()}><Undo2 aria-hidden className="size-4" />Deshacer</Button>}
        <Button variant="ghost" size="sm" onClick={() => void archive()} className="ml-auto"><Archive aria-hidden className="size-4" />Archivar</Button>
      </div>
    </Card>
  );
}

export default function ObstaclesPage() {
  const toast = useToast();
  const [list, setList] = useState<AntiHabit[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [period, setPeriod] = useState<Period>('week');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'general', cue: '', limit: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setList(await antiHabits.listAntiHabits()); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const limit = Number(form.limit);
      await antiHabits.createAntiHabit({
        title: form.title.trim(), category: form.category.trim() || 'general', cue: form.cue.trim() || undefined,
        targetPerWeek: Number.isInteger(limit) && limit >= 1 ? limit : undefined,
      });
      setOpen(false); setForm({ title: '', category: 'general', cue: '', limit: '' });
      await load();
    } catch { toast.error('No se pudo crear el obstáculo'); }
    finally { setSaving(false); }
  }

  const totals = list.reduce((acc, o) => ({ falls: acc.falls + o.metrics[period].falls, resisted: acc.resisted + o.metrics[period].resisted }), { falls: 0, resisted: 0 });

  return (
    <ZoneShell zone="custom" contentClassName="gap-6 md:gap-10" ambience={<AmbientLight tone="warning" alpha={0.08} darkAlpha={0.06} d={16} className="right-[8%] top-[6%] h-[30rem] w-[60%]" />}>
      <PageHeader eyebrow="Anti-hábitos" title="Obstáculos" description="Registra tus caídas y las tentaciones que resistes para ver con qué frecuencia aparecen cada día, semana y mes." aside={<Button onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" />Nuevo obstáculo</Button>} />

      <motion.div variants={item} className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} label="Periodo" className="max-w-[360px]" />
        {list.length > 0 && <p className="text-body-md text-on-surface-light"><b className="font-mono text-on-surface">{totals.resisted}</b> resistidas · <b className="font-mono text-on-surface">{totals.falls}</b> caídas</p>}
      </motion.div>

      {state === 'loading' ? <PageLoader label="Cargando tus obstáculos…" /> : state === 'error' ? (
        <ErrorState title="No pudimos cargar tus obstáculos" onRetry={() => void load()} />
      ) : list.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Sin obstáculos registrados" description="Añade algo que quieras dejar (redes de noche, azúcar, fumar…) y registra cada tentación." action={<Button onClick={() => setOpen(true)}><Plus aria-hidden className="size-4" />Crear obstáculo</Button>} />
      ) : (
        <motion.div variants={item} className="grid items-start gap-5 lg:grid-cols-2">
          {list.map((o) => <ObstacleCard key={o.id} obstacle={o} period={period} onChanged={load} />)}
        </motion.div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo obstáculo">
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="¿Qué quieres evitar?"><Input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={100} placeholder="Ej. Redes sociales después de las 23:00" required /></Field>
          <Field label="Categoría"><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} maxLength={32} placeholder="salud, dinero, pantallas…" /></Field>
          <Field label="Detonante (opcional)"><Input value={form.cue} onChange={(e) => setForm((f) => ({ ...f, cue: e.target.value }))} maxLength={200} placeholder="Aburrimiento, estrés, después de cenar…" /></Field>
          <Field label="Límite semanal (opcional)"><Input type="number" inputMode="numeric" min={1} max={100} value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))} placeholder="Ej. 2" /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={saving} disabled={!form.title.trim()}><Plus aria-hidden className="size-4" />Crear</Button>
          </div>
        </form>
      </Modal>
    </ZoneShell>
  );
}
