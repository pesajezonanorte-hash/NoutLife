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

type ViewMode = 'day' | 'week' | 'month';

const CATEGORIES: Array<{ key: string; label: string; tone: Tone }> = [
  { key: 'personal', label: 'Personal', tone: 'forest' },
  { key: 'work', label: 'Trabajo', tone: 'primary' },
  { key: 'health', label: 'Salud', tone: 'success' },
  { key: 'social', label: 'Social', tone: 'info' },
  { key: 'romantic', label: 'Romántico', tone: 'error' },
  { key: 'finance', label: 'Finanzas', tone: 'warning' },
  { key: 'tarea', label: 'Tarea', tone: 'info' },
  { key: 'examen', label: 'Examen', tone: 'error' },
  { key: 'exposicion', label: 'Exposición', tone: 'forest' },
  { key: 'clase', label: 'Clase', tone: 'primary' },
  { key: 'other', label: 'Otro', tone: 'muted' },
];

const REMINDERS = [
  { value: null, label: 'Sin recordatorio' },
  { value: 30, label: '30 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 1440, label: '1 día antes' },
];

const VIEWS = [
  { value: 'day' as const, label: 'Día' },
  { value: 'week' as const, label: 'Semana' },
  { value: 'month' as const, label: 'Mes' },
];

const catInfo = (key: string) => CATEGORIES.find((c) => c.key === key.toLowerCase()) ?? CATEGORIES[CATEGORIES.length - 1];

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
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

const minutesOf = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const durationOf = (e: AgendaEvent) => (e.endDate ? Math.max(15, (new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 60000) : 60);
const timeLabel = (e: AgendaEvent) => (e.isAllDay ? 'Todo el día' : `${formatTime(e.startDate)}${e.endDate ? ` – ${formatTime(e.endDate)}` : ''}`);
const hm = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')} min` : ''}`;

// ─── Event row / block ───────────────────────────────────────────────────────

function EventActions({ event, pending, onEdit, onToggle }: { event: AgendaEvent; pending?: boolean; onEdit: () => void; onToggle: () => void }) {
  if (event.eventType === 'habit') {
    return <Link to="/habits" className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-label-lg text-primary-text hover:underline"><Link2 aria-hidden className="size-4" />Hábitos</Link>;
  }
  return (
    <div className="relative flex shrink-0 items-center">
      <InkCheckButton name={event.title} checked={event.isCompleted} pending={pending} onToggle={onToggle} className="size-11" />
      <Button variant="icon" aria-label={`Editar ${event.title}`} onClick={onEdit}><Pencil aria-hidden className="size-[18px]" strokeWidth={1.75} /></Button>
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
        <p className="font-mono text-body-sm tabular-nums text-on-surface-light">{timeLabel(event)} · {cat.label}</p>
        {event.location && <p className="flex items-center gap-1 text-body-sm text-on-surface-light"><MapPin aria-hidden className="size-3.5" />{event.location}</p>}
      </Written>
      <EventActions event={event} pending={pending} onEdit={onEdit} onToggle={onToggle} />
    </article>
  );
}

const rowRule = { initial: { scaleX: 0 }, animate: { scaleX: 1 } };

/** Evento como una línea de la hoja: la línea se dibuja y el evento se escribe. */
function EventRow({ event, index, pending, onEdit, onToggle }: { event: AgendaEvent; index: number; pending?: boolean; onEdit: () => void; onToggle: () => void }) {
  const cat = catInfo(event.category);
  return (
    <li className="group relative flex items-center gap-3 py-2 transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)] active:-rotate-[0.3deg] [.reduce-motion_&]:active:transform-none">
      <motion.span aria-hidden="true" variants={rowRule} initial="initial" animate="animate" transition={{ ...springs.gentle, mass: 0.8, delay: 0.1 + index * 0.06 }} className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-info/25" />
      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', solidBg[cat.tone])} />
      <Written delay={0.22 + index * 0.07} className="min-w-0 flex-1">
        <EventTitle event={event} />
        <p className="text-body-sm text-on-surface-light">{timeLabel(event)} · {cat.label}{event.location ? ` · ${event.location}` : ''}</p>
        {event.eventType === 'habit' && <p className="text-body-sm text-primary-text">Hábito recurrente · se gestiona desde Hábitos</p>}
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
    if (isAcademic && asignatura.trim()) finalDesc = `Asignatura: ${asignatura.trim()}\n\n${description}`.trim();
    onSave({
      title: title.trim(), category,
      startDate: isAllDay ? `${startDate.slice(0, 10)}T00:00:00.000Z` : new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      isAllDay, location: location || undefined, description: finalDesc || undefined, reminder: reminder ?? undefined,
    });
  }

  return (
    <ResponsiveDialog open onClose={onClose} title={initial ? 'Editar evento' : 'Nuevo evento'} className="max-w-[480px]">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <Field label="Título del evento"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required /></Field>
        <Field label="Categoría">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select>
        </Field>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <label htmlFor="ev-allday" className="text-body-md">Todo el día</label>
          <Switch id="ev-allday" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
        </div>
        {isAllDay ? (
          <Field label="Fecha"><DatePicker value={startDate.slice(0, 10)} onChange={(d) => setStartDate(`${d}T00:00`)} /></Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inicio"><Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Fin (opcional)"><Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
        )}
        <Field label="Lugar (opcional)"><Input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        {isAcademic && <Field label="Asignatura"><Input value={asignatura} onChange={(e) => setAsignatura(e.target.value)} placeholder="Ej. Matemáticas" /></Field>}
        <Field label="Descripción (opcional)"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Recordatorio">
          <Select value={reminder ?? ''} onChange={(e) => setReminder(e.target.value === '' ? null : Number(e.target.value))}>
            {REMINDERS.map((r) => <option key={r.label} value={r.value ?? ''}>{r.label}</option>)}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-3">
          {onDelete && <Button type="button" variant="danger" onClick={onDelete}><Trash2 aria-hidden className="size-4" />Eliminar</Button>}
          <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!title.trim()}>{initial ? 'Guardar' : 'Crear evento'}</Button>
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
  const toast = useToast();
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const handledCodeRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const to = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1).toISOString();
      setEvents(await agendaService.fetchEvents({ from, to }));
    } catch { /* se mantiene la lista anterior */ }
    finally { setLoading(false); }
  }, [currentDate]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(body: Parameters<typeof agendaService.createEvent>[0]) {
    try { await agendaService.createEvent(body); setShowModal(false); await load(); toast.success('Evento creado'); }
    catch { toast.error('Error al crear evento'); }
  }
  async function handleUpdate(id: string, body: Parameters<typeof agendaService.updateEvent>[1]) {
    try { await agendaService.updateEvent(id, body); setEditingEvent(null); await load(); toast.success('Evento actualizado'); }
    catch { toast.error('Error al actualizar evento'); }
  }
  async function handleDelete(id: string) {
    try { await agendaService.deleteEvent(id); setEditingEvent(null); await load(); toast.success('Evento eliminado'); }
    catch { toast.error('Error al eliminar evento'); }
  }
  // La tinta va antes que la API: se marca al momento y, si falla, se recoge.
  const [toggling, setToggling] = useState<string | null>(null);
  async function handleToggle(event: AgendaEvent) {
    const next = !event.isCompleted;
    const set = (v: boolean) => setEvents((prev) => prev.map((x) => (x.id === event.id ? { ...x, isCompleted: v } : x)));
    set(next);
    setToggling(event.id);
    try { await agendaService.updateEvent(event.id, { isCompleted: next } as Partial<AgendaEvent>); }
    catch { set(!next); toast.error('Error al actualizar evento'); }
    finally { setToggling(null); }
  }

  // Google Calendar
  useEffect(() => {
    agendaService.getGoogleCalendarStatus().then((s) => setGoogleConnected(s.connected)).catch(() => setGoogleConnected(false));
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && handledCodeRef.current !== code) {
      handledCodeRef.current = code;
      const redirectUri = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, window.location.pathname);
      agendaService.handleGoogleCallback(code, redirectUri)
        .then(() => { toast.success('¡Google Calendar vinculado con éxito!'); setGoogleConnected(true); void load(); })
        .catch((err: unknown) => toast.error(errMsg(err, 'Error al vincular Google Calendar')));
    }
  }, [load, toast]);

  async function handleConnectGoogle() {
    try { window.location.href = await agendaService.getGoogleAuthUrl(window.location.origin + window.location.pathname); }
    catch (err) { toast.error(errMsg(err, 'No se pudo obtener la URL de autorización de Google.')); }
  }
  async function handleSyncGoogle() {
    setSyncingGoogle(true);
    try { const res = await agendaService.syncGoogleCalendar(); toast.success(res.message); setGoogleConnected(true); await load(); }
    catch (err) { toast.error(errMsg(err, 'Error al sincronizar con Google Calendar')); }
    finally { setSyncingGoogle(false); }
  }
  async function handleDisconnectGoogle() {
    try { await agendaService.disconnectGoogleCalendar(); toast.success('Google Calendar desconectado.'); setGoogleConnected(false); }
    catch (err) { toast.error(errMsg(err, 'Error al desconectar Google Calendar')); }
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


  return (
    <ZoneShell
      zone="agenda"
      contentClassName="gap-6 md:gap-8"
      ambience={<AmbientLight tone="warning" alpha={0.1} darkAlpha={0.06} d={18} className="left-[18%] top-[6%] h-[34rem] w-[64%]" />}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1 md:gap-2">
          <span className="hidden text-label-lg text-primary-text md:block">{longDate()}</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Agenda" /></h1>
          <p className="text-body-lg text-on-surface-light">Tu tiempo, tus misiones.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="secondary" size="md" onClick={() => { setDir(new Date() >= currentDate ? 1 : -1); setCurrentDate(new Date()); }}>Hoy</Button>
          <Button size="md" onClick={() => setShowModal(true)}><Plus aria-hidden className="size-4" />Evento</Button>
        </div>
      </motion.section>

      <motion.div variants={item} className="w-full max-w-[360px]">
        <SegmentedControl options={VIEWS} value={view} onChange={setView} label="Vista" />
      </motion.div>

      <motion.section variants={item} aria-label="Google Calendar">
        <Card padding="sm" className="flex flex-wrap items-center gap-4 md:px-5">
          <IconChip icon={Calendar} tone="info" size="sm" />
          <div className="min-w-0 flex-[1_1_280px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-lg">Google Calendar</span>
              <Badge variant={googleConnected ? 'success' : 'warning'} icon={googleConnected ? Check : undefined}>{googleConnected ? 'Conectado' : 'Sin conectar'}</Badge>
            </div>
            <p className="text-body-sm text-on-surface-light">Sincroniza tus reuniones y eventos; los hábitos que elijas se añaden como series recurrentes separadas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {googleConnected ? (
              <>
                <Button variant="secondary" size="md" loading={syncingGoogle} onClick={() => void handleSyncGoogle()}><RefreshCw aria-hidden className="size-4" />{syncingGoogle ? 'Sincronizando…' : 'Sincronizar'}</Button>
                <Button variant="ghost" size="md" onClick={() => void handleDisconnectGoogle()}><Unplug aria-hidden className="size-4" />Desconectar</Button>
              </>
            ) : (
              <Button variant="secondary" size="md" onClick={() => void handleConnectGoogle()}>Conectar Google</Button>
            )}
          </div>
        </Card>
      </motion.section>

      {loading && events.length === 0 ? (
        <PageLoader label="Ordenando tu agenda…" words={LOADING_COPY.agenda} />
      ) : (
        <DeskMat>
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {view === 'day' && (
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                <PlannerPage aria-label="Día" className="flex flex-col gap-4 px-4 pb-6 md:px-7">
                  <NavBar
                    dir={dir}
                    label={upper1(currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}
                    display={(
                      // La fecha como en un calendario de escritorio: el número grande, escrito con la letra de la marca
                      <span className="flex items-center gap-3 text-left">
                        <span className="text-display-sm leading-none md:text-display-md"><Lettering text={String(currentDate.getDate())} delay={0.1} /></span>
                        <span className="flex flex-col">
                          <span className="text-heading-sm leading-tight">{upper1(currentDate.toLocaleDateString('es-ES', { weekday: 'long' }))}</span>
                          <span className="text-body-sm font-normal text-on-surface-light">{upper1(currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))}</span>
                        </span>
                      </span>
                    )}
                    prevLabel="Día anterior" nextLabel="Día siguiente" onPrev={() => shift(-1)} onNext={() => shift(1)}
                  />
                  {allDay.length > 0 && (
                    <ul aria-label="Todo el día" className="flex flex-wrap gap-2">
                      {allDay.map((e) => <li key={e.id}><button type="button" onClick={() => setEditingEvent(e)} className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label-lg md:min-h-9', softTone[catInfo(e.category).tone])}>{e.title}<span className="sr-only">, todo el día. Editar</span></button></li>)}
                    </ul>
                  )}
                  {/* La hoja del día se pasa hacia arriba sobre las anillas */}
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.div key={currentDate.toDateString()} custom={dir} variants={flip} initial="enter" animate="center" exit="leave" style={{ transformPerspective: 1200, originY: 0 }}>
                      {timed.length === 0 && allDay.length === 0 ? (
                        <EmptyState icon={CalendarCheck} title="Sin eventos este día" description="Pulsa «Evento» para agregar uno." className="py-10" action={<Button variant="secondary" onClick={() => setShowModal(true)}><Plus aria-hidden className="size-4" />Agregar evento</Button>} />
                      ) : (
                        <TimelineDay ruled items={items} showNow={isSameDay(currentDate, today)} label={`Eventos del día`} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </PlannerPage>
                <aside className="flex flex-col gap-8 pt-2">
                  {/* Notas adhesivas: el resumen con sus casillas marcadas y el tiempo por categoría */}
                  <StickyNote tone="warning" tilt={-1.8} delay={0.35} aria-labelledby="ag-sum">
                    <h2 id="ag-sum" className="text-heading-sm">Resumen del día</h2>
                    <p className="flex items-baseline gap-2">
                      <span className="font-mono text-display-sm font-bold tabular-nums">{doneN}<span className="text-on-surface-light">/{dayEvents.length}</span></span>
                      <span className="text-label-lg">bloques completados</span>
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
                    <p className="text-body-sm text-on-surface">{planned ? `${hm(planned)} planificadas` : 'Nada planificado'}</p>
                  </StickyNote>
                  <StickyNote tone="info" tilt={1.4} delay={0.5} aria-labelledby="ag-cats" className="gap-2.5">
                    <h2 id="ag-cats" className="text-heading-sm">Categorías</h2>
                    {byCat.length === 0 ? <p className="text-body-sm text-on-surface">Sin bloques con horario.</p> : byCat.map(([key, min]) => (
                      <div key={key} className="flex items-center gap-3"><span aria-hidden className={cn('h-5 w-2 rounded-sm', solidBg[catInfo(key).tone])} /><span className="flex-1 text-body-md">{catInfo(key).label}</span><span className="font-mono text-body-sm tabular-nums text-on-surface">{hm(min)}</span></div>
                    ))}
                  </StickyNote>
                </aside>
              </div>
            )}

            {view === 'week' && (
              <PlannerPage aria-label="Semana" className="flex flex-col gap-4 px-4 pb-6 md:px-7">
                <NavBar dir={dir} label={`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`} prevLabel="Semana anterior" nextLabel="Semana siguiente" onPrev={() => shift(-7)} onNext={() => shift(7)} />
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
                          aria-label={`${day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}, ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}`}
                          onClick={() => { setDir(day >= currentDate ? 1 : -1); setCurrentDate(day); setView('day'); }}
                          className="flex min-h-16 w-full flex-col gap-2 rounded-lg px-2 py-3 text-left transition-colors duration-300 hover:bg-warning/[.08] md:min-h-[260px] md:px-2.5"
                        >
                          <span aria-hidden className="flex items-center justify-between gap-2 md:flex-col md:items-start md:gap-1">
                            <Written delay={0.15 + di * 0.05}><span className="text-label-md text-on-surface-light">{day.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}</span></Written>
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
                          {evs.length > 4 && <span aria-hidden className="text-body-sm text-on-surface-light">+{evs.length - 4} más</span>}
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
                <PlannerPage aria-label="Mes" className="flex flex-col gap-4 px-4 pb-6 md:px-7">
                  <NavBar dir={dir} label={upper1(currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))} prevLabel="Mes anterior" nextLabel="Mes siguiente" onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div key={`${currentDate.getFullYear()}-${currentDate.getMonth()}`} custom={dir} variants={flip} initial="enter" animate="center" exit="leave" style={{ transformPerspective: 1200, originY: 0 }}>
                  <MonthGrid
                    month={currentDate} selected={currentDate} onSelect={setCurrentDate}
                    dots={(d) => events.filter((e) => isEventOnDay(e, d)).map((e) => catInfo(e.category).tone)}
                    describe={(d) => { const n = events.filter((e) => isEventOnDay(e, d)).length; return `${n} ${n === 1 ? 'evento' : 'eventos'}`; }}
                  />
                  </motion.div>
                  </AnimatePresence>
                </PlannerPage>
                <PlannerPage rings={false} aria-labelledby="ag-sel" className="flex flex-col gap-2 p-6">
                  <h2 id="ag-sel" className="text-heading-sm">{upper1(currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
                  {dayEvents.length === 0 ? <p className="py-2 text-body-md text-on-surface-light">Sin eventos este día.</p> : (
                    <ul key={currentDate.toDateString()}>{dayEvents.map((e, i) => <EventRow key={e.id} index={i} event={e} pending={toggling === e.id} onEdit={() => setEditingEvent(e)} onToggle={() => void handleToggle(e)} />)}</ul>
                  )}
                </PlannerPage>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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
