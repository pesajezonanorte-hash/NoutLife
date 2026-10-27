// Tendencias del Ciclo Menstrual: la duración de cada ciclo frente a la de su
// periodo (barras, con el número escrito) y los síntomas que más aparecen en cada
// fase. Todo sale de los registros propios; con pocos datos lo dice en vez de
// dibujar una tendencia que no existe.
import { motion } from 'framer-motion';
import { useMotionReduced } from '@/lib/motion';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import type { CycleAnalytics as Analytics, CycleOverview } from '@/services/cycle.service';
import { PHASES, longDay, phaseFill, phaseInk, phaseMetaFor, symptomLabelsFor } from './cycleMeta';

const es = {
  cycleAvg: 'Duración media del ciclo',
  periodAvg: 'Duración media del periodo',
  regularity: 'Regularidad',
  noData: 'Aún sin datos',
  regular: (sd: number | null): string => `Regular (± ${sd} días)`,
  variable: (sd: number | null): string => `Variable (± ${sd} días)`,
  irregular: (sd: number | null): string => `Irregular (± ${sd} días)`,
  days: (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`,
  daysUnit: 'días',
  times: (n: number): string => `${n} ${n === 1 ? 'vez' : 'veces'}`,
  cycleVsPeriod: 'Ciclo frente a periodo',
  eachCycle: 'Duración de cada ciclo',
  eachPeriod: 'Duración de cada periodo',
  needTwo: 'Con dos ciclos completos ya verás la tendencia aquí. Anota tus periodos pasados para acelerarlo.',
  symptomsByPhase: 'Síntomas más frecuentes por fase',
  noSymptoms: 'Sin síntomas anotados en esta fase.',
};

const en: typeof es = {
  cycleAvg: 'Average cycle length',
  periodAvg: 'Average period length',
  regularity: 'Regularity',
  noData: 'No data yet',
  regular: (sd: number | null): string => `Regular (± ${sd} days)`,
  variable: (sd: number | null): string => `Variable (± ${sd} days)`,
  irregular: (sd: number | null): string => `Irregular (± ${sd} days)`,
  days: (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`,
  daysUnit: 'days',
  times: (n: number): string => `${n} ${n === 1 ? 'time' : 'times'}`,
  cycleVsPeriod: 'Cycle vs. period',
  eachCycle: 'Length of each cycle',
  eachPeriod: 'Length of each period',
  needTwo: 'With two full cycles, the trend will show up here. Log your past periods to speed it up.',
  symptomsByPhase: 'Most frequent symptoms by phase',
  noSymptoms: 'No symptoms logged in this phase.',
};

const COPY: Copy<typeof es> = { es, en };

/** Barras horizontales escaladas al mayor valor de la lista. */
function Bars({ rows, max, color, unit }: { rows: { key: string; label: string; value: number }[]; max: number; color: string; unit: string }) {
  const reduce = useMotionReduced();
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={r.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.75rem] items-center gap-3">
          <span className="truncate text-body-sm text-on-surface-light">{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-on-background/[.06]">
            <motion.span
              className="block h-full origin-left rounded-full"
              style={{ background: color, width: `${Math.max(4, (r.value / max) * 100)}%` }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 * i } }}
            />
          </span>
          <span className="whitespace-nowrap text-right font-mono text-body-sm tabular-nums">{r.value} {unit}</span>
        </li>
      ))}
    </ol>
  );
}

export function CycleAnalyticsPanel({ data }: { data: CycleOverview }) {
  const t = useText(COPY);
  const locale = useLocale();
  const phases = phaseMetaFor(locale);
  const symptoms = symptomLabelsFor(locale);
  const a: Analytics = data.analytics;
  const avg = data.averages;
  const enough = a.cycles.length >= 2;

  // Ciclos y periodos en la misma escala para compararlos.
  const scale = Math.max(1, ...a.cycles.map((c) => c.length), ...a.periods.map((p) => p.length));
  const cycleRows = a.cycles.map((c) => ({ key: c.start, label: longDay(c.start, locale), value: c.length }));
  const periodRows = a.periods.map((p) => ({ key: p.start, label: longDay(p.start, locale), value: p.length }));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-variant p-3">
          <dt className="text-body-sm text-on-surface-light">{t.cycleAvg}</dt>
          <dd className="font-mono text-heading-lg tabular-nums">{t.days(avg.cycleLength)}</dd>
        </div>
        <div className="rounded-xl bg-surface-variant p-3">
          <dt className="text-body-sm text-on-surface-light">{t.periodAvg}</dt>
          <dd className="font-mono text-heading-lg tabular-nums">{t.days(avg.periodLength)}</dd>
        </div>
        <div className="rounded-xl bg-surface-variant p-3">
          <dt className="text-body-sm text-on-surface-light">{t.regularity}</dt>
          <dd className="text-heading-sm">
            {avg.regularity == null
              ? t.noData
              : avg.regularity === 'regular' ? t.regular(avg.stdDev)
                : avg.regularity === 'variable' ? t.variable(avg.stdDev)
                  : t.irregular(avg.stdDev)}
          </dd>
        </div>
      </div>

      <section aria-labelledby="cy-trends" className="flex flex-col gap-4">
        <h3 id="cy-trends" className="text-heading-sm">{t.cycleVsPeriod}</h3>
        {enough ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-label-lg text-on-surface">{t.eachCycle}</span>
              <Bars rows={cycleRows} max={scale} color={phaseFill('follicular')} unit={t.daysUnit} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-label-lg text-on-surface">{t.eachPeriod}</span>
              <Bars rows={periodRows} max={scale} color={phaseFill('menstrual')} unit={t.daysUnit} />
            </div>
          </div>
        ) : (
          <p className="text-body-md text-on-surface-light">{t.needTwo}</p>
        )}
      </section>

      <section aria-labelledby="cy-symptoms" className="flex flex-col gap-4">
        <h3 id="cy-symptoms" className="text-heading-sm">{t.symptomsByPhase}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHASES.map((p) => {
            const row = a.symptomsByPhase[p];
            const top = row.symptoms.slice(0, 4);
            return (
              <div key={p} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
                <span className="flex items-center justify-between gap-2 text-label-lg" style={{ color: phaseInk(p) }}>
                  {phases[p].name}
                  <span className="font-mono text-label-md tabular-nums text-on-surface-light">{t.days(row.days)}</span>
                </span>
                {top.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {top.map((s) => (
                      <li key={s.symptom} className="flex items-center justify-between gap-2 text-body-sm">
                        <span>{symptoms[s.symptom]}</span>
                        <span className="font-mono tabular-nums text-on-surface-light">{t.times(s.count)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-sm text-on-surface-light">{t.noSymptoms}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
