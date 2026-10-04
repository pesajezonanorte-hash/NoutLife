// Finanzas — Finances.dc.html (móvil) / FinancesDesktop.dc.html (desktop).
// Debajo del prototipo: planificación (presupuestos, metas, deudas, fijos,
// proyección) rediseñada con los mismos servicios.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Transaction } from '@lifequest/shared';
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Info, Minus, Plus, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { dayKey, formatMoney } from '@/lib/lifeMeta';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import { AnimatedValue, BarChart, Button, Card, EmptyState, ErrorState, IconChip, ResponsiveDialog, SegmentedControl, Tabs, type BarDatum, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { solidBg } from '@/components/ui/lq/tones';
import * as financeService from '@/services/finance.service';
import { SHARE_TONES, monthRange, pctChange, txCategory } from '@/components/finances/financeMeta';
import { TransactionFormDialog } from '@/components/finances/TransactionFormDialog';
import { BudgetsPanel, DebtsPanel, GoalsPanel, PLANNING_TABS, ProjectionPanel, RecurringPanel } from '@/components/finances/PlanningTools';

type Summary = { income: number; expenses: number; balance: number; byCategory: Record<string, number>; count: number };
type TxTab = 'all' | 'INCOME' | 'EXPENSE';
type PlanTab = (typeof PLANNING_TABS)[number]['value'];
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const EMPTY: Summary = { income: 0, expenses: 0, balance: 0, byCategory: {}, count: 0 };

function summarize(txs: Transaction[]): Summary {
  const s: Summary = { ...EMPTY, byCategory: {} };
  for (const t of txs) {
    const a = Number(t.amount);
    if (t.type === 'INCOME') s.income += a;
    else { s.expenses += a; s.byCategory[t.category] = (s.byCategory[t.category] ?? 0) + a; }
  }
  s.balance = s.income - s.expenses;
  s.count = txs.length;
  return s;
}

function FinancesSkeleton() {
  return <PageLoader label="Cargando tus finanzas…" words={LOADING_COPY.statsFinance} />;
}

function Trend({ value, good, suffix }: { value: number | null; good: 'up' | 'down'; suffix: string }) {
  if (value === null) return <span className="text-body-sm text-on-surface-light">Sin datos del mes anterior</span>;
  if (value === 0) return <span className="flex items-center gap-1 text-body-sm text-on-surface"><Minus aria-hidden className="size-4" />Igual que {suffix}</span>;
  const up = value > 0;
  const positive = (up && good === 'up') || (!up && good === 'down');
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-1 text-body-sm', positive ? 'text-success-text' : 'text-error-text')}>
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />{up ? '+' : ''}{value}% vs. {suffix}
    </span>
  );
}

export default function FinancesPage() {
  const currency = useAuthStore((s) => s.user?.currency) ?? 'COP';
  const money = useCallback((n: number) => formatMoney(n, currency), [currency]);
  const compact = useCallback((n: number) => formatMoney(n, currency, true), [currency]);
  const [offset, setOffset] = useState(0);
  const range = useMemo(() => monthRange(offset), [offset]);
  const prevRange = useMemo(() => monthRange(offset - 1), [offset]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prev, setPrev] = useState<Summary | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [txTab, setTxTab] = useState<TxTab>('all');
  const [showAll, setShowAll] = useState(false);
  const [plan, setPlan] = useState<PlanTab>('budgets');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [payday, setPayday] = useState(() => {
    const d = new Date().getDate();
    try { return [1, 15, 30].includes(d) && sessionStorage.getItem('lq-payday') !== new Date().toDateString(); } catch { return false; }
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      // TODO(api): /finances/transactions con from y to aplica solo `to` (el segundo filtro de fecha
      // pisa al primero), así que se pide hasta fin de mes y se recorta al mes en el cliente.
      const [list, s, p] = await Promise.all([
        financeService.fetchTransactions({ to: `${range.to}T23:59:59` }),
        financeService.fetchTransactionSummary(range.from, `${range.to}T23:59:59`).catch(() => null),
        financeService.fetchTransactionSummary(prevRange.from, `${prevRange.to}T23:59:59`).catch(() => null),
      ]);
      const inMonth = list.filter((t) => { const k = t.date.slice(0, 10); return k >= range.from && k <= range.to; });
      setTxs(inMonth);
      const local = summarize(inMonth);
      // El reparto por categoría sale de los movimientos si el resumen no lo trae.
      setSummary(s ? { ...EMPTY, ...s, byCategory: Object.keys(s.byCategory ?? {}).length ? s.byCategory : local.byCategory } : local);
      setPrev(p ? { ...EMPTY, ...p } : null);
      setState('ready');
    } catch {
      if (!silent) setState('error');
    }
  }, [range, prevRange]);

  useEffect(() => { void load(); setShowAll(false); }, [load]);

  async function remove(t: Transaction) {
    setTxs((list) => list.filter((x) => x.id !== t.id));
    try {
      await financeService.deleteTransaction(t.id);
      useToastStore.getState().success('Movimiento eliminado');
      void load(true);
    } catch {
      useToastStore.getState().error('No se pudo eliminar');
      void load(true);
    }
  }

  const s = summary ?? EMPTY;
  const savingsRate = s.income > 0 ? Math.round((s.balance / s.income) * 100) : null;

  // Gastos de los últimos 7 días del mes visible (hasta hoy si es el mes actual).
  const week: BarDatum[] = useMemo(() => {
    const end = offset === 0 ? new Date() : range.last;
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(end); d.setDate(end.getDate() - (6 - i)); return d; });
    const vals = days.map((d) => {
      const k = dayKey(d);
      return txs.filter((t) => t.type === 'EXPENSE' && t.date.slice(0, 10) === k).reduce((a, t) => a + Number(t.amount), 0);
    });
    const max = Math.max(...vals);
    return days.map((d, i) => ({
      label: DAY_NAMES[d.getDay()].slice(0, 3),
      value: vals[i],
      highlight: max > 0 && vals[i] === max,
      tip: `${DAY_NAMES[d.getDay()]} · ${money(vals[i])}`,
    }));
  }, [txs, offset, range, money]);
  const weekTotal = week.reduce((a, b) => a + b.value, 0);

  const cats = Object.entries(s.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const catTotal = cats.reduce((a, [, v]) => a + v, 0);
  const shown = txs.filter((t) => txTab === 'all' || t.type === txTab);
  const visible = showAll ? shown : shown.slice(0, 8);

  const monthPicker = (
    <div className="flex items-center gap-1" role="group" aria-label="Mes">
      <Button variant="icon" aria-label="Mes anterior" onClick={() => setOffset((o) => o - 1)}><ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      <span className="min-w-[9.5rem] text-center text-label-lg font-mono tabular-nums" aria-live="polite">{range.label}</span>
      <Button variant="icon" aria-label="Mes siguiente" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))}><ChevronRight aria-hidden className="size-5" strokeWidth={1.75} /></Button>
    </div>
  );

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{range.label}</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Finanzas</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {monthPicker}
        <Button size="md" onClick={() => setAdding(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Transacción</Button>
      </div>
    </motion.section>
  );

  let body;
  if (state === 'loading') body = <FinancesSkeleton />;
  else if (state === 'error') body = <ErrorState title="No pudimos cargar tus finanzas" onRetry={() => void load()} />;
  else {
    body = (
      <div className="flex flex-col gap-6 md:gap-12">
        {payday && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/[var(--lq-soft-alpha)] p-4">
            <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-info-text" strokeWidth={1.75} />
            <p className="flex-1 text-body-md text-on-surface">
              <b className="text-info-text">Día de pago.</b> Aparta tu ahorro, paga primero las deudas con más interés y revisa tus presupuestos.
            </p>
            <Button variant="icon" aria-label="Ocultar aviso" className="-m-2" onClick={() => { setPayday(false); try { sessionStorage.setItem('lq-payday', new Date().toDateString()); } catch { /* */ } }}>
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          </div>
        )}

        {/* KPIs */}
        <section aria-label="Resumen del mes" className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] md:gap-6">
          <Card variant="elevated" padding="lg" interactive className="flex flex-col gap-1 border-transparent bg-primary/[var(--lq-soft-alpha)] md:order-last md:gap-3">
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-on-surface md:text-body-md">Saldo del mes</span>
              <IconChip icon={Wallet} tone="primary" size="sm" className="hidden bg-background md:flex" />
            </div>
            <span className={cn('text-display-md font-mono tabular-nums md:text-display-lg', s.balance < 0 ? 'text-error-text' : 'text-primary-text')}>
              <AnimatedValue value={s.balance} format={compact} />
            </span>
            {savingsRate !== null
              ? <span className={cn('text-body-sm', savingsRate >= 0 ? 'text-success-text' : 'text-error-text')}>{savingsRate >= 0 ? `Ahorras el ${savingsRate} %` : `Gastas ${-savingsRate} % más de lo que ingresas`}</span>
              : <Trend value={pctChange(s.balance, prev?.balance ?? 0)} good="up" suffix={prevRange.label.split(' ')[0].toLowerCase()} />}
          </Card>
          <div className="grid grid-cols-2 gap-4 md:contents">
            {([
              ['Ingresos', s.income, prev?.income, ArrowDownLeft, 'success', 'up'],
              ['Gastos', s.expenses, prev?.expenses, ArrowUpRight, 'error', 'down'],
            ] as const).map(([label, v, pv, Icon, tone, good], i) => (
              <Card key={label} padding="lg" interactive className={cn('flex flex-col gap-2 max-md:p-4 md:gap-3', i === 0 ? 'md:order-first' : 'md:order-2')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm text-on-surface-light md:text-body-md">{label}</span>
                  <IconChip icon={Icon} tone={tone} size="sm" />
                </div>
                <span className="text-heading-md font-mono tabular-nums md:text-display-lg"><AnimatedValue value={v} format={compact} /></span>
                <span className="hidden md:block"><Trend value={pv !== undefined ? pctChange(v, pv) : null} good={good} suffix={prevRange.label.split(' ')[0].toLowerCase()} /></span>
              </Card>
            ))}
          </div>
        </section>

        {s.count === 0 && txs.length === 0 ? (
          <EmptyState
            icon={Wallet}
            tone="info"
            title="Sin movimientos"
            description={offset === 0 ? 'Registra tu primer gasto o ingreso.' : `No registraste movimientos en ${range.label.toLowerCase()}.`}
            action={<Button onClick={() => setAdding(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Transacción</Button>}
            className="py-12"
          />
        ) : (
          <>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
              <Card as="section" padding="lg" aria-labelledby="fin-week" className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="fin-week" className="text-heading-sm md:text-heading-lg">Gastos · últimos 7 días</h2>
                  <span className="text-heading-sm font-mono tabular-nums">{money(weekTotal)}</span>
                </div>
                <BarChart data={week} label={`Gastos diarios: ${week.map((d) => d.tip).join(', ')}`} tone="primary" highlightTone="error" grid height={200} formatValue={compact} />
              </Card>

              <Card as="section" padding="lg" aria-labelledby="fin-cats" className="flex flex-col gap-5">
                <h2 id="fin-cats" className="text-heading-sm">Por categoría</h2>
                {cats.length === 0 ? (
                  <p className="text-body-md text-on-surface-light">Sin gastos este mes.</p>
                ) : (
                  <>
                    <div className="flex h-3 gap-[3px] overflow-hidden rounded-full" role="img" aria-label={cats.map(([c, v]) => `${txCategory(c).label} ${Math.round((v / catTotal) * 100)} %`).join(', ')}>
                      {cats.map(([c, v], i) => (
                        <motion.span
                          key={c}
                          className={cn('block h-full origin-left', solidBg[SHARE_TONES[i % SHARE_TONES.length]])}
                          style={{ flex: v }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
                        />
                      ))}
                    </div>
                    <ul className="flex flex-col gap-3">
                      {cats.slice(0, 6).map(([c, v], i) => (
                        <li key={c} className="flex items-center gap-3">
                          <span aria-hidden className={cn('size-3 shrink-0 rounded', solidBg[SHARE_TONES[i % SHARE_TONES.length]])} />
                          <span className="flex-1 text-body-md">{txCategory(c).label}</span>
                          <span className="text-body-sm text-on-surface-light font-mono tabular-nums">{Math.round((v / catTotal) * 100)} %</span>
                          <span className="w-24 text-right text-label-lg font-mono tabular-nums">{compact(v)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>

            <Card as="section" padding="lg" aria-labelledby="fin-tx" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 id="fin-tx" className="text-heading-sm md:text-heading-lg">Movimientos</h2>
                <SegmentedControl label="Tipo de movimiento" value={txTab} onChange={(v) => { setTxTab(v); setShowAll(false); }} options={[{ value: 'all', label: 'Todos' }, { value: 'INCOME', label: 'Ingresos' }, { value: 'EXPENSE', label: 'Gastos' }]} className="w-full md:max-w-[380px]" />
              </div>
              {shown.length === 0 ? (
                <p className="py-6 text-center text-body-md text-on-surface-light">Nada en este filtro.</p>
              ) : (
                <motion.ul key={`${txTab}-${offset}`} variants={stagger} initial="initial" animate="animate" className="flex flex-col">
                  {visible.map((t, i) => {
                    const cat = txCategory(t.category);
                    const income = t.type === 'INCOME';
                    return (
                      <motion.li
                        key={t.id}
                        variants={item}
                        className={cn('group relative grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md hover:bg-surface-variant/60 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:gap-4', i < visible.length - 1 && 'border-b border-border')}
                      >
                        <IconChip icon={income ? ArrowDownLeft : cat.icon} tone={income ? 'success' : cat.tone} size="sm" />
                        <div className="min-w-0">
                          <button type="button" aria-haspopup="dialog" onClick={() => setDetail(t)} className="block max-w-full truncate text-left text-body-md font-semibold lq-stretch after:absolute after:inset-0 after:content-['']">{t.description || cat.label}</button>
                          <div className="truncate text-body-sm text-on-surface-light">
                            {income ? 'Ingreso' : cat.label} · {new Date(t.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <span className={cn('text-body-md font-semibold font-mono tabular-nums md:text-heading-sm', income ? 'text-success-text' : 'text-on-background')}>
                          {income ? '+' : '−'}{money(Number(t.amount))}
                        </span>
                        <Button
                          variant="icon"
                          aria-label={`Eliminar ${t.description || cat.label}`}
                          onClick={() => void remove(t)}
                          className="relative z-[1] -mr-2 hidden hover:text-error-text md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                        >
                          <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                        </Button>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}
              {shown.length > 8 && (
                <Button variant="ghost" size="md" className="self-center" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Ver menos' : `Ver todos (${shown.length})`}
                </Button>
              )}
            </Card>
          </>
        )}

        {/* Planificación */}
        <section aria-labelledby="fin-plan" className="flex flex-col gap-4">
          <h2 id="fin-plan" className="text-heading-sm md:text-heading-lg">Planificación</h2>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <Tabs label="Herramientas de planificación" value={plan} onChange={setPlan} options={PLANNING_TABS.map(({ value, label }) => ({ value, label }))} className="min-w-max" />
          </div>
          <Card padding="lg" role="tabpanel" aria-label={PLANNING_TABS.find((t) => t.value === plan)?.label}>
            {plan === 'budgets' && <BudgetsPanel month={range.month} year={range.year} money={compact} />}
            {plan === 'goals' && <GoalsPanel money={money} />}
            {plan === 'debts' && <DebtsPanel money={money} />}
            {plan === 'recurring' && <RecurringPanel money={money} />}
            {plan === 'projection' && <ProjectionPanel money={compact} />}
          </Card>
        </section>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      {header}
      <motion.div variants={item}>{body}</motion.div>
      <ResponsiveDialog open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? (detail.description || txCategory(detail.category).label) : ''}>
        {detail && (() => {
          const cat = txCategory(detail.category);
          const income = detail.type === 'INCOME';
          return (
            <div className="flex flex-col gap-5">
              <span className={cn('text-display-sm font-mono tabular-nums', income ? 'text-success-text' : 'text-on-background')}>{income ? '+' : '−'}{money(Number(detail.amount))}</span>
              <dl className="flex flex-col gap-1">
                {[['Tipo', income ? 'Ingreso' : 'Gasto'], ['Categoría', cat.label], ['Fecha', new Date(detail.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })]].map(([k, v]) => (
                  <div key={k} className="flex min-h-10 items-center justify-between gap-4 border-b border-border last:border-0">
                    <dt className="text-body-md text-on-surface-light">{k}</dt><dd className="text-label-lg">{v}</dd>
                  </div>
                ))}
              </dl>
              <Button variant="danger" block onClick={() => { const t = detail; setDetail(null); void remove(t); }}>
                <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Eliminar movimiento
              </Button>
            </div>
          );
        })()}
      </ResponsiveDialog>
      <TransactionFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(true); }} />
    </motion.div>
  );
}
