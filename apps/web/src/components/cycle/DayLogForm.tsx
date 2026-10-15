// Registro de un día del Ciclo Menstrual: flujo, ánimo, energía, síntomas, estilo
// de vida (actividad sexual, anticonceptivos, sueño, estrés, agua) y una nota.
// Todo se marca con un toque y se guarda junto. Anotar sangrado fuera de un
// periodo lo abre solo (lo decide la API).
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplet, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { Button, Field, Textarea } from '@/components/ui/lq';
import type { CycleContraceptive, CycleFlow, CycleLog, CycleLogInput, CycleMood, CycleSexualActivity, CycleSymptom } from '@/services/cycle.service';
import {
  CONTRACEPTIVE_OPTIONS, ENERGY_LABELS, FLOW_OPTIONS, MOOD_META, MOODS, SEXUAL_OPTIONS, SYMPTOMS, SYMPTOM_META, phaseFill,
} from './cycleMeta';

const toggleClass = (on: boolean) => cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-label-lg transition-[background-color,border-color,color,transform] duration-200 active:scale-[.97]',
  on ? 'border-transparent text-on-background' : 'border-border bg-background text-on-surface hover:border-border-strong',
);
const WATER_MAX = 20;

/** Gotas del flujo: 0 a 3 (el manchado lleva una gota hueca). */
function Drops({ flow }: { flow: CycleFlow }) {
  const meta = FLOW_OPTIONS.find((f) => f.value === flow)!;
  if (flow === 'none') return null;
  if (flow === 'spotting') return <Droplet aria-hidden className="size-3.5" strokeWidth={1.75} />;
  return (
    <span aria-hidden className="flex -space-x-1">
      {Array.from({ length: meta.drops }, (_, i) => <Droplet key={i} className="size-3.5" fill="currentColor" strokeWidth={1.5} />)}
    </span>
  );
}

/** Cinco barras que suben: la energía del día (radiogroup con flechas). */
function EnergyMeter({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Energía" className="flex items-end gap-2">
      {ENERGY_LABELS.map((label, i) => {
        const n = i + 1;
        const on = value === n;
        const lit = value != null && n <= value;
        return (
          <button
            key={n} type="button" role="radio" aria-checked={on} aria-label={`${n} de 5: ${label}`} title={label}
            tabIndex={on || (value == null && n === 3) ? 0 : -1}
            onClick={() => onChange(on ? null : n)}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = Math.min(5, Math.max(1, (value ?? 3) + d));
              onChange(next);
              (e.currentTarget.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
            }}
            className="group flex min-h-11 min-w-11 flex-col items-center justify-end gap-1 rounded-lg px-1"
          >
            <motion.span
              aria-hidden="true"
              className={cn('block w-3.5 origin-bottom rounded-[4px]', lit ? 'bg-success' : 'bg-on-background/10 group-hover:bg-on-background/20')}
              style={{ height: 10 + n * 7 }}
              animate={{ scaleY: on ? 1.08 : 1 }}
              transition={springs.snappy}
            />
            <span className={cn('text-label-md', on ? 'text-on-background' : 'text-on-surface-light')}>{n}</span>
          </button>
        );
      })}
      <span className="ml-1 self-center text-body-sm text-on-surface-light" aria-live="polite">{value ? ENERGY_LABELS[value - 1] : 'Sin anotar'}</span>
    </div>
  );
}

/** Escala de 1 a 5 con etiquetas en los extremos (sueño, estrés). */
function ScaleRow({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (n: number | null) => void; low: string; high: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <button
              key={n} type="button" role="radio" aria-checked={on} aria-label={`${n} de 5`}
              onClick={() => onChange(on ? null : n)}
              className={cn('flex min-h-11 flex-1 items-center justify-center rounded-xl border font-mono text-label-lg tabular-nums transition-colors duration-200',
                on ? 'border-transparent bg-primary text-on-primary' : 'border-border bg-background text-on-surface hover:border-border-strong')}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-label-md text-on-surface-light"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

/** Vasos de agua: un contador con más y menos. */
function WaterStepper({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const n = value ?? 0;
  const set = (next: number) => onChange(next <= 0 ? null : Math.min(WATER_MAX, next));
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" size="md" aria-label="Quitar un vaso" disabled={n === 0} onClick={() => set(n - 1)}><Minus aria-hidden className="size-4" /></Button>
      <span className="min-w-[4.5rem] text-center font-mono text-heading-sm tabular-nums" aria-live="polite">{n} {n === 1 ? 'vaso' : 'vasos'}</span>
      <Button type="button" variant="secondary" size="md" aria-label="Añadir un vaso" disabled={n >= WATER_MAX} onClick={() => set(n + 1)}><Plus aria-hidden className="size-4" /></Button>
    </div>
  );
}

export function DayLogForm({ initial, onSave, onClear, saving, compact }: {
  initial: CycleLog | null;
  onSave: (input: CycleLogInput) => Promise<void>;
  onClear?: () => Promise<void>;
  saving?: boolean;
  /** Sin la nota (registro rápido de hoy). */
  compact?: boolean;
}) {
  const [flow, setFlow] = useState<CycleFlow | null>(initial?.flow ?? null);
  const [moods, setMoods] = useState<CycleMood[]>(initial?.moods ?? []);
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [symptoms, setSymptoms] = useState<CycleSymptom[]>(initial?.symptoms ?? []);
  const [sexualActivity, setSexualActivity] = useState<CycleSexualActivity | null>(initial?.sexualActivity ?? null);
  const [contraception, setContraception] = useState<CycleContraceptive | null>(initial?.contraception ?? null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(initial?.sleepQuality ?? null);
  const [stress, setStress] = useState<number | null>(initial?.stress ?? null);
  const [waterGlasses, setWaterGlasses] = useState<number | null>(initial?.waterGlasses ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const toggle = <T extends string>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const empty = !flow && moods.length === 0 && !energy && symptoms.length === 0 && !sexualActivity && !contraception
    && !sleepQuality && !stress && !waterGlasses && !notes.trim();

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          flow, moods, energy, symptoms, sexualActivity, contraception, sleepQuality, stress, waterGlasses, notes: notes.trim() || null,
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Flujo</legend>
        <div className="flex flex-wrap gap-2">
          {FLOW_OPTIONS.map((f) => {
            const on = flow === f.value;
            return (
              <button
                key={f.value} type="button" aria-pressed={on} onClick={() => setFlow(on ? null : f.value)}
                className={toggleClass(on)}
                style={on ? { background: f.drops || f.value === 'spotting' ? phaseFill('menstrual', 0.18) : 'rgb(var(--lq-surface-variant))', color: f.drops || f.value === 'spotting' ? 'rgb(var(--cy-menstrual-text))' : undefined } : undefined}
              >
                <Drops flow={f.value} />{f.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Ánimo</legend>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => {
            const on = moods.includes(m);
            const { icon: Icon, label } = MOOD_META[m];
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => setMoods(toggle(moods, m))} className={toggleClass(on)} style={on ? { background: 'rgb(var(--lq-primary) / var(--lq-soft-alpha))' } : undefined}>
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />{label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-label-lg text-on-surface" aria-hidden>Energía</span>
        <EnergyMeter value={energy} onChange={setEnergy} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Síntomas físicos</legend>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            const { icon: Icon, label } = SYMPTOM_META[s];
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => setSymptoms(toggle(symptoms, s))} className={toggleClass(on)} style={on ? { background: 'rgb(var(--lq-primary) / var(--lq-soft-alpha))' } : undefined}>
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />{label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Actividad sexual</legend>
        <div className="flex flex-wrap gap-2">
          {SEXUAL_OPTIONS.map((o) => {
            const on = sexualActivity === o.value;
            return <button key={o.value} type="button" aria-pressed={on} onClick={() => setSexualActivity(on ? null : o.value)} className={toggleClass(on)}>{o.label}</button>;
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Anticonceptivo de hoy</legend>
        <div className="flex flex-wrap gap-2">
          {CONTRACEPTIVE_OPTIONS.map((o) => {
            const on = contraception === o.value;
            return <button key={o.value} type="button" aria-pressed={on} onClick={() => setContraception(on ? null : o.value)} className={toggleClass(on)}>{o.label}</button>;
          })}
        </div>
      </fieldset>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Calidad del sueño</legend>
          <ScaleRow label="Calidad del sueño" value={sleepQuality} onChange={setSleepQuality} low="Muy mal" high="Muy bien" />
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Estrés</legend>
          <ScaleRow label="Estrés" value={stress} onChange={setStress} low="Nada" high="Mucho" />
        </fieldset>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label-lg text-on-surface" aria-hidden>Agua</span>
        <WaterStepper value={waterGlasses} onChange={setWaterGlasses} />
      </div>

      {!compact && (
        <Field label="Nota del día" help="Solo la ves tú.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} placeholder="Cómo te sentiste, qué te ayudó…" />
        </Field>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onClear && initial && (
          <Button type="button" variant="ghost" onClick={() => void onClear()} className="mr-auto"><Trash2 aria-hidden className="size-4" />Borrar el día</Button>
        )}
        <Button type="submit" loading={saving} disabled={empty && !initial}><Save aria-hidden className="size-4" />Guardar el día</Button>
      </div>
    </form>
  );
}
