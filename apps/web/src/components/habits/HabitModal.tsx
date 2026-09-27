import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CalendarDays, Check, Link2, Loader2 } from 'lucide-react';
import { getOpenOrigin } from '@/lib/origin';
import { PixelButton } from '../ui/PixelButton';
import { PixelInput } from '../ui/PixelInput';
import type { CreateHabitPayload } from '../../services/habit.service';
import * as agendaService from '../../services/agenda.service';
import { E, HABIT_ICON_OPTIONS, CATEGORY_GLYPHS, resolveGlyph } from '@/components/ui/glyphs';

const CATEGORIES = ['HEALTH', 'FITNESS', 'FINANCE', 'LEARNING', 'LOVE', 'SOCIAL', 'PERSONAL', 'CREATIVE'] as const;
const COLOR_OPTIONS = ['#17171a', '#52525b', '#8a8a92', '#c0c0c8', '#a8871e', '#b0332a', '#3f7a55', '#d9b44a'];

interface Props {
  onSubmit: (data: CreateHabitPayload) => Promise<void>;
  onClose: () => void;
  initial?: Partial<CreateHabitPayload>;
  title?: string;
}

export function HabitModal({ onSubmit, onClose, initial, title }: Props) {
  // Punto de apertura: de aquí crece la animación (desde donde se hizo click).
  const [origin] = useState(() => getOpenOrigin());
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [form, setForm] = useState<CreateHabitPayload>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'HEALTH',
    icon: initial?.icon ?? 'star',
    color: initial?.color ?? '#a8871e',
    xpReward: initial?.xpReward ?? 20,
    goldReward: initial?.goldReward ?? 5,
    reminderTime: initial?.reminderTime ?? '',
    frequency: initial?.frequency ?? { type: 'daily', days: [] },
    syncToGoogleCalendar: initial?.syncToGoogleCalendar ?? false,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    agendaService
      .getGoogleCalendarStatus()
      .then((status) => {
        if (mounted) setGoogleConnected(status.connected);
      })
      .catch(() => {
        if (mounted) setGoogleConnected(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit() {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        description: form.description || undefined,
        reminderTime: form.reminderTime || undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  const googleToggleDisabled = googleConnected !== true;
  const frequency = form.frequency ?? { type: 'daily' as const, days: [] };
  const weekDays = [
    { value: 0, label: 'D' },
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'X' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
  ];

  return createPortal((
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      style={{ transformOrigin: origin }}
      className="fixed inset-0 z-[200] isolate overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-start justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6">
        <motion.div
          className="relative z-10 flex w-full max-w-md min-h-0 max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:max-h-[calc(100dvh-3rem)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: 0.05 }}
        >
          <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-[var(--border)] bg-[var(--bg-panel-light)] p-4">
            <h2 id="habit-modal-title" className="text-base font-semibold text-[var(--text-primary)]">
              {title ?? 'Nuevo hábito'}
            </h2>
            <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]"><E e="✕" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Nombre*</label>
              <PixelInput
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Nombre del hábito..."
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Descripción</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe el hábito..."
                rows={2}
                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-blue)]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Icono</label>
              <div className="flex flex-wrap gap-1.5">
                {HABIT_ICON_OPTIONS.map(({ id, Icon }) => {
                  const selected = form.icon === id || resolveGlyph(form.icon) === Icon;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, icon: id }))}
                      aria-label={`Seleccionar icono ${id}`}
                      aria-pressed={selected}
                      className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${selected ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10' : 'border-[var(--border)] hover:border-[var(--text-secondary)]'}`}
                    >
                      <Icon size={18} strokeWidth={1.75} />
                      {selected && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent-gold)] text-[8px] font-bold leading-none text-black"><E e="✓" /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => {
                  const selected = form.color === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, color }))}
                      aria-label={`Seleccionar color ${color}`}
                      aria-pressed={selected}
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110 ${selected ? 'scale-110 ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-panel)]' : 'ring-1 ring-[var(--border-strong)]'}`}
                      style={{ backgroundColor: color }}
                    >
                      {selected && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-panel)] text-[10px] font-bold leading-none text-[var(--text-primary)]"><E e="✓" /></span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Categoría</label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((category) => {
                  const selected = form.category === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, category }))}
                      aria-label={`Seleccionar categoría ${category.toLowerCase()}`}
                      aria-pressed={selected}
                      className={`relative rounded-lg border-2 p-2 text-center text-xl transition-all ${selected ? 'border-[var(--text-primary)] bg-[var(--bg-muted)] shadow-[0_0_10px_rgba(0,0,0,0.18)]' : 'border-[var(--border)] hover:border-[var(--text-secondary)]'}`}
                    >
                      <E e={CATEGORY_GLYPHS[category]} />
                      {selected && <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text-primary)] text-[10px] font-bold leading-none text-[var(--text-inv)]"><E e="✓" /></span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs font-medium capitalize text-[var(--accent-gold)]">
                Seleccionado: <E e={CATEGORY_GLYPHS[form.category]} /> {form.category.toLowerCase()}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">Frecuencia</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, frequency: { type: 'daily', days: [] } }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${frequency.type === 'daily' ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'}`}
                >
                  Todos los días
                </button>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, frequency: { type: 'days_per_week', days: current.frequency?.type === 'days_per_week' && current.frequency.days.length > 0 ? current.frequency.days : [1, 2, 3, 4, 5] } }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${frequency.type === 'days_per_week' ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'}`}
                >
                  Días específicos
                </button>
              </div>
              {frequency.type === 'days_per_week' && (
                <div className="mt-2 flex justify-between gap-1" aria-label="Días del hábito">
                  {weekDays.map((day) => {
                    const selected = frequency.days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setForm((current) => {
                          const currentDays = current.frequency?.type === 'days_per_week' ? current.frequency.days : [];
                          const days = currentDays.includes(day.value)
                            ? (currentDays.length === 1 ? currentDays : currentDays.filter((value) => value !== day.value))
                            : [...currentDays, day.value].sort((a, b) => a - b);
                          return { ...current, frequency: { type: 'days_per_week', days } };
                        })}
                        className={`flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-semibold transition-colors ${selected ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--bg-deep)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'}`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Recordatorio / hora de agenda (opcional)</label>
              <input
                type="time"
                value={form.reminderTime}
                onChange={(event) => setForm((current) => ({ ...current, reminderTime: event.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-blue)]"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Si lo añades al calendario, esta será la hora del evento. Sin hora se crea como evento de todo el día.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]">
                  <CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Añadir a Google Calendar</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Crea un evento recurrente que también aparece en tu Agenda de LifeQuest.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(form.syncToGoogleCalendar)}
                      aria-label="Añadir este hábito a Google Calendar"
                      disabled={googleToggleDisabled}
                      onClick={() => setForm((current) => ({ ...current, syncToGoogleCalendar: !current.syncToGoogleCalendar }))}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${form.syncToGoogleCalendar ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/25' : 'border-[var(--border-strong)] bg-[var(--bg-deep)]'}`}
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full bg-[var(--text-primary)] shadow-sm transition-transform ${form.syncToGoogleCalendar ? 'translate-x-5' : 'translate-x-1'}`}>
                        {form.syncToGoogleCalendar && <Check size={10} className="text-[var(--bg-deep)]" strokeWidth={3} />}
                      </span>
                    </button>
                  </div>

                  {googleConnected === null && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Comprobando conexión con Google Calendar...
                    </p>
                  )}
                  {googleConnected === false && (
                    <a href="/agenda" className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-gold)] hover:text-[var(--text-primary)]">
                      <Link2 size={13} aria-hidden="true" /> Vincula Google Calendar desde Agenda para activar esta opción.
                    </a>
                  )}
                  {googleConnected === true && form.syncToGoogleCalendar && (
                    <p className="mt-2 text-xs text-[var(--accent-green)]">
                      Se sincronizará como serie recurrente según la frecuencia del hábito.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 gap-3 border-t border-[var(--border)] bg-[var(--bg-panel)] p-4">
            <PixelButton variant="ghost" className="flex-1" onClick={onClose}>Cancelar</PixelButton>
            <PixelButton variant="primary" className="flex-1" onClick={handleSubmit} disabled={loading || !form.title.trim()}>
              {loading ? 'Guardando...' : 'Guardar'}
            </PixelButton>
          </div>
        </motion.div>
      </div>
    </motion.div>
  ), document.body);
}
