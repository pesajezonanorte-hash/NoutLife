import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
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

const modalInputClass = 'min-h-[44px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]';

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onClick={onClose}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute h-3 w-3 rounded-full bg-[color-mix(in_oklab,var(--accent-gold)_30%,transparent)] blur-2xl"
        style={{ left: point.x, top: point.y }}
        initial={{ x: '-50%', y: '-50%', scale: 0, opacity: 0 }}
        animate={{ x: '-50%', y: '-50%', scale: 150, opacity: 0.24 }}
        exit={{ x: '-50%', y: '-50%', scale: 115, opacity: 0 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 9, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.82 }}
        className={`relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)] sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:pb-5 ${size === 'sm' ? 'max-w-sm' : 'max-w-md'}`}
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
          <FlowButton
            tone="ghost"
            size="sm"
            withArrows={false}
            onClick={onClose}
            aria-label={`Cerrar ${title.toLowerCase()}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] sm:h-8 sm:w-8"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </FlowButton>
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
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">COP</span>
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
      <FlowButton tone="ghost" withArrows={false} onClick={onCancel} className="min-h-[44px] w-full">
        Cancelar
      </FlowButton>
      <FlowButton tone="primary" withArrows={false} onClick={onConfirm} disabled={disabled || saving} className="min-h-[44px] w-full">
        {saving ? 'Guardando…' : confirmLabel}
      </FlowButton>
    </div>
  );
}

function CategoryPicker({
  category,
  onChange,
}: {
  category: string;
  onChange: (category: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = CATEGORY_MODAL_ICONS[category] ?? Package;

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [isOpen]);

  return (
    <div ref={pickerRef} className="relative">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Categoría</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="transaction-category-options"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-secondary)]">
          <SelectedIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="ml-2.5 min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]">{CATEGORY_LABELS[category]}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-2 text-[var(--text-muted)]">
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id="transaction-category-options"
            role="listbox"
            aria-label="Opciones de categoría"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-1.5 shadow-[var(--shadow-md)]">
              {Object.keys(CATEGORY_LABELS).map((key) => {
                const Icon = CATEGORY_MODAL_ICONS[key] ?? Package;
                const selected = category === key;
                return (
                  <motion.button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onChange(key);
                      setIsOpen(false);
                    }}
                    className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${selected ? 'bg-[color-mix(in_oklab,var(--accent-gold)_13%,var(--bg-muted))] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{CATEGORY_LABELS[key]}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
        }}
        className="space-y-4"
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }} className="grid grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1" role="group" aria-label="Tipo de transacción">
          {([
            { id: 'INCOME' as const, label: 'Ingreso', Icon: ArrowUpRight, color: 'text-[var(--accent-green)]' },
            { id: 'EXPENSE' as const, label: 'Gasto', Icon: ArrowDownLeft, color: 'text-[var(--accent-red)]' },
          ]).map(({ id, label, Icon, color }) => {
            const selected = type === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`relative inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${selected ? color : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
              >
                {selected && (
                  <motion.span
                    layoutId="transaction-type-active"
                    className="absolute inset-0 rounded-lg bg-[var(--bg-panel)] shadow-[var(--shadow-sm)]"
                    transition={{ type: 'spring', stiffness: 430, damping: 32 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </span>
              </button>
            );
          })}
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}>
          <MoneyField id="transaction-amount" label="Monto" value={amount} onChange={setAmount} autoFocus onEnter={() => void save()} />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}>
          <CategoryPicker category={category} onChange={setCategory} />
        </motion.div>

        <motion.div variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }} className="grid gap-3 sm:grid-cols-[1.3fr_0.9fr]">
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
        </motion.div>
      </motion.div>
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
        >
          <LifeQuestFlipCard
            eyebrow="Balance del mes"
            title={dashboard.summary.balance >= 0 ? 'Tu bóveda avanza con margen' : 'Tu bóveda necesita atención'}
            description="Un resumen claro de tus ingresos, gastos y próximo movimiento."
            visual={(
              <div className="text-center" aria-hidden="true">
                <p className={`font-vt text-5xl leading-none sm:text-6xl ${dashboard.summary.balance >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                  <AnimatedCounter
                    value={Math.abs(dashboard.summary.balance)}
                    separator="."
                    prefix={`${dashboard.summary.balance < 0 ? '-' : ''}$ `}
                    duration={1}
                  />
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">saldo disponible</p>
              </div>
            )}
            visualLabel={`Balance del mes: ${formatCOP(dashboard.summary.balance)}`}
            badge={dashboard.summary.balance >= 0 ? 'Balance positivo' : 'Revisar gastos'}
            frontFooter={(
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-muted px-3 py-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Ingresos</p><p className="mt-1 truncate text-sm font-semibold text-[var(--accent-green)]"><AnimatedCounter value={dashboard.summary.income} separator="." prefix="$ " duration={0.7} /></p></div>
                <div className="rounded-xl border border-border bg-muted px-3 py-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Gastos</p><p className="mt-1 truncate text-sm font-semibold text-[var(--accent-red)]"><AnimatedCounter value={dashboard.summary.expenses} separator="." prefix="$ " duration={0.7} /></p></div>
              </div>
            )}
            backDescription={<p>Consulta tus movimientos para entender qué está moviendo el balance y registra una transacción cuando lo necesites.</p>}
            metrics={[
              { label: 'Ingresos', value: formatCOP(dashboard.summary.income) },
              { label: 'Gastos', value: formatCOP(dashboard.summary.expenses) },
              { label: 'Balance', value: formatCOP(dashboard.summary.balance) },
            ]}
            actionLabel="Ver movimientos"
            onAction={() => setTab('transactions')}
            accent="var(--accent-gold)"
          />
        </motion.div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        {([['dashboard', ' Resumen'], ['transactions', ' Transacciones'], ['budgets', ' Presupuestos'], ['goals', ' Metas'], ['debts', ' Deudas'], ['recurring', ' Recurrentes'], ['projection', ' Proyección']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`min-h-11 min-w-0 px-2 py-1.5 border-2 font-pixel transition-all sm:shrink-0 ${tab === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary hover:border-text-secondary'}`}
            style={{ fontSize: '12px' }}
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
              <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '12px' }}>GASTOS POR CATEGORÍA</p>
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
            <p className="font-pixel text-text-secondary mb-2" style={{ fontSize: '12px' }}>MOVIMIENTOS RECIENTES</p>
            <div className="space-y-2">
              {dashboard.recent.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-1 border-b border-border-pixel/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg"><E e={CATEGORY_ICONS[t.category] ?? '📦'} /></span>
                    <div>
                      <p className="font-vt text-text-primary text-base">{t.description ?? CATEGORY_LABELS[t.category]}</p>
                      <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>{new Date(t.date).toLocaleDateString('es-CO')}</p>
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
              <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>SIN TRANSACCIONES</p>
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
                        <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>
                          <E e={CATEGORY_LABELS[t.category]} /> · {new Date(t.date).toLocaleDateString('es-CO')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`font-vt text-xl ${t.type === 'INCOME' ? 'text-accent-green' : 'text-accent-red'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{formatCOP(t.amount)}
                      </p>
                      <FlowButton
                        tone="danger"
                        size="sm"
                        withArrows={false}
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="font-pixel text-accent-red hover:opacity-70 transition-opacity"
                        style={{ fontSize: '12px' }}
                      >
                        <E e="✕" />
                      </FlowButton>
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
              <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>SIN PRESUPUESTOS</p>
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
                    <p className={`font-pixel ${color}`} style={{ fontSize: '12px' }}>{Math.round(pct)}%</p>
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
              <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>SIN METAS DE AHORRO</p>
            </PixelPanel>
          ) : (
            goals.map(g => {
              const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
              return (
                <PixelPanel key={g.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-vt text-text-primary text-xl">{g.title}</p>
                    {g.isCompleted && <span className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}><E e="✓" /> COMPLETADA</span>}
                  </div>
                  {g.description && <p className="font-vt text-text-secondary text-base mb-2">{g.description}</p>}
                  <div className="stat-bar h-4 mb-1">
                    <motion.div className="h-full bg-accent-gold" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-vt text-text-secondary text-base">{formatCOP(g.currentAmount)}</span>
                    <span className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>{Math.round(pct)}%</span>
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
