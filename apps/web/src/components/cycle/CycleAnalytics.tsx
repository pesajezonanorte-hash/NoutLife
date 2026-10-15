// Tendencias del Ciclo Menstrual: la duración de cada ciclo frente a la de su
// periodo (barras, con el número escrito) y los síntomas que más aparecen en cada
// fase. Todo sale de los registros propios; con pocos datos lo dice en vez de
// dibujar una tendencia que no existe.
import { motion } from 'framer-motion';
import { useMotionReduced } from '@/lib/motion';
import type { CycleAnalytics as Analytics, CycleOverview } from '@/services/cycle.service';
import { PHASES, PHASE_META, SYMPTOM_LABELS, phaseFill, phaseInk, longDay } from './cycleMeta';

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
  const a: Analytics = data.analytics;
  const avg = data.averages;
  const enough = a.cycles.length >= 2;

  // Ciclos y periodos en la misma escala para compararlos.
  const scale = Math.max(1, ...a.cycles.map((c) => c.length), ...a.periods.map((p) => p.length));
  const cycleRows = a.cycles.map((c) => ({ key: c.start, label: longDay(c.start), value: c.length }));
  const periodRows = a.periods.map((p) => ({ key: p.start, label: longDay(p.start), value: p.length }));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-variant p-3">
          <dt className="text-body-sm text-on-surface-light">Duración media del ciclo</dt>
          <dd className="font-mono text-heading-lg tabular-nums">{avg.cycleLength} días</dd>
        </div>
        <div className="rounded-xl bg-surface-variant p-3">
          <dt className="text-body-sm text-on-surface-light">Duración media del periodo</dt>
          <dd className="font-mono text-heading-lg tabular-nums">{avg.periodLength} días</dd>
        </div>
        <div className="rounded-xl bg-surface-variant p-3">
          <dt className="text-body-sm text-on-surface-light">Regularidad</dt>
          <dd className="text-heading-sm">
            {avg.regularity == null
              ? 'Aún sin datos'
              : avg.regularity === 'regular' ? `Regular (± ${avg.stdDev} días)`
                : avg.regularity === 'variable' ? `Variable (± ${avg.stdDev} días)`
                  : `Irregular (± ${avg.stdDev} días)`}
          </dd>
        </div>
      </div>

      <section aria-labelledby="cy-trends" className="flex flex-col gap-4">
        <h3 id="cy-trends" className="text-heading-sm">Ciclo frente a periodo</h3>
        {enough ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-label-lg text-on-surface">Duración de cada ciclo</span>
              <Bars rows={cycleRows} max={scale} color={phaseFill('follicular')} unit="días" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-label-lg text-on-surface">Duración de cada periodo</span>
              <Bars rows={periodRows} max={scale} color={phaseFill('menstrual')} unit="días" />
            </div>
          </div>
        ) : (
          <p className="text-body-md text-on-surface-light">Con dos ciclos completos ya verás la tendencia aquí. Anota tus periodos pasados para acelerarlo.</p>
        )}
      </section>

      <section aria-labelledby="cy-symptoms" className="flex flex-col gap-4">
        <h3 id="cy-symptoms" className="text-heading-sm">Síntomas más frecuentes por fase</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHASES.map((p) => {
            const row = a.symptomsByPhase[p];
            const top = row.symptoms.slice(0, 4);
            return (
              <div key={p} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
                <span className="flex items-center justify-between gap-2 text-label-lg" style={{ color: phaseInk(p) }}>
                  {PHASE_META[p].name}
                  <span className="font-mono text-label-md tabular-nums text-on-surface-light">{row.days} {row.days === 1 ? 'día' : 'días'}</span>
                </span>
                {top.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {top.map((s) => (
                      <li key={s.symptom} className="flex items-center justify-between gap-2 text-body-sm">
                        <span>{SYMPTOM_LABELS[s.symptom]}</span>
                        <span className="font-mono tabular-nums text-on-surface-light">{s.count} {s.count === 1 ? 'vez' : 'veces'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-sm text-on-surface-light">Sin síntomas anotados en esta fase.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
