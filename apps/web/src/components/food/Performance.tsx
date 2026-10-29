// Nutrición de rendimiento: lo que comiste hoy leído como combustible para entrenar.
// Si el Coliseo registra una sesión en el día mostrado, el panel lo dice y prioriza
// proteína y carbohidratos; si no, es día de descanso. Cada macro es una barra por
// segmentos, como la de una pulsera deportiva, y abajo el reparto de energía (P/C/G).
import { motion } from 'framer-motion';
import { Activity, BatteryCharging, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { fmtIntFor, macrosFor } from './foodMeta';

type Macro = 'protein' | 'carbs' | 'fat';

const es = {
  title: 'Combustible para entrenar',
  trained: (title: string): string => `Día de entreno: ${title}. Prioriza proteína para recuperar y carbohidratos para reponer energía.`,
  rest: 'Día de descanso: mantén la proteína alta y baja un poco los carbohidratos.',
  roles: { protein: 'recuperación muscular', carbs: 'energía', fat: 'hormonas y saciedad' } as Record<Macro, string>,
  split: 'Reparto de la energía',
  splitAria: (p: number, c: number, f: number): string => `Proteína ${p} %, carbohidratos ${c} %, grasas ${f} %`,
  ofGoal: (v: string, g: string): string => `${v}/${g} g`,
  barAria: (name: string, pct: number): string => `${name}: ${pct} % de la meta`,
};

const en: typeof es = {
  title: 'Fuel for training',
  trained: (title: string): string => `Training day: ${title}. Prioritize protein to recover and carbs to refuel.`,
  rest: 'Rest day: keep protein high and ease off the carbs a little.',
  roles: { protein: 'muscle recovery', carbs: 'energy', fat: 'hormones and fullness' },
  split: 'Energy split',
  splitAria: (p: number, c: number, f: number): string => `Protein ${p}%, carbs ${c}%, fat ${f}%`,
  ofGoal: (v: string, g: string): string => `${v}/${g} g`,
  barAria: (name: string, pct: number): string => `${name}: ${pct}% of goal`,
};

const COPY: Copy<typeof es> = { es, en };
const SEGMENTS = 12;
const FILL: Record<string, string> = { primary: 'bg-primary', warning: 'bg-warning', forest: 'bg-forest' };

export function PerformancePanel({ totals, goals, trainedTitle }: {
  totals: Record<Macro, number>;
  goals: Record<Macro, number>;
  /** Título de la sesión del Coliseo de ese día, o null si fue día de descanso. */
  trainedTitle: string | null;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const reduce = useMotionStore((s) => s.reduce);
  const kcal = { protein: totals.protein * 4, carbs: totals.carbs * 4, fat: totals.fat * 9 };
  const sum = kcal.protein + kcal.carbs + kcal.fat;
  const share = (k: Macro) => (sum ? Math.round((kcal[k] / sum) * 100) : 0);
  return (
    <section aria-labelledby="food-performance" className="lq-perf flex flex-col gap-5 rounded-3xl border border-border p-5 md:p-7">
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl', trainedTitle ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'bg-surface-variant text-on-surface')}>
          {trainedTitle ? <Activity aria-hidden className="size-5" /> : <Moon aria-hidden className="size-5" />}
        </span>
        <div className="min-w-0 flex-[1_1_16rem]">
          <h2 id="food-performance" className="text-heading-sm">{t.title}</h2>
          <p className="text-body-sm text-on-surface-light">{trainedTitle ? t.trained(trainedTitle) : t.rest}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-4">
        {macrosFor(locale).map(({ key, label, tone }, row) => {
          const pct = goals[key] ? Math.round((totals[key] / goals[key]) * 100) : 0;
          const lit = Math.min(SEGMENTS, Math.round((pct / 100) * SEGMENTS));
          return (
            <li key={key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-label-lg">{label} <span className="font-normal text-on-surface-light">· {t.roles[key]}</span></span>
                <span className="font-mono text-label-md tabular-nums text-on-surface">{t.ofGoal(fmtIntFor(totals[key], locale), fmtIntFor(goals[key], locale))}</span>
              </div>
              <div role="meter" aria-label={t.barAria(label, pct)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)} className="grid grid-cols-12 gap-1">
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <span key={i} className="relative h-2.5 overflow-hidden rounded-[3px] bg-surface-variant">
                    {i < lit && (
                      <motion.span
                        className={cn('absolute inset-0 origin-left', FILL[tone] ?? 'bg-primary', pct > 110 && 'bg-error')}
                        initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                        transition={{ duration: 0.18, delay: reduce ? 0 : 0.25 + row * 0.12 + i * 0.035 }}
                      />
                    )}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-label-md text-on-surface-light"><BatteryCharging aria-hidden className="size-4" />{t.split}</span>
        <div role="img" aria-label={t.splitAria(share('protein'), share('carbs'), share('fat'))} className="flex h-3 gap-[3px] overflow-hidden rounded-full">
          {(['protein', 'carbs', 'fat'] as const).map((k, i) => (
            <motion.span
              key={k} className={cn('block h-full first:rounded-l-full last:rounded-r-full', ['bg-primary', 'bg-warning', 'bg-forest'][i])}
              style={{ flex: Math.max(1, share(k)) }} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: sum ? 1 : 0.25 }} transition={{ delay: 0.5 + i * 0.1 }}
            />
          ))}
        </div>
        <div className="flex justify-between font-mono text-label-md tabular-nums text-on-surface-light">
          <span>P {share('protein')} %</span><span>C {share('carbs')} %</span><span>{locale === 'en' ? 'F' : 'G'} {share('fat')} %</span>
        </div>
      </div>
    </section>
  );
}
