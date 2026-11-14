// Nueva transacción (sin prototipo propio: formulario del sistema). Mismo
// payload que el antiguo TransactionModal. Con el gasto «Ropa para mí» aparece
// el atajo «Ir al Espejo» para registrar la prenda recién comprada en su armario.
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MirrorIcon } from '@/components/zones/mirrorIcon';
import type { Transaction, TransactionCategory } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { Button, ChipGroup, Field, Input, ResponsiveDialog, SegmentedControl, DatePicker } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { useToastStore } from '@/hooks/useToast';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import * as financeService from '@/services/finance.service';
import { categoriesFor } from './financeMeta';
import { ACCOUNT_ICON } from './Wallets';
import type { FinanceAccount } from '@/services/wallet.service';

/** La última cartera usada en este dispositivo: la siguiente transacción la propone. */
const LAST_ACCOUNT = 'lq-fin-account';
const lastAccount = () => { try { return localStorage.getItem(LAST_ACCOUNT); } catch { return null; } };

const es = {
  saveErr: 'No se pudo guardar. Inténtalo de nuevo.',
  incomeOk: 'Ingreso registrado',
  expenseOk: 'Gasto registrado',
  title: 'Nueva transacción',
  typeLabel: 'Tipo de transacción',
  expense: 'Gasto',
  income: 'Ingreso',
  amount: 'Monto',
  amountErr: 'Escribe un monto mayor que 0',
  category: 'Categoría',
  shortcutNote: '¿Acabas de comprar ropa? Añade la prenda al armario de tu Espejo.',
  goMirror: 'Ir al Espejo',
  description: 'Descripción',
  optional: 'Opcional',
  incomePh: 'Ej. Pago de nómina',
  expensePh: 'Ej. Supermercado',
  date: 'Fecha',
  cancel: 'Cancelar',
  save: 'Guardar',
  wallet: 'Cartera',
  noWallet: 'Sin cartera',
};

const en: typeof es = {
  saveErr: 'Could not save. Try again.',
  incomeOk: 'Income logged',
  expenseOk: 'Expense logged',
  title: 'New transaction',
  typeLabel: 'Transaction type',
  expense: 'Expense',
  income: 'Income',
  amount: 'Amount',
  amountErr: 'Enter an amount greater than 0',
  category: 'Category',
  shortcutNote: 'Just bought clothes? Add the piece to your Mirror wardrobe.',
  goMirror: 'Go to the Mirror',
  description: 'Description',
  optional: 'Optional',
  incomePh: 'E.g. Payroll',
  expensePh: 'E.g. Groceries',
  date: 'Date',
  cancel: 'Cancel',
  save: 'Save',
  wallet: 'Wallet',
  noWallet: 'No wallet',
};

const COPY: Copy<typeof es> = { es, en };

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionFormDialog({ open, onClose, onSaved, accounts = [], defaultAccountId = null }: {
  open: boolean;
  onClose: () => void;
  onSaved: (t: Transaction) => void;
  /** Carteras activas: con alguna, el movimiento elige de cuál sale o a cuál entra. */
  accounts?: FinanceAccount[];
  /** Cartera por la que se está filtrando la página, si hay una. */
  defaultAccountId?: string | null;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const navigate = useNavigate();
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('FOOD');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('EXPENSE'); setAmount(''); setCategory('FOOD'); setDescription(''); setDate(today()); setTouched(false); setError(null);
    const proposed = defaultAccountId ?? lastAccount();
    setAccountId(accounts.some((a) => a.id === proposed) ? proposed! : '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeType(next: 'EXPENSE' | 'INCOME') {
    setType(next);
    setCategory(next === 'INCOME' ? 'SALARY' : 'FOOD');
  }

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const created = await financeService.createTransaction({ type, amount: value, category, description: description.trim() || undefined, date, ...(accounts.length > 0 && { accountId: accountId || null }) });
      try { if (accountId) localStorage.setItem(LAST_ACCOUNT, accountId); } catch { /* modo privado */ }
      useToastStore.getState().success(type === 'INCOME' ? t.incomeOk : t.expenseOk);
      onSaved(created);
    } catch {
      setError(t.saveErr);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={t.title} className="md:max-w-[520px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <SegmentedControl role="radiogroup" label={t.typeLabel} value={type} onChange={changeType} options={[{ value: 'EXPENSE', label: t.expense }, { value: 'INCOME', label: t.income }]} />
        <Field label={t.amount} error={touched && !valid ? t.amountErr : undefined}>
          <Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-heading-sm font-mono tabular-nums" />
        </Field>
        {accounts.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-label-lg text-on-surface">{t.wallet}</span>
            <ChipGroup
              label={t.wallet} value={accountId} onChange={setAccountId}
              options={[...accounts.map((a) => ({ value: a.id, label: a.name, icon: ACCOUNT_ICON[a.kind] })), { value: '', label: t.noWallet }]}
            />
          </div>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.category}</legend>
          <div role="radiogroup" aria-label={t.category} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {categoriesFor(type, locale).map(({ value: v, label, icon: Icon, tone }) => {
              const selected = category === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategory(v)}
                  className={cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-label-md transition-colors',
                    selected ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:bg-surface-variant',
                  )}
                >
                  <span className={cn('flex size-7 items-center justify-center rounded-md', !selected && softTone[tone])}>
                    <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
        {/* Atajo contextual: «Ropa para mí» conecta el gasto con el armario del Espejo,
            para registrar la prenda que acabas de comprar. */}
        {type === 'EXPENSE' && category === 'CLOTHING_FOR_ME' && (
          <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/[var(--lq-soft-alpha)] p-3">
            <p className="min-w-0 flex-1 text-body-sm text-on-surface">{t.shortcutNote}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => { onClose(); navigate('/espejo?add=prenda'); }}>
              <MirrorIcon aria-hidden className="size-4" />{t.goMirror}
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.description} help={t.optional}>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === 'INCOME' ? t.incomePh : t.expensePh} />
          </Field>
          <Field label={t.date}>
            <DatePicker value={date} max={today()} onChange={setDate} />
          </Field>
        </div>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" loading={saving}>{t.save}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
