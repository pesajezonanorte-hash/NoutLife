import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BusFront,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clapperboard,
  CreditCard,
  GraduationCap,
  HeartPulse,
  Home,
  Lightbulb,
  Package,
  PiggyBank,
  Shirt,
  TrendingUp,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { FlowButton } from '../../components/ui/flow-button';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter';
import type { Transaction, Budget, FinancialGoal } from '@lifequest/shared';
import * as financeService from '../../services/finance.service';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { DebtsPanel, RecurringPanel, ProjectionPanel, PaydayModal } from '../../components/finances/FinancesExtras';
import { E } from '@/components/ui/glyphs';

const CATEGORY_ICONS: Record<string, string> = {
  FOOD: '🍔', TRANSPORT: '🚌', ENTERTAINMENT: '🎮', HEALTH: '🏥',
  EDUCATION: '📚', CLOTHING: '👕', HOUSING: '🏠', UTILITIES: '💡',
  SAVINGS: '💰', INVESTMENT: '📈', SUBSCRIPTIONS: '💳', OTHER: '📦',
};

const CATEGORY_LABELS: Record<string, string> = {
  FOOD: 'Comida', TRANSPORT: 'Transporte', ENTERTAINMENT: 'Ocio', HEALTH: 'Salud',
  EDUCATION: 'Educación', CLOTHING: 'Ropa', HOUSING: 'Vivienda', UTILITIES: 'Servicios',
  SAVINGS: 'Ahorro', INVESTMENT: 'Inversión', SUBSCRIPTIONS: 'Suscripciones', OTHER: 'Otros',
};

const COP_COLORS = ['#a8871e', '#2a2a2e', '#4a4a52', '#6b6b73', '#8a8a92', '#a1a1aa', '#c0c0c8', '#5c5c64', '#bdbdc5', '#7a7a82', '#d4d4dc', '#3a3a40'];

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

type ModalOrigin = { x: number; y: number };

const CATEGORY_MODAL_ICONS: Record<string, LucideIcon> = {
  FOOD: Utensils,
  TRANSPORT: BusFront,
  ENTERTAINMENT: Clapperboard,
  HEALTH: HeartPulse,
  EDUCATION: GraduationCap,
  CLOTHING: Shirt,
  HOUSING: Home,
  UTILITIES: Lightbulb,
  SAVINGS: PiggyBank,
  INVESTMENT: TrendingUp,
  SUBSCRIPTIONS: CreditCard,
  OTHER: Package,
};

const modalInputClass = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]';

function ModalShell({
  title,
  description,
  icon: Icon = CircleDollarSign,
  origin,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  origin?: ModalOrigin;
  onClose: () => void;
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  useEscapeKey(onClose);
  const point = origin ?? { x: 0, y: 0 };
  const revealFrom = `circle(0px at ${point.x}px ${point.y}px)`;
  const revealTo = `circle(150vmax at ${point.x}px ${point.y}px)`;

  return (
    <motion.div
      initial={{ opacity: 0, clipPath: revealFrom }}
      animate={{ opacity: 1, clipPath: revealTo }}
      exit={{ opacity: 0, clipPath: revealFrom }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 18, scale: 0.975, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, scale: 0.985, filter: 'blur(3px)' }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.78 }}
        className={`max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-pop)] ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--accent-gold)]">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Cerrar ${title.toLowerCase()}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        {children}
      </motion.section>
    </motion.div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  autoFocus = false,
  onEnter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--text-muted)]">$</span>
        <input
          id={id}
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onEnter?.()}
          placeholder="0"
          autoFocus={autoFocus}
          className={`${modalInputClass} money-input pr-14 pl-8 text-right text-2xl font-semibold tabular-nums`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">COP</span>
      </span>
    </label>
  );
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  disabled = false,
  saving = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-[var(--border-soft)] pt-4">
      <FlowButton tone="ghost" withArrows={false} onClick={onCancel} className="w-full">
        Cancelar
      </FlowButton>
      <FlowButton tone="primary" withArrows={false} onClick={onConfirm} disabled={disabled || saving} className="w-full">
        {saving ? 'Guardando…' : confirmLabel}
      </FlowButton>
    </div>
  );
}

function TransactionModal({
  onClose,
  onSave,
  origin,
}: {
  onClose: () => void;
  onSave: (t: Transaction) => void;
  origin?: ModalOrigin;
}) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('FOOD');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const CategoryIcon = CATEGORY_MODAL_ICONS[category] ?? Package;
  const isValidAmount = Number(amount) > 0;

  async function save() {
    if (!isValidAmount || saving) return;
    setSaving(true);
    try {
      const transaction = await financeService.createTransaction({
        type,
        amount: Number(amount),
        category,
        description: description.trim() || undefined,
        date,
      });
      onSave(transaction);
      toast.success(type === 'INCOME' ? 'Ingreso registrado' : 'Gasto registrado');
    } catch {
      toast.error('No se pudo guardar la transacción');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Nueva transacción"
      description="Registra un movimiento real para actualizar tu balance."
      origin={origin}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1" role="group" aria-label="Tipo de transacción">
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${type === 'INCOME' ? 'bg-[var(--bg-panel)] text-[var(--accent-green)] shadow-[var(--shadow-sm)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            Ingreso
          </button>
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${type === 'EXPENSE' ? 'bg-[var(--bg-panel)] text-[var(--accent-red)] shadow-[var(--shadow-sm)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Gasto
          </button>
        </div>

        <MoneyField id="transaction-amount" label="Monto" value={amount} onChange={setAmount} autoFocus onEnter={() => void save()} />

        <label htmlFor="transaction-category" className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Categoría</span>
          <span className="relative flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] transition-colors focus-within:border-[var(--accent-gold)] focus-within:ring-2 focus-within:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]">
            <span className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-secondary)]">
              <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <select
              id="transaction-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-w-0 flex-1 appearance-none bg-transparent px-2 py-2.5 pr-9 text-sm text-[var(--text-primary)] outline-none"
            >
              {Object.keys(CATEGORY_LABELS).map((key) => (
                <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-[1.3fr_0.9fr]">
          <label htmlFor="transaction-description" className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Descripción <span className="text-[var(--text-muted)]">opcional</span></span>
            <input
              id="transaction-description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej. mercado semanal"
              className={modalInputClass}
            />
          </label>
          <label htmlFor="transaction-date" className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Fecha</span>
            <input
              id="transaction-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={modalInputClass}
            />
          </label>
        </div>
      </div>
      <ModalActions onCancel={onClose} onConfirm={() => void save()} confirmLabel="Guardar" disabled={!isValidAmount} saving={saving} />
    </ModalShell>
  );
}

export default function FinancesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'dashboard' | 'transactions' | 'budgets' | 'goals' | 'debts' | 'recurring' | 'projection'>('dashboard');
  const [showPayday, setShowPayday] = useState(false);
  const [dashboard, setDashboard] = useState<{ summary: { income: number; expenses: number; balance: number; byCategory: Record<string, number> }; budgets: (Budget & { spent: number })[]; goals: FinancialGoal[]; recent: Transaction[] } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [modalOrigin, setModalOrigin] = useState<ModalOrigin | undefined>();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', targetAmount: '', description: '' });
  const [showContributeModal, setShowContributeModal] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, txs, gl] = await Promise.all([
        financeService.fetchFinanceDashboard(),
        financeService.fetchTransactions(),
        financeService.fetchFinancialGoals(),
      ]);
      setDashboard(dash);
      setTransactions(txs);
      setGoals(gl);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const day = new Date().getDate();
    if (day === 1 || day === 15 || day === 30) setShowPayday(true);
  }, []);

  function captureModalOrigin(event: { clientX: number; clientY: number }) {
    const fallbackX = typeof window === 'undefined' ? 0 : window.innerWidth / 2;
    const fallbackY = typeof window === 'undefined' ? 0 : window.innerHeight / 2;
    setModalOrigin({ x: event.clientX || fallbackX, y: event.clientY || fallbackY });
  }

  function handleTransactionSaved(t: Transaction) {
    // Optimistic: already added by modal, refresh
    setTransactions(prev => [t, ...prev]);
    setShowAddTransaction(false);
    load(); // Sync dashboard
  }

  async function handleDeleteTransaction(id: string) {
    setTransactions(prev => prev.filter(t => t.id !== id));
    try {
      await financeService.deleteTransaction(id);
      load();
    } catch {
      toast.error('Error al eliminar');
      load();
    }
  }

  async function handleCreateGoal() {
    if (!goalForm.title.trim() || Number(goalForm.targetAmount) <= 0) return;
    try {
      const g = await financeService.createFinancialGoal({ title: goalForm.title, targetAmount: Number(goalForm.targetAmount), description: goalForm.description || undefined });
      setGoals(prev => [...prev, g]);
      setShowGoalModal(false);
      setGoalForm({ title: '', targetAmount: '', description: '' });
      toast.success('¡Meta creada!');
    } catch {
      toast.error('Error al crear meta');
    }
  }

  async function handleContribute() {
    if (!showContributeModal || Number(contributeAmount) <= 0) return;
    const amount = Number(contributeAmount);
    // Optimistic
    setGoals(prev => prev.map(g => g.id === showContributeModal ? { ...g, currentAmount: g.currentAmount + amount } : g));
    setShowContributeModal(null);
    setContributeAmount('');
    try {
      await financeService.contributeToGoal(showContributeModal, amount);
      toast.success('¡Aporte agregado!');
      load();
    } catch {
      toast.error('Error al agregar aporte');
      load();
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const categoryData = dashboard ? Object.entries(dashboard.summary.byCategory).map(([k, v]) => ({ name: CATEGORY_LABELS[k] ?? k, value: v })) : [];

  return (
    <div className="space-y-4">
      {/* Header minimal */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="💰" /> LA BÓVEDA</h1>
          <p className="font-vt text-text-secondary text-base">Finanzas en COP — dinero real</p>
        </div>
        <div className="flex items-center gap-2">
          <SageContextButton message="¿Cómo voy con mi dinero este mes? Analiza mis gastos e ingresos y dame recomendaciones concretas." label="¿Cómo voy?" />
          <PixelButton variant="primary" onClick={(event) => {
            captureModalOrigin(event);
            setShowAddTransaction(true);
          }}>
            + TRANSACCIÓN
          </PixelButton>
        </div>
      </div>

      {/* ── Balance Hero Card ── */}
      {dashboard && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-panel-light)', border: '1px solid var(--border)' }}
        >
          {/* Main balance area */}
          <div className="px-6 pt-7 pb-5 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-3"
               style={{ color: 'var(--text-muted)' }}>
              Balance del mes
            </p>
            <div
              className={`font-vt leading-none ${dashboard.summary.balance >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}
              style={{ fontSize: 'clamp(2.4rem, 10vw, 4rem)' }}
            >
              <AnimatedCounter
                value={Math.abs(dashboard.summary.balance)}
                separator="."
                prefix={`${dashboard.summary.balance < 0 ? '-' : ''}$ `}
                duration={1}
              />
            </div>
          </div>

          {/* Income / Expense row */}
          <div
            className="grid grid-cols-2"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div className="px-5 py-3.5 text-center space-y-0.5">
              <p className="text-[9px] uppercase tracking-[0.18em] font-semibold flex items-center justify-center gap-1.5"
                 style={{ color: 'var(--accent-green)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] inline-block" />
                Ingresos
              </p>
              <div className="font-vt text-[var(--accent-green)]" style={{ fontSize: '1.35rem' }}>
                <AnimatedCounter value={dashboard.summary.income} separator="." prefix="$ " duration={0.7} />
              </div>
            </div>
            <div className="px-5 py-3.5 text-center space-y-0.5"
                 style={{ borderLeft: '1px solid var(--border)' }}>
              <p className="text-[9px] uppercase tracking-[0.18em] font-semibold flex items-center justify-center gap-1.5"
                 style={{ color: 'var(--accent-red)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] inline-block" />
                Gastos
              </p>
              <div className="font-vt text-[var(--accent-red)]" style={{ fontSize: '1.35rem' }}>
                <AnimatedCounter value={dashboard.summary.expenses} separator="." prefix="$ " duration={0.7} />
              </div>
            </div>
          </div>
        </motion.div>
      )}


      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {([['dashboard', ' Resumen'], ['transactions', ' Transacciones'], ['budgets', ' Presupuestos'], ['goals', ' Metas'], ['debts', ' Deudas'], ['recurring', ' Recurrentes'], ['projection', ' Proyección']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-shrink-0 px-3 py-1.5 border-2 font-pixel transition-all ${tab === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary hover:border-text-secondary'}`}
            style={{ fontSize: '8px' }}
          >

            {label}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && dashboard && (
        <div className="space-y-4">
          {categoryData.length > 0 && (
            <PixelPanel className="p-4">
              <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '8px' }}>GASTOS POR CATEGORÍA</p>
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COP_COLORS[i % COP_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={{ background: 'var(--bg-panel)', border: '2px solid var(--border)', fontFamily: 'Montserrat', fontSize: '16px', color: 'var(--text-primary)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1">
                  {categoryData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1">
                      <span className="w-3 h-3 flex-shrink-0" style={{ background: COP_COLORS[i % COP_COLORS.length] }} />
                      <span className="font-vt text-text-secondary text-base">{d.name}: {formatCOP(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </PixelPanel>
          )}

          {/* Recent transactions */}
          <PixelPanel className="p-4">
            <p className="font-pixel text-text-secondary mb-2" style={{ fontSize: '8px' }}>MOVIMIENTOS RECIENTES</p>
            <div className="space-y-2">
              {dashboard.recent.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-1 border-b border-border-pixel/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg"><E e={CATEGORY_ICONS[t.category] ?? '📦'} /></span>
                    <div>
                      <p className="font-vt text-text-primary text-base">{t.description ?? CATEGORY_LABELS[t.category]}</p>
                      <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>{new Date(t.date).toLocaleDateString('es-CO')}</p>
                    </div>
                  </div>
                  <p className={`font-vt text-lg ${t.type === 'INCOME' ? 'text-accent-green' : 'text-accent-red'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{formatCOP(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          </PixelPanel>
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2"><E e="💸" /></p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '9px' }}>SIN TRANSACCIONES</p>
            </PixelPanel>
          ) : (
            <AnimatePresence>
              {transactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <PixelPanel className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl"><E e={CATEGORY_ICONS[t.category] ?? '📦'} /></span>
                      <div>
                        <p className="font-vt text-text-primary text-lg">{t.description ?? CATEGORY_LABELS[t.category]}</p>
                        <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
                          <E e={CATEGORY_LABELS[t.category]} /> · {new Date(t.date).toLocaleDateString('es-CO')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`font-vt text-xl ${t.type === 'INCOME' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{formatCOP(t.amount)}
                      </p>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="font-pixel text-accent-red hover:opacity-70 transition-opacity"
                        style={{ fontSize: '8px' }}
                      >
                        <E e="✕" />
                      </button>
                    </div>
                  </PixelPanel>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Budgets tab */}
      {tab === 'budgets' && dashboard && (
        <div className="space-y-3">
          {dashboard.budgets.length === 0 ? (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2"><E e="📋" /></p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '9px' }}>SIN PRESUPUESTOS</p>
              <p className="font-vt text-text-secondary text-base mt-1">Crea presupuestos para controlar tus gastos</p>
            </PixelPanel>
          ) : (
            dashboard.budgets.map(b => {
              const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
              const color = pct >= 90 ? 'text-accent-red' : pct >= 70 ? 'text-accent-gold' : 'text-accent-green';
              const barColor = pct >= 90 ? 'bg-accent-red' : pct >= 70 ? 'bg-accent-gold' : 'bg-accent-green';
              return (
                <PixelPanel key={b.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl"><E e={CATEGORY_ICONS[b.category]} /></span>
                      <p className="font-vt text-text-primary text-lg"><E e={CATEGORY_LABELS[b.category]} /></p>
                    </div>
                    <p className={`font-pixel ${color}`} style={{ fontSize: '8px' }}>{Math.round(pct)}%</p>
                  </div>
                  <div className="stat-bar h-3">
                    <motion.div className={`h-full ${barColor}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="font-vt text-text-secondary text-base">{formatCOP(b.spent)} gastado</span>
                    <span className="font-vt text-text-secondary text-base">de {formatCOP(b.amount)}</span>
                  </div>
                </PixelPanel>
              );
            })
          )}
        </div>
      )}

      {/* Goals tab */}
      {tab === 'goals' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <PixelButton variant="secondary" onClick={(event) => {
              captureModalOrigin(event);
              setShowGoalModal(true);
            }}>+ META</PixelButton>
          </div>
          {goals.length === 0 ? (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2"><E e="🎯" /></p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '9px' }}>SIN METAS DE AHORRO</p>
            </PixelPanel>
          ) : (
            goals.map(g => {
              const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
              return (
                <PixelPanel key={g.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-vt text-text-primary text-xl">{g.title}</p>
                    {g.isCompleted && <span className="font-pixel text-accent-gold" style={{ fontSize: '8px' }}><E e="✓" /> COMPLETADA</span>}
                  </div>
                  {g.description && <p className="font-vt text-text-secondary text-base mb-2">{g.description}</p>}
                  <div className="stat-bar h-4 mb-1">
                    <motion.div className="h-full bg-accent-gold" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-vt text-text-secondary text-base">{formatCOP(g.currentAmount)}</span>
                    <span className="font-pixel text-accent-gold" style={{ fontSize: '8px' }}>{Math.round(pct)}%</span>
                    <span className="font-vt text-text-secondary text-base">{formatCOP(g.targetAmount)}</span>
                  </div>
                  {!g.isCompleted && (
                    <PixelButton variant="secondary" onClick={(event) => {
                      captureModalOrigin(event);
                      setShowContributeModal(g.id);
                    }} className="w-full">
                      + AGREGAR APORTE
                    </PixelButton>
                  )}
                </PixelPanel>
              );
            })
          )}
        </div>
      )}

      {/* Debts tab */}
      {tab === 'debts' && <DebtsPanel />}

      {/* Recurring tab */}
      {tab === 'recurring' && <RecurringPanel />}

      {/* Projection tab */}
      {tab === 'projection' && <ProjectionPanel />}

      {/* Transaction modal */}
      <AnimatePresence>
        {showAddTransaction && (
          <TransactionModal
            origin={modalOrigin}
            onClose={() => setShowAddTransaction(false)}
            onSave={handleTransactionSaved}
          />
        )}
      </AnimatePresence>

      {/* Payday modal */}
      <AnimatePresence>
        {showPayday && <PaydayModal onClose={() => setShowPayday(false)} />}
      </AnimatePresence>

      {/* Goal modal */}
      <AnimatePresence>
        {showGoalModal && (
          <ModalShell
            title="Nueva meta de ahorro"
            description="Define un objetivo claro y registra el avance cuando hagas un aporte."
            icon={PiggyBank}
            origin={modalOrigin}
            onClose={() => setShowGoalModal(false)}
          >
            <div className="space-y-4">
              <label htmlFor="financial-goal-title" className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Nombre de la meta</span>
                <input
                  id="financial-goal-title"
                  value={goalForm.title}
                  onChange={(event) => setGoalForm((form) => ({ ...form, title: event.target.value }))}
                  placeholder="Ej. fondo de emergencia"
                  autoFocus
                  className={modalInputClass}
                />
              </label>
              <MoneyField
                id="financial-goal-amount"
                label="Objetivo"
                value={goalForm.targetAmount}
                onChange={(targetAmount) => setGoalForm((form) => ({ ...form, targetAmount }))}
                onEnter={() => void handleCreateGoal()}
              />
              <label htmlFor="financial-goal-description" className="block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Nota <span className="text-[var(--text-muted)]">opcional</span></span>
                <input
                  id="financial-goal-description"
                  value={goalForm.description}
                  onChange={(event) => setGoalForm((form) => ({ ...form, description: event.target.value }))}
                  placeholder="Para qué quieres ahorrar"
                  className={modalInputClass}
                />
              </label>
            </div>
            <ModalActions
              onCancel={() => setShowGoalModal(false)}
              onConfirm={() => void handleCreateGoal()}
              confirmLabel="Crear meta"
              disabled={!goalForm.title.trim() || Number(goalForm.targetAmount) <= 0}
            />
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Contribute modal */}
      <AnimatePresence>
        {showContributeModal && (
          <ModalShell
            title="Agregar aporte"
            description="El aporte se suma al progreso de esta meta de ahorro."
            icon={CircleDollarSign}
            origin={modalOrigin}
            onClose={() => setShowContributeModal(null)}
            size="sm"
          >
            <MoneyField
              id="financial-goal-contribution"
              label="Monto del aporte"
              value={contributeAmount}
              onChange={setContributeAmount}
              autoFocus
              onEnter={() => void handleContribute()}
            />
            <ModalActions
              onCancel={() => setShowContributeModal(null)}
              onConfirm={() => void handleContribute()}
              confirmLabel="Agregar aporte"
              disabled={Number(contributeAmount) <= 0}
            />
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}
