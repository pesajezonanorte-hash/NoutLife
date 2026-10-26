// Mensual o anual, como dos tarjetas de radio. El anual va primero, elegido por defecto y con el
// oro de Pro: «Mejor valor», el ahorro en la moneda de la cuenta y en porcentaje, y el precio dicho por
// mes. El total del año siempre es la cifra grande (lo que se cobra), nunca el equivalente mensual.
import { useRef, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import type { BillingInterval } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import type { Copy } from '@/lib/i18n';
import { useOffer } from '@/lib/useOffer';

const OPTIONS: BillingInterval[] = ['year', 'month'];

const es = {
  group: 'Plan de NoutLife Pro',
  best: (percent: number) => `Mejor valor · −${percent} %`,
  name: (annual: boolean): string => (annual ? 'Anual' : 'Mensual'),
  annualLine: (perMonth: string, savings: string) => `${perMonth}/mes · ahorras ${savings}`,
  monthlyLine: (perDay: string) => `${perDay} al día, mes a mes`,
  first: (annual: boolean, price: string) => `${annual ? 'Primer año' : 'Primer mes'}: ${price}`,
};
const en: typeof es = {
  group: 'NoutLife Pro plan',
  best: (percent) => `Best value · −${percent}%`,
  name: (annual) => (annual ? 'Annual' : 'Monthly'),
  annualLine: (perMonth, savings) => `${perMonth}/month · save ${savings}`,
  monthlyLine: (perDay) => `${perDay} a day, month to month`,
  first: (annual, price) => `${annual ? 'First year' : 'First month'}: ${price}`,
};
const COPY: Copy<typeof es> = { es, en };

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
  const offer = useOffer();
  const t = COPY[offer.locale];

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
    <div role="radiogroup" aria-label={t.group} lang={offer.locale} className={cn('grid grid-cols-2 gap-2.5', className)}>
      {OPTIONS.map((interval, i) => {
        const on = interval === value;
        const annual = interval === 'year';
        const first = offer.firstPayment(interval, discountPercent);
        const discounted = first < offer.listFor(interval);
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
                {t.best(offer.savingsPercent)}
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
            <span className="text-label-lg">{t.name(annual)}</span>
            <span className="flex flex-wrap items-baseline gap-x-1">
              <span className="text-heading-md font-semibold tabular-nums tracking-tight">{offer.money(offer.listFor(interval))}</span>
              <span className="text-body-sm text-on-surface-light">/{offer.unit(interval)}</span>
            </span>
            <span className="text-body-sm text-on-surface">
              {annual
                ? t.annualLine(offer.money(offer.perMonthOfYear), offer.money(offer.savings))
                : t.monthlyLine(offer.perDay(offer.perDayFor('month')))}
            </span>
            {discounted && (
              <span className="text-label-sm font-semibold text-success-text">{t.first(annual, offer.money(first))}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
