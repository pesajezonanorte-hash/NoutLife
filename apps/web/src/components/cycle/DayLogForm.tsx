// Registro de un día del ciclo: flujo, ánimo, energía, síntomas y una nota.
// Todo se marca con un toque y se guarda junto. Anotar sangrado fuera de un
// periodo lo abre solo (lo decide la API).
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplet, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { Button, Field, MoodPicker, Textarea } from '@/components/ui/lq';
import type { CycleFlow, CycleLog, CycleLogInput, CycleSymptom } from '@/services/cycle.service';
import { ENERGY_LABELS, FLOW_OPTIONS, SYMPTOMS, SYMPTOM_LABELS, phaseFill } from './cycleMeta';

const toggleClass = (on: boolean) => cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-label-lg transition-[background-color,border-color,color,transform] duration-200 active:scale-[.97]',
  on ? 'border-transparent text-on-background' : 'border-border bg-background text-on-surface hover:border-border-strong',
);

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

export function DayLogForm({ initial, onSave, onClear, saving, compact }: {
  initial: CycleLog | null;
  onSave: (input: CycleLogInput) => Promise<void>;
  onClear?: () => Promise<void>;
  saving?: boolean;
  /** Sin la nota (registro rápido de hoy). */
  compact?: boolean;
}) {
  const [flow, setFlow] = useState<CycleFlow | null>(initial?.flow ?? null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [symptoms, setSymptoms] = useState<CycleSymptom[]>(initial?.symptoms ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const toggleSymptom = (s: CycleSymptom) => setSymptoms((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const empty = !flow && !mood && !energy && symptoms.length === 0 && !notes.trim();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => { e.preventDefault(); void onSave({ flow, mood, energy, symptoms, notes: notes.trim() || null }); }}
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
                style={on ? { background: f.drops ? phaseFill('menstrual', 0.18) : 'rgb(var(--lq-surface-variant))', color: f.drops ? 'rgb(var(--cy-menstrual-text))' : undefined } : undefined}
              >
                <Drops flow={f.value} />{f.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-label-lg text-on-surface" aria-hidden>Ánimo</span>
        <MoodPicker label="Ánimo" value={mood ?? 0} onChange={(n) => setMood(n === mood ? null : n)} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-label-lg text-on-surface" aria-hidden>Energía</span>
        <EnergyMeter value={energy} onChange={setEnergy} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">Síntomas</legend>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => toggleSymptom(s)} className={toggleClass(on)} style={on ? { background: 'rgb(var(--lq-primary) / var(--lq-soft-alpha))' } : undefined}>
                {SYMPTOM_LABELS[s]}
              </button>
            );
          })}
        </div>
      </fieldset>

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
