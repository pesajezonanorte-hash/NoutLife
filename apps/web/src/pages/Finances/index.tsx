// Finanzas — Finances.dc.html (móvil) / FinancesDesktop.dc.html (desktop).
// Debajo del prototipo: planificación (presupuestos, metas, deudas, fijos,
// proyección) rediseñada con los mismos servicios.
//
// Movimiento «de banco»: los saldos son odómetros que ruedan con peso, la tarjeta
// de saldo se inclina como una tarjeta física y mide el flujo del mes, y todo está
// enlazado: pasar por un día del gráfico resalta sus movimientos (y al revés), pasar
// por una categoría resalta su tramo y sus movimientos. Un movimiento nuevo entra
// con un golpe y el saldo lo acusa; al cambiar de mes los números ruedan al nuevo
// valor sin recargar la página.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transaction } from '@noutlife/shared';
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Info, Minus, Plus, Trash2, TrendingDown, TrendingUp, Wallet, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, heavy, item, slam, stagger, useSpotlight } from '@/lib/motion';
import { dayKey, formatMoney } from '@/lib/lifeMeta';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import { AnimatedValue, Button, Card, EmptyState, ErrorState, IconChip, ResponsiveDialog, SegmentedControl, Tabs, Thud, WeightBars, type WeightBar, PageLoader } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { solidBg } from '@/components/ui/lq/tones';
import * as financeService from '@/services/finance.service';
import { SHARE_TONES, monthRange, pctChange, txCategory } from '@/components/finances/financeMeta';
import { TransactionFormDialog } from '@/components/finances/TransactionFormDialog';
import { BudgetsPanel, DebtsPanel, GoalsPanel, PLANNING_TABS, ProjectionPanel, RecurringPanel, SavingsPanel } from '@/components/finances/PlanningTools';
import { CategoryChecklists } from '@/components/checklists/CategoryChecklists';
import { Lettering } from '@/components/layout/Lettering';
import { SketchUnderline, ZoneShell } from '@/components/ambience';
import { BalanceChart, MarketBackdrop, Ticker, dailyBalance, type Quote } from '@/components/finances/Market';
import { CashflowCard } from '@/components/finances/CashflowCard';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

type Summary = { income: number; expenses: number; balance: number; byCategory: Record<string, number>; count: number };
type TxTab = 'all' | 'INCOME' | 'EXPENSE';
type PlanTab = (typeof PLANNING_TABS)[number]['value'];
/** Categorías de gasto que en realidad apartan dinero. */
const SAVED_CATEGORIES = new Set<string>(['SAVINGS', 'INVESTMENT']);
const EMPTY: Summary = { income: 0, expenses: 0, balance: 0, byCategory: {}, count: 0 };

const es = {
  loading: 'Cargando tus finanzas…',
  loadFailed: 'No pudimos cargar tus finanzas',
  prevMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',
  newTx: 'Transacción',
  updating: 'Actualizando',
  monthGroup: 'Mes',
  payday: 'Día de pago.',
  paydayBody: 'Aparta tu ahorro, paga primero las deudas con más interés y revisa tus presupuestos.',
  hideNotice: 'Ocultar aviso',
  balanceMonth: 'Saldo del mes',
  meterLabel: 'Gastado de lo ingresado',
  savingsPositive: (n: number): string => `Ahorras el ${n} %`,
  savingsNegative: (n: number): string => `Gastas ${n} % más de lo que ingresas`,
  noPrevData: 'Sin datos del mes anterior',
  sameAs: (s: string): string => `Igual que ${s}`,
  vs: (sign: string, v: number, s: string): string => `${sign}${v}% vs. ${s}`,
  income: 'Ingresos',
  expenses: 'Gastos',
  weekTitle: 'Gastos · últimos 7 días',
  weekHint: 'Pasa por un día para ver sus movimientos abajo.',
  weekLabel: (items: string): string => `Gastos diarios: ${items}`,
  bestDay: 'Día de mayor gasto',
  noExpenses: 'Sin gastos',
  movement: 'movimiento',
  movements: 'movimientos',
  byCategory: 'Por categoría',
  noExpensesMonth: 'Sin gastos este mes.',
  catAria: (items: string): string => `Reparto por categoría: ${items}`,
  movementsTitle: 'Movimientos',
  allFilter: 'Todos',
  incomeFilter: 'Ingresos',
  expenseFilter: 'Gastos',
  movementTypeLabel: 'Tipo de movimiento',
  nothingHere: 'Nada en este filtro.',
  incomeWord: 'Ingreso',
  deleteLabel: (name: string): string => `Eliminar ${name}`,
  viewLess: 'Ver menos',
  viewAll: (n: number): string => `Ver todos (${n})`,
  planning: 'Planificación',
  planTabsLabel: 'Herramientas de planificación',
  planTabs: { savings: 'Ahorro', budgets: 'Presupuestos', goals: 'Metas', debts: 'Deudas', recurring: 'Fijos', projection: 'Proyección' } as Record<string, string>,
  emptyTitle: 'Sin movimientos',
  emptyBody: 'Registra tu primer gasto o ingreso.',
  emptyNone: (m: string): string => `No registraste movimientos en ${m}.`,
  txAdd: 'Transacción',
  detailType: 'Tipo',
  detailCategory: 'Categoría',
  detailDate: 'Fecha',
  typeIncome: 'Ingreso',
  typeExpense: 'Gasto',
  deleteTx: 'Eliminar movimiento',
  deleted: 'Movimiento eliminado',
  deleteFailed: 'No se pudo eliminar',
  pendingFinance: 'Pendientes financieros',
  pendingFinanceBody: 'Pagos, trámites y revisiones por hacer.',
  financeWord: 'Finanzas',
  tickerLabel: 'Tus cifras del mes frente al anterior',
  savingsQuote: 'Ahorro',
  balanceTrend: 'Evolución del saldo del mes',
};

const en: typeof es = {
  loading: 'Loading your finances…',
  loadFailed: "We couldn't load your finances",
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  newTx: 'Transaction',
  updating: 'Updating',
  monthGroup: 'Month',
  payday: 'Payday.',
  paydayBody: 'Set your savings aside, pay the highest-interest debts first and check your budgets.',
  hideNotice: 'Hide notice',
  balanceMonth: 'Balance this month',
  meterLabel: 'Spent from what came in',
  savingsPositive: (n: number): string => `You save ${n}%`,
  savingsNegative: (n: number): string => `You spend ${n}% more than you earn`,
  noPrevData: 'No data from last month',
  sameAs: (s: string): string => `Same as ${s}`,
  vs: (sign: string, v: number, s: string): string => `${sign}${v}% vs. ${s}`,
  income: 'Income',
  expenses: 'Expenses',
  weekTitle: 'Spending · last 7 days',
  weekHint: 'Hover over a day to see its movements below.',
  weekLabel: (items: string): string => `Daily spending: ${items}`,
  bestDay: 'Highest-spending day',
  noExpenses: 'No spending',
  movement: 'movement',
  movements: 'movements',
  byCategory: 'By category',
  noExpensesMonth: 'No spending this month.',
  catAria: (items: string): string => `Split by category: ${items}`,
  movementsTitle: 'Movements',
  allFilter: 'All',
  incomeFilter: 'Income',
  expenseFilter: 'Expenses',
  movementTypeLabel: 'Movement type',
  nothingHere: 'Nothing matches this filter.',
  incomeWord: 'Income',
  deleteLabel: (name: string): string => `Delete ${name}`,
  viewLess: 'Show less',
  viewAll: (n: number): string => `Show all (${n})`,
  planning: 'Planning',
  planTabsLabel: 'Planning tools',
  planTabs: { savings: 'Savings', budgets: 'Budgets', goals: 'Goals', debts: 'Debts', recurring: 'Recurring', projection: 'Forecast' } as Record<string, string>,
  emptyTitle: 'No movements yet',
  emptyBody: 'Log your first expense or income.',
  emptyNone: (m: string): string => `You didn't log any movements in ${m}.`,
  txAdd: 'Transaction',
  detailType: 'Type',
  detailCategory: 'Category',
  detailDate: 'Date',
  typeIncome: 'Income',
  typeExpense: 'Expense',
  deleteTx: 'Delete movement',
  deleted: 'Movement deleted',
  deleteFailed: "We couldn't delete it",
  pendingFinance: 'Financial to-dos',
  pendingFinanceBody: 'Payments, paperwork and reviews to do.',
  financeWord: 'Finances',
  tickerLabel: 'Your numbers this month vs. last month',
  savingsQuote: 'Savings',
  balanceTrend: 'Balance over the month',
};

const COPY: Copy<typeof es> = { es, en };

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

function Trend({ value, good, suffix, t }: { value: number | null; good: 'up' | 'down'; suffix: string; t: { noPrevData: string; sameAs: (s: string) => string; vs: (sign: string, v: number, s: string) => string } }) {
  if (value === null) return <span className="text-body-sm text-on-surface-light">{t.noPrevData}</span>;
  if (value === 0) return <span className="flex items-center gap-1 text-body-sm text-on-surface"><Minus aria-hidden className="size-4" />{t.sameAs(suffix)}</span>;
  const up = value > 0;
  const positive = (up && good === 'up') || (!up && good === 'down');
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('flex items-center gap-1 text-body-sm', positive ? 'text-success-text' : 'text-error-text')}>
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />{t.vs(up ? '+' : '', value, suffix)}
    </span>
  );
}

/** Flecha que «llega» (ingreso) o «sale» (gasto) de su ficha. */
function FlowChip({ income }: { income: boolean }) {
  return (
    <span className="relative overflow-hidden rounded-xl">
      <motion.span
        className="flex"
        initial={{ opacity: 0, x: income ? 14 : -14, y: income ? -14 : 14 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ ...slam, delay: 0.55 }}
      >
        <IconChip icon={income ? ArrowDownLeft : ArrowUpRight} tone={income ? 'success' : 'error'} size="sm" />
      </motion.span>
    </span>
  );
}

export default function FinancesPage() {
  const locale: Locale = useLocale();
  const t = useText(COPY);
  const loadingCopy = useLoadingCopy();
  const currency = useAuthStore((s) => s.user?.currency) ?? 'COP';
  const money = useCallback((n: number) => formatMoney(n, currency, false, locale), [currency, locale]);
  const compact = useCallback((n: number) => formatMoney(n, currency, true, locale), [currency, locale]);
  const [offset, setOffset] = useState(0);
  const range = useMemo(() => monthRange(offset, locale), [offset, locale]);
  const prevRange = useMemo(() => monthRange(offset - 1, locale), [offset, locale]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prev, setPrev] = useState<Summary | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [fetching, setFetching] = useState(false);
  const [txTab, setTxTab] = useState<TxTab>('all');
  const [showAll, setShowAll] = useState(false);
  const [plan, setPlan] = useState<PlanTab>('savings');
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Transaction | null>(null);
  /** Enlaces entre gráfico, categorías y lista. */
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  /** Movimiento recién guardado (entra con golpe y destello). */
  const [fresh, setFresh] = useState<string | null>(null);
  /** Sube con cada alta/baja: los bloques de saldo acusan el golpe. */
  const [pulse, setPulse] = useState(0);
  const monthDir = useRef(-1);
  const loaded = useRef(false);
  const spot = useSpotlight<HTMLDivElement>();
  const [payday, setPayday] = useState(() => {
    const d = new Date().getDate();
    try { return [1, 15, 30].includes(d) && sessionStorage.getItem('lq-payday') !== new Date().toDateString(); } catch { return false; }
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    setFetching(true);
    try {
      // TODO(api): /finances/transactions con from y to aplica solo `to` (el segundo filtro de fecha
      // pisa al primero), así que se pide hasta fin de mes y se recorta al mes en el cliente.
      const [list, s, p] = await Promise.all([
        financeService.fetchTransactions({ to: `${range.to}T23:59:59` }),
        financeService.fetchTransactionSummary(range.from, `${range.to}T23:59:59`).catch(() => null),
        financeService.fetchTransactionSummary(prevRange.from, `${prevRange.to}T23:59:59`).catch(() => null),
      ]);
      const inMonth = list.filter((tx) => { const k = tx.date.slice(0, 10); return k >= range.from && k <= range.to; });
      setTxs(inMonth);
      const local = summarize(inMonth);
      // El reparto por categoría sale de los movimientos si el resumen no lo trae.
      setSummary(s ? { ...EMPTY, ...s, byCategory: Object.keys(s.byCategory ?? {}).length ? s.byCategory : local.byCategory } : local);
      setPrev(p ? { ...EMPTY, ...p } : null);
      setState('ready');
      loaded.current = true;
    } catch {
      if (!silent) setState('error');
    } finally {
      setFetching(false);
    }
  }, [range, prevRange]);

  // Al cambiar de mes no se vuelve al cargador: los números ruedan del mes anterior al nuevo.
  useEffect(() => { void load(loaded.current); setShowAll(false); }, [load]);

  function changeMonth(d: -1 | 1) {
    monthDir.current = d;
    setOffset((o) => Math.min(0, o + d));
  }

  async function remove(tx: Transaction) {
    setTxs((list) => list.filter((x) => x.id !== tx.id));
    setPulse((n) => n + 1);
    try {
      await financeService.deleteTransaction(tx.id);
      useToastStore.getState().success(t.deleted);
      void load(true);
    } catch {
      useToastStore.getState().error(t.deleteFailed);
      void load(true);
    }
  }

  const s = summary ?? EMPTY;
  // Lo que se aparta a Ahorro o Inversión es dinero ahorrado, no gastado (mismo criterio que el ranking de Ahorro).
  const setAside = txs.filter((tx) => tx.type === 'EXPENSE' && SAVED_CATEGORIES.has(tx.category)).reduce((a, tx) => a + Number(tx.amount), 0);
  const spent = Math.max(0, s.expenses - setAside);
  const savingsRate = s.income > 0 ? Math.round(((s.income - spent) / s.income) * 100) : null;
  const spentShare = s.income > 0 ? Math.min(1, spent / s.income) : spent > 0 ? 1 : 0;
  const prevWord = prevRange.label.split(' ')[0].toLowerCase();

  // Gastos de los últimos 7 días del mes visible (hasta hoy si es el mes actual).
  const week: WeightBar[] = useMemo(() => {
    const end = offset === 0 ? new Date() : range.last;
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(end); d.setDate(end.getDate() - (6 - i)); return d; });
    return days.map((d) => {
      const k = dayKey(d);
      const list = txs.filter((tx) => tx.type === 'EXPENSE' && tx.date.slice(0, 10) === k).sort((a, b) => Number(b.amount) - Number(a.amount));
      const title = d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '');
      return {
        key: k,
        label: d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short' }).replace('.', '').slice(0, 3),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        value: list.reduce((a, tx) => a + Number(tx.amount), 0),
        details: list.map((tx) => `${tx.description || txCategory(tx.category, locale).label} · ${compact(Number(tx.amount))}`),
      };
    });
  }, [txs, offset, range, compact, locale]);
  const weekTotal = week.reduce((a, b) => a + b.value, 0);
  const weekKeys = useMemo(() => new Set(week.map((d) => d.key)), [week]);

  const cats = Object.entries(s.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const catTotal = cats.reduce((a, [, v]) => a + v, 0);
  const shown = txs.filter((tx) => txTab === 'all' || tx.type === txTab);
  const visible = showAll ? shown : shown.slice(0, 8);
  /** Una fila está «enlazada» si coincide con el día o la categoría resaltados. */
  const linked = (tx: Transaction) => (hoverDay ? tx.date.slice(0, 10) === hoverDay && tx.type === 'EXPENSE' : hoverCat ? tx.type === 'EXPENSE' && tx.category === hoverCat : null);
  const anyLink = Boolean(hoverDay || hoverCat);
  // Cinta de cotizaciones: ingresos, gastos, ahorro y las categorías con más gasto, contra el mes anterior.
  const quotes: Quote[] = [
    { key: 'in', label: t.income, value: compact(s.income), change: prev ? pctChange(s.income, prev.income) : null },
    { key: 'out', label: t.expenses, value: compact(s.expenses), change: prev ? pctChange(s.expenses, prev.expenses) : null },
    ...(savingsRate !== null ? [{ key: 'save', label: t.savingsQuote, value: `${savingsRate} %`, change: null }] : []),
    ...cats.slice(0, 6).map(([c, v]) => ({ key: c, label: txCategory(c, locale).label, value: compact(v), change: prev?.byCategory?.[c] ? pctChange(v, prev.byCategory[c]) : null })),
  ];
  const balanceSeries = useMemo(() => dailyBalance(txs, range.from, range.to), [txs, range]);

  const monthPicker = (
    <div className="flex items-center gap-1" role="group" aria-label={t.monthGroup}>
      <Button variant="icon" aria-label={t.prevMonth} onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      <span className="relative min-w-[9.5rem] overflow-hidden text-center text-label-lg font-mono tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={monthDir.current}>
          <motion.span
            key={range.label} className="block" custom={monthDir.current}
            variants={{ enter: (d: number) => ({ y: d * -18, opacity: 0 }), center: { y: 0, opacity: 1 }, leave: (d: number) => ({ y: d * 18, opacity: 0 }) }}
            initial="enter" animate="center" exit="leave" transition={slam}
          >
            {range.label}
          </motion.span>
        </AnimatePresence>
      </span>
      <Button variant="icon" aria-label={t.nextMonth} disabled={offset >= 0} onClick={() => changeMonth(1)}><ChevronRight aria-hidden className="size-5" strokeWidth={1.75} /></Button>
    </div>
  );

  const header = (
    <motion.section variants={item} className="relative flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{range.label}</span>
        {/* Letra de la marca, como el resto de zonas. */}
        <h1 className="relative self-start text-display-sm md:text-display-md lg:text-display-lg">
          <Lettering text={t.financeWord} />
          <SketchUnderline className="absolute -bottom-1.5 left-0 w-full text-success md:-bottom-2.5" delay={0.75} />
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {monthPicker}
        <Button size="md" onClick={() => setAdding(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.newTx}</Button>
      </div>
      {/* Sincronizando con el banco */}
      <AnimatePresence>
        {fetching && loaded.current && (
          <motion.span
            role="status" aria-label={t.updating} className="absolute inset-x-0 -bottom-3 h-px overflow-hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <motion.span
              className="block h-full w-1/3 bg-primary"
              animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1], repeat: Infinity }}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.section>
  );

  let body;
  if (state === 'loading') body = <PageLoader label={t.loading} words={loadingCopy.statsFinance} />;
  else if (state === 'error') body = <ErrorState title={t.loadFailed} onRetry={() => void load()} />;
  else {
    body = (
      <div className="flex flex-col gap-6 md:gap-12">
        <AnimatePresence>
          {payday && (
            <motion.div
              role="status" className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/[var(--lq-soft-alpha)] p-4"
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }} transition={slam}
            >
              <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-info-text" strokeWidth={1.75} />
              <p className="flex-1 text-body-md text-on-surface">
                <b className="text-info-text">{t.payday}</b> {t.paydayBody}
              </p>
              <Button variant="icon" aria-label={t.hideNotice} className="-m-2" onClick={() => { setPayday(false); try { sessionStorage.setItem('lq-payday', new Date().toDateString()); } catch { /* */ } }}>
                <X aria-hidden className="size-5" strokeWidth={1.75} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {s.count > 0 && <Ticker quotes={quotes} label={t.tickerLabel} />}

        {/* KPIs */}
        <Thud as="section" trigger={pulse} aria-label={t.balanceMonth} className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] md:gap-6">
          {/* Tarjeta de saldo: vidrio ahumado que se inclina con el cursor (parallax en el saldo) y mide el flujo del mes */}
          <div {...spot} className="lq-spot lq-smoke lq-smoke-accent flex flex-col gap-1 rounded-2xl p-6 md:order-last md:gap-3">
            <div className="flex items-center justify-between">
              <span className="text-body-sm text-on-surface md:text-body-md">{t.balanceMonth}</span>
              <IconChip icon={Wallet} tone="primary" size="sm" className="hidden bg-background md:flex" />
            </div>
            <span className={cn('lq-parallax text-display-md font-mono tabular-nums md:text-display-lg', s.balance < 0 ? 'text-error-text' : 'text-primary-text')}>
              <AnimatedValue value={s.balance} format={compact} quietUnits />
            </span>
            {/* El saldo del mes como la gráfica de una acción. */}
            {balanceSeries.length > 1 && <span role="img" aria-label={t.balanceTrend} className="block"><BalanceChart key={range.label} series={balanceSeries} /></span>}
            {/* Medidor de flujo: cuánto de lo que entró ya salió */}
            <div className="flex flex-col gap-1.5">
              <div
                role="meter" aria-label={t.meterLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(spentShare * 100)}
                className="h-1.5 overflow-hidden rounded-full bg-success/30"
              >
                <motion.span
                  className="block h-full rounded-full bg-error/80" style={{ originX: 0 }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: spentShare }} transition={{ ...heavy, delay: 0.5 }}
                />
              </div>
              {savingsRate !== null
                ? <span className={cn('text-body-sm', savingsRate >= 0 ? 'text-success-text' : 'text-error-text')}>{savingsRate >= 0 ? t.savingsPositive(savingsRate) : t.savingsNegative(-savingsRate)}</span>
                : <Trend value={pctChange(s.balance, prev?.balance ?? 0)} good="up" suffix={prevWord} t={t} />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:contents">
            {([
              [t.income, s.income, prev?.income, true, 'up'],
              [t.expenses, s.expenses, prev?.expenses, false, 'down'],
            ] as const).map(([label, v, pv, income, good], i) => (
              <Card key={label} padding="lg" {...spot} className={cn('lq-spot lq-smoke flex flex-col gap-2 max-md:p-4 md:gap-3', i === 0 ? 'md:order-first' : 'md:order-2')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-sm text-on-surface-light md:text-body-md">{label}</span>
                  <FlowChip income={income} />
                </div>
                <span className="lq-parallax text-heading-md font-mono tabular-nums md:text-display-lg" title={money(v)}><AnimatedValue value={v} format={compact} quietUnits /></span>
                <span className="hidden md:block"><Trend value={pv !== undefined ? pctChange(v, pv) : null} good={good} suffix={prevWord} t={t} /></span>
              </Card>
            ))}
          </div>
        </Thud>

        {s.count === 0 && txs.length === 0 ? (
          <EmptyState
            icon={Wallet}
            tone="info"
            title={t.emptyTitle}
            description={offset === 0 ? t.emptyBody : t.emptyNone(range.label.toLowerCase())}
            action={<Button onClick={() => setAdding(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.txAdd}</Button>}
            className="py-12"
          />
        ) : (
          <>
            <CashflowCard txs={txs} from={range.from} to={range.to} money={compact} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
              <Card as="section" padding="lg" aria-labelledby="fin-week" className="flex flex-col gap-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 id="fin-week" className="text-heading-sm md:text-heading-lg">{t.weekTitle}</h2>
                    <p className="text-body-sm text-on-surface-light">{t.weekHint}</p>
                  </div>
                  <span className="text-heading-sm font-mono tabular-nums"><AnimatedValue value={weekTotal} format={money} quietUnits /></span>
                </div>
                <WeightBars
                  data={week} label={t.weekLabel(week.map((d) => `${d.title} ${money(d.value)}`).join(', '))}
                  format={compact} tone="error" height={210}
                  bestLabel={t.bestDay} emptyLabel={t.noExpenses} noun={[t.movement, t.movements]}
                  highlightKey={hoverDay} onActiveChange={setHoverDay}
                />
              </Card>

              <Card as="section" padding="lg" aria-labelledby="fin-cats" className="flex flex-col gap-5">
                <h2 id="fin-cats" className="text-heading-sm">{t.byCategory}</h2>
                {cats.length === 0 ? (
                  <p className="text-body-md text-on-surface-light">{t.noExpensesMonth}</p>
                ) : (
                  <>
                    <div className="flex h-3 items-center gap-[3px]" role="img" aria-label={t.catAria(cats.map(([c, v]) => `${txCategory(c, locale).label} ${Math.round((v / catTotal) * 100)} %`).join(', '))}>
                      {cats.map(([c, v], i) => (
                        <motion.span
                          key={c} layout
                          className={cn('block h-full rounded-full transition-opacity duration-300', solidBg[SHARE_TONES[i % SHARE_TONES.length]], hoverCat && hoverCat !== c && 'opacity-30')}
                          style={{ flex: v, originX: 0 }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1, scaleY: hoverCat === c ? 1.6 : 1 }}
                          transition={{ ...heavy, delay: 0.2 + i * 0.08, scaleY: slam }}
                        />
                      ))}
                    </div>
                    <ul className="flex flex-col" onPointerLeave={() => setHoverCat(null)}>
                      {cats.slice(0, 6).map(([c, v], i) => {
                        const pct = Math.round((v / catTotal) * 100);
                        const on = hoverCat === c;
                        return (
                          <motion.li
                            key={c} layout="position"
                            initial={{ opacity: 0, x: -12 }} animate={{ opacity: hoverCat && !on ? 0.45 : 1, x: on ? 4 : 0 }}
                            transition={{ ...heavy, opacity: { duration: 0.25 } }}
                            onPointerEnter={() => setHoverCat(c)}
                            className="flex min-h-11 cursor-default items-center gap-3"
                          >
                            <span aria-hidden className={cn('size-3 shrink-0 rounded', solidBg[SHARE_TONES[i % SHARE_TONES.length]])} />
                            <span className="flex-1 text-body-md">{txCategory(c, locale).label}</span>
                            <span className="text-body-sm text-on-surface-light font-mono tabular-nums">{pct} %</span>
                            <span className="w-24 text-right text-label-lg font-mono tabular-nums"><AnimatedValue value={v} format={compact} quietUnits /></span>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </Card>
            </div>

            <Card as="section" padding="lg" aria-labelledby="fin-tx" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 id="fin-tx" className="flex items-baseline gap-3 text-heading-sm md:text-heading-lg">
                  {t.movementsTitle}
                  <span className="font-mono text-body-sm tabular-nums text-on-surface-light"><AnimatedValue value={shown.length} /></span>
                </h2>
                <SegmentedControl label={t.movementTypeLabel} value={txTab} onChange={(v) => { setTxTab(v); setShowAll(false); }} options={[{ value: 'all', label: t.allFilter }, { value: 'INCOME', label: t.incomeFilter }, { value: 'EXPENSE', label: t.expenseFilter }]} className="w-full md:max-w-[380px]" />
              </div>
              {shown.length === 0 ? (
                <p className="py-6 text-center text-body-md text-on-surface-light">{t.nothingHere}</p>
              ) : (
                <motion.ul key={`${txTab}-${offset}`} variants={stagger} initial="initial" animate="animate" className="flex flex-col">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {visible.map((tx, i) => {
                      const cat = txCategory(tx.category, locale);
                      const income = tx.type === 'INCOME';
                      const link = linked(tx);
                      const isFresh = fresh === tx.id;
                      return (
                        <motion.li
                          key={tx.id}
                          layout="position"
                          variants={item}
                          initial={isFresh ? { opacity: 0, y: -24, scale: 0.98 } : undefined}
                          animate={isFresh ? { opacity: 1, y: 0, scale: 1, transition: slam } : undefined}
                          exit={{ opacity: 0, x: 56, transition: { duration: 0.28, ease: expo } }}
                          onPointerEnter={(e) => {
                            if (e.pointerType !== 'mouse' || income) return;
                            const k = tx.date.slice(0, 10);
                            if (weekKeys.has(k)) setHoverDay(k); else setHoverCat(tx.category);
                          }}
                          onPointerLeave={() => { setHoverDay(null); setHoverCat(null); }}
                          className={cn(
                            'group relative grid min-h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md transition-[opacity,background-color] duration-300 hover:bg-surface-variant/60 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:gap-4',
                            i < visible.length - 1 && 'border-b border-border',
                            anyLink && (link ? 'bg-surface-variant/70' : '[&>*]:opacity-35'),
                          )}
                        >
                          {isFresh && (
                            <motion.span
                              aria-hidden className="pointer-events-none absolute inset-0 rounded-md bg-primary/[var(--lq-soft-alpha)]"
                              initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.8, delay: 0.6, ease: 'easeOut' }}
                            />
                          )}
                          <IconChip icon={income ? ArrowDownLeft : cat.icon} tone={income ? 'success' : cat.tone} size="sm" className="relative transition-[opacity,transform] duration-500 ease-expo group-hover:-rotate-6 group-hover:scale-105" />
                          <div className="relative min-w-0 transition-opacity duration-300">
                            <button type="button" aria-haspopup="dialog" onClick={() => setDetail(tx)} className="block max-w-full truncate text-left text-body-md font-semibold lq-stretch after:absolute after:inset-0 after:content-['']">{tx.description || cat.label}</button>
                            <div className="truncate text-body-sm text-on-surface-light">
                              {income ? t.incomeWord : cat.label} · {new Date(tx.date).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short', day: 'numeric', month: 'short' })}
                            </div>
                          </div>
                          <span className={cn('relative text-body-md font-semibold font-mono tabular-nums transition-[opacity,transform] duration-500 ease-expo group-hover:-translate-x-1 md:text-heading-sm', income ? 'text-success-text' : 'text-on-background')}>
                            {income ? '+' : '−'}{money(Number(tx.amount))}
                          </span>
                          <Button
                            variant="icon"
                            aria-label={t.deleteLabel(tx.description || cat.label)}
                            onClick={() => void remove(tx)}
                            className="relative z-[1] -mr-2 hidden hover:text-error-text md:inline-flex md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                          >
                            <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                          </Button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </motion.ul>
              )}
              {shown.length > 8 && (
                <Button variant="ghost" size="md" className="self-center" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? t.viewLess : t.viewAll(shown.length)}
                </Button>
              )}
            </Card>
          </>
        )}

        {/* Planificación */}
        <section aria-labelledby="fin-plan" className="flex flex-col gap-4">
          <h2 id="fin-plan" className="text-heading-sm md:text-heading-lg">{t.planning}</h2>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <Tabs label={t.planTabsLabel} value={plan} onChange={setPlan} options={PLANNING_TABS.map(({ value }) => ({ value, label: t.planTabs[value] }))} className="min-w-max" />
          </div>
          <Card padding="lg" role="tabpanel" aria-label={t.planTabs[plan]} className="overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={plan}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: heavy }} exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: expo } }}
              >
                {plan === 'savings' && <SavingsPanel money={money} onChanged={() => void load(true)} />}
                {plan === 'budgets' && <BudgetsPanel month={range.month} year={range.year} money={compact} />}
                {plan === 'goals' && <GoalsPanel money={money} />}
                {plan === 'debts' && <DebtsPanel money={money} />}
                {plan === 'recurring' && <RecurringPanel money={money} />}
                {plan === 'projection' && <ProjectionPanel money={compact} />}
              </motion.div>
            </AnimatePresence>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <ZoneShell zone="finances" ambience={<MarketBackdrop />}>
      {header}
      <motion.div variants={item}>{body}</motion.div>
      <motion.div variants={item}><CategoryChecklists category="Finanzas" title={t.pendingFinance} description={t.pendingFinanceBody} /></motion.div>
      <ResponsiveDialog open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? (detail.description || txCategory(detail.category, locale).label) : ''}>
        {detail && (() => {
          const cat = txCategory(detail.category, locale);
          const income = detail.type === 'INCOME';
          return (
            <div className="flex flex-col gap-5">
              <span className={cn('flex items-start text-display-sm font-mono tabular-nums', income ? 'text-success-text' : 'text-on-background')}>
                <span className="h-[1.1em] leading-[1.1em]">{income ? '+' : '−'}</span><AnimatedValue value={Number(detail.amount)} format={money} quietUnits />
              </span>
              <dl className="flex flex-col gap-1">
                {[[t.detailType, income ? t.typeIncome : t.typeExpense], [t.detailCategory, cat.label], [t.detailDate, new Date(detail.date).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })]].map(([k, v], i) => (
                  <motion.div
                    key={k} className="flex min-h-10 items-center justify-between gap-4 border-b border-border last:border-0"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...heavy, delay: 0.15 + i * 0.06 }}
                  >
                    <dt className="text-body-md text-on-surface-light">{k}</dt><dd className="text-label-lg">{v}</dd>
                  </motion.div>
                ))}
              </dl>
              <Button variant="danger" block onClick={() => { const tx = detail; setDetail(null); void remove(tx); }}>
                <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />{t.deleteTx}
              </Button>
            </div>
          );
        })()}
      </ResponsiveDialog>
      <TransactionFormDialog
        open={adding} onClose={() => setAdding(false)}
        onSaved={(tx) => { setAdding(false); setFresh(tx.id); setPulse((n) => n + 1); setTxTab('all'); void load(true); }}
      />
    </ZoneShell>
  );
}
