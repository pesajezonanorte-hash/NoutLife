// Agenda — AgendaDesktop.dc.html. Día (línea de tiempo con "ahora" y bloques completables),
// Semana, Mes y Google Calendar con estado. Servicios sin cambios (agenda.service).
// Zona ambientada: un calendario que transmite orden. Las celdas se colocan en
// cascada diagonal, hoy lleva un círculo dibujado y cambiar de mes, semana o día
// pasa la hoja como en un calendario de escritorio (hacia arriba o hacia abajo).
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar, CalendarCheck, ChevronLeft, ChevronRight, Check, Link2, MapPin, Pencil, Plus, RefreshCw, Trash2, Unplug,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { item, springs } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { useToast } from '../../hooks/useToast';
import * as agendaService from '../../services/agenda.service';
import type { AgendaEvent } from '../../services/agenda.service';
import { Badge, Button, Card, EmptyState, Field, IconChip, Input, MonthGrid, ProgressRing, ResponsiveDialog, SegmentedControl, Select, Switch, Textarea, TimelineDay, type TimelineItem, type Tone, PageLoader, DatePicker } from '@/components/ui/lq';
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

function EventActions({ event, onEdit, onToggle }: { event: AgendaEvent; onEdit: () => void; onToggle: () => void }) {
  if (event.eventType === 'habit') {
    return <Link to="/habits" className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-label-lg text-primary-text hover:underline"><Link2 aria-hidden className="size-4" />Hábitos</Link>;
  }
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button" aria-pressed={event.isCompleted}
        aria-label={`${event.isCompleted ? 'Desmarcar' : 'Completar'} ${event.title}`}
        onClick={onToggle}
        className={cn('flex size-11 items-center justify-center rounded-full border-2 transition-colors', event.isCompleted ? 'border-success bg-success text-on-primary' : 'border-border-strong text-transparent hover:border-success')}
      ><Check aria-hidden className="size-[18px]" strokeWidth={2.5} /></button>
      <Button variant="icon" aria-label={`Editar ${event.title}`} onClick={onEdit}><Pencil aria-hidden className="size-[18px]" strokeWidth={1.75} /></Button>
    </div>
  );
}

function EventBlock({ event, onEdit, onToggle }: { event: AgendaEvent; onEdit: () => void; onToggle: () => void }) {
  const cat = catInfo(event.category);
  return (
    <article
      aria-label={event.title}
      className={cn('lq-lift flex h-full items-start gap-3 rounded-[14px] border border-border py-2.5 pl-4 pr-1 transition-opacity', event.isCompleted ? 'bg-surface opacity-80' : 'bg-background')}
    >
      <span aria-hidden className={cn('mt-2 size-2.5 shrink-0 rounded-full', solidBg[cat.tone])} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-label-lg', event.isCompleted ? 'text-on-surface-light line-through' : 'text-on-background')}>{event.title}</p>
        <p className="font-mono text-body-sm tabular-nums text-on-surface-light">{timeLabel(event)} · {cat.label}</p>
        {event.location && <p className="flex items-center gap-1 text-body-sm text-on-surface-light"><MapPin aria-hidden className="size-3.5" />{event.location}</p>}
      </div>
      <EventActions event={event} onEdit={onEdit} onToggle={onToggle} />
    </article>
  );
}

function EventRow({ event, onEdit, onToggle }: { event: AgendaEvent; onEdit: () => void; onToggle: () => void }) {
  const cat = catInfo(event.category);
  return (
    <li className="flex items-center gap-3 border-b border-border py-2 last:border-0">
      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', solidBg[cat.tone])} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-label-lg', event.isCompleted && 'text-on-surface-light line-through')}>{event.title}</p>
        <p className="text-body-sm text-on-surface-light">{timeLabel(event)} · {cat.label}{event.location ? ` · ${event.location}` : ''}</p>
        {event.eventType === 'habit' && <p className="text-body-sm text-primary-text">Hábito recurrente · se gestiona desde Hábitos</p>}
      </div>
      <EventActions event={event} onEdit={onEdit} onToggle={onToggle} />
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

function NavBar({ label, onPrev, onNext, prevLabel, nextLabel, dir = 0 }: { label: string; onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string; dir?: number }) {
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
            {label}
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
  const handleToggle = (event: AgendaEvent) => handleUpdate(event.id, { isCompleted: !event.isCompleted } as Partial<AgendaEvent>);

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

  const items: TimelineItem[] = timed.map((e) => ({
    id: e.id, start: minutesOf(e.startDate), duration: durationOf(e),
    render: <EventBlock event={e} onEdit={() => setEditingEvent(e)} onToggle={() => void handleToggle(e)} />,
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
      ambience={<span className="lq-tex-grid absolute inset-x-0 top-0 block h-[38rem] [mask-image:linear-gradient(to_bottom,#000,transparent)]" />}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">Agenda</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Tu tiempo, tus misiones</h1>
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {view === 'day' && (
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <Card as="section" padding="lg" aria-label="Día" className="flex flex-col gap-4">
                  <NavBar dir={dir} label={upper1(currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))} prevLabel="Día anterior" nextLabel="Día siguiente" onPrev={() => shift(-1)} onNext={() => shift(1)} />
                  {allDay.length > 0 && (
                    <ul aria-label="Todo el día" className="flex flex-wrap gap-2">
                      {allDay.map((e) => <li key={e.id}><button type="button" onClick={() => setEditingEvent(e)} className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-label-lg md:min-h-9', softTone[catInfo(e.category).tone])}>{e.title}<span className="sr-only">, todo el día. Editar</span></button></li>)}
                    </ul>
                  )}
                  {timed.length === 0 && allDay.length === 0 ? (
                    <EmptyState icon={CalendarCheck} title="Sin eventos este día" description="Pulsa «Evento» para agregar uno." className="py-10" action={<Button variant="secondary" onClick={() => setShowModal(true)}><Plus aria-hidden className="size-4" />Agregar evento</Button>} />
                  ) : (
                    <TimelineDay key={currentDate.toDateString()} items={items} showNow={isSameDay(currentDate, today)} label={`Eventos del día`} />
                  )}
                </Card>
                <aside className="flex flex-col gap-6">
                  <Card as="section" padding="lg" aria-labelledby="ag-sum" className="flex flex-col gap-4">
                    <h2 id="ag-sum" className="text-heading-sm">Resumen del día</h2>
                    <div className="flex items-center gap-5">
                      <ProgressRing value={dayEvents.length ? (doneN / dayEvents.length) * 100 : 0} tone="success" size={96} stroke={8} label="Bloques completados" valueText={`${doneN} de ${dayEvents.length}`}>
                        <span className="font-mono text-heading-sm font-bold tabular-nums">{doneN}/{dayEvents.length}</span>
                      </ProgressRing>
                      <div><p className="text-label-lg">Bloques completados</p><p className="text-body-sm text-on-surface-light">{planned ? `${hm(planned)} planificadas` : 'Nada planificado'}</p></div>
                    </div>
                  </Card>
                  <Card as="section" padding="lg" aria-labelledby="ag-cats" className="flex flex-col gap-3">
                    <h2 id="ag-cats" className="text-heading-sm">Categorías</h2>
                    {byCat.length === 0 ? <p className="text-body-sm text-on-surface-light">Sin bloques con horario.</p> : byCat.map(([key, min]) => (
                      <div key={key} className="flex items-center gap-3"><span aria-hidden className={cn('size-2.5 rounded-full', solidBg[catInfo(key).tone])} /><span className="flex-1 text-body-md">{catInfo(key).label}</span><span className="font-mono text-body-sm tabular-nums text-on-surface-light">{hm(min)}</span></div>
                    ))}
                  </Card>
                </aside>
              </div>
            )}

            {view === 'week' && (
              <Card as="section" padding="lg" aria-label="Semana" className="relative flex flex-col gap-4">
                <NavBar dir={dir} label={`${weekDays[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`} prevLabel="Semana anterior" nextLabel="Semana siguiente" onPrev={() => shift(-7)} onNext={() => shift(7)} />
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.ol key={weekDays[0].toDateString()} custom={dir} variants={flip} initial="enter" animate="center" exit="leave" style={{ transformPerspective: 1200, originY: 0 }} className="grid grid-cols-1 gap-3 md:grid-cols-7">
                  {weekDays.map((day, di) => {
                    const evs = events.filter((e) => isEventOnDay(e, day));
                    const isToday = isSameDay(day, today);
                    return (
                      <motion.li key={day.toISOString()} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...springs.natural, delay: 0.06 + di * 0.04 } }}>
                        <button
                          type="button" aria-current={isToday ? 'date' : undefined}
                          aria-label={`${day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}, ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}`}
                          onClick={() => { setCurrentDate(day); setView('day'); }}
                          className={cn('flex min-h-24 w-full flex-col gap-2 rounded-2xl p-3 text-left transition-colors md:min-h-[240px]', isToday ? 'bg-primary/[var(--lq-soft-alpha)]' : 'bg-surface-variant hover:bg-border')}
                        >
                          <span className="flex items-center justify-between"><span className="text-label-md uppercase text-on-surface">{day.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}</span><span className={cn('font-mono text-heading-sm tabular-nums', isToday && 'text-primary-text')}>{day.getDate()}</span></span>
                          {evs.slice(0, 4).map((e, k) => (
                            // Cada evento encaja en su franja: baja un poco y se asienta.
                            <motion.span key={e.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.25 + di * 0.04 + k * 0.05 } }} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-body-sm"><span aria-hidden className={cn('size-2 shrink-0 rounded-full', solidBg[catInfo(e.category).tone])} /><span className="truncate">{e.title}</span></motion.span>
                          ))}
                          {evs.length > 4 && <span className="text-body-sm text-on-surface-light">+{evs.length - 4} más</span>}
                        </button>
                      </motion.li>
                    );
                  })}
                </motion.ol>
                </AnimatePresence>
              </Card>
            )}

            {view === 'month' && (
              <div className="flex flex-col gap-6">
                <Card as="section" padding="lg" aria-label="Mes" className="relative flex flex-col gap-4">
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
                </Card>
                <Card as="section" padding="lg" aria-labelledby="ag-sel" className="flex flex-col gap-2">
                  <h2 id="ag-sel" className="text-heading-sm">{upper1(currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }))}</h2>
                  {dayEvents.length === 0 ? <p className="py-2 text-body-md text-on-surface-light">Sin eventos este día.</p> : (
                    <ul>{dayEvents.map((e) => <EventRow key={e.id} event={e} onEdit={() => setEditingEvent(e)} onToggle={() => void handleToggle(e)} />)}</ul>
                  )}
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {showModal && <EventModal defaultDate={defaultDate} onSave={handleCreate} onClose={() => setShowModal(false)} />}
      {editingEvent && (
        <EventModal initial={editingEvent} defaultDate={defaultDate} onSave={(d) => void handleUpdate(editingEvent.id, d as Partial<AgendaEvent>)}
          onDelete={editingEvent.eventType === 'habit' ? undefined : () => void handleDelete(editingEvent.id)} onClose={() => setEditingEvent(null)} />
      )}
    </ZoneShell>
  );
}
