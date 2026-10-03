// Herramientas de Finanzas sin prototipo propio (presupuestos, metas, deudas,
// recurrentes, proyección), rediseñadas con los componentes del sistema.
// Mismos servicios que el antiguo FinancesExtras / página de Finanzas.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { FinancialGoal, TransactionCategory } from '@lifequest/shared';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, PiggyBank, Plus, Repeat, Target, Trash2, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/lifeMeta';
import {
  Badge, Button, Card, EmptyState, ErrorState, Field, IconChip, Input, LineChart, ProgressBar, ResponsiveDialog, SegmentedControl,
  Select, Skeleton,
} from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import * as financeService from '@/services/finance.service';
import * as f2 from '@/services/finance2.service';
import { TX_CATEGORIES, txCategory } from './financeMeta';

type Money = (n: number) => string;
const toast = () => useToastStore.getState();

// ── Piezas comunes ───────────────────────────────────────────────────────────

function useLoader<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    fetcher().then(setData).catch(() => setFailed(true));
  }, [fetcher]);
  useEffect(load, [load]);
  return { data, setData, failed, load };
}

function PanelState({ failed, loading, onRetry }: { failed: boolean; loading: boolean; onRetry: () => void }) {
  if (failed) return <ErrorState title="No pudimos cargar esta sección" onRetry={onRetry} autoRetrySeconds={0} className="py-8" />;
  if (loading) return <div className="flex flex-col gap-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  return null;
}

function PanelHead({ title, summary, action }: { title: string; summary?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-heading-sm">{title}</h3>
        {summary && <p className="text-body-sm text-on-surface-light">{summary}</p>}
      </div>
      {action}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button variant="secondary" size="sm" onClick={onClick}><Plus aria-hidden className="size-4" strokeWidth={2} />{label}</Button>;
}

function Row({ icon, tone, title, meta, right, children, onDelete, deleteLabel }: {
  icon: LucideIcon; tone: Parameters<typeof IconChip>[0]['tone']; title: string; meta?: ReactNode; right?: ReactNode;
  children?: ReactNode; onDelete?: () => void; deleteLabel?: string;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-3">
        <IconChip icon={icon} tone={tone} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-lg text-on-background">{title}</span>
          {meta && <span className="block truncate text-body-sm text-on-surface-light">{meta}</span>}
        </span>
        {right}
        {onDelete && (
          <Button variant="icon" aria-label={deleteLabel} onClick={onDelete} className="-mr-2 hover:text-error-text">
            <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        )}
      </div>
      {children}
    </li>
  );
}

/** Diálogo con un formulario de monto (aporte, pago…). */
function AmountDialog({ open, title, label, money, onClose, onSubmit }: {
  open: boolean; title: string; label: string; money: Money; onClose: () => void; onSubmit: (n: number) => Promise<void>;
}) {
  const [v, setV] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setV(''); }, [open]);
  const n = Number(v);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(n > 0)) return;
    setSaving(true);
    try { await onSubmit(n); } finally { setSaving(false); }
  }
  return (
    <ResponsiveDialog open={open} onClose={onClose} title={title}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <Field label={label} help={n > 0 ? money(n) : undefined}>
          <Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={v} onChange={(e) => setV(e.target.value)} />
        </Field>
        <Button type="submit" block loading={saving} disabled={!(n > 0)}>Guardar</Button>
      </form>
    </ResponsiveDialog>
  );
}

// ── Presupuestos ─────────────────────────────────────────────────────────────

export function BudgetsPanel({ month, year, money }: { month: number; year: number; money: Money }) {
  const fetcher = useCallback(() => financeService.fetchBudgets(month, year), [month, year]);
  const { data, setData, failed, load } = useLoader(fetcher);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ category: TransactionCategory; amount: string }>({ category: 'FOOD', amount: '' });
  const [saving, setSaving] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return;
    setSaving(true);
    try {
      await financeService.createBudget({ category: form.category, amount: Number(form.amount), month, year });
      setAdding(false);
      setForm({ category: 'FOOD', amount: '' });
      load();
      toast().success('Presupuesto creado');
    } catch { toast().error('No se pudo crear el presupuesto'); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const prev = data;
    setData((d) => d?.filter((b) => b.id !== id) ?? d);
    try { await financeService.deleteBudget(id); } catch { setData(prev); toast().error('No se pudo eliminar'); }
  }

  const total = data?.reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const spent = data?.reduce((s, b) => s + Number(b.spent ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title="Presupuestos del mes" summary={data?.length ? `${money(spent)} de ${money(total)} usados` : undefined} action={<AddButton label="Presupuesto" onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && data.length === 0 && <EmptyState icon={Target} tone="muted" title="Sin presupuestos" description="Pon un tope por categoría y te avisamos al pasar del 80 %." className="py-8" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((b) => {
            const cat = txCategory(b.category);
            const used = Number(b.spent ?? 0);
            const pct = Number(b.amount) > 0 ? (used / Number(b.amount)) * 100 : 0;
            const over = pct > 100;
            return (
              <Row key={b.id} icon={cat.icon} tone={cat.tone} title={cat.label} meta={`${money(used)} de ${money(Number(b.amount))}`}
                right={<Badge variant={over ? 'error' : pct > 80 ? 'warning' : 'success'}>{Math.round(pct)}%</Badge>}
                onDelete={() => void remove(b.id)} deleteLabel={`Eliminar presupuesto de ${cat.label}`}>
                <ProgressBar value={Math.min(100, pct)} tone={over ? 'error' : pct > 80 ? 'warning' : 'success'} label={`Presupuesto de ${cat.label}`} valueText={`${Math.round(pct)} % usado`} />
                {over && <span className="text-body-sm text-error-text">Te pasaste por {money(used - Number(b.amount))}</span>}
              </Row>
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title="Nuevo presupuesto">
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <Field label="Categoría">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TransactionCategory }))}>
              {TX_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Tope mensual">
            <Input data-autofocus type="number" inputMode="decimal" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Button type="submit" block loading={saving} disabled={!(Number(form.amount) > 0)}>Crear presupuesto</Button>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

// ── Metas de ahorro ──────────────────────────────────────────────────────────

export function GoalsPanel({ money }: { money: Money }) {
  const { data, setData, failed, load } = useLoader(financeService.fetchFinancialGoals);
  const [adding, setAdding] = useState(false);
  const [contributing, setContributing] = useState<FinancialGoal | null>(null);
  const [form, setForm] = useState({ title: '', targetAmount: '', deadline: '' });
  const [saving, setSaving] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !(Number(form.targetAmount) > 0)) return;
    setSaving(true);
    try {
      const g = await financeService.createFinancialGoal({ title: form.title.trim(), targetAmount: Number(form.targetAmount), deadline: form.deadline || undefined });
      setData((d) => [...(d ?? []), g]);
      setAdding(false);
      setForm({ title: '', targetAmount: '', deadline: '' });
      toast().success('Meta creada');
    } catch { toast().error('No se pudo crear la meta'); } finally { setSaving(false); }
  }

  async function contribute(n: number) {
    if (!contributing) return;
    try {
      const g = await financeService.contributeToGoal(contributing.id, n);
      setData((d) => d?.map((x) => (x.id === g.id ? g : x)) ?? d);
      setContributing(null);
      toast().success('Aporte registrado', money(n));
    } catch { toast().error('No se pudo registrar el aporte'); }
  }

  async function remove(id: string) {
    const prev = data;
    setData((d) => d?.filter((g) => g.id !== id) ?? d);
    try { await financeService.deleteFinancialGoal(id); } catch { setData(prev); toast().error('No se pudo eliminar'); }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title="Metas de ahorro" action={<AddButton label="Meta" onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && data.length === 0 && <EmptyState icon={PiggyBank} tone="muted" title="Sin metas de ahorro" description="Ponle nombre y cifra a lo que quieres conseguir." className="py-8" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((g) => {
            const pct = Number(g.targetAmount) > 0 ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100 : 0;
            return (
              <Row key={g.id} icon={PiggyBank} tone={g.isCompleted ? 'success' : 'primary'} title={g.title}
                meta={`${money(Number(g.currentAmount))} de ${money(Number(g.targetAmount))}${g.deadline ? ` · hasta ${new Date(g.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}`}
                right={g.isCompleted ? <Badge variant="success">Lograda</Badge> : <span className="text-label-lg text-primary-text tabular-nums">{Math.round(pct)}%</span>}
                onDelete={() => void remove(g.id)} deleteLabel={`Eliminar meta ${g.title}`}>
                <ProgressBar value={Math.min(100, pct)} tone={g.isCompleted ? 'success' : 'primary'} shine={!g.isCompleted} label={`Progreso de ${g.title}`} valueText={`${Math.round(pct)} %`} />
                {!g.isCompleted && <Button variant="ghost" size="sm" className="self-start" onClick={() => setContributing(g)}><Plus aria-hidden className="size-4" strokeWidth={2} />Aportar</Button>}
              </Row>
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title="Nueva meta de ahorro">
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <Field label="Nombre"><Input data-autofocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Viaje a la costa" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cifra objetivo"><Input type="number" inputMode="decimal" min="0" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} /></Field>
            <Field label="Fecha límite" help="Opcional"><Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} /></Field>
          </div>
          <Button type="submit" block loading={saving} disabled={!form.title.trim() || !(Number(form.targetAmount) > 0)}>Crear meta</Button>
        </form>
      </ResponsiveDialog>
      <AmountDialog open={Boolean(contributing)} title={`Aportar a ${contributing?.title ?? ''}`} label="Monto del aporte" money={money} onClose={() => setContributing(null)} onSubmit={contribute} />
    </div>
  );
}

// ── Deudas ───────────────────────────────────────────────────────────────────

export function DebtsPanel({ money }: { money: Money }) {
  const { data, setData, failed, load } = useLoader(f2.fetchDebts);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<f2.Debt | null>(null);
  const [form, setForm] = useState({ title: '', type: 'owe' as 'owe' | 'owed', originalAmount: '', personName: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !(Number(form.originalAmount) > 0)) return;
    setSaving(true);
    try {
      const d = await f2.createDebt({ title: form.title.trim(), type: form.type, originalAmount: Number(form.originalAmount), personName: form.personName || undefined, dueDate: form.dueDate || undefined });
      setData((x) => [...(x ?? []), d]);
      setAdding(false);
      setForm({ title: '', type: 'owe', originalAmount: '', personName: '', dueDate: '' });
    } catch { toast().error('No se pudo crear la deuda'); } finally { setSaving(false); }
  }

  async function pay(n: number) {
    if (!paying) return;
    try {
      await f2.addDebtPayment(paying.id, n, new Date().toISOString().slice(0, 10));
      setPaying(null);
      load();
      toast().success('Pago registrado', money(n));
    } catch { toast().error('No se pudo registrar el pago'); }
  }

  async function remove(id: string) {
    setConfirmId(null);
    const prev = data;
    setData((d) => d?.filter((x) => x.id !== id) ?? d);
    try { await f2.deleteDebt(id); } catch { setData(prev); toast().error('No se pudo eliminar'); }
  }

  const open = data?.filter((d) => !d.isPaid) ?? [];
  const owe = open.filter((d) => d.type === 'owe').reduce((s, d) => s + Number(d.currentAmount), 0);
  const owed = open.filter((d) => d.type === 'owed').reduce((s, d) => s + Number(d.currentAmount), 0);

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title="Deudas" summary={data ? `Debes ${money(owe)} · te deben ${money(owed)}` : undefined} action={<AddButton label="Deuda" onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && open.length === 0 && <EmptyState icon={ArrowDownLeft} tone="muted" title="Sin deudas pendientes" className="py-8" />}
      {open.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {open.map((d) => {
            const paid = Number(d.originalAmount) > 0 ? (1 - Number(d.currentAmount) / Number(d.originalAmount)) * 100 : 0;
            const iOwe = d.type === 'owe';
            return (
              <Row key={d.id} icon={iOwe ? ArrowUpRight : ArrowDownLeft} tone={iOwe ? 'error' : 'success'} title={d.title}
                meta={`${iOwe ? 'Debes a' : 'Te debe'} ${d.personName ?? '—'}${d.dueDate ? ` · vence ${new Date(d.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}`}
                right={<span className="text-label-lg tabular-nums">{money(Number(d.currentAmount))}</span>}
                onDelete={() => setConfirmId(d.id)} deleteLabel={`Eliminar deuda ${d.title}`}>
                <ProgressBar value={paid} tone="success" label={`Pagado de ${d.title}`} valueText={`${Math.round(paid)} % pagado`} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm text-on-surface-light tabular-nums">{Math.round(paid)} % pagado de {money(Number(d.originalAmount))}</span>
                  <Button variant="ghost" size="sm" onClick={() => setPaying(d)}>Registrar pago</Button>
                </div>
                {confirmId === d.id && (
                  <div role="alertdialog" aria-label="Confirmar eliminación" className="flex items-center justify-between gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] p-3">
                    <span className="text-body-sm text-error-text">¿Eliminar esta deuda?</span>
                    <span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>No</Button><Button size="sm" variant="danger" onClick={() => void remove(d.id)}>Eliminar</Button></span>
                  </div>
                )}
              </Row>
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title="Nueva deuda">
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <SegmentedControl role="radiogroup" label="Tipo de deuda" value={form.type} onChange={(t) => setForm((f) => ({ ...f, type: t }))} options={[{ value: 'owe', label: 'Yo debo' }, { value: 'owed', label: 'Me deben' }]} />
          <Field label="Concepto"><Input data-autofocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monto"><Input type="number" inputMode="decimal" min="0" value={form.originalAmount} onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))} /></Field>
            <Field label="Persona" help="Opcional"><Input value={form.personName} onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))} /></Field>
          </div>
          <Field label="Vence" help="Opcional"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          <Button type="submit" block loading={saving} disabled={!form.title.trim() || !(Number(form.originalAmount) > 0)}>Guardar deuda</Button>
        </form>
      </ResponsiveDialog>
      <AmountDialog open={Boolean(paying)} title={`Pago de ${paying?.title ?? ''}`} label="Monto pagado" money={money} onClose={() => setPaying(null)} onSubmit={pay} />
    </div>
  );
}

// ── Recurrentes ──────────────────────────────────────────────────────────────

export function RecurringPanel({ money }: { money: Money }) {
  const { data, setData, failed, load } = useLoader(f2.fetchRecurring);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'EXPENSE' as 'EXPENSE' | 'INCOME', amount: '', category: 'SUBSCRIPTIONS' as TransactionCategory, description: '', dayOfMonth: '1' });
  const [saving, setSaving] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !(Number(form.amount) > 0)) return;
    setSaving(true);
    try {
      const item = await f2.createRecurring({ type: form.type, amount: Number(form.amount), category: form.category, description: form.description.trim(), dayOfMonth: Number(form.dayOfMonth) });
      setData((d) => [...(d ?? []), item as f2.RecurringTransaction]);
      setAdding(false);
      setForm({ type: 'EXPENSE', amount: '', category: 'SUBSCRIPTIONS', description: '', dayOfMonth: '1' });
    } catch { toast().error('No se pudo crear'); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const prev = data;
    setData((d) => d?.filter((x) => x.id !== id) ?? d);
    try { await f2.deleteRecurring(id); } catch { setData(prev); toast().error('No se pudo eliminar'); }
  }

  const income = data?.filter((i) => i.type === 'INCOME').reduce((s, i) => s + Number(i.amount), 0) ?? 0;
  const expenses = data?.filter((i) => i.type === 'EXPENSE').reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title="Ingresos y gastos fijos" summary={data ? `+${money(income)} · −${money(expenses)} al mes` : undefined} action={<AddButton label="Fijo" onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && data.length === 0 && <EmptyState icon={Repeat} tone="muted" title="Sin movimientos fijos" description="Nómina, alquiler, suscripciones… se registran solos cada mes." className="py-8" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((i) => {
            const cat = txCategory(i.category);
            const isIncome = i.type === 'INCOME';
            return (
              <Row key={i.id} icon={cat.icon} tone={isIncome ? 'success' : cat.tone} title={i.description} meta={`${cat.label} · día ${i.dayOfMonth}`}
                right={<span className={cn('text-label-lg tabular-nums', isIncome ? 'text-success-text' : 'text-on-background')}>{isIncome ? '+' : '−'}{money(Number(i.amount))}</span>}
                onDelete={() => void remove(i.id)} deleteLabel={`Eliminar ${i.description}`} />
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title="Nuevo movimiento fijo">
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <SegmentedControl role="radiogroup" label="Tipo" value={form.type} onChange={(t) => setForm((f) => ({ ...f, type: t }))} options={[{ value: 'EXPENSE', label: 'Gasto' }, { value: 'INCOME', label: 'Ingreso' }]} />
          <Field label="Descripción"><Input data-autofocus value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ej. Netflix" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Monto"><Input type="number" inputMode="decimal" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
            <Field label="Categoría">
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TransactionCategory }))}>
                {TX_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Día del mes"><Input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: e.target.value }))} /></Field>
          </div>
          <Button type="submit" block loading={saving} disabled={!form.description.trim() || !(Number(form.amount) > 0)}>Guardar</Button>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

// ── Proyección ───────────────────────────────────────────────────────────────

export function ProjectionPanel({ money }: { money: Money }) {
  const [months, setMonths] = useState<'3' | '6' | '12'>('3');
  const fetcher = useCallback(() => f2.fetchProjection(Number(months)), [months]);
  const { data, failed, load } = useLoader(fetcher);
  const points = data?.projection.map((p) => ({
    label: new Date(`${p.month}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'short' }),
    value: p.balance,
    tip: `${p.month}: ${money(p.balance)}`,
  })) ?? [];
  const vals = points.map((p) => p.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title="Proyección" summary="Con tus fijos y tu gasto medio" action={
        <SegmentedControl label="Horizonte" value={months} onChange={setMonths} options={[{ value: '3', label: '3 m' }, { value: '6', label: '6 m' }, { value: '12', label: '12 m' }]} className="w-56" />
      } />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              ['Ingreso mensual', data.monthlyIncome, 'text-success-text'],
              ['Gastos (fijos + medios)', data.monthlyRecurringExpenses + data.avgVariableExpenses, 'text-on-background'],
              ['Neto mensual', data.netMonthly, data.netMonthly >= 0 ? 'text-success-text' : 'text-error-text'],
            ] as const).map(([k, v, cls]) => (
              <div key={k} className="rounded-2xl border border-border bg-background p-4">
                <span className="block text-body-sm text-on-surface-light">{k}</span>
                <span className={cn('block text-heading-sm tabular-nums', cls)}>{money(v)}</span>
              </div>
            ))}
          </div>
          {points.length > 1 && (
            <LineChart data={points} min={min} max={max} dots label={`Saldo proyectado: ${points.map((p) => p.tip).join(', ')}`} goal={min < 0 ? { value: 0, label: 'Cero' } : undefined} />
          )}
          {data.debtProjections.length > 0 && (
            <ul className="flex flex-col gap-2">
              {data.debtProjections.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-body-sm">
                  <span className="flex items-center gap-2"><CalendarClock aria-hidden className="size-4 text-on-surface-light" strokeWidth={1.75} />{d.title}</span>
                  <span className="text-on-surface-light">{d.monthsToPayoff !== null ? `≈ ${d.monthsToPayoff} meses para saldarla` : 'Sin historial de pagos'}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export const PLANNING_TABS = [
  { value: 'budgets', label: 'Presupuestos', icon: Target },
  { value: 'goals', label: 'Metas', icon: PiggyBank },
  { value: 'debts', label: 'Deudas', icon: ArrowUpRight },
  { value: 'recurring', label: 'Fijos', icon: Repeat },
  { value: 'projection', label: 'Proyección', icon: TrendingUp },
] as const;

export function PlanningCard({ children }: { children: ReactNode }) {
  return <Card padding="lg" className="flex flex-col gap-6">{children}</Card>;
}
