// Mensual o anual, como dos tarjetas de radio. El anual va primero, elegido por defecto y con el
// oro de Pro: «Mejor valor», el ahorro en pesos y en porcentaje, y el precio dicho por mes. El total
// del año siempre es la cifra grande (lo que se cobra), nunca el equivalente mensual.
import { useRef, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { BillingInterval } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import {
  ANNUAL_SAVINGS_COP, ANNUAL_SAVINGS_PERCENT, PRO_ANNUAL_PER_MONTH_COP, PRO_PER_DAY_COP, firstPaymentCop, formatCop, intervalUnit, priceFor,
} from '@/lib/plan';

const OPTIONS: BillingInterval[] = ['year', 'month'];

export interface PlanIntervalPickerProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  /** Descuento del código de creador: se muestra el precio del primer pago. */
  discountPercent?: number;
  /** Dónde está, para la analítica (upgrade_modal, plan, checkout…). */
  surface: string;
  className?: string;
}

export function PlanIntervalPicker({ value, onChange, discountPercent = 0, surface, className }: PlanIntervalPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const choose = (interval: BillingInterval) => {
    if (interval === value) return;
    onChange(interval);
    track('plan_interval_selected', { interval, surface });
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + OPTIONS.length) % OPTIONS.length;
    choose(OPTIONS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Plan de NoutLife Pro" className={cn('grid grid-cols-2 gap-2.5', className)}>
      {OPTIONS.map((interval, i) => {
        const on = interval === value;
        const annual = interval === 'year';
        const first = firstPaymentCop(interval, discountPercent);
        const discounted = first < priceFor(interval);
        return (
          <button
            key={interval}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => choose(interval)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative flex min-h-[7.5rem] flex-col items-start gap-1 rounded-2xl border px-3.5 pb-3 pt-4 text-left transition-[border-color,background-color,box-shadow] duration-200',
              on ? 'border-secondary bg-secondary/[var(--lq-soft-alpha)] shadow-sm' : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            {annual && (
              // Texto oro sobre el fondo (no sobre oro sólido): el contraste se cumple en todos los temas.
              <span className="absolute -top-2.5 left-3 rounded-full border border-secondary/70 bg-background px-2 py-0.5 text-label-sm font-semibold text-secondary-text shadow-sm">
                Mejor valor · −{ANNUAL_SAVINGS_PERCENT} %
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                'absolute right-3 top-3 flex size-5 items-center justify-center rounded-full border bg-background transition-colors',
                on ? 'border-secondary text-secondary-text' : 'border-border-strong',
              )}
            >
              {on && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className="text-label-lg">{annual ? 'Anual' : 'Mensual'}</span>
            <span className="flex flex-wrap items-baseline gap-x-1">
              <span className="text-heading-md font-semibold tabular-nums tracking-tight">{formatCop(priceFor(interval))}</span>
              <span className="text-body-sm text-on-surface-light">/{intervalUnit(interval)}</span>
            </span>
            <span className="text-body-sm text-on-surface">
              {annual
                ? <>{formatCop(PRO_ANNUAL_PER_MONTH_COP)}/mes · ahorras {formatCop(ANNUAL_SAVINGS_COP)}</>
                : <>{formatCop(PRO_PER_DAY_COP)} al día, mes a mes</>}
            </span>
            {discounted && (
              <span className="text-label-sm font-semibold text-success-text">
                {annual ? 'Primer año' : 'Primer mes'}: {formatCop(first)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
