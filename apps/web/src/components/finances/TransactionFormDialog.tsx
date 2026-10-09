// Nueva transacción (sin prototipo propio: formulario del sistema). Mismo
// payload que el antiguo TransactionModal. Con el gasto «Ropa para mí» aparece
// el atajo «Ir al Espejo» para registrar la prenda recién comprada.
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { Transaction, TransactionCategory } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { Button, Field, Input, ResponsiveDialog, SegmentedControl, DatePicker } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { useToastStore } from '@/hooks/useToast';
import * as financeService from '@/services/finance.service';
import { categoriesFor } from './financeMeta';

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionFormDialog({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: (t: Transaction) => void;
}) {
  const navigate = useNavigate();
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('FOOD');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType('EXPENSE'); setAmount(''); setCategory('FOOD'); setDescription(''); setDate(today()); setTouched(false); setError(null);
  }, [open]);

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
      const t = await financeService.createTransaction({ type, amount: value, category, description: description.trim() || undefined, date });
      useToastStore.getState().success(type === 'INCOME' ? 'Ingreso registrado' : 'Gasto registrado');
      onSaved(t);
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Nueva transacción" className="md:max-w-[520px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <SegmentedControl role="radiogroup" label="Tipo de transacción" value={type} onChange={changeType} options={[{ value: 'EXPENSE', label: 'Gasto' }, { value: 'INCOME', label: 'Ingreso' }]} />
        <Field label="Monto" error={touched && !valid ? 'Escribe un monto mayor que 0' : undefined}>
          <Input data-autofocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-heading-sm font-mono tabular-nums" />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Categoría</legend>
          <div role="radiogroup" aria-label="Categoría" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {categoriesFor(type).map(({ value: v, label, icon: Icon, tone }) => {
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
        {/* Atajo contextual: «Ropa para mí» conecta el gasto con el Espejo,
            para registrar la prenda que acabas de comprar. */}
        {type === 'EXPENSE' && category === 'CLOTHING_FOR_ME' && (
          <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/[var(--lq-soft-alpha)] p-3">
            <p className="min-w-0 flex-1 text-body-sm text-on-surface">¿Acabas de comprar ropa? Añade la prenda a tu Espejo.</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => { onClose(); navigate('/espejo?add=prenda'); }}>
              <Sparkles aria-hidden className="size-4" />Ir al Espejo
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descripción" help="Opcional">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === 'INCOME' ? 'Ej. Pago de nómina' : 'Ej. Supermercado'} />
          </Field>
          <Field label="Fecha">
            <DatePicker value={date} max={today()} onChange={setDate} />
          </Field>
        </div>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Guardar</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
