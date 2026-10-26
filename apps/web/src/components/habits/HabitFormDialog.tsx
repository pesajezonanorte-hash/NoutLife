// Crear / editar hábito (rediseño del antiguo HabitModal, mismo payload).
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Dumbbell, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, ResponsiveDialog, SegmentedControl, Switch, Textarea } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { HABIT_ICON_OPTIONS, resolveGlyph } from '@/components/ui/glyphs';
import { CATEGORIES, categoryMeta } from '@/lib/lifeMeta';
import * as agendaService from '@/services/agenda.service';
import type { CreateHabitPayload, Habit } from '@/services/habit.service';
import { useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  days: [
    { value: 1, label: 'L', name: 'lunes' }, { value: 2, label: 'M', name: 'martes' }, { value: 3, label: 'X', name: 'miércoles' },
    { value: 4, label: 'J', name: 'jueves' }, { value: 5, label: 'V', name: 'viernes' }, { value: 6, label: 'S', name: 'sábado' },
    { value: 0, label: 'D', name: 'domingo' },
  ],
  kinds: [{ value: 'habit', label: 'Hábito' }, { value: 'ritual', label: 'Ritual' }] as { value: 'habit' | 'ritual'; label: string }[],
  nameErr: 'Ponle un nombre a tu hábito',
  daysErr: 'Elige al menos un día',
  ritualErr: 'Añade al menos un paso al ritual.',
  saveErr: 'No pudimos guardar el hábito. Inténtalo de nuevo.',
  edit: 'Editar hábito',
  create: 'Nuevo hábito',
  name: 'Nombre',
  namePh: 'Ej. Leer 20 páginas',
  description: 'Descripción',
  optional: 'Opcional',
  descriptionPh: '¿Por qué te importa?',
  type: 'Tipo',
  typeRitual: 'Un ritual tiene pasos en orden. Los marcas uno a uno; al marcar el último, el ritual queda hecho.',
  typeHabit: 'Un hábito se marca de una vez.',
  steps: 'Pasos, en orden',
  stepLabel: (n: number) => `Paso ${n}`,
  stepPh: 'Ej. Tomar agua',
  up: (n: number) => `Subir paso ${n}`,
  down: (n: number) => `Bajar paso ${n}`,
  remove: (n: number) => `Quitar paso ${n}`,
  addStep: 'Añadir paso',
  category: 'Categoría',
  categoryGroup: 'Categoría',
  hygieneNote: 'Aparece también en Cuidado Personal (Espejo). Lo que marques en uno cuenta en el otro.',
  icon: 'Ícono',
  iconGroup: 'Ícono',
  iconLabel: (id: string) => `Ícono ${id}`,
  frequency: 'Frecuencia',
  everyDay: 'Todos los días',
  specificDays: 'Días concretos',
  daysGroup: 'Días del hábito',
  restNote: 'Los días sin seleccionar son de descanso y no rompen tu racha.',
  reminder: 'Recordatorio',
  reminderHelp: 'Opcional · también fija la hora en tu agenda',
  coliseoTitle: 'Cuenta como asistencia al Coliseo',
  coliseoBody: 'Completar este hábito registra un día de entrenamiento en el Coliseo.',
  gcalTitle: 'Añadir a Google Calendar',
  gcalChecking: 'Comprobando conexión…',
  gcalOn: 'Se creará un evento recurrente.',
  gcalConnectA: 'Conecta tu calendario en ',
  gcalConnectB: 'Agenda',
  cancel: 'Cancelar',
  saveChanges: 'Guardar cambios',
  createHabit: 'Crear hábito',
  hygieneCategory: 'HYGIENE',
};

const en: typeof es = {
  days: [
    { value: 1, label: 'M', name: 'Monday' }, { value: 2, label: 'T', name: 'Tuesday' }, { value: 3, label: 'W', name: 'Wednesday' },
    { value: 4, label: 'T', name: 'Thursday' }, { value: 5, label: 'F', name: 'Friday' }, { value: 6, label: 'S', name: 'Saturday' },
    { value: 0, label: 'S', name: 'Sunday' },
  ],
  kinds: [{ value: 'habit', label: 'Habit' }, { value: 'ritual', label: 'Ritual' }],
  nameErr: 'Give your habit a name',
  daysErr: 'Choose at least one day',
  ritualErr: 'Add at least one step to the ritual.',
  saveErr: "We couldn't save the habit. Try again.",
  edit: 'Edit habit',
  create: 'New habit',
  name: 'Name',
  namePh: 'E.g. Read 20 pages',
  description: 'Description',
  optional: 'Optional',
  descriptionPh: 'Why does it matter to you?',
  type: 'Type',
  typeRitual: 'A ritual has steps in order. You check them off one by one; when you check the last one, the ritual is done.',
  typeHabit: 'A habit is checked off in one go.',
  steps: 'Steps, in order',
  stepLabel: (n) => `Step ${n}`,
  stepPh: 'E.g. Drink water',
  up: (n) => `Move step ${n} up`,
  down: (n) => `Move step ${n} down`,
  remove: (n) => `Remove step ${n}`,
  addStep: 'Add step',
  category: 'Category',
  categoryGroup: 'Category',
  hygieneNote: 'It also appears in Personal Care (Mirror). What you check off in one counts in the other.',
  icon: 'Icon',
  iconGroup: 'Icon',
  iconLabel: (id) => `Icon ${id}`,
  frequency: 'Frequency',
  everyDay: 'Every day',
  specificDays: 'Specific days',
  daysGroup: 'Habit days',
  restNote: 'Unselected days are rest days and do not break your streak.',
  reminder: 'Reminder',
  reminderHelp: 'Optional · also sets the time in your agenda',
  coliseoTitle: 'Counts as Coliseum attendance',
  coliseoBody: 'Completing this habit logs a training day in the Coliseum.',
  gcalTitle: 'Add to Google Calendar',
  gcalChecking: 'Checking the connection…',
  gcalOn: 'A recurring event will be created.',
  gcalConnectA: 'Connect your calendar in ',
  gcalConnectB: 'Agenda',
  cancel: 'Cancel',
  saveChanges: 'Save changes',
  createHabit: 'Create habit',
  hygieneCategory: 'HYGIENE',
};

const COPY: Copy<typeof es> = { es, en };

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

const MAX_STEPS = 12;

function apiError(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { error?: string; details?: { message: string }[] } } }).response?.data;
  return data?.details?.[0]?.message ?? data?.error ?? fallback;
}

export interface HabitFormDialogProps {
  open: boolean;
  habit?: Habit | null;
  onClose: () => void;
  onSubmit: (payload: CreateHabitPayload) => Promise<void>;
}

export function HabitFormDialog({ open, habit, onClose, onSubmit }: HabitFormDialogProps) {
  const t = useText(COPY);
  const locale = useLocale();
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
  const titleError = touched && !form.title.trim() ? t.nameErr : undefined;
  const daysError = touched && freq.type === 'days_per_week' && freq.days.length === 0 ? t.daysErr : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!form.title.trim() || (freq.type === 'days_per_week' && freq.days.length === 0)) return;
    const kind = form.kind ?? 'habit';
    const steps = (form.steps ?? []).map((st) => st.trim()).filter(Boolean);
    if (kind === 'ritual' && steps.length === 0) { setError(t.ritualErr); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...form, title: form.title.trim(), description: form.description?.trim() || undefined, reminderTime: form.reminderTime || undefined, kind, steps: kind === 'ritual' ? steps : [] });
    } catch (err) {
      setError(apiError(err, t.saveErr));
    } finally {
      setSaving(false);
    }
  }

  const SelectedIcon = resolveGlyph(form.icon);
  const tone = categoryMeta(form.category).tone;

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={habit ? t.edit : t.create} className="md:max-w-[560px]">
      <form className="flex flex-col gap-6" onSubmit={(e) => void submit(e)} noValidate>
        <div className="flex items-start gap-4">
          <span aria-hidden className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl', softTone[tone])}>
            <SelectedIcon className="size-7" strokeWidth={1.75} />
          </span>
          <Field label={t.name} error={titleError} className="flex-1">
            <Input data-autofocus value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder={t.namePh} />
          </Field>
        </div>

        <Field label={t.description} help={t.optional}>
          <Textarea rows={2} className="min-h-20" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder={t.descriptionPh} />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.type}</legend>
          <SegmentedControl role="radiogroup" label={t.type} value={form.kind ?? 'habit'} onChange={(v) => set('kind', v)} options={t.kinds} />
          <p className="text-body-sm text-on-surface-light">
            {(form.kind ?? 'habit') === 'ritual' ? t.typeRitual : t.typeHabit}
          </p>
        </fieldset>

        {(form.kind ?? 'habit') === 'ritual' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label-lg text-on-surface">{t.steps}</legend>
            <ol className="flex flex-col gap-2">
              {(form.steps ?? []).map((title, i, all) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden className="w-5 shrink-0 text-center font-mono text-label-md tabular-nums text-on-surface-light">{i + 1}</span>
                  <Input
                    aria-label={t.stepLabel(i + 1)} value={title} maxLength={100} placeholder={t.stepPh}
                    onChange={(e) => set('steps', all.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <Button type="button" variant="ghost" size="sm" aria-label={t.up(i + 1)} disabled={i === 0}
                    onClick={() => set('steps', all.map((x, j) => (j === i - 1 ? all[i] : j === i ? all[i - 1] : x)))}><ArrowUp aria-hidden className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label={t.down(i + 1)} disabled={i === all.length - 1}
                    onClick={() => set('steps', all.map((x, j) => (j === i + 1 ? all[i] : j === i ? all[i + 1] : x)))}><ArrowDown aria-hidden className="size-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" aria-label={t.remove(i + 1)}
                    onClick={() => set('steps', all.filter((_, j) => j !== i))}><X aria-hidden className="size-4" /></Button>
                </li>
              ))}
            </ol>
            <Button type="button" variant="secondary" size="sm" disabled={(form.steps ?? []).length >= MAX_STEPS}
              onClick={() => set('steps', [...(form.steps ?? []), ''])} className="self-start"><Plus aria-hidden className="size-4" />{t.addStep}</Button>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.category}</legend>
          <div role="radiogroup" aria-label={t.categoryGroup} className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => {
              const meta = categoryMeta(c, locale);
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
          {form.category === t.hygieneCategory && (
            <p className="text-body-sm text-on-surface-light">{t.hygieneNote}</p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.icon}</legend>
          <div role="radiogroup" aria-label={t.iconGroup} className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {HABIT_ICON_OPTIONS.map(({ id, Icon }) => {
              const selected = form.icon === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t.iconLabel(id)}
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
          <span className="text-label-lg text-on-surface" aria-hidden>{t.frequency}</span>
          <SegmentedControl<FreqType>
            role="radiogroup"
            label={t.frequency}
            value={freq.type}
            onChange={(v) => set('frequency', v === 'daily' ? { type: 'daily', days: [] } : { type: 'days_per_week', days: freq.days.length ? freq.days : [1, 2, 3, 4, 5] })}
            options={[{ value: 'daily', label: t.everyDay }, { value: 'days_per_week', label: t.specificDays }]}
          />
          {freq.type === 'days_per_week' && (
            <div className="flex flex-col gap-1.5">
              <div role="group" aria-label={t.daysGroup} className="grid grid-cols-7 gap-1.5">
                {t.days.map((d) => {
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
              <p className="text-body-sm text-on-surface-light">{t.restNote}</p>
            </div>
          )}
        </div>

        <Field label={t.reminder} help={t.reminderHelp}>
          <Input type="time" value={form.reminderTime ?? ''} onChange={(e) => set('reminderTime', e.target.value)} className="max-w-40" />
        </Field>

        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          <label className="flex items-center gap-3 p-4">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', softTone.success)}><Dumbbell aria-hidden className="size-5" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg text-on-background">{t.coliseoTitle}</span>
              <span className="block text-body-sm text-on-surface-light">{t.coliseoBody}</span>
            </span>
            <Switch checked={Boolean(form.createsColiseoAttendance)} onChange={(e) => set('createsColiseoAttendance', e.target.checked)} />
          </label>
          <div className="flex items-center gap-3 p-4">
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', softTone.info)}><CalendarDays aria-hidden className="size-5" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
              <label htmlFor="habit-gcal" className="block text-label-lg text-on-background">{t.gcalTitle}</label>
              <span className="block text-body-sm text-on-surface-light">
                {google === null ? t.gcalChecking : google ? t.gcalOn : (
                  <>{t.gcalConnectA}<a href="/agenda" className="font-semibold text-primary-text underline-offset-2 hover:underline">{t.gcalConnectB}</a>.</>
                )}
              </span>
            </span>
            <Switch id="habit-gcal" disabled={google !== true} checked={Boolean(form.syncToGoogleCalendar)} onChange={(e) => set('syncToGoogleCalendar', e.target.checked)} />
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl bg-error/[var(--lq-soft-alpha)] p-3 text-body-sm text-error-text">{error}</p>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" loading={saving}>{habit ? t.saveChanges : t.createHabit}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
