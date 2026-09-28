import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { useToast } from '../../hooks/useToast';
import * as agendaService from '../../services/agenda.service';
import type { AgendaEvent } from '../../services/agenda.service';
import { Link2 } from 'lucide-react';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader-adapted';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

type ViewMode = 'day' | 'week' | 'month';

const CATEGORIES = [
  { key: 'personal',   label: 'Personal',   emoji: '🏠', color: '#5c5c64' },
  { key: 'work',       label: 'Trabajo',    emoji: '💼', color: '#2a2a2e' },
  { key: 'health',     label: 'Salud',      emoji: '🏥', color: 'var(--accent-green)' },
  { key: 'social',     label: 'Social',     emoji: '🎉', color: '#8a8a92' },
  { key: 'romantic',   label: 'Romántico',  emoji: '💖', color: 'var(--accent-red)' },
  { key: 'finance',    label: 'Finanzas',   emoji: '💰', color: 'var(--accent-gold)' },
  { key: 'tarea',      label: 'Tarea',      emoji: '📚', color: '#a1a1aa' },
  { key: 'examen',     label: 'Examen',     emoji: '📝', color: '#3a3a40' },
  { key: 'exposicion', label: 'Exposición', emoji: '🗣️', color: '#6b6b73' },
  { key: 'clase',      label: 'Clase',      emoji: '🎒', color: '#c0c0c8' },
  { key: 'other',      label: 'Otro',       emoji: '📦', color: '#8f8f98' },
];

const REMINDERS = [
  { value: null,  label: 'Sin recordatorio' },
  { value: 30,    label: '30 minutos antes' },
  { value: 60,    label: '1 hora antes' },
  { value: 1440,  label: '1 día antes' },
];

function catInfo(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Google returns all-day events as YYYY-MM-DD. They are stored as a UTC
// calendar key, so compare UTC parts to avoid showing them one day early in
// timezones west of Greenwich.
function isEventOnDay(event: AgendaEvent, day: Date) {
  const eventDate = new Date(event.startDate);
  if (event.isAllDay) {
    return eventDate.getUTCFullYear() === day.getFullYear()
      && eventDate.getUTCMonth() === day.getMonth()
      && eventDate.getUTCDate() === day.getDate();
  }
  return isSameDay(eventDate, day);
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onEdit,
  onDelete,
  onToggle,
}: {
  event: AgendaEvent;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const cat = catInfo(event.category);
  const isHabitEvent = event.eventType === 'habit';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`border-l-4 px-3 py-2 rounded-r-sm transition-opacity ${event.isCompleted ? 'opacity-50' : ''}`}
      style={{ borderLeftColor: cat.color, background: `${cat.color}10` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span><E e={cat.emoji} /></span>
            <p className={`font-vt text-text-primary text-lg ${event.isCompleted ? 'line-through' : ''}`}>
              {event.title}
            </p>
          </div>
          <p className="font-pixel text-text-secondary mt-0.5" style={{ fontSize: '7px' }}>
            {event.isAllDay ? 'Todo el día' : formatTime(event.startDate)}
            {event.endDate && !event.isAllDay ? ` — ${formatTime(event.endDate)}` : ''}
            {event.location ? ` · ${event.location}` : ''}
            {event.reminder ? ` · ⏰ ${REMINDERS.find(r => r.value === event.reminder)?.label ?? ''}` : ''}
          </p>
          {isHabitEvent && (
            <p className="mt-1 flex items-center gap-1 text-xs text-accent-gold">
              <Link2 size={12} strokeWidth={1.8} aria-hidden="true" /> Hábito recurrente · se gestiona desde Hábitos
            </p>
          )}
          {event.description && (
            <p className="font-vt text-text-secondary text-sm mt-0.5">{event.description}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isHabitEvent ? (
            <a
              href="/habits"
              className="font-pixel text-accent-gold hover:text-text-primary transition-colors"
              style={{ fontSize: '8px' }}
            >
              HÁBITOS
            </a>
          ) : (
            <>
              <button
                onClick={onToggle}
                title={event.isCompleted ? 'Marcar pendiente' : 'Marcar completado'}
                className="font-pixel text-text-secondary hover:text-accent-green transition-colors"
                style={{ fontSize: '10px' }}
              >
                {event.isCompleted ? '↩' : '✓'}
              </button>
              <button
                onClick={onEdit}
                className="font-pixel text-text-secondary hover:text-accent-gold transition-colors"
                style={{ fontSize: '10px' }}
              >
                <E e="✏" />
              </button>
              <button
                onClick={onDelete}
                className="font-pixel text-text-secondary hover:text-accent-red transition-colors"
                style={{ fontSize: '10px' }}
              >
                <E e="✕" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

function EventModal({
  initial,
  defaultDate,
  onSave,
  onClose,
}: {
  initial?: AgendaEvent;
  defaultDate?: string;
  onSave: (data: Omit<AgendaEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isCompleted'>) => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose);
  const todayLocal = defaultDate ?? new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'personal');
  const [startDate, setStartDate] = useState(
    initial ? initial.startDate.slice(0, 16) : `${todayLocal}T09:00`,
  );
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 16) ?? '');
  const [isAllDay, setIsAllDay] = useState(initial?.isAllDay ?? false);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(
    initial?.description && !initial.description.startsWith('Asignatura:') 
      ? initial.description 
      : (initial?.description?.split('\n\n')[1] ?? '')
  );
  const [asignatura, setAsignatura] = useState(() => {
    if (initial?.description?.startsWith('Asignatura:')) {
      return initial.description.split('\n')[0].replace('Asignatura: ', '');
    }
    return '';
  });
  const [reminder, setReminder] = useState<number | null>(initial?.reminder ?? null);

  const isAcademic = ['tarea', 'examen', 'exposicion', 'clase'].includes(category);

  function handleSubmit() {
    if (!title.trim()) return;
    
    let finalDesc = description;
    if (isAcademic && asignatura.trim()) {
      finalDesc = `Asignatura: ${asignatura.trim()}\n\n${description}`.trim();
    }

    onSave({
      title: title.trim(),
      category,
      startDate: isAllDay ? `${startDate.slice(0, 10)}T00:00:00.000Z` : new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      isAllDay,
      location: location || undefined,
      description: finalDesc || undefined,
      reminder: reminder ?? undefined,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="max-h-[86dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border-2 border-border-pixel bg-bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:max-h-[90vh] md:rounded-2xl md:p-5"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-pixel text-accent-gold" style={{ fontSize: '10px' }}>
          {initial ? 'EDITAR EVENTO' : 'NUEVO EVENTO'}
        </p>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título del evento *"
          autoFocus
          className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-lg px-3 py-2 focus:border-accent-gold outline-none"
        />

        {/* Category */}
        <div>
          <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '7px' }}>CATEGORÍA</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex min-h-11 min-w-0 items-center gap-1 border-2 px-2 font-pixel transition-colors`}
                style={{
                  fontSize: '7px',
                  borderColor: category === c.key ? c.color : 'var(--border-pixel)',
                  background: category === c.key ? `${c.color}20` : 'transparent',
                  color: category === c.key ? c.color : 'var(--text-secondary)',
                }}
              >
                <E e={c.emoji} /> {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* All day toggle */}
        <label htmlFor="allday" className="flex min-h-11 cursor-pointer items-center gap-2 font-vt text-base text-text-primary">
          <input
            type="checkbox"
            id="allday"
            checked={isAllDay}
            onChange={e => setIsAllDay(e.target.checked)}
            className="accent-accent-gold"
          />
          Todo el día
        </label>

        {/* Dates */}
        {isAllDay ? (
          <div>
            <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '7px' }}>FECHA</p>
            <input
              type="date"
              value={startDate.slice(0, 10)}
              onChange={e => setStartDate(`${e.target.value}T00:00`)}
              className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '7px' }}>INICIO</p>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="min-h-11 w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-sm px-2 py-1.5 focus:border-accent-gold outline-none"
              />
            </div>
            <div>
              <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '7px' }}>FIN (OPCIONAL)</p>
              <input
                type="datetime-local"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="min-h-11 w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-sm px-2 py-1.5 focus:border-accent-gold outline-none"
              />
            </div>
          </div>
        )}

        {/* Location */}
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder=" Lugar (opcional)"
          className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none"
        />

        {/* Asignatura (solo si es académico) */}
        {isAcademic && (
          <input
            type="text"
            value={asignatura}
            onChange={e => setAsignatura(e.target.value)}
            placeholder=" Asignatura (ej. Matemáticas)"
            className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none"
          />
        )}

        {/* Description */}
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none resize-none"
        />

        {/* Reminder */}
        <div>
          <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '7px' }}>RECORDATORIO</p>
          <select
            value={reminder ?? ''}
            onChange={e => setReminder(e.target.value === '' ? null : Number(e.target.value))}
            className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none"
          >
            {REMINDERS.map(r => (
              <option key={r.label} value={r.value ?? ''}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <PixelButton variant="ghost" onClick={onClose} className="flex-1">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={handleSubmit} className="flex-1" disabled={!title.trim()}>
            {initial ? 'Guardar' : 'Crear evento'}
          </PixelButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Agenda Page ──────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const toast = useToast();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const to   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1).toISOString();
      const data = await agendaService.fetchEvents({ from, to });
      setEvents(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(body: Parameters<typeof agendaService.createEvent>[0]) {
    try {
      await agendaService.createEvent(body);
      setShowModal(false);
      await load();
      toast.success('Evento creado');
    } catch {
      toast.error('Error al crear evento');
    }
  }

  async function handleUpdate(id: string, body: Parameters<typeof agendaService.updateEvent>[1]) {
    try {
      await agendaService.updateEvent(id, body);
      setEditingEvent(null);
      await load();
      toast.success('Evento actualizado');
    } catch {
      toast.error('Error al actualizar evento');
    }
  }

  async function handleDelete(id: string) {
    try {
      await agendaService.deleteEvent(id);
      await load();
      toast.success('Evento eliminado');
    } catch {
      toast.error('Error al eliminar evento');
    }
  }

  async function handleToggle(event: AgendaEvent) {
    await handleUpdate(event.id, { isCompleted: !event.isCompleted } as Partial<AgendaEvent>);
  }

  // ── Day view ────────────────────────────────────────────────────────────────

  function DayView() {
    const dayEvents = events.filter((event) => isEventOnDay(event, currentDate));
    const dateLabel = currentDate.toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }}
            className="flex h-11 w-11 items-center justify-center font-pixel text-text-secondary hover:text-accent-gold transition-colors"
            style={{ fontSize: '10px' }}
          >◀</button>
          <p className="font-vt text-text-primary text-xl capitalize">{dateLabel}</p>
          <button
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }}
            className="flex h-11 w-11 items-center justify-center font-pixel text-text-secondary hover:text-accent-gold transition-colors"
            style={{ fontSize: '10px' }}
          >▶</button>
        </div>
        {dayEvents.length === 0 ? (
          <PixelPanel className="p-6 text-center">
            <p className="font-vt text-text-secondary text-lg">Sin eventos este día</p>
            <p className="font-pixel text-text-muted mt-1" style={{ fontSize: '8px' }}>
              Pulsa + para agregar uno
            </p>
          </PixelPanel>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {dayEvents.map(e => (
                <EventCard
                  key={e.id}
                  event={e}
                  onEdit={() => setEditingEvent(e)}
                  onDelete={() => handleDelete(e.id)}
                  onToggle={() => handleToggle(e)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  // ── Week view ───────────────────────────────────────────────────────────────

  function WeekView() {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }}
            className="flex h-11 w-11 items-center justify-center font-pixel text-text-secondary hover:text-accent-gold transition-colors"
            style={{ fontSize: '10px' }}
          >◀</button>
          <p className="font-vt text-text-primary text-base">
            {days[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} —{' '}
            {days[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <button
            onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }}
            className="flex h-11 w-11 items-center justify-center font-pixel text-text-secondary hover:text-accent-gold transition-colors"
            style={{ fontSize: '10px' }}
          >▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const dayEvents = events.filter((event) => isEventOnDay(event, day));
            const isToday = isSameDay(day, new Date());
            const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
            return (
              <div
                key={i}
                className={`border rounded-sm p-1 cursor-pointer transition-colors min-h-[80px] ${
                  isToday ? 'border-accent-gold' : 'border-border-pixel'
                }`}
                onClick={() => { setCurrentDate(day); setView('day'); }}
              >
                <p className={`font-pixel text-center mb-1 ${isToday ? 'text-accent-gold' : 'text-text-secondary'}`} style={{ fontSize: '7px' }}>
                  {DAY_NAMES[i]}<br />{day.getDate()}
                </p>
                {dayEvents.slice(0, 3).map(e => {
                  const cat = catInfo(e.category);
                  return (
                    <div
                      key={e.id}
                      className="text-xs px-1 py-0.5 rounded mb-0.5 truncate"
                      style={{ background: `${cat.color}30`, color: cat.color, fontSize: '7px' }}
                    >
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="font-pixel text-text-muted" style={{ fontSize: '6px' }}>+{dayEvents.length - 3}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Month view ──────────────────────────────────────────────────────────────

  function MonthView() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay + 6) % 7; // Monday start

    const cells: (Date | null)[] = [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];

    const monthLabel = currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="flex h-11 w-11 items-center justify-center font-pixel text-text-secondary hover:text-accent-gold transition-colors"
            style={{ fontSize: '10px' }}
          >◀</button>
          <p className="font-vt text-text-primary text-xl capitalize">{monthLabel}</p>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="flex h-11 w-11 items-center justify-center font-pixel text-text-secondary hover:text-accent-gold transition-colors"
            style={{ fontSize: '10px' }}
          >▶</button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
          {['L','M','X','J','V','S','D'].map(d => (
            <p key={d} className="font-pixel text-text-muted" style={{ fontSize: '7px' }}>{d}</p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dayEvents = events.filter((event) => isEventOnDay(event, day));
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, currentDate);

            return (
              <div
                key={i}
                className={`border rounded-sm p-1 cursor-pointer transition-colors min-h-[44px] ${
                  isSelected ? 'border-accent-gold bg-accent-gold/10' :
                  isToday ? 'border-accent-gold/50' : 'border-border-pixel hover:border-accent-gold/40'
                }`}
                onClick={() => { setCurrentDate(day); setView('day'); }}
              >
                <p className={`font-pixel text-center ${isToday ? 'text-accent-gold' : 'text-text-secondary'}`} style={{ fontSize: '8px' }}>
                  {day.getDate()}
                </p>
                <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                  {dayEvents.slice(0, 3).map(e => {
                    const cat = catInfo(e.category);
                    return (
                      <div
                        key={e.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: cat.color }}
                        title={e.title}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected day events */}
        {(() => {
          const dayEvents = events.filter((event) => isEventOnDay(event, currentDate));
          if (dayEvents.length === 0) return null;
          return (
            <div className="space-y-2 mt-2">
              <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>
                {currentDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
              <AnimatePresence>
                {dayEvents.map(e => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onEdit={() => setEditingEvent(e)}
                    onDelete={() => handleDelete(e.id)}
                    onToggle={() => handleToggle(e)}
                  />
                ))}
              </AnimatePresence>
            </div>
          );
        })()}
      </div>
    );
  }

  const defaultDate = currentDate.toISOString().slice(0, 10);

  // Google Calendar Integration State
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const handledCodeRef = useRef<string | null>(null);

  useEffect(() => {
    agendaService
      .getGoogleCalendarStatus()
      .then((status) => setGoogleConnected(status.connected))
      .catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    // Check if redirect contains OAuth code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && handledCodeRef.current !== code) {
      handledCodeRef.current = code;
      const redirectUri = window.location.origin + window.location.pathname;

      // Clean URL parameters immediately to avoid re-triggering on state changes
      window.history.replaceState({}, document.title, window.location.pathname);

      agendaService
        .handleGoogleCallback(code, redirectUri)
        .then(() => {
          toast.success('¡Google Calendar vinculado con éxito!');
          setGoogleConnected(true);
          load();
        })
        .catch((err: unknown) => {
          const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
          const msg = errorObj.response?.data?.error || errorObj.message || 'Error al vincular Google Calendar';
          toast.error(msg);
        });
    }
  }, [load, toast]);

  async function handleConnectGoogle() {
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const url = await agendaService.getGoogleAuthUrl(redirectUri);
      window.location.href = url;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = errorObj.response?.data?.error || errorObj.message || 'No se pudo obtener la URL de autorización de Google.';
      toast.error(msg);
    }
  }

  async function handleSyncGoogle() {
    setSyncingGoogle(true);
    try {
      const res = await agendaService.syncGoogleCalendar();
      toast.success(res.message);
      setGoogleConnected(true);
      await load();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = errorObj.response?.data?.error || errorObj.message || 'Error al sincronizar con Google Calendar';
      toast.error(msg);
    } finally {
      setSyncingGoogle(false);
    }
  }

  async function handleDisconnectGoogle() {
    try {
      await agendaService.disconnectGoogleCalendar();
      toast.success('Google Calendar desconectado.');
      setGoogleConnected(false);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = errorObj.response?.data?.error || errorObj.message || 'Error al desconectar Google Calendar';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="📅" /> AGENDA</h1>
          <p className="font-vt text-text-secondary text-base">Tu tiempo, tus misiones</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <PixelButton variant="ghost" onClick={handleConnectGoogle} className="text-xs flex items-center gap-1">
            <span className="text-accent-gold"><E e="📆" /></span> {googleConnected ? 'Re-conectar Google' : 'Conectar Google'}
          </PixelButton>
          <PixelButton variant="secondary" onClick={handleSyncGoogle} disabled={syncingGoogle} className="text-xs">
            {syncingGoogle ? 'Sincronizando...' : ' Sincronizar'}
          </PixelButton>
          <PixelButton variant="secondary" onClick={() => setCurrentDate(new Date())} className="text-sm">
            Hoy
          </PixelButton>
          <PixelButton variant="primary" onClick={() => setShowModal(true)}>
            + EVENTO
          </PixelButton>
        </div>
      </div>

      {/* Google Sync Banner */}
      <PixelPanel className="p-3 bg-bg-deep/40 flex items-center justify-between flex-wrap gap-2 border-border-pixel">
        <div className="flex items-center gap-2">
          <span className="text-lg"><E e="🗓" /></span>
          <div>
            <p className="font-pixel text-text-primary" style={{ fontSize: '8px' }}>
              INTEGRACIÓN GOOGLE CALENDAR
            </p>
            <p className="font-vt text-text-secondary text-sm">
              Sincroniza tus reuniones y eventos de Google Calendar; los hábitos que elijas se añaden como series recurrentes separadas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncGoogle}
            disabled={syncingGoogle}
            className="font-pixel px-3 py-1.5 bg-accent-gold/20 border-2 border-accent-gold text-accent-gold hover:bg-accent-gold/30 transition-colors text-xs flex items-center gap-1"
            style={{ fontSize: '8px' }}
          >
            {syncingGoogle ? '⏳ Sincronizando...' : ' Sincronizar Google Calendar'}
          </button>
          <button
            onClick={handleDisconnectGoogle}
            className="font-pixel px-2 py-1.5 text-text-muted hover:text-accent-red transition-colors text-xs"
            style={{ fontSize: '8px' }}
            title="Desconectar cuenta de Google"
          >
            <E e="🔌" /> Desconectar
          </button>
        </div>
      </PixelPanel>

      {/* View tabs */}
      <div className="flex gap-0 border-b-2 border-border-pixel">
        {(['day', 'week', 'month'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`min-h-11 font-pixel px-4 py-2 border-b-2 -mb-0.5 transition-colors ${
              view === v
                ? 'border-accent-gold text-accent-gold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            style={{ fontSize: '8px' }}
          >
            {v === 'day' ? 'DÍA' : v === 'week' ? 'SEMANA' : 'MES'}
          </button>
        ))}
      </div>

      <LoadingGate loading={loading} fallback={<ModernLoader variant="compact" words={LOADING_COPY.agenda} />}>
        {loading ? null : view === 'day' ? (
        <DayView />
      ) : view === 'week' ? (
        <WeekView />
      ) : (
        <MonthView />
        )}
      </LoadingGate>

      <AnimatePresence>
        {showModal && (
          <EventModal
            defaultDate={defaultDate}
            onSave={handleCreate}
            onClose={() => setShowModal(false)}
          />
        )}
        {editingEvent && (
          <EventModal
            initial={editingEvent}
            defaultDate={defaultDate}
            onSave={d => handleUpdate(editingEvent.id, d as Partial<AgendaEvent>)}
            onClose={() => setEditingEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
