// Herramientas de Finanzas sin prototipo propio (presupuestos, metas, deudas,
// recurrentes, proyección), rediseñadas con los componentes del sistema.
// Mismos servicios que el antiguo FinancesExtras / página de Finanzas.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { FinancialGoal, TransactionCategory } from '@noutlife/shared';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Landmark, PiggyBank, Plus, Repeat, Target, Trash2, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { Badge, Button, Card, EmptyState, ErrorState, Field, IconChip, Input, LineChart, ProgressBar, ResponsiveDialog, SegmentedControl, Select, PageLoader, DatePicker } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { useToastStore } from '@/hooks/useToast';
import * as financeService from '@/services/finance.service';
import * as f2 from '@/services/finance2.service';
import { categoriesFor, txCategory } from './financeMeta';

type Money = (n: number) => string;
const toast = () => useToastStore.getState();

const es = {
  loadFail: 'No pudimos cargar esta sección',
  loading: 'Cargando esta sección…',
  save: 'Guardar',
  optional: 'Opcional',
  category: 'Categoría',
  day: 'día',
  deleteAria: (name: string): string => `Eliminar ${name}`,
  // Presupuestos
  budgetsTitle: 'Presupuestos del mes',
  addBudget: 'Presupuesto',
  noBudgets: 'Sin presupuestos',
  noBudgetsDesc: 'Pon un tope por categoría y te avisamos al pasar del 80 %.',
  usedOf: (used: string, total: string): string => `${used} de ${total} usados`,
  ofTotal: (used: string, total: string): string => `${used} de ${total}`,
  expense: 'Gasto',
  income: 'Ingreso',
  budgetCreated: 'Presupuesto creado',
  budgetCreateErr: 'No se pudo crear el presupuesto',
  deleteErr: 'No se pudo eliminar',
  deleteBudgetAria: (name: string): string => `Eliminar presupuesto de ${name}`,
  budgetLabel: (name: string): string => `Presupuesto de ${name}`,
  pctUsed: (n: number): string => `${n} % usado`,
  overBy: (v: string): string => `Te pasaste por ${v}`,
  newBudget: 'Nuevo presupuesto',
  monthlyCap: 'Tope mensual',
  createBudget: 'Crear presupuesto',
  // Metas
  goalsTitle: 'Metas de ahorro',
  addGoal: 'Meta',
  noGoals: 'Sin metas de ahorro',
  noGoalsDesc: 'Ponle nombre y cifra a lo que quieres conseguir.',
  goalCreated: 'Meta creada',
  goalCreateErr: 'No se pudo crear la meta',
  contributed: 'Aporte registrado',
  contributeErr: 'No se pudo registrar el aporte',
  untilDate: (d: string): string => ` · hasta ${d}`,
  achieved: 'Lograda',
  goalProgress: (name: string): string => `Progreso de ${name}`,
  contribute: 'Aportar',
  newGoal: 'Nueva meta de ahorro',
  name: 'Nombre',
  goalNamePh: 'Ej. Viaje a la costa',
  targetAmount: 'Cifra objetivo',
  deadline: 'Fecha límite',
  createGoal: 'Crear meta',
  contributeTitle: (name: string): string => `Aportar a ${name}`,
  contributeLabel: 'Monto del aporte',
  // Deudas
  debtsTitle: 'Deudas',
  addDebt: 'Deuda',
  debtSummary: (owe: string, owed: string): string => `Debes ${owe} · te deben ${owed}`,
  noDebts: 'Sin deudas pendientes',
  iOwe: 'Debes a',
  theyOwe: 'Te debe',
  due: (d: string): string => ` · vence ${d}`,
  paidOf: (p: number, total: string): string => `${p} % pagado de ${total}`,
  paidLabel: (name: string): string => `Pagado de ${name}`,
  paidPct: (p: number): string => `${p} % pagado`,
  registerPayment: 'Registrar pago',
  confirmDelete: 'Confirmar eliminación',
  deleteDebtQ: '¿Eliminar esta deuda?',
  no: 'No',
  delete: 'Eliminar',
  debtCreateErr: 'No se pudo crear la deuda',
  paymentOk: 'Pago registrado',
  paymentErr: 'No se pudo registrar el pago',
  newDebt: 'Nueva deuda',
  debtType: 'Tipo de deuda',
  iOweBtn: 'Yo debo',
  theyOweBtn: 'Me deben',
  concept: 'Concepto',
  amount: 'Monto',
  person: 'Persona',
  dueLabel: 'Vence',
  saveDebt: 'Guardar deuda',
  paymentTitle: (name: string): string => `Pago de ${name}`,
  amountPaid: 'Monto pagado',
  // Fijos
  recurringTitle: 'Ingresos y gastos fijos',
  recurringSummary: (income: string, expenses: string): string => `+${income} · −${expenses} al mes`,
  addFixed: 'Fijo',
  noFixed: 'Sin movimientos fijos',
  noFixedDesc: 'Nómina, alquiler, suscripciones… se registran solos cada mes.',
  recurringMeta: (cat: string, day: string, n: number): string => `${cat} · ${day} ${n}`,
  createErr: 'No se pudo crear',
  newFixed: 'Nuevo movimiento fijo',
  typeLabel: 'Tipo',
  description: 'Descripción',
  descPh: 'Ej. Netflix',
  dayOfMonth: 'Día del mes',
  // Proyección
  projectionTitle: 'Proyección',
  projectionSummary: 'Con tus fijos y tu gasto medio',
  horizon: 'Horizonte',
  incomeMonthly: 'Ingreso mensual',
  expensesAll: 'Gastos (fijos + medios)',
  netMonthly: 'Neto mensual',
  projectedBalance: (list: string): string => `Saldo proyectado: ${list}`,
  zero: 'Cero',
  payoffMonths: (m: number): string => `≈ ${m} meses para saldarla`,
  noPaymentHistory: 'Sin historial de pagos',
  // Ahorro
  savingsTitle: 'Mi ahorro',
  savingsSummary: 'Aparta una parte de tu dinero y llévala aquí.',
  savedNow: 'Ahorrado ahora',
  shareLabel: 'Porción de tus ingresos del mes que ahorraste',
  monthSaved: (dep: string, share: number, inc: string): string => `Este mes apartaste ${dep}, el ${share} % de tus ingresos (${inc}).`,
  putIn: 'Meter dinero',
  takeOut: 'Sacar dinero',
  noSavings: 'Aún no ahorras aquí',
  noSavingsDesc: 'Mete una parte de tu dinero o de un ingreso extra.',
  fromMine: 'De mi dinero',
  toMine: 'A mi dinero',
  extraIncome: 'Ingreso extra',
  spent: 'Gastado',
  savingWord: 'Ahorro',
  withdrawalWord: 'Retiro',
  depositOk: 'Ahorro guardado',
  withdrawOk: 'Retiro registrado',
  moveErr: 'No se pudo registrar el movimiento',
  withdrawTitle: 'Sacar del ahorro',
  depositTitle: 'Meter al ahorro',
  origin: 'Origen',
  destination: 'Destino',
  withdrawToGeneral: 'El dinero vuelve a tu saldo general.',
  withdrawSpent: 'El dinero sale del ahorro y no vuelve a tu saldo.',
  depositFromGeneral: 'Se descuenta de tu saldo general.',
  depositExtra: 'Dinero nuevo que va directo al ahorro, sin tocar tu saldo.',
  onlyHave: (m: string): string => `Solo tienes ${m} ahorrado`,
  tooMuch: 'Es más de lo que tienes ahorrado',
  note: 'Nota',
  notePh: 'Ej. Prima de diciembre',
  depositSourceMine: 'Mi dinero',
  depositSourceExtra: 'Ingreso extra',
  withdrawToMine: 'A mi dinero',
  withdrawSpend: 'Gastarlo',
};

const en: typeof es = {
  loadFail: 'We could not load this section',
  loading: 'Loading this section…',
  save: 'Save',
  optional: 'Optional',
  category: 'Category',
  day: 'day',
  deleteAria: (name: string): string => `Delete ${name}`,
  budgetsTitle: 'Budgets this month',
  addBudget: 'Budget',
  noBudgets: 'No budgets',
  noBudgetsDesc: 'Set a cap per category and we will let you know when you pass 80 %.',
  usedOf: (used: string, total: string): string => `${used} of ${total} used`,
  ofTotal: (used: string, total: string): string => `${used} of ${total}`,
  expense: 'Expense',
  income: 'Income',
  budgetCreated: 'Budget created',
  budgetCreateErr: 'Could not create the budget',
  deleteErr: 'Could not delete',
  deleteBudgetAria: (name: string): string => `Delete budget for ${name}`,
  budgetLabel: (name: string): string => `Budget for ${name}`,
  pctUsed: (n: number): string => `${n} % used`,
  overBy: (v: string): string => `You went over by ${v}`,
  newBudget: 'New budget',
  monthlyCap: 'Monthly cap',
  createBudget: 'Create budget',
  goalsTitle: 'Savings goals',
  addGoal: 'Goal',
  noGoals: 'No savings goals',
  noGoalsDesc: 'Give a name and an amount to what you want to reach.',
  goalCreated: 'Goal created',
  goalCreateErr: 'Could not create the goal',
  contributed: 'Contribution logged',
  contributeErr: 'Could not log the contribution',
  untilDate: (d: string): string => ` · until ${d}`,
  achieved: 'Reached',
  goalProgress: (name: string): string => `Progress of ${name}`,
  contribute: 'Contribute',
  newGoal: 'New savings goal',
  name: 'Name',
  goalNamePh: 'E.g. Trip to the coast',
  targetAmount: 'Target amount',
  deadline: 'Deadline',
  createGoal: 'Create goal',
  contributeTitle: (name: string): string => `Contribute to ${name}`,
  contributeLabel: 'Contribution amount',
  debtsTitle: 'Debts',
  addDebt: 'Debt',
  debtSummary: (owe: string, owed: string): string => `You owe ${owe} · you are owed ${owed}`,
  noDebts: 'No pending debts',
  iOwe: 'You owe',
  theyOwe: 'Owes you',
  due: (d: string): string => ` · due ${d}`,
  paidOf: (p: number, total: string): string => `${p} % paid of ${total}`,
  paidLabel: (name: string): string => `Paid of ${name}`,
  paidPct: (p: number): string => `${p} % paid`,
  registerPayment: 'Log payment',
  confirmDelete: 'Confirm deletion',
  deleteDebtQ: 'Delete this debt?',
  no: 'No',
  delete: 'Delete',
  debtCreateErr: 'Could not create the debt',
  paymentOk: 'Payment logged',
  paymentErr: 'Could not log the payment',
  newDebt: 'New debt',
  debtType: 'Debt type',
  iOweBtn: 'I owe',
  theyOweBtn: 'They owe me',
  concept: 'Concept',
  amount: 'Amount',
  person: 'Person',
  dueLabel: 'Due',
  saveDebt: 'Save debt',
  paymentTitle: (name: string): string => `Payment for ${name}`,
  amountPaid: 'Amount paid',
  recurringTitle: 'Fixed income and expenses',
  recurringSummary: (income: string, expenses: string): string => `+${income} · −${expenses} per month`,
  addFixed: 'Fixed',
  noFixed: 'No fixed items',
  noFixedDesc: 'Payroll, rent, subscriptions… are logged on their own every month.',
  recurringMeta: (cat: string, day: string, n: number): string => `${cat} · ${day} ${n}`,
  createErr: 'Could not create',
  newFixed: 'New fixed item',
  typeLabel: 'Type',
  description: 'Description',
  descPh: 'E.g. Netflix',
  dayOfMonth: 'Day of the month',
  projectionTitle: 'Projection',
  projectionSummary: 'With your fixed items and your average spending',
  horizon: 'Horizon',
  incomeMonthly: 'Monthly income',
  expensesAll: 'Expenses (fixed + average)',
  netMonthly: 'Monthly net',
  projectedBalance: (list: string): string => `Projected balance: ${list}`,
  zero: 'Zero',
  payoffMonths: (m: number): string => `≈ ${m} months to pay it off`,
  noPaymentHistory: 'No payment history',
  savingsTitle: 'My savings',
  savingsSummary: 'Set aside part of your money and keep it here.',
  savedNow: 'Saved now',
  shareLabel: 'Share of this month’s income you saved',
  monthSaved: (dep: string, share: number, inc: string): string => `This month you set aside ${dep}, ${share} % of your income (${inc}).`,
  putIn: 'Add money',
  takeOut: 'Take money out',
  noSavings: 'Nothing saved here yet',
  noSavingsDesc: 'Put part of your money or an extra income here.',
  fromMine: 'From my money',
  toMine: 'Back to my money',
  extraIncome: 'Extra income',
  spent: 'Spent',
  savingWord: 'Savings',
  withdrawalWord: 'Withdrawal',
  depositOk: 'Savings saved',
  withdrawOk: 'Withdrawal logged',
  moveErr: 'Could not log the movement',
  withdrawTitle: 'Take out of savings',
  depositTitle: 'Add to savings',
  origin: 'Source',
  destination: 'Destination',
  withdrawToGeneral: 'The money goes back to your general balance.',
  withdrawSpent: 'The money leaves your savings and does not go back to your balance.',
  depositFromGeneral: 'It is taken from your general balance.',
  depositExtra: 'New money that goes straight to savings, without touching your balance.',
  onlyHave: (m: string): string => `You only have ${m} saved`,
  tooMuch: 'More than you have saved',
  note: 'Note',
  notePh: 'E.g. December bonus',
  depositSourceMine: 'My money',
  depositSourceExtra: 'Extra income',
  withdrawToMine: 'Back to my money',
  withdrawSpend: 'Spend it',
};

const COPY: Copy<typeof es> = { es, en };

/** Pestañas del plan (valores para la página; las etiquetas salen de su propio diccionario). */
export const PLANNING_TABS = [
  { value: 'savings', label: 'Ahorro', icon: Landmark },
  { value: 'budgets', label: 'Presupuestos', icon: Target },
  { value: 'goals', label: 'Metas', icon: PiggyBank },
  { value: 'debts', label: 'Deudas', icon: ArrowUpRight },
  { value: 'recurring', label: 'Fijos', icon: Repeat },
  { value: 'projection', label: 'Proyección', icon: TrendingUp },
] as const;

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
  const t = useText(COPY);
  const copy = useLoadingCopy();
  if (failed) return <ErrorState title={t.loadFail} onRetry={onRetry} autoRetrySeconds={0} className="py-8" />;
  if (loading) return <PageLoader label={t.loading} words={copy.statsFinance} size="sm" />;
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
  const t = useText(COPY);
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
        <Button type="submit" block loading={saving} disabled={!(n > 0)}>{t.save}</Button>
      </form>
    </ResponsiveDialog>
  );
}

// ── Presupuestos ─────────────────────────────────────────────────────────────

export function BudgetsPanel({ month, year, money }: { month: number; year: number; money: Money }) {
  const t = useText(COPY);
  const locale = useLocale();
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
      toast().success(t.budgetCreated);
    } catch { toast().error(t.budgetCreateErr); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const prev = data;
    setData((d) => d?.filter((b) => b.id !== id) ?? d);
    try { await financeService.deleteBudget(id); } catch { setData(prev); toast().error(t.deleteErr); }
  }

  const total = data?.reduce((s, b) => s + Number(b.amount), 0) ?? 0;
  const spent = data?.reduce((s, b) => s + Number(b.spent ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title={t.budgetsTitle} summary={data?.length ? t.usedOf(money(spent), money(total)) : undefined} action={<AddButton label={t.addBudget} onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && data.length === 0 && <EmptyState icon={Target} tone="muted" title={t.noBudgets} description={t.noBudgetsDesc} className="py-8" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((b) => {
            const cat = txCategory(b.category, locale);
            const used = Number(b.spent ?? 0);
            const pct = Number(b.amount) > 0 ? (used / Number(b.amount)) * 100 : 0;
            const over = pct > 100;
            return (
              <Row key={b.id} icon={cat.icon} tone={cat.tone} title={cat.label} meta={t.ofTotal(money(used), money(Number(b.amount)))}
                right={<Badge variant={over ? 'error' : pct > 80 ? 'warning' : 'success'}>{Math.round(pct)}%</Badge>}
                onDelete={() => void remove(b.id)} deleteLabel={t.deleteBudgetAria(cat.label)}>
                <ProgressBar value={Math.min(100, pct)} tone={over ? 'error' : pct > 80 ? 'warning' : 'success'} label={t.budgetLabel(cat.label)} valueText={t.pctUsed(Math.round(pct))} />
                {over && <span className="text-body-sm text-error-text">{t.overBy(money(used - Number(b.amount)))}</span>}
              </Row>
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title={t.newBudget}>
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <Field label={t.category}>
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TransactionCategory }))}>
              {categoriesFor('EXPENSE', locale).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label={t.monthlyCap}>
            <Input data-autofocus type="number" inputMode="decimal" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Button type="submit" block loading={saving} disabled={!(Number(form.amount) > 0)}>{t.createBudget}</Button>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

// ── Metas de ahorro ──────────────────────────────────────────────────────────

export function GoalsPanel({ money }: { money: Money }) {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
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
      toast().success(t.goalCreated);
    } catch { toast().error(t.goalCreateErr); } finally { setSaving(false); }
  }

  async function contribute(n: number) {
    if (!contributing) return;
    try {
      const g = await financeService.contributeToGoal(contributing.id, n);
      setData((d) => d?.map((x) => (x.id === g.id ? g : x)) ?? d);
      setContributing(null);
      toast().success(t.contributed, money(n));
    } catch { toast().error(t.contributeErr); }
  }

  async function remove(id: string) {
    const prev = data;
    setData((d) => d?.filter((g) => g.id !== id) ?? d);
    try { await financeService.deleteFinancialGoal(id); } catch { setData(prev); toast().error(t.deleteErr); }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title={t.goalsTitle} action={<AddButton label={t.addGoal} onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && data.length === 0 && <EmptyState icon={PiggyBank} tone="muted" title={t.noGoals} description={t.noGoalsDesc} className="py-8" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((g) => {
            const pct = Number(g.targetAmount) > 0 ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100 : 0;
            return (
              <Row key={g.id} icon={PiggyBank} tone={g.isCompleted ? 'success' : 'primary'} title={g.title}
                meta={`${money(Number(g.currentAmount))} de ${money(Number(g.targetAmount))}${g.deadline ? t.untilDate(new Date(g.deadline).toLocaleDateString(nf, { day: 'numeric', month: 'short' })) : ''}`}
                right={g.isCompleted ? <Badge variant="success">{t.achieved}</Badge> : <span className="text-label-lg text-primary-text font-mono tabular-nums">{Math.round(pct)}%</span>}
                onDelete={() => void remove(g.id)} deleteLabel={t.deleteAria(g.title)}>
                <ProgressBar value={Math.min(100, pct)} tone={g.isCompleted ? 'success' : 'primary'} shine={!g.isCompleted} label={t.goalProgress(g.title)} valueText={`${Math.round(pct)} %`} />
                {!g.isCompleted && <Button variant="ghost" size="sm" className="self-start" onClick={() => setContributing(g)}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.contribute}</Button>}
              </Row>
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title={t.newGoal}>
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <Field label={t.name}><Input data-autofocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t.goalNamePh} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.targetAmount}><Input type="number" inputMode="decimal" min="0" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} /></Field>
            <Field label={t.deadline} help={t.optional}><DatePicker clearable value={form.deadline} onChange={(v) => setForm((f) => ({ ...f, deadline: v }))} /></Field>
          </div>
          <Button type="submit" block loading={saving} disabled={!form.title.trim() || !(Number(form.targetAmount) > 0)}>{t.createGoal}</Button>
        </form>
      </ResponsiveDialog>
      <AmountDialog open={Boolean(contributing)} title={t.contributeTitle(contributing?.title ?? '')} label={t.contributeLabel} money={money} onClose={() => setContributing(null)} onSubmit={contribute} />
    </div>
  );
}

// ── Deudas ───────────────────────────────────────────────────────────────────

export function DebtsPanel({ money }: { money: Money }) {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
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
    } catch { toast().error(t.debtCreateErr); } finally { setSaving(false); }
  }

  async function pay(n: number) {
    if (!paying) return;
    try {
      await f2.addDebtPayment(paying.id, n, new Date().toISOString().slice(0, 10));
      setPaying(null);
      load();
      toast().success(t.paymentOk, money(n));
    } catch { toast().error(t.paymentErr); }
  }

  async function remove(id: string) {
    setConfirmId(null);
    const prev = data;
    setData((d) => d?.filter((x) => x.id !== id) ?? d);
    try { await f2.deleteDebt(id); } catch { setData(prev); toast().error(t.deleteErr); }
  }

  const open = data?.filter((d) => !d.isPaid) ?? [];
  const owe = open.filter((d) => d.type === 'owe').reduce((s, d) => s + Number(d.currentAmount), 0);
  const owed = open.filter((d) => d.type === 'owed').reduce((s, d) => s + Number(d.currentAmount), 0);

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title={t.debtsTitle} summary={data ? t.debtSummary(money(owe), money(owed)) : undefined} action={<AddButton label={t.addDebt} onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && open.length === 0 && <EmptyState icon={ArrowDownLeft} tone="muted" title={t.noDebts} className="py-8" />}
      {open.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {open.map((d) => {
            const paid = Number(d.originalAmount) > 0 ? (1 - Number(d.currentAmount) / Number(d.originalAmount)) * 100 : 0;
            const iOwe = d.type === 'owe';
            return (
              <Row key={d.id} icon={iOwe ? ArrowUpRight : ArrowDownLeft} tone={iOwe ? 'error' : 'success'} title={d.title}
                meta={`${iOwe ? t.iOwe : t.theyOwe} ${d.personName ?? '—'}${d.dueDate ? t.due(new Date(d.dueDate).toLocaleDateString(nf, { day: 'numeric', month: 'short' })) : ''}`}
                right={<span className="text-label-lg font-mono tabular-nums">{money(Number(d.currentAmount))}</span>}
                onDelete={() => setConfirmId(d.id)} deleteLabel={t.deleteAria(d.title)}>
                <ProgressBar value={paid} tone="success" label={t.paidLabel(d.title)} valueText={t.paidPct(Math.round(paid))} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm text-on-surface-light font-mono tabular-nums">{t.paidOf(Math.round(paid), money(Number(d.originalAmount)))}</span>
                  <Button variant="ghost" size="sm" onClick={() => setPaying(d)}>{t.registerPayment}</Button>
                </div>
                {confirmId === d.id && (
                  <div role="alertdialog" aria-label={t.confirmDelete} className="flex items-center justify-between gap-2 rounded-xl bg-error/[var(--lq-soft-alpha)] p-3">
                    <span className="text-body-sm text-error-text">{t.deleteDebtQ}</span>
                    <span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>{t.no}</Button><Button size="sm" variant="danger" onClick={() => void remove(d.id)}>{t.delete}</Button></span>
                  </div>
                )}
              </Row>
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title={t.newDebt}>
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <SegmentedControl role="radiogroup" label={t.debtType} value={form.type} onChange={(x) => setForm((f) => ({ ...f, type: x }))} options={[{ value: 'owe', label: t.iOweBtn }, { value: 'owed', label: t.theyOweBtn }]} />
          <Field label={t.concept}><Input data-autofocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.amount}><Input type="number" inputMode="decimal" min="0" value={form.originalAmount} onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))} /></Field>
            <Field label={t.person} help={t.optional}><Input value={form.personName} onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))} /></Field>
          </div>
          <Field label={t.dueLabel} help={t.optional}><DatePicker clearable value={form.dueDate} onChange={(v) => setForm((f) => ({ ...f, dueDate: v }))} /></Field>
          <Button type="submit" block loading={saving} disabled={!form.title.trim() || !(Number(form.originalAmount) > 0)}>{t.saveDebt}</Button>
        </form>
      </ResponsiveDialog>
      <AmountDialog open={Boolean(paying)} title={t.paymentTitle(paying?.title ?? '')} label={t.amountPaid} money={money} onClose={() => setPaying(null)} onSubmit={pay} />
    </div>
  );
}

// ── Recurrentes ──────────────────────────────────────────────────────────────

export function RecurringPanel({ money }: { money: Money }) {
  const t = useText(COPY);
  const locale = useLocale();
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
    } catch { toast().error(t.createErr); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const prev = data;
    setData((d) => d?.filter((x) => x.id !== id) ?? d);
    try { await f2.deleteRecurring(id); } catch { setData(prev); toast().error(t.deleteErr); }
  }

  const income = data?.filter((i) => i.type === 'INCOME').reduce((s, i) => s + Number(i.amount), 0) ?? 0;
  const expenses = data?.filter((i) => i.type === 'EXPENSE').reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title={t.recurringTitle} summary={data ? t.recurringSummary(money(income), money(expenses)) : undefined} action={<AddButton label={t.addFixed} onClick={() => setAdding(true)} />} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && data.length === 0 && <EmptyState icon={Repeat} tone="muted" title={t.noFixed} description={t.noFixedDesc} className="py-8" />}
      {data && data.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((i) => {
            const cat = txCategory(i.category, locale);
            const isIncome = i.type === 'INCOME';
            return (
              <Row key={i.id} icon={cat.icon} tone={isIncome ? 'success' : cat.tone} title={i.description} meta={t.recurringMeta(cat.label, t.day, i.dayOfMonth)}
                right={<span className={cn('text-label-lg font-mono tabular-nums', isIncome ? 'text-success-text' : 'text-on-background')}>{isIncome ? '+' : '−'}{money(Number(i.amount))}</span>}
                onDelete={() => void remove(i.id)} deleteLabel={t.deleteAria(i.description)} />
            );
          })}
        </ul>
      )}
      <ResponsiveDialog open={adding} onClose={() => setAdding(false)} title={t.newFixed}>
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <SegmentedControl role="radiogroup" label={t.typeLabel} value={form.type} onChange={(x) => setForm((f) => ({ ...f, type: x, category: x === 'INCOME' ? 'SALARY' : 'OTHER' }))} options={[{ value: 'EXPENSE', label: t.expense }, { value: 'INCOME', label: t.income }]} />
          <Field label={t.description}><Input data-autofocus value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t.descPh} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.amount}><Input type="number" inputMode="decimal" min="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
            <Field label={t.category}>
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TransactionCategory }))}>
                {categoriesFor(form.type, locale).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label={t.dayOfMonth}><Input type="number" min="1" max="28" value={form.dayOfMonth} onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: e.target.value }))} /></Field>
          </div>
          <Button type="submit" block loading={saving} disabled={!form.description.trim() || !(Number(form.amount) > 0)}>{t.save}</Button>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

// ── Proyección ───────────────────────────────────────────────────────────────

export function ProjectionPanel({ money }: { money: Money }) {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
  const [months, setMonths] = useState<'3' | '6' | '12'>('3');
  const fetcher = useCallback(() => f2.fetchProjection(Number(months)), [months]);
  const { data, failed, load } = useLoader(fetcher);
  const points = data?.projection.map((p) => ({
    label: new Date(`${p.month}-01T12:00:00`).toLocaleDateString(nf, { month: 'short' }),
    value: p.balance,
    tip: `${p.month}: ${money(p.balance)}`,
  })) ?? [];
  const vals = points.map((p) => p.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(1, ...vals);

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title={t.projectionTitle} summary={t.projectionSummary} action={
        <SegmentedControl label={t.horizon} value={months} onChange={setMonths} options={[{ value: '3', label: '3 m' }, { value: '6', label: '6 m' }, { value: '12', label: '12 m' }]} className="w-56" />
      } />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              [t.incomeMonthly, data.monthlyIncome, 'text-success-text'],
              [t.expensesAll, data.monthlyRecurringExpenses + data.avgVariableExpenses, 'text-on-background'],
              [t.netMonthly, data.netMonthly, data.netMonthly >= 0 ? 'text-success-text' : 'text-error-text'],
            ] as const).map(([k, v, cls]) => (
              <div key={k} className="rounded-2xl border border-border bg-background p-4">
                <span className="block text-body-sm text-on-surface-light">{k}</span>
                <span className={cn('block text-heading-sm font-mono tabular-nums', cls)}>{money(v)}</span>
              </div>
            ))}
          </div>
          {points.length > 1 && (
            <LineChart data={points} min={min} max={max} dots label={t.projectedBalance(points.map((p) => p.tip).join(', '))} goal={min < 0 ? { value: 0, label: t.zero } : undefined} />
          )}
          {data.debtProjections.length > 0 && (
            <ul className="flex flex-col gap-2">
              {data.debtProjections.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-body-sm">
                  <span className="flex items-center gap-2"><CalendarClock aria-hidden className="size-4 text-on-surface-light" strokeWidth={1.75} />{d.title}</span>
                  <span className="text-on-surface-light">{d.monthsToPayoff !== null ? t.payoffMonths(d.monthsToPayoff) : t.noPaymentHistory}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ── Ahorro (alcancía) ────────────────────────────────────────────────────────

export function SavingsPanel({ money, onChanged }: { money: Money; onChanged: () => void }) {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
  const DEPOSIT_SOURCES = [
    { value: 'GENERAL', label: t.depositSourceMine },
    { value: 'EXTRA', label: t.depositSourceExtra },
  ] as const;
  const WITHDRAW_TARGETS = [
    { value: 'GENERAL', label: t.withdrawToMine },
    { value: 'OUT', label: t.withdrawSpend },
  ] as const;
  const { data, failed, load } = useLoader(financeService.fetchSavings);
  const [dialog, setDialog] = useState<'DEPOSIT' | 'WITHDRAW' | null>(null);
  const [counterpart, setCounterpart] = useState<'GENERAL' | 'EXTRA' | 'OUT'>('GENERAL');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  function open(kind: 'DEPOSIT' | 'WITHDRAW') {
    setDialog(kind); setCounterpart('GENERAL'); setAmount(''); setNote('');
  }

  const value = Number(amount);
  const tooMuch = dialog === 'WITHDRAW' && data ? value > data.balance : false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dialog || !(value > 0) || tooMuch) return;
    setSaving(true);
    try {
      await financeService.moveSavings({ kind: dialog, counterpart, amount: value, note: note.trim() || undefined });
      toast().success(dialog === 'DEPOSIT' ? t.depositOk : t.withdrawOk, money(value));
      setDialog(null);
      load();
      onChanged();
    } catch { toast().error(t.moveErr); } finally { setSaving(false); }
  }

  const share = data && data.monthIncome > 0 ? Math.min(100, Math.round((data.monthDeposited / data.monthIncome) * 100)) : null;

  return (
    <div className="flex flex-col gap-4">
      <PanelHead title={t.savingsTitle} summary={t.savingsSummary} />
      <PanelState failed={failed} loading={!data && !failed} onRetry={load} />
      {data && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <IconChip icon={Landmark} tone="success" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-on-surface-light">{t.savedNow}</p>
                <p className="truncate text-heading-md font-mono tabular-nums text-on-background">{money(data.balance)}</p>
              </div>
            </div>
            {share !== null && (
              <>
                <ProgressBar value={share} tone="success" label={t.shareLabel} valueText={`${share} %`} />
                <p className="text-body-sm text-on-surface-light">
                  {t.monthSaved(money(data.monthDeposited), share, money(data.monthIncome))}
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => open('DEPOSIT')}><ArrowDownLeft aria-hidden className="size-4" strokeWidth={2} />{t.putIn}</Button>
              <Button size="sm" variant="secondary" disabled={data.balance <= 0} onClick={() => open('WITHDRAW')}><ArrowUpRight aria-hidden className="size-4" strokeWidth={2} />{t.takeOut}</Button>
            </div>
          </div>
          {data.entries.length === 0
            ? <EmptyState icon={PiggyBank} tone="muted" title={t.noSavings} description={t.noSavingsDesc} className="py-6" />
            : (
              <ul className="flex flex-col gap-2">
                {data.entries.map((en) => {
                  const dep = en.kind === 'DEPOSIT';
                  const where = en.counterpart === 'EXTRA' ? t.extraIncome : en.counterpart === 'OUT' ? t.spent : dep ? t.fromMine : t.toMine;
                  return (
                    <li key={en.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                      <IconChip icon={dep ? ArrowDownLeft : ArrowUpRight} tone={dep ? 'success' : 'warning'} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-label-lg text-on-background">{en.note || (dep ? t.savingWord : t.withdrawalWord)}</span>
                        <span className="block truncate text-body-sm text-on-surface-light">
                          {where} · {new Date(en.createdAt).toLocaleDateString(nf, { day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                      <span className={cn('font-mono text-label-lg tabular-nums', dep ? 'text-success-text' : 'text-on-surface')}>{dep ? '+' : '−'}{money(en.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
        </>
      )}
      <ResponsiveDialog open={dialog !== null} onClose={() => setDialog(null)} title={dialog === 'WITHDRAW' ? t.withdrawTitle : t.depositTitle}>
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <SegmentedControl
            role="radiogroup"
            label={dialog === 'WITHDRAW' ? t.destination : t.origin}
            value={counterpart}
            onChange={setCounterpart}
            options={(dialog === 'WITHDRAW' ? WITHDRAW_TARGETS : DEPOSIT_SOURCES).map((o) => ({ value: o.value, label: o.label }))}
          />
          <p className="text-body-sm text-on-surface-light">
            {dialog === 'WITHDRAW'
              ? counterpart === 'GENERAL' ? t.withdrawToGeneral : t.withdrawSpent
              : counterpart === 'GENERAL' ? t.depositFromGeneral : t.depositExtra}
          </p>
          <Field label={t.amount} help={tooMuch && data ? t.onlyHave(money(data.balance)) : value > 0 ? money(value) : undefined} error={tooMuch ? t.tooMuch : undefined}>
            <Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t.note} help={t.optional}>
            <Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={t.notePh} />
          </Field>
          <Button type="submit" block loading={saving} disabled={!(value > 0) || tooMuch}>{t.save}</Button>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

export function PlanningCard({ children }: { children: ReactNode }) {
  return <Card padding="lg" className="flex flex-col gap-6">{children}</Card>;
}
