// Tarjeta «Flujo de caja 3D» de Finanzas: cada día del mes es una barra de vidrio extruida (lo
// que entró sube, lo que salió baja). Compacta y sin adornos: la gráfica a un lado y, al otro,
// el día elegido y los picos del mes con jerarquía clara (etiqueta, cifra, fecha). three.js solo
// se descarga cerca de la pantalla; sin WebGL 2 la tarjeta no aparece (la gráfica semanal y el
// saldo dicen lo mismo).
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { Transaction } from '@noutlife/shared';
import { ArrowDownLeft, ArrowUpRight, BarChart2, Hand } from 'lucide-react';
import { hasWebGL2, useNear } from '@/components/three3d/near';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { cashflowDays, cashPeaks } from './cashflowMath';
import type { Cashflow3DProps } from './cashflow3d/Cashflow3D';

const es = {
  eyebrow: 'Flujo de caja 3D',
  title: 'Tu mes en relieve',
  hint: 'Cada día es una barra: lo que entró sube y lo que salió baja.',
  income: 'Entró',
  expense: 'Salió',
  pick: 'Pasa el cursor o toca un día para verlo.',
  bestIn: 'Más ingresos',
  bestOut: 'Más gastos',
  none: 'Sin movimientos',
  drag: 'Arrastra para girar',
};
const en: typeof es = {
  eyebrow: '3D cash flow',
  title: 'Your month in relief',
  hint: 'Each day is a bar: money in rises and money out drops.',
  income: 'In',
  expense: 'Out',
  pick: 'Hover or tap a day to see it.',
  bestIn: 'Top income',
  bestOut: 'Top spending',
  none: 'No movements',
  drag: 'Drag to turn',
};
const COPY: Copy<typeof es> = { es, en };

const Cashflow3D = lazy<ComponentType<Cashflow3DProps>>(() => import('./cashflow3d/Cashflow3D').catch(() => ({
  default: ({ onUnavailable }: Cashflow3DProps) => { useEffect(onUnavailable, []); return null; },
})));

export interface CashflowCardProps {
  txs: Transaction[];
  from: string;
  to: string;
  money: (n: number) => string;
}

export function CashflowCard({ txs, from, to, money }: CashflowCardProps) {
  const t = useText(COPY);
  const locale = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const [ok, setOk] = useState(hasWebGL2);
  const [picked, setPicked] = useState<number | null>(null);
  const days = useMemo(() => cashflowDays(txs, from, to), [txs, from, to]);
  const { inI, outI } = useMemo(() => cashPeaks(days), [days]);
  const dayLabel = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  const day = picked !== null ? days[picked] : null;
  useEffect(() => { setPicked(null); }, [from]);

  if (!ok || days.every((d) => d.income === 0 && d.expense === 0)) return null;
  const peak = (label: string, i: number, value: number, tone: string) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-label-sm text-on-surface-light">{label}</dt>
      {i >= 0 ? (
        <>
          <dd className={`font-mono text-label-lg tabular-nums ${tone}`}>{money(value)}</dd>
          <dd className="truncate text-label-sm font-normal text-on-surface-light first-letter:uppercase">{dayLabel(days[i].key)}</dd>
        </>
      ) : <dd className="text-label-sm font-normal text-on-surface-light">{t.none}</dd>}
    </div>
  );
  return (
    <section ref={ref} aria-labelledby="cashflow-t" className="lq-glass3d grid md:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
      <div className="relative h-[190px] sm:h-[220px] md:h-auto md:min-h-[250px]">
        {near && (
          <Suspense fallback={null}>
            <Cashflow3D
              days={days} onPick={setPicked} onUnavailable={() => setOk(false)}
              tag={day && <><span>{dayLabel(day.key)}</span>{day.income > 0 && <span className="font-mono tabular-nums text-success-text">+{money(day.income)}</span>}{day.expense > 0 && <span className="font-mono tabular-nums text-error-text">−{money(day.expense)}</span>}</>}
            />
          </Suspense>
        )}
        <span aria-hidden className="pointer-events-none absolute bottom-2.5 left-3 flex items-center gap-1 text-label-sm font-normal text-on-surface-light/70">
          <Hand className="size-3" strokeWidth={1.75} />{t.drag}
        </span>
      </div>
      <div className="flex flex-col gap-4 border-t border-on-background/[.07] p-5 md:border-l md:border-t-0">
        <header className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-label-sm uppercase tracking-[.08em] text-primary-text">
            <BarChart2 aria-hidden className="size-3.5" strokeWidth={2} />{t.eyebrow}
          </span>
          <h2 id="cashflow-t" className="text-heading-sm">{t.title}</h2>
          <p className="text-body-sm text-on-surface-light">{t.hint}</p>
        </header>
        <div aria-live="polite" className="lq-well flex min-h-[64px] flex-col justify-center gap-1 px-3.5 py-2.5">
          {day ? (
            <>
              <span className="text-label-lg first-letter:uppercase">{dayLabel(day.key)}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
                <span className="flex items-center gap-1 text-success-text"><ArrowDownLeft aria-hidden className="size-4" />{t.income} <b className="font-mono tabular-nums">{money(day.income)}</b></span>
                <span className="flex items-center gap-1 text-error-text"><ArrowUpRight aria-hidden className="size-4" />{t.expense} <b className="font-mono tabular-nums">{money(day.expense)}</b></span>
              </span>
            </>
          ) : <span className="text-body-sm text-on-surface-light">{t.pick}</span>}
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-4">
          {peak(t.bestIn, inI, inI >= 0 ? days[inI].income : 0, 'text-success-text')}
          {peak(t.bestOut, outI, outI >= 0 ? days[outI].expense : 0, 'text-error-text')}
        </dl>
      </div>
    </section>
  );
}
