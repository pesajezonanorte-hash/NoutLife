// Agenda — AgendaDesktop.dc.html. Día (línea de tiempo con "ahora" y bloques completables),
// Semana, Mes y Google Calendar con estado. Servicios sin cambios (agenda.service).
// Zona ambientada: un escritorio ordenado, con el lenguaje de la libreta de
// Hábitos. Sobre un vade de fieltro, la hoja de la agenda se posa y cierra sus
// anillas; el margen se traza, las horas se escriben y cada evento es una marca
// de resaltador que se pasa y luego se escribe. Completar traza un check de tinta
// y tacha el evento a mano. Cambiar de día, semana o mes pasa la hoja hacia
// arriba sobre las anillas. El resumen y las categorías son notas adhesivas que
// caen; en la semana, cada día es una columna de la hoja y hoy lleva un círculo.
import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar, CalendarCheck, ChevronLeft, ChevronRight, Check, Link2, MapPin, Pencil, Plus, RefreshCw, Trash2, Unplug,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { item, springs } from '@/lib/motion';
import { longDate } from '@/lib/lifeMeta';
import { AmbientLight, SketchCheck, SketchCircle, SketchStrike, ZoneShell } from '@/components/ambience';
import { DeskMat, PlannerPage, StickyNote } from '@/components/agenda/Planner';
import { InkCheckButton } from '@/components/habits/InkCheckButton';
import { Lettering } from '@/components/layout/Lettering';
import { useToast } from '../../hooks/useToast';
import * as agendaService from '../../services/agenda.service';
import type { AgendaEvent } from '../../services/agenda.service';
import { Badge, Button, Card, EmptyState, Field, IconChip, Input, MonthGrid, ResponsiveDialog, SegmentedControl, Select, Switch, Textarea, TimelineDay, type TimelineItem, type Tone, PageLoader, DatePicker } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { solidBg, softTone } from '@/components/ui/lq/tones';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const es = {
  categories: {
    personal: 'Personal', work: 'Trabajo', health: 'Salud', social: 'Social', romantic: 'Romántico', finance: 'Finanzas',
    tarea: 'Tarea', examen: 'Examen', exposicion: 'Exposición', clase: 'Clase', other: 'Otro',
  } as Record<string, string>,
  reminders: ['Sin recordatorio', '30 minutos antes', '1 hora antes', '1 día antes'] as string[],
  views: { day: 'Día', week: 'Semana', month: 'Mes' } as Record<ViewKey, string>,
  allDay: 'Todo el día',
  habitsLink: 'Hábitos',
  editAria: (title: string): string => `Editar ${title}`,
  recurring: 'Hábito recurrente · se gestiona desde Hábitos',
  edit: 'Editar',
  editEvent: 'Editar evento',
  newEvent: 'Nuevo evento',
  titleField: 'Título del evento',
  categoryField: 'Categoría',
  allDayField: 'Todo el día',
  dateField: 'Fecha',
  startField: 'Inicio',
  endField: 'Fin (opcional)',
  placeField: 'Lugar (opcional)',
  subjectField: 'Asignatura',
  subjectPh: 'Ej. Matemáticas',
  descField: 'Descripción (opcional)',
  reminderField: 'Recordatorio',
  delete: 'Eliminar',
  cancel: 'Cancelar',
  save: 'Guardar',
  createEvent: 'Crear evento',
  eventCreated: 'Evento creado',
  createFail: 'Error al crear evento',
  eventUpdated: 'Evento actualizado',
  updateFail: 'Error al actualizar evento',
  eventDeleted: 'Evento eliminado',
  deleteFail: 'Error al eliminar evento',
  googleCancelled: 'No se conectó Google Calendar. Puedes intentarlo cuando quieras.',
  googleLinked: '¡Google Calendar vinculado con éxito!',
  googleLinkFail: 'Error al vincular Google Calendar',
  googleUrlFail: 'No se pudo obtener la URL de autorización de Google.',
  googleDisconnected: 'Google Calendar desconectado.',
  googleDisconnectFail: 'Error al desconectar Google Calendar',
  googleSyncFail: 'Error al sincronizar con Google Calendar',
  loadingAgenda: 'Ordenando tu agenda…',
  tagline: 'Tu tiempo, tus misiones.',
  today: 'Hoy',
  event: 'Evento',
  googleTitle: 'Google Calendar',
  connected: 'Conectado',
  notConnected: 'Sin conectar',
  googleDesc: 'Sincroniza tus reuniones y eventos. Tus misiones con fecha límite y las tareas de la agenda se publican en Google, y los hábitos que elijas se añaden como series recurrentes.',
  syncing: 'Sincronizando…',
  sync: 'Sincronizar',
  disconnect: 'Desconectar',
  connectGoogle: 'Conectar Google',
  dayPrev: 'Día anterior',
  dayNext: 'Día siguiente',
  dayAria: 'Día',
  eventsOfDay: 'Eventos del día',
  allDayAria: 'Todo el día',
  allDayEdit: ', todo el día. Editar',
  noEventsDay: 'Sin eventos este día',
  noEventsHint: 'Pulsa «Evento» para agregar uno.',
  addEvent: 'Agregar evento',
  summaryTitle: 'Resumen del día',
  blocksDone: 'bloques completados',
  plannedFor: (t: string): string => `${t} planificadas`,
  nothingPlanned: 'Nada planificado',
  categoriesTitle: 'Categorías',
  noTimed: 'Sin bloques con horario.',
  weekAria: 'Semana',
  weekPrev: 'Semana anterior',
  weekNext: 'Semana siguiente',
  monthAria: 'Mes',
  monthPrev: 'Mes anterior',
  monthNext: 'Mes siguiente',
  eventsCount: (n: number): string => `${n} ${n === 1 ? 'evento' : 'eventos'}`,
  more: (n: number): string => `+${n} más`,
  noEventsSel: 'Sin eventos este día.',
  googleRange: (a: string, b: string): string => `${a} — ${b}`,
  viewLabel: 'Vista',
};

const en: typeof es = {
  categories: {
    personal: 'Personal', work: 'Work', health: 'Health', social: 'Social', romantic: 'Romantic', finance: 'Finance',
    tarea: 'Homework', examen: 'Exam', exposicion: 'Presentation', clase: 'Class', other: 'Other',
  } as Record<string, string>,
  reminders: ['No reminder', '30 minutes before', '1 hour before', '1 day before'] as string[],
  views: { day: 'Day', week: 'Week', month: 'Month' } as Record<ViewKey, string>,
  allDay: 'All day',
  habitsLink: 'Habits',
  editAria: (title: string): string => `Edit ${title}`,
  recurring: 'Recurring habit · managed from Habits',
  edit: 'Edit',
  editEvent: 'Edit event',
  newEvent: 'New event',
  titleField: 'Event title',
  categoryField: 'Category',
  allDayField: 'All day',
  dateField: 'Date',
  startField: 'Start',
  endField: 'End (optional)',
  placeField: 'Place (optional)',
  subjectField: 'Subject',
  subjectPh: 'E.g. Maths',
  descField: 'Description (optional)',
  reminderField: 'Reminder',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  createEvent: 'Create event',
  eventCreated: 'Event created',
  createFail: 'Could not create the event',
  eventUpdated: 'Event updated',
  updateFail: 'Could not update the event',
  eventDeleted: 'Event deleted',
  deleteFail: 'Could not delete the event',
  googleCancelled: 'Google Calendar was not connected. You can try again whenever you like.',
  googleLinked: 'Google Calendar linked successfully!',
  googleLinkFail: 'Could not link Google Calendar',
  googleUrlFail: 'Could not get the Google authorization URL.',
  googleDisconnected: 'Google Calendar disconnected.',
  googleDisconnectFail: 'Could not disconnect Google Calendar',
  googleSyncFail: 'Could not sync with Google Calendar',
  loadingAgenda: 'Sorting your agenda…',
  tagline: 'Your time, your quests.',
  today: 'Today',
  event: 'Event',
  googleTitle: 'Google Calendar',
  connected: 'Connected',
  notConnected: 'Not connected',
  googleDesc: 'Sync your meetings and events. Your quests with deadlines and agenda tasks are published to Google, and the habits you pick are added as recurring series.',
  syncing: 'Syncing…',
  sync: 'Sync',
  disconnect: 'Disconnect',
  connectGoogle: 'Connect Google',
  dayPrev: 'Previous day',
  dayNext: 'Next day',
  dayAria: 'Day',
  eventsOfDay: 'Events of the day',
  allDayAria: 'All day',
  allDayEdit: ', all day. Edit',
  noEventsDay: 'No events this day',
  noEventsHint: 'Press “Event” to add one.',
  addEvent: 'Add event',
  summaryTitle: 'Day summary',
  blocksDone: 'blocks completed',
  plannedFor: (t: string): string => `${t} planned`,
  nothingPlanned: 'Nothing planned',
  categoriesTitle: 'Categories',
  noTimed: 'No timed blocks.',
  weekAria: 'Week',
  weekPrev: 'Previous week',
  weekNext: 'Next week',
  monthAria: 'Month',
  monthPrev: 'Previous month',
  monthNext: 'Next month',
  eventsCount: (n: number): string => `${n} ${n === 1 ? 'event' : 'events'}`,
  more: (n: number): string => `+${n} more`,
  noEventsSel: 'No events this day.',
  googleRange: (a: string, b: string): string => `${a} — ${b}`,
  viewLabel: 'View',
};

const COPY: Copy<typeof es> = { es, en };

type ViewKey = 'day' | 'week' | 'month';
type ViewMode = ViewKey;

const CATEGORY_KEYS: Array<{ key: string; tone: Tone }> = [
  { key: 'personal', tone: 'forest' },
  { key: 'work', tone: 'primary' },
  { key: 'health', tone: 'success' },
  { key: 'social', tone: 'info' },
  { key: 'romantic', tone: 'error' },
  { key: 'finance', tone: 'warning' },
  { key: 'tarea', tone: 'info' },
  { key: 'examen', tone: 'error' },
  { key: 'exposicion', tone: 'forest' },
  { key: 'clase', tone: 'primary' },
  { key: 'other', tone: 'muted' },
];

const REMINDER_VALUES: Array<number | null> = [null, 30, 60, 1440];

const catInfo = (key: string) => CATEGORY_KEYS.find((c) => c.key === key.toLowerCase()) ?? CATEGORY_KEYS[CATEGORY_KEYS.length - 1];
const catLabel = (key: string, t: typeof es) => t.categories[catInfo(key).key] ?? t.categories.other;

const formatTime = (iso: string, locale: Locale) => new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' });
const upper1 = (s: string) => s.replace(/^\p{L}/u, (c) => c.toUpperCase());

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Google devuelve los eventos de todo el día como YYYY-MM-DD, guardados como clave de
// calendario UTC: se comparan las partes UTC para no mostrarlos un día antes al oeste de Greenwich.
function isEventOnDay(event: AgendaEvent, day: Date) {
  const eventDate = new Date(event.startDate);
  if (event.isAllDay) {
    return eventDate.getUTCFullYear() === day.getFullYear() && eventDate.getUTCMonth() === day.getMonth() && eventDate.getUTCDate() === day.getDate();
  }
  return isSameDay(eventDate, day);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const NO_TONES: Tone[] = [];

const minutesOf = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const durationOf = (e: AgendaEvent) => (e.endDate ? Math.max(15, (new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 60000) : 60);
const timeLabel = (e: AgendaEvent, t: typeof es, locale: Locale) => (e.isAllDay ? t.allDay : `${formatTime(e.startDate, locale)}${e.endDate ? ` – ${formatTime(e.endDate, locale)}` : ''}`);
const hm = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')} min` : ''}`;

// ─── Event row / block ───────────────────────────────────────────────────────

function EventActions({ event, pending, onEdit, onToggle }: { event: AgendaEvent; pending?: boolean; onEdit: () => void; onToggle: () => void }) {
  const t = useText(COPY);
  if (event.eventType === 'habit') {
    return <Link to="/habits" className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-label-lg text-primary-text hover:underline"><Link2 aria-hidden className="size-4" />{t.habitsLink}</Link>;
  }
  return (
    <div className="relative flex shrink-0 items-center">
      <InkCheckButton name={event.title} checked={event.isCompleted} pending={pending} onToggle={onToggle} className="size-11" />
      <Button variant="icon" aria-label={t.editAria(event.title)} onClick={onEdit}><Pencil aria-hidden className="size-[18px]" strokeWidth={1.75} /></Button>
    </div>
  );
}

/** Texto que se escribe de izquierda a derecha; la máscara se quita al terminar (no recorta el foco). */
function Written({ delay, className, children }: { delay: number; className?: string; children: ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <div
      className={cn(className, !done && 'lq-write')}
      style={{ '--delay': `${Math.round(delay * 1000)}ms`, '--d': '540ms' } as CSSProperties}
      onAnimationEnd={(e) => { if (e.animationName === 'lq-write') setDone(true); }}
    >
      {children}
    </div>
  );
}

/** Título del evento; al completarlo se tacha a mano. */
function EventTitle({ event, className }: { event: AgendaEvent; className?: string }) {
  return (
    <p className={cn('flex min-w-0 text-label-lg transition-colors duration-300', event.isCompleted ? 'text-on-surface-light' : 'text-on-background', className)}>
      {/* El tachado mide lo que el título, no la fila entera */}
      <span className="relative min-w-0 truncate">
        {event.title}
        <SketchStrike drawn={event.isCompleted} className="text-on-surface-light" />
      </span>
    </p>
  );
}

function EventBlock({ event, index, pending, onEdit, onToggle }: { event: AgendaEvent; index: number; pending?: boolean; onEdit: () => void; onToggle: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const cat = catInfo(event.category);
  const at = 0.34 + index * 0.09;
  return (
    <article
      aria-label={event.title}
      style={{ '--hl': `var(--lq-${cat.tone === 'muted' ? 'border-strong' : cat.tone})` } as CSSProperties}
      // Presionar inclina un poco la marca, como el papel bajo el lápiz.
      className="group relative flex h-full items-start gap-3 rounded-[4px_12px_12px_4px] py-2.5 pl-3.5 pr-1 transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)] active:-rotate-[0.45deg] [.reduce-motion_&]:active:transform-none"
    >
      {/* El resaltador se pasa de izquierda a derecha; después se escribe el evento */}
      <motion.span
        aria-hidden="true"
        className={cn('lq-highlight lq-highlight-mark pointer-events-none absolute inset-0 origin-left rounded-[inherit]', event.isCompleted && '!opacity-60')}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, transition: { duration: 0.5, ease: [0.3, 0.2, 0.2, 1], delay: at } }}
      />
      <Written delay={at + 0.28} className="relative min-w-0 flex-1">
        <EventTitle event={event} />
        <p className="font-mono text-body-sm tabular-nums text-on-surface-light">{timeLabel(event, t, locale)} · {catLabel(event.category, t)}</p>
        {event.location && <p className="flex items-center gap-1 text-body-sm text-on-surface-light"><MapPin aria-hidden className="size-3.5" />{event.location}</p>}
      </Written>
      <EventActions event={event} pending={pending} onEdit={onEdit} onToggle={onToggle} />
    </article>
  );
}

const rowRule = { initial: { scaleX: 0 }, animate: { scaleX: 1 } };

/** Evento como una línea de la hoja: la línea se dibuja y el evento se escribe. */
function EventRow({ event, index, pending, onEdit, onToggle }: { event: AgendaEvent; index: number; pending?: boolean; onEdit: () => void; onToggle: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const cat = catInfo(event.category);
  return (
    <li className="group relative flex items-center gap-3 py-2 transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)] active:-rotate-[0.3deg] [.reduce-motion_&]:active:transform-none">
      <motion.span aria-hidden="true" variants={rowRule} initial="initial" animate="animate" transition={{ ...springs.gentle, mass: 0.8, delay: 0.1 + index * 0.06 }} className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-info/25" />
      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', solidBg[cat.tone])} />
      <Written delay={0.22 + index * 0.07} className="min-w-0 flex-1">
        <EventTitle event={event} />
        <p className="text-body-sm text-on-surface-light">{timeLabel(event, t, locale)} · {catLabel(event.category, t)}{event.location ? ` · ${event.location}` : ''}</p>
        {event.eventType === 'habit' && <p className="text-body-sm text-primary-text">{t.recurring}</p>}
      </Written>
      <EventActions event={event} pending={pending} onEdit={onEdit} onToggle={onToggle} />
    </li>
  );
}

// ─── Event Modal ──────────────────────────────────────────────────────────────

type EventBody = Omit<AgendaEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isCompleted'>;

function EventModal({ initial, defaultDate, onSave, onDelete, onClose }: {
  initial?: AgendaEvent; defaultDate?: string; onSave: (data: EventBody) => void; onDelete?: () => void; onClose: () => void;
}) {
  const t = useText(COPY);
  const todayLocal = defaultDate ?? new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'personal');
  const [startDate, setStartDate] = useState(initial ? initial.startDate.slice(0, 16) : `${todayLocal}T09:00`);
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 16) ?? '');
  const [isAllDay, setIsAllDay] = useState(initial?.isAllDay ?? false);
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(
    initial?.description && !initial.description.startsWith('Asignatura:') ? initial.description : (initial?.description?.split('\n\n')[1] ?? ''),
  );
  const [asignatura, setAsignatura] = useState(() => (initial?.description?.startsWith('Asignatura:') ? initial.description.split('\n')[0].replace('Asignatura: ', '') : ''));
  const [reminder, setReminder] = useState<number | null>(initial?.reminder ?? null);
  const isAcademic = ['tarea', 'examen', 'exposicion', 'clase'].includes(category);

  function handleSubmit() {
    if (!title.trim()) return;
    let finalDesc = description;
    // «Asignatura:» es el formato guardado en la descripción: se mantiene tal cual.
    if (isAcademic && asignatura.trim()) finalDesc = `Asignatura: ${asignatura.trim()}\n\n${description}`.trim();
    onSave({
      title: title.trim(), category,
      startDate: isAllDay ? `${startDate.slice(0, 10)}T00:00:00.000Z` : new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      isAllDay, location: location || undefined, description: finalDesc || undefined, reminder: reminder ?? undefined,
    });
  }

  return (
    <ResponsiveDialog open onClose={onClose} title={initial ? t.editEvent : t.newEvent} className="max-w-[480px]">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <Field label={t.titleField}><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required /></Field>
        <Field label={t.categoryField}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORY_KEYS.map((c) => <option key={c.key} value={c.key}>{t.categories[c.key]}</option>)}</Select>
        </Field>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <label htmlFor="ev-allday" className="text-body-md">{t.allDayField}</label>
          <Switch id="ev-allday" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
        </div>
        {isAllDay ? (
          <Field label={t.dateField}><DatePicker value={startDate.slice(0, 10)} onChange={(d) => setStartDate(`${d}T00:00`)} /></Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.startField}><Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label={t.endField}><Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
        )}
        <Field label={t.placeField}><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        {isAcademic && <Field label={t.subjectField}><Input value={asignatura} onChange={(e) => setAsignatura(e.target.value)} placeholder={t.subjectPh} /></Field>}
        <Field label={t.descField}><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label={t.reminderField}>
          <Select value={reminder ?? ''} onChange={(e) => setReminder(e.target.value === '' ? null : Number(e.target.value))}>
            {REMINDER_VALUES.map((value, i) => <option key={t.reminders[i]} value={value ?? ''}>{t.reminders[i]}</option>)}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-3">
          {onDelete && <Button type="button" variant="danger" onClick={onDelete}><Trash2 aria-hidden className="size-4" />{t.delete}</Button>}
          <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" disabled={!title.trim()}>{initial ? t.save : t.createEvent}</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

// ─── Agenda Page ──────────────────────────────────────────────────────────────

function NavBar({ label, display, onPrev, onNext, prevLabel, nextLabel, dir = 0 }: { label: string; display?: ReactNode; onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; dir?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button variant="icon" aria-label={prevLabel} onClick={onPrev}><ChevronLeft aria-hidden className="size-6" strokeWidth={1.75} /></Button>
      <h2 className="relative overflow-hidden text-center text-heading-md" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={label} className="block" custom={dir}
            variants={{ enter: (d: number) => ({ y: d * 20, opacity: 0 }), center: { y: 0, opacity: 1 }, leave: (d: number) => ({ y: d * -20, opacity: 0 }) }}
            initial="enter" animate="center" exit="leave" transition={springs.natural}
          >
            {display ?? label}
          </motion.span>
        </AnimatePresence>
      </h2>
      <Button variant="icon" aria-label={nextLabel} onClick={onNext}><ChevronRight aria-hidden className="size-6" strokeWidth={1.75} /></Button>
    </div>
  );
}

const errMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e.response?.data?.error || e.message || fallback;
};

export default function AgendaPage() {
  const t = useText(COPY);
  const locale = useLocale();
  const dateLocale = INTL_LOCALE[locale];
  const toast = useToast();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  // Solo la primera carga muestra el cargador: después, cambiar de día, semana o mes nunca
  // desmonta el calendario (antes, una agenda vacía parpadeaba con el cargador en cada toque).
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const handledCodeRef = useRef<string | null>(null);

  // Se pide por mes, no por día: elegir otro día del mismo mes no vuelve a cargar nada.
  const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
  const load = useCallback(async () => {
    const [y, m] = monthKey.split('-').map(Number);
    try {
      // Desde una semana antes: la vista semanal puede empezar en el mes anterior.
      const from = new Date(y, m, 1 - 7).toISOString();
      const to = new Date(y, m + 2, 1).toISOString();
      setEvents(await agendaService.fetchEvents({ from, to }));
    } catch { /* se mantiene la lista anterior */ }
    finally { setLoaded(true); }
  }, [monthKey]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(body: Parameters<typeof agendaService.createEvent>[0]) {
    try { await agendaService.createEvent(body); setShowModal(false); await load(); toast.success(t.eventCreated); }
    catch { toast.error(t.createFail); }
  }
  async function handleUpdate(id: string, body: Parameters<typeof agendaService.updateEvent>[1]) {
    try { await agendaService.updateEvent(id, body); setEditingEvent(null); await load(); toast.success(t.eventUpdated); }
    catch { toast.error(t.updateFail); }
  }
  async function handleDelete(id: string) {
    try { await agendaService.deleteEvent(id); setEditingEvent(null); await load(); toast.success(t.eventDeleted); }
    catch { toast.error(t.deleteFail); }
  }
  // La tinta va antes que la API: se marca al momento y, si falla, se recoge.
  const [toggling, setToggling] = useState<string | null>(null);
  async function handleToggle(event: AgendaEvent) {
    const next = !event.isCompleted;
    const set = (v: boolean) => setEvents((prev) => prev.map((x) => (x.id === event.id ? { ...x, isCompleted: v } : x)));
    set(next);
    setToggling(event.id);
    try { await agendaService.updateEvent(event.id, { isCompleted: next } as Partial<AgendaEvent>); }
    catch { set(!next); toast.error(t.updateFail); }
    finally { setToggling(null); }
  }

  // Google Calendar
  useEffect(() => {
    agendaService.getGoogleCalendarStatus().then((s) => setGoogleConnected(s.connected)).catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    // Cancelar o cerrar la pantalla de Google vuelve con ?error=access_denied.
    if (params.get('error')) {
      window.history.replaceState({}, document.title, window.location.pathname);
      toast.info(t.googleCancelled);
      return;
    }
    if (code && handledCodeRef.current !== code) {
      handledCodeRef.current = code;
      const redirectUri = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, window.location.pathname);
      agendaService.handleGoogleCallback(code, redirectUri, params.get('state') ?? undefined)
        .then(() => { toast.success(t.googleLinked); setGoogleConnected(true); void load(); })
        .catch((err: unknown) => toast.error(errMsg(err, t.googleLinkFail)));
    }
  }, [load, toast, t]);

  async function handleConnectGoogle() {
    try { window.location.href = await agendaService.getGoogleAuthUrl(window.location.origin + window.location.pathname); }
    catch (err) { toast.error(errMsg(err, t.googleUrlFail)); }
  }
  async function handleSyncGoogle() {
    setSyncingGoogle(true);
    try { const res = await agendaService.syncGoogleCalendar(); toast.success(res.message); setGoogleConnected(true); await load(); }
    catch (err) { toast.error(errMsg(err, t.googleSyncFail)); }
    finally { setSyncingGoogle(false); }
  }
  async function handleDisconnectGoogle() {
    try { await agendaService.disconnectGoogleCalendar(); toast.success(t.googleDisconnected); setGoogleConnected(false); }
    catch (err) { toast.error(errMsg(err, t.googleDisconnectFail)); }
  }

  /** Sentido del último cambio (hoja hacia arriba = adelante). */
  const [dir, setDir] = useState(0);
  const shift = (days: number) => { setDir(Math.sign(days)); const d = new Date(currentDate); d.setDate(d.getDate() + days); setCurrentDate(d); };
  const shiftMonth = (n: number) => { setDir(Math.sign(n)); setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + n, 1)); };
  /** Pasar la hoja del calendario: sale hacia arriba (o abajo) desde la anilla superior. */
  const flip = {
    enter: (d: number) => ({ opacity: 0, rotateX: d >= 0 ? -16 : 16, y: d >= 0 ? 10 : -10 }),
    center: { opacity: 1, rotateX: 0, y: 0, transition: springs.heavy },
    leave: (d: number) => ({ opacity: 0, rotateX: d >= 0 ? 70 : -70, y: d >= 0 ? -14 : 14, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }),
  };
  const dayEvents = useMemo(() => events.filter((e) => isEventOnDay(e, currentDate)), [events, currentDate]);
  // Puntos del mes: un mapa por día calculado una vez por lista de eventos (no 42 filtros por render).
  const tonesByDay = useMemo(() => {
    const map = new Map<string, Tone[]>();
    for (const e of events) {
      const d = new Date(e.startDate);
      // Igual que isEventOnDay: los de todo el día van por su fecha UTC.
      const key = e.isAllDay ? `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}` : dayKey(d);
      map.set(key, [...(map.get(key) ?? []), catInfo(e.category).tone]);
    }
    return map;
  }, [events]);
  const dotsOf = useCallback((d: Date) => tonesByDay.get(dayKey(d)) ?? NO_TONES, [tonesByDay]);
  const describeDay = useCallback((d: Date) => t.eventsCount(dotsOf(d).length), [dotsOf, t]);
  const timed = dayEvents.filter((e) => !e.isAllDay);
  const allDay = dayEvents.filter((e) => e.isAllDay);
  const doneN = dayEvents.filter((e) => e.isCompleted).length;
  const planned = timed.reduce((a, e) => a + durationOf(e), 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of timed) m.set(e.category, (m.get(e.category) ?? 0) + durationOf(e));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [timed]);

  // En orden de la hoja: los bloques se resaltan y se escriben de arriba abajo.
  const items: TimelineItem[] = [...timed].sort((a, b) => minutesOf(a.startDate) - minutesOf(b.startDate)).map((e, i) => ({
    id: e.id, start: minutesOf(e.startDate), duration: durationOf(e),
    render: <EventBlock event={e} index={i} pending={toggling === e.id} onEdit={() => setEditingEvent(e)} onToggle={() => void handleToggle(e)} />,
  }));

  const monday = new Date(currentDate);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
  const today = new Date();
  const defaultDate = currentDate.toISOString().slice(0, 10);

  const VIEWS = (['day', 'week', 'month'] as const).map((value) => ({ value, label: t.views[value] }));

  return (
    <ZoneShell
      zone="agenda"
      contentClassName="gap-6 md:gap-8"
      ambience={<AmbientLight tone="warning" alpha={0.1} darkAlpha={0.06} d={18} className="left-[18%] top-[6%] h-[34rem] w-[64%]" />}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1 md:gap-2">
          <span className="hidden text-label-lg text-primary-text md:block">{longDate(new Date(), locale)}</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Agenda" /></h1>
          <p className="text-body-lg text-on-surface-light">{t.tagline}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="secondary" size="md" onClick={() => { setDir(new Date() >= currentDate ? 1 : -1); setCurrentDate(new Date()); }}>{t.today}</Button>
          <Button size="md" onClick={() => setShowModal(true)}><Plus aria-hidden className="size-4" />{t.event}</Button>
        </div>
      </motion.section>

      <motion.div variants={item} className="w-full max-w-[360px]">
        <SegmentedControl options={VIEWS} value={view} onChange={setView} label={t.viewLabel} />
      </motion.div>

      <motion.section variants={item} aria-label={t.googleTitle}>
        <Card padding="sm" className="flex flex-wrap items-center gap-4 md:px-5">
          <IconChip icon={Calendar} tone="info" size="sm" />
          <div className="min-w-0 flex-[1_1_280px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-lg">{t.googleTitle}</span>
              <Badge variant={googleConnected ? 'success' : 'warning'} icon={googleConnected ? Check : undefined}>{googleConnected ? t.connected : t.notConnected}</Badge>
            </div>
            <p className="text-body-sm text-on-surface-light">{t.googleDesc}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {googleConnected ? (
              <>
                <Button variant="secondary" size="md" loading={syncingGoogle} onClick={() => void handleSyncGoogle()}><RefreshCw aria-hidden className="size-4" />{syncingGoogle ? t.syncing : t.sync}</Button>
                <Button variant="ghost" size="md" onClick={() => void handleDisconnectGoogle()}><Unplug aria-hidden className="size-4" />{t.disconnect}</Button>
              </>
            ) : (
              <Button variant="secondary" size="md" onClick={() => void handleConnectGoogle()}>{t.connectGoogle}</Button>
            )}
          </div>
        </Card>
      </motion.section>

      {!loaded ? (
        <PageLoader label={t.loadingAgenda} words={LOADING_COPY.agenda} />
      ) : (
        <DeskMat>
        {/* Cambio de vista: la nueva entra en el sitio de la anterior, sin hueco entre las dos (antes la
            salida dejaba el contenedor vacío un instante y la página saltaba). */}
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {view === 'day' && (
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                <PlannerPage aria-label={t.dayAria} className="flex flex-col gap-4 px-4 pb-6 md:px-7">
                  <NavBar
                    dir={dir}
                    label={upper1(currentDate.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }))}
                    display={(
                      // La fecha como en un calendario de escritorio: el número grande, escrito con la letra de la marca
                      <span className="flex items-center gap-3 text-left">
                        <span className="text-display-sm leading-none md:text-display-md"><Lettering text={String(currentDate.getDate())} delay={0.1} /></span>
                        <span className="flex flex-col">
                          <span className="text-heading-sm leading-tight">{upper1(currentDate.toLocaleDateString(dateLocale, { weekday: 'long' }))}</span>
                          <span className="text-body-sm font-normal text-on-surface-light">{upper1(currentDate.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }))}</span>
                        </span>
                      </span>
                    )}
                    prevLabel={t.dayPrev} nextLabel={t.dayNext} onPrev={() => shift(-1)} onNext={() => shift(1)}
                  />
                  {allDay.length > 0 && (
                    <ul aria-label={t.allDayAria} className="flex flex-wrap gap-2">
                      {allDay.map((e) => <li key={e.id}><button type="button" onClick={() => setEditingEvent(e)} className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label-lg md:min-h-9', softTone[catInfo(e.category).tone])}>{e.title}<span className="sr-only">{t.allDayEdit}</span></button></li>)}
                    </ul>
                  )}
                  {/* La hoja del día se pasa hacia arriba sobre las anillas */}
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.div key={currentDate.toDateString()} custom={dir} variants={flip} initial="enter" animate="center" exit="leave" style={{ transformPerspective: 1200, originY: 0 }}>
                      {timed.length === 0 && allDay.length === 0 ? (
                        <EmptyState icon={CalendarCheck} title={t.noEventsDay} description={t.noEventsHint} className="py-10" action={<Button variant="secondary" onClick={() => setShowModal(true)}><Plus aria-hidden className="size-4" />{t.addEvent}</Button>} />
                      ) : (
                        <TimelineDay ruled items={items} showNow={isSameDay(currentDate, today)} label={t.eventsOfDay} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </PlannerPage>
                <aside className="flex flex-col gap-8 pt-2">
                  {/* Notas adhesivas: el resumen con sus casillas marcadas y el tiempo por categoría */}
                  <StickyNote tone="warning" tilt={-1.8} delay={0.35} aria-labelledby="ag-sum">
                    <h2 id="ag-sum" className="text-heading-sm">{t.summaryTitle}</h2>
                    <p className="flex items-baseline gap-2">
                      <span className="font-mono text-display-sm font-bold tabular-nums">{doneN}<span className="text-on-surface-light">/{dayEvents.length}</span></span>
                      <span className="text-label-lg">{t.blocksDone}</span>
                    </p>
                    {dayEvents.length > 0 && (
                      <span aria-hidden="true" className="flex flex-wrap gap-1.5">
                        {dayEvents.map((e) => (
                          <span key={e.id} className="relative block size-6 rounded-[4px] border-2 border-on-background/35">
                            {e.isCompleted && <SketchCheck className="absolute -inset-1 text-success-text" />}
                          </span>
                        ))}
                      </span>
                    )}
                    <p className="text-body-sm text-on-surface">{planned ? t.plannedFor(hm(planned)) : t.nothingPlanned}</p>
                  </StickyNote>
                  <StickyNote tone="info" tilt={1.4} delay={0.5} aria-labelledby="ag-cats" className="gap-2.5">
                    <h2 id="ag-cats" className="text-heading-sm">{t.categoriesTitle}</h2>
                    {byCat.length === 0 ? <p className="text-body-sm text-on-surface">{t.noTimed}</p> : byCat.map(([key, min]) => (
                      <div key={key} className="flex items-center gap-3"><span aria-hidden className={cn('h-5 w-2 rounded-sm', solidBg[catInfo(key).tone])} /><span className="flex-1 text-body-md">{catLabel(key, t)}</span><span className="font-mono text-body-sm tabular-nums text-on-surface">{hm(min)}</span></div>
                    ))}
                  </StickyNote>
                </aside>
              </div>
            )}

            {view === 'week' && (
              <PlannerPage aria-label={t.weekAria} className="flex flex-col gap-4 px-4 pb-6 md:px-7">
                <NavBar dir={dir} label={t.googleRange(weekDays[0].toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }), weekDays[6].toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }))} prevLabel={t.weekPrev} nextLabel={t.weekNext} onPrev={() => shift(-7)} onNext={() => shift(7)} />
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                {/* Cada día es una columna de la hoja (una línea en móvil): el día se escribe, hoy lleva un círculo de tinta y los eventos son marcas de resaltador. */}
                <motion.ol key={weekDays[0].toDateString()} custom={dir} variants={flip} initial="enter" animate="center" exit="leave" style={{ transformPerspective: 1200, originY: 0 }} className="grid grid-cols-1 md:grid-cols-7">
                  {weekDays.map((day, di) => {
                    const evs = events.filter((e) => isEventOnDay(e, day));
                    const isToday = isSameDay(day, today);
                    return (
                      <li key={day.toISOString()} className={cn('relative', di > 0 && 'md:border-l md:border-info/20')}>
                        <motion.span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-info/25 md:hidden" initial={{ scaleX: 0 }} animate={{ scaleX: 1, transition: { ...springs.gentle, mass: 0.8, delay: 0.1 + di * 0.05 } }} />
                        <button
                          type="button" aria-current={isToday ? 'date' : undefined}
                          aria-label={`${day.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}, ${t.eventsCount(evs.length)}`}
                          onClick={() => { setDir(day >= currentDate ? 1 : -1); setCurrentDate(day); setView('day'); }}
                          className="flex min-h-16 w-full flex-col gap-2 rounded-lg px-2 py-3 text-left transition-colors duration-300 hover:bg-warning/[.08] md:min-h-[260px] md:px-2.5"
                        >
                          <span aria-hidden className="flex items-center justify-between gap-2 md:flex-col md:items-start md:gap-1">
                            <Written delay={0.15 + di * 0.05}><span className="text-label-md text-on-surface-light">{day.toLocaleDateString(dateLocale, { weekday: 'short' }).replace('.', '')}</span></Written>
                            <span className={cn('relative inline-flex min-w-8 items-center justify-center font-mono text-heading-md tabular-nums', isToday && 'text-primary-text')}>
                              {day.getDate()}
                              {isToday && <SketchCircle className="absolute -inset-2 size-[calc(100%+1rem)] text-primary" delay={0.6} duration={0.6} strokeWidth={1.8} />}
                            </span>
                          </span>
                          {evs.slice(0, 4).map((e, k) => {
                            const tone = catInfo(e.category).tone;
                            return (
                              <span key={e.id} aria-hidden className="relative flex items-center rounded-[3px_8px_8px_3px] py-1 pl-2 pr-1.5 text-body-sm" style={{ '--hl': `var(--lq-${tone === 'muted' ? 'border-strong' : tone})` } as CSSProperties}>
                                <motion.span className="lq-highlight absolute inset-0 origin-left rounded-[inherit]" initial={{ scaleX: 0 }} animate={{ scaleX: 1, transition: { duration: 0.45, ease: [0.3, 0.2, 0.2, 1], delay: 0.3 + di * 0.05 + k * 0.07 } }} />
                                <span className={cn('relative truncate', e.isCompleted && 'text-on-surface-light line-through')}>{e.title}</span>
                              </span>
                            );
                          })}
                          {evs.length > 4 && <span aria-hidden className="text-body-sm text-on-surface-light">{t.more(evs.length - 4)}</span>}
                        </button>
                      </li>
                    );
                  })}
                </motion.ol>
                </AnimatePresence>
              </PlannerPage>
            )}

            {view === 'month' && (
              <div className="flex flex-col gap-6">
                <PlannerPage aria-label={t.monthAria} className="flex flex-col gap-4 px-4 pb-6 md:px-7">
                  <NavBar dir={dir} label={upper1(currentDate.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }))} prevLabel={t.monthPrev} nextLabel={t.monthNext} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`} custom={dir} variants={flip} initial="enter" animate="center" exit="leave" style={{ transformPerspective: 1200, originY: 0 }}>
                  <MonthGrid
                    month={currentDate} selected={currentDate} onSelect={setCurrentDate}
                    dots={dotsOf}
                    describe={describeDay}
                  />
                  </motion.div>
                  </AnimatePresence>
                </PlannerPage>
                <PlannerPage rings={false} aria-labelledby="ag-sel" className="flex flex-col gap-2 p-6">
                  <h2 id="ag-sel" className="text-heading-sm">{upper1(currentDate.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
                  {dayEvents.length === 0 ? <p className="py-2 text-body-md text-on-surface-light">{t.noEventsSel}</p> : (
                    <ul key={currentDate.toDateString()}>{dayEvents.map((e, i) => <EventRow key={e.id} index={i} event={e} pending={toggling === e.id} onEdit={() => setEditingEvent(e)} onToggle={() => void handleToggle(e)} />)}</ul>
                  )}
                </PlannerPage>
              </div>
            )}
          </motion.div>
        </DeskMat>
      )}

      {showModal && <EventModal defaultDate={defaultDate} onSave={handleCreate} onClose={() => setShowModal(false)} />}
      {editingEvent && (
        <EventModal initial={editingEvent} defaultDate={defaultDate} onSave={(d) => void handleUpdate(editingEvent.id, d as Partial<AgendaEvent>)}
          onDelete={editingEvent.eventType === 'habit' ? undefined : () => void handleDelete(editingEvent.id)} onClose={() => setEditingEvent(null)} />
      )}
    </ZoneShell>
  );
}
