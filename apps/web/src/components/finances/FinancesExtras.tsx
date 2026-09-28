import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PixelPanel } from '../ui/PixelPanel';
import * as f2 from '../../services/finance2.service';
import { E } from '@/components/ui/glyphs';

// ─── Debts Panel ───────────────────────────────────────────────────────────────

export function DebtsPanel() {
  const [debts, setDebts] = useState<f2.Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [form, setForm] = useState({ title: '', type: 'owe', originalAmount: '', personName: '', interestRate: '', dueDate: '' });

  useEffect(() => { f2.fetchDebts().then(setDebts).finally(() => setLoading(false)); }, []);

  async function handleCreate() {
    if (!form.title || !form.originalAmount) return;
    const debt = await f2.createDebt({
      title: form.title,
      type: form.type,
      originalAmount: parseFloat(form.originalAmount),
      personName: form.personName || undefined,
      interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
      dueDate: form.dueDate || undefined,
    });
    setDebts(prev => [...prev, debt]);
    setShowForm(false);
    setForm({ title: '', type: 'owe', originalAmount: '', personName: '', interestRate: '', dueDate: '' });
  }

  async function handlePayment(debtId: string) {
    if (!payAmount) return;
    await f2.addDebtPayment(debtId, parseFloat(payAmount), new Date().toISOString().slice(0, 10));
    const fresh = await f2.fetchDebts();
    setDebts(fresh);
    setPayingId(null);
    setPayAmount('');
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar deuda?')) return;
    await f2.deleteDebt(id);
    setDebts(prev => prev.filter(d => d.id !== id));
  }

  const totalOwe = debts.filter(d => d.type === 'owe' && !d.isPaid).reduce((s, d) => s + Number(d.currentAmount), 0);
  const totalOwed = debts.filter(d => d.type === 'owed' && !d.isPaid).reduce((s, d) => s + Number(d.currentAmount), 0);

  return (
    <PixelPanel className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-text text-sm text-[var(--accent-gold)]"><E e="💳" /> DEUDAS Y PRÉSTAMOS</h3>
        <button onClick={() => setShowForm(s => !s)} className="pixel-button px-3 py-1 text-xs">+ Nueva</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--bg-deep)] rounded p-3 text-center border border-red-500/30">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Debo</p>
          <p className="text-lg font-bold text-red-400">${totalOwe.toLocaleString('es-CO')}</p>
        </div>
        <div className="bg-[var(--bg-deep)] rounded p-3 text-center border border-green-500/30">
          <p className="text-xs text-[var(--text-secondary)] mb-1">Me deben</p>
          <p className="text-lg font-bold text-green-400">${totalOwed.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="space-y-2 p-3 bg-[var(--bg-deep)] rounded border border-[var(--border)]">
              <div className="grid grid-cols-2 gap-2">
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Nombre de la deuda"
                  className="col-span-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                  <option value="owe">Yo debo</option>
                  <option value="owed">Me deben</option>
                </select>
                <input value={form.originalAmount} onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))} placeholder="Monto" type="number"
                  className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
                <input value={form.personName} onChange={e => setForm(f => ({ ...f, personName: e.target.value }))} placeholder="¿A quién?"
                  className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
                <input value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} type="date"
                  className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border border-[var(--border)] rounded py-1.5 text-sm text-[var(--text-secondary)]">Cancelar</button>
                <button onClick={handleCreate} className="flex-1 pixel-button py-1.5 text-sm">Guardar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debt list */}
      <div className="space-y-3">
        {debts.filter(d => !d.isPaid).map(debt => {
          const pct = Math.round((1 - Number(debt.currentAmount) / Number(debt.originalAmount)) * 100);
          return (
            <div key={debt.id} className="border border-[var(--border)] rounded p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{debt.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {debt.type === 'owe' ? '↗ Debo a' : '↙ Me debe'} {debt.personName ?? '—'}
                    {debt.dueDate && ` · Vence ${new Date(debt.dueDate).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold ${debt.type === 'owe' ? 'text-red-400' : 'text-green-400'}`}>
                    ${Number(debt.currentAmount).toLocaleString('es-CO')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">de ${Number(debt.originalAmount).toLocaleString('es-CO')}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="stat-bar mb-2">
                <motion.div className="stat-bar-fill bg-accent-green" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-2">{pct}% pagado</p>
              {payingId === debt.id ? (
                <div className="flex gap-2">
                  <input value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Monto pago" type="number"
                    className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--text-primary)] outline-none" />
                  <button onClick={() => handlePayment(debt.id)} className="pixel-button px-3 py-1 text-xs"><E e="✓" /></button>
                  <button onClick={() => setPayingId(null)} className="text-[var(--text-secondary)] text-sm px-2"><E e="✕" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setPayingId(debt.id)} className="text-xs border border-[var(--accent-green)] text-[var(--accent-green)] rounded px-3 py-1 hover:bg-[var(--accent-green)] hover:text-white transition-colors">
                    <E e="💸" /> Registrar pago
                  </button>
                  <button onClick={() => handleDelete(debt.id)} className="text-xs text-red-400 hover:text-red-300 ml-auto"><E e="✕" /></button>
                </div>
              )}
            </div>
          );
        })}
        {debts.filter(d => d.isPaid).length > 0 && (
          <p className="text-xs text-[var(--text-secondary)] text-center"><E e="✅" /> {debts.filter(d => d.isPaid).length} deuda(s) pagada(s)</p>
        )}
      </div>
    </PixelPanel>
  );
}

// ─── Recurring Transactions Panel ─────────────────────────────────────────────

export function RecurringPanel() {
  const [items, setItems] = useState<f2.RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'EXPENSE', amount: '', category: 'OTHER', description: '', dayOfMonth: '1' });

  useEffect(() => { f2.fetchRecurring().then(setItems).finally(() => setLoading(false)); }, []);

  const monthlyIncome = items.filter(i => i.type === 'INCOME').reduce((s, i) => s + Number(i.amount), 0);
  const monthlyExpenses = items.filter(i => i.type === 'EXPENSE').reduce((s, i) => s + Number(i.amount), 0);

  async function handleCreate() {
    if (!form.amount || !form.description) return;
    const item = await f2.createRecurring({ type: form.type, amount: parseFloat(form.amount), category: form.category, description: form.description, dayOfMonth: parseInt(form.dayOfMonth) });
    setItems(prev => [...prev, item]);
    setShowForm(false);
    setForm({ type: 'EXPENSE', amount: '', category: 'OTHER', description: '', dayOfMonth: '1' });
  }

  async function handleDelete(id: string) {
    await f2.deleteRecurring(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <PixelPanel className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-text text-sm text-[var(--accent-gold)]"><E e="🔄" /> RECURRENTES</h3>
        <button onClick={() => setShowForm(s => !s)} className="pixel-button px-3 py-1 text-xs">+ Nueva</button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-center">
        <div className="bg-[var(--bg-deep)] rounded p-2 border border-green-500/20">
          <p className="text-xs text-[var(--text-secondary)]">Ingresos/mes</p>
          <p className="font-bold text-green-400">${monthlyIncome.toLocaleString('es-CO')}</p>
        </div>
        <div className="bg-[var(--bg-deep)] rounded p-2 border border-red-500/20">
          <p className="text-xs text-[var(--text-secondary)]">Gastos/mes</p>
          <p className="font-bold text-red-400">${monthlyExpenses.toLocaleString('es-CO')}</p>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="space-y-2 p-3 bg-[var(--bg-deep)] rounded border border-[var(--border)]">
              <div className="grid grid-cols-2 gap-2">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Gasto</option>
                </select>
                <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Monto" type="number"
                  className="bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción (ej: Netflix)"
                  className="col-span-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]" />
                <div className="col-span-2 flex items-center gap-2">
                  <label className="text-xs text-[var(--text-secondary)]">Día del mes:</label>
                  <input value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))} type="number" min="1" max="28"
                    className="w-16 bg-[var(--bg-panel)] border border-[var(--border)] rounded px-2 py-1 text-sm text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border border-[var(--border)] rounded py-1.5 text-sm text-[var(--text-secondary)]">Cancelar</button>
                <button onClick={handleCreate} className="flex-1 pixel-button py-1.5 text-sm">Guardar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2 max-h-56 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
            <div className="flex items-center gap-2">
              <span className={`text-lg ${item.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>{item.type === 'INCOME' ? '↗' : '↙'}</span>
              <div>
                <p className="text-sm text-[var(--text-primary)]">{item.description}</p>
                <p className="text-xs text-[var(--text-secondary)]">Día {item.dayOfMonth} de cada mes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm ${item.type === 'INCOME' ? 'text-green-400' : 'text-red-400'}`}>
                {item.type === 'INCOME' ? '+' : '-'}${Number(item.amount).toLocaleString('es-CO')}
              </span>
              <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 text-xs"><E e="✕" /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-center text-[var(--text-muted)] text-sm py-4">Sin transacciones recurrentes</p>}
      </div>
    </PixelPanel>
  );
}

// ─── Financial Projection ──────────────────────────────────────────────────────

export function ProjectionPanel() {
  const [data, setData] = useState<f2.FinancialProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);

  useEffect(() => { f2.fetchProjection(months).then(setData).finally(() => setLoading(false)); }, [months]);

  if (loading) return <PixelPanel className="p-4 animate-pulse"><div className="h-40 bg-[var(--bg-deep)] rounded" /></PixelPanel>;
  if (!data) return null;

  const chartData = data.projection.map(p => ({
    mes: p.month.slice(5),
    balance: p.balance,
  }));

  const netColor = data.netMonthly >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <PixelPanel className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="pixel-text text-sm text-[var(--accent-gold)]"><E e="📈" /> PROYECCIÓN FINANCIERA</h3>
        <div className="flex gap-1">
          {[3, 6, 12].map(m => (
            <button key={m} onClick={() => setMonths(m)}
              className={`text-xs px-2 py-1 border rounded transition-colors ${months === m ? 'border-[var(--accent-gold)] text-[var(--accent-gold)]' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}>
              {m}m
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Ingresos/mes</p>
          <p className="font-bold text-green-400">${data.monthlyIncome.toLocaleString('es-CO')}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Gastos/mes</p>
          <p className="font-bold text-red-400">${(data.monthlyRecurringExpenses + data.avgVariableExpenses).toLocaleString('es-CO')}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">Neto/mes</p>
          <p className="font-bold" style={{ color: netColor }}>${data.netMonthly.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData}>
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={45} />
            <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: 12 }}
              formatter={(v: number) => [`$${v.toLocaleString('es-CO')}`, 'Balance']} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="balance" stroke="var(--accent-gold)" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 4, fill: 'var(--accent-gold)' }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {data.debtProjections.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Proyección de deudas:</p>
          {data.debtProjections.map(d => (
            <div key={d.id} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]">
              <span className="text-[var(--text-primary)]">{d.title}</span>
              <span className="text-[var(--text-secondary)]">
                {d.monthsToPayoff !== null ? `~${d.monthsToPayoff} meses` : 'Sin historial de pagos'}
              </span>
            </div>
          ))}
        </div>
      )}
    </PixelPanel>
  );
}

// ─── Payday Modal ──────────────────────────────────────────────────────────────

export function PaydayModal({ onClose }: { onClose: () => void }) {
  const today = new Date().getDate();
  const isPayday = today === 15 || today === 30 || today === 1;

  if (!isPayday) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="pixel-panel p-6 w-full max-w-sm" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}>
          <div className="text-center mb-5">
            <p className="text-4xl mb-2"><E e="💰" /></p>
            <h2 className="pixel-text text-lg text-[var(--accent-gold)]">¡Día de Pago!</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Es hora de distribuir tus ingresos sabiamente</p>
          </div>
          <div className="space-y-3 mb-5">
            {[
              { icon: '🏦', label: 'Apartar al ahorro', hint: '20% del ingreso' },
              { icon: '💳', label: 'Pagar deudas', hint: 'Prioriza las de mayor interés' },
              { icon: '🛒', label: 'Asignar presupuestos', hint: 'Comida, transporte, etc.' },
            ].map(({ icon, label, hint }) => (
              <div key={label} className="flex items-center gap-3 p-3 bg-[var(--bg-deep)] rounded border border-[var(--border)]">
                <span className="text-2xl"><E e={icon} /></span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full pixel-button py-2 text-sm"><E e="✓" /> Entendido, ¡a distribuir!</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
