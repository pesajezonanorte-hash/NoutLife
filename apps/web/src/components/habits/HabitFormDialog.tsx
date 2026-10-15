// Crear / editar hábito (rediseño del antiguo HabitModal, mismo payload).
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Dumbbell, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, ResponsiveDialog, SegmentedControl, Switch, Textarea } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { HABIT_ICON_OPTIONS, resolveGlyph } from '@/components/ui/glyphs';
import { CATEGORIES, CATEGORY_META } from '@/lib/lifeMeta';
import * as agendaService from '@/services/agenda.service';
import type { CreateHabitPayload, Habit } from '@/services/habit.service';

const WEEK = [
  { value: 1, label: 'L', name: 'lunes' }, { value: 2, label: 'M', name: 'martes' }, { value: 3, label: 'X', name: 'miércoles' },
  { value: 4, label: 'J', name: 'jueves' }, { value: 5, label: 'V', name: 'viernes' }, { value: 6, label: 'S', name: 'sábado' },
  { value: 0, label: 'D', name: 'domingo' },
];

type FreqType = 'daily' | 'days_per_week';

function initialForm(h?: Habit | null): CreateHabitPayload {
  return {
    title: h?.title ?? '',
    description: h?.description ?? '',
    category: h?.category ?? 'HEALTH',
    icon: h?.icon ?? 'star',
    color: h?.color, // se conserva el color guardado; el rediseño no lo muestra ni lo pide
    xpReward: h?.xpReward ?? 20,
    goldReward: h?.goldReward ?? 5,
    reminderTime: h?.reminderTime ?? '',
    frequency: h?.frequency ?? { type: 'daily', days: [] },
    syncToGoogleCalendar: h?.syncToGoogleCalendar ?? false,
    createsColiseoAttendance: h?.createsColiseoAttendance ?? false,
    kind: h?.kind ?? 'habit',
    steps: [...(h?.steps ?? [])].sort((a, b) => a.order - b.order).map((st) => st.title),
  };
}

const KIND_OPTIONS: { value: 'habit' | 'ritual'; label: string }[] = [
  { value: 'habit', label: 'Hábito' },
  { value: 'ritual', label: 'Ritual' },
];
const MAX_STEPS = 12;

function apiError(err: unknown) {
  const data = (err as { response?: { data?: { error?: string; details?: { message: string }[] } } }).response?.data;
  return data?.details?.[0]?.message ?? data?.error ?? 'No pudimos guardar el hábito. Inténtalo de nuevo.';
}

export interface HabitFormDialogProps {
  open: boolean;
  habit?: Habit | null;
  onClose: () => void;
  onSubmit: (payload: CreateHabitPayload) => Promise<void>;
}

export function HabitFormDialog({ open, habit, onClose, onSubmit }: HabitFormDialogProps) {
  const [form, setForm] = useState<CreateHabitPayload>(() => initialForm(habit));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [google, setGoogle] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(habit));
    setTouched(false);
    setError(null);
    let alive = true;
    agendaService.getGoogleCalendarStatus().then((s) => alive && setGoogle(s.connected)).catch(() => alive && setGoogle(false));
    return () => { alive = false; };
  }, [open, habit]);

  const set = <K extends keyof CreateHabitPayload>(k: K, v: CreateHabitPayload[K]) => setForm((f) => ({ ...f, [k]: v }));
  const freq = form.frequency ?? { type: 'daily' as const, days: [] };
  const titleError = touched && !form.title.trim() ? 'Ponle un nombre a tu hábito' : undefined;
  const daysError = touched && freq.type === 'days_per_week' && freq.days.length === 0 ? 'Elige al menos un día' : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || (freq.type === 'days_per_week' && freq.days.length === 0)) return;
    const kind = form.kind ?? 'habit';
    const steps = (form.steps ?? []).map((st) => st.trim()).filter(Boolean);
    if (kind === 'ritual' && steps.length === 0) { setError('Añade al menos un paso al ritual.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...form, title: form.title.trim(), description: form.description?.trim() || undefined, reminderTime: form.reminderTime || undefined, kind, steps: kind === 'ritual' ? steps : [] });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  const SelectedIcon = resolveGlyph(form.icon);
  const tone = CATEGORY_META[(form.category as keyof typeof CATEGORY_META)]?.tone ?? 'primary';

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={habit ? 'Editar hábito' : 'Nuevo hábito'} className="md:max-w-[560px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <div className="flex items-start gap-4">
          <span aria-hidden className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl', softTone[tone])}>
            <SelectedIcon className="size-7" strokeWidth={1.75} />
          </span>
          <Field label="Nombre" error={titleError} className="flex-1">
            <Input data-autofocus value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder="Ej. Leer 20 páginas" />
          </Field>
        </div>

        <Field label="Descripción" help="Opcional">
          <Textarea rows={2} className="min-h-20" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="¿Por qué te importa?" />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Tipo</legend>
          <SegmentedControl role="radiogroup" label="Tipo" value={form.kind ?? 'habit'} onChange={(v) => set('kind', v)} options={KIND_OPTIONS} />
          <p className="text-body-sm text-on-surface-light">
            {(form.kind ?? 'habit') === 'ritual' ? 'Un ritual tiene pasos en orden. Los marcas uno a uno; al marcar el último, el ritual queda hecho.' : 'Un hábito se marca de una vez.'}
          </p>
        </fieldset>

        {(form.kind ?? 'habit') === 'ritual' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label-lg text-on-surface">Pasos, en orden</legend>
            <ol className="flex flex-col gap-2">
              {(form.steps ?? []).map((title, i, all) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden className="w-5 shrink-0 text-center font-mono text-label-md tabular-nums text-on-surface-light">{i + 1}</span>
                  <Input
                    aria-label={`Paso ${i + 1}`} value={title} maxLength={100} placeholder="Ej. Tomar agua"
                    onChange={(e) => set('steps', all.map((t, j) => (j === i ? e.target.value : t)))}
                  />
                  <Button type="button" variant="ghost" size="sm" aria-label={`Subir paso ${i + 1}`} disabled={i === 0}
                    onClick={() => set('steps', all.map((t, j) => (j === i - 1 ? all[i] : j === i ? all[i - 1] : t)))}><ArrowUp aria-hidden className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Bajar paso ${i + 1}`} disabled={i === all.length - 1}
                    onClick={() => set('steps', all.map((t, j) => (j === i + 1 ? all[i] : j === i ? all[i + 1] : t)))}><ArrowDown aria-hidden className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Quitar paso ${i + 1}`}
                    onClick={() => set('steps', all.filter((_, j) => j !== i))}><X aria-hidden className="size-4" /></Button>
                </li>
              ))}
            </ol>
            <Button type="button" variant="secondary" size="sm" disabled={(form.steps ?? []).length >= MAX_STEPS}
              onClick={() => set('steps', [...(form.steps ?? []), ''])} className="self-start"><Plus aria-hidden className="size-4" />Añadir paso</Button>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Categoría</legend>
          <div role="radiogroup" aria-label="Categoría" className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => {
              const meta = CATEGORY_META[c];
              const Icon = meta.icon;
              const selected = form.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set('category', c)}
                  className={cn(
                    'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-label-md transition-colors',
                    selected ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:bg-surface-variant',
                  )}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                  {meta.label}
                </button>
              );
            })}
          </div>
          {form.category === 'HYGIENE' && (
            <p className="text-body-sm text-on-surface-light">Aparece también en Cuidado Personal (Espejo). Lo que marques en uno cuenta en el otro.</p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Ícono</legend>
          <div role="radiogroup" aria-label="Ícono" className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {HABIT_ICON_OPTIONS.map(({ id, Icon }) => {
              const selected = form.icon === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Ícono ${id}`}
                  onClick={() => set('icon', id)}
                  className={cn(
                    'flex size-11 items-center justify-center rounded-xl border transition-colors',
                    selected ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface-light hover:bg-surface-variant hover:text-on-surface',
                  )}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <span className="text-label-lg text-on-surface" aria-hidden>Frecuencia</span>
          <SegmentedControl<FreqType>
            role="radiogroup"
            label="Frecuencia"
            value={freq.type}
            onChange={(t) => set('frequency', t === 'daily' ? { type: 'daily', days: [] } : { type: 'days_per_week', days: freq.days.length ? freq.days : [1, 2, 3, 4, 5] })}
            options={[{ value: 'daily', label: 'Todos los días' }, { value: 'days_per_week', label: 'Días concretos' }]}
          />
          {freq.type === 'days_per_week' && (
            <div className="flex flex-col gap-1.5">
              <div role="group" aria-label="Días del hábito" className="grid grid-cols-7 gap-1.5">
                {WEEK.map((d) => {
                  const on = freq.days.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={on}
                      aria-label={d.name}
                      onClick={() => set('frequency', { type: 'days_per_week', days: on ? freq.days.filter((x) => x !== d.value) : [...freq.days, d.value] })}
                      className={cn(
                        'flex h-11 items-center justify-center rounded-xl border text-label-lg transition-colors',
                        on ? 'border-primary-strong bg-primary-strong text-on-primary' : 'border-border-strong text-on-surface hover:bg-surface-variant',
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {daysError && <span role="alert" className="text-body-sm text-error-text">{daysError}</span>}
              <p className="text-body-sm text-on-surface-light">Los días sin seleccionar son de descanso y no rompen tu racha.</p>
            </div>
          )}
        </div>

        <Field label="Recordatorio" help="Opcional · también fija la hora en tu agenda">
          <Input type="time" value={form.reminderTime ?? ''} onChange={(e) => set('reminderTime', e.target.value)} className="max-w-40" />
        </Field>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          <label className="flex items-center gap-3 p-4">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', softTone.success)}><Dumbbell aria-hidden className="size-5" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg text-on-background">Cuenta como asistencia al Coliseo</span>
              <span className="block text-body-sm text-on-surface-light">Completar este hábito registra un día de entrenamiento en el Coliseo.</span>
            </span>
            <Switch checked={Boolean(form.createsColiseoAttendance)} onChange={(e) => set('createsColiseoAttendance', e.target.checked)} />
          </label>
          <div className="flex items-center gap-3 p-4">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', softTone.info)}><CalendarDays aria-hidden className="size-5" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <label htmlFor="habit-gcal" className="block text-label-lg text-on-background">Añadir a Google Calendar</label>
              <span className="block text-body-sm text-on-surface-light">
                {google === null ? 'Comprobando conexión…' : google ? 'Se creará un evento recurrente.' : (
                  <>Conecta tu calendario en <a href="/agenda" className="font-semibold text-primary-text underline-offset-2 hover:underline">Agenda</a>.</>
                )}
              </span>
            </span>
            <Switch id="habit-gcal" disabled={google !== true} checked={Boolean(form.syncToGoogleCalendar)} onChange={(e) => set('syncToGoogleCalendar', e.target.checked)} />
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-error/[var(--lq-soft-alpha)] p-3 text-body-sm text-error-text">{error}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>{habit ? 'Guardar cambios' : 'Crear hábito'}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
