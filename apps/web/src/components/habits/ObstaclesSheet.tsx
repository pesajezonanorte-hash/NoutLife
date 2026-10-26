// Obstáculos (anti-hábitos) dentro de la libreta de Hábitos: lo que quieres
// dejar o evitar, anotado en su propia hoja. Cada línea registra una tentación
// resistida o una caída con un toque; al abrirla se ven las caídas de hoy, la
// semana y el mes, la serie de 30 días, y se edita, deshace o archiva sin salir
// de la libreta.
import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Archive, ChevronDown, Pencil, Plus, ShieldAlert, ShieldCheck, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useToast } from '@/hooks/useToast';
import * as antiHabits from '@/services/antiHabit.service';
import type { AntiHabit } from '@/services/antiHabit.service';
import { Badge, BarChart, Button, EmptyState, ErrorState, Field, IconChip, Input, Modal, PageLoader, SegmentedControl, type BarDatum } from '@/components/ui/lq';
import { NotebookSheet } from './NotebookSheet';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

export type ObstaclePeriod = 'today' | 'week' | 'month';

const COPY: Copy<{
  periods: Record<ObstaclePeriod, string>;
  fall: (n: number) => string; resisted: (n: number) => string; clean: (n: number) => string;
  fallNote: string; resistNote: string; savedObstacle: string; savedBody: string; createdBody: string;
  saveFailed: string; createFailed: string; newObstacle: string; editObstacle: string; avoidQ: string; avoidPh: string;
  category: string; categoryPh: string; trigger: string; triggerPh: string; limit: string; limitHelp: string; limitPh: string;
  cancel: string; save: string; create: string; add: string;
  fallLogged: string; fallLoggedBody: string; resistedLogged: string; resistedLoggedBody: string;
  logFailed: string; undoneLast: string; undoFailed: string; archiveQ: (t: string) => string; archiveFailed: string; archived: string;
  removeQ: (t: string) => string; removeFailed: string; removed: string; superceded: string; overLimit: string;
  hide: string; viewDetail: string; daysOfWeek: string; fallsDay: string; resistedLabel: string; resistedTitle: string;
  edit: string; undoLast: string; archiveBtn: string; notePlural: string;
  summaryLine: (today: number, week: number, weekTarget: string, month: number) => string;
  chartLabel: (t: string) => string;
  period: string; newObstacleBtn: string; loading: string; loadFailed: string;
  emptyTitle: string; emptyBody: string; emptyCta: string;
  dayLabel: string;
  resistBtn: string; slipBtn: string; deleteLabel: (t: string) => string;
}> = {
  es: {
    periods: { today: 'Hoy', week: 'Semana', month: 'Mes' },
    fall: (n) => `${n} ${n === 1 ? 'caída' : 'caídas'}`,
    resisted: (n) => `${n} ${n === 1 ? 'tentación resistida' : 'tentaciones resistidas'}`,
    clean: (n) => `${n} ${n === 1 ? 'día' : 'días'} sin caer`,
    fallNote: 'Mañana es otro intento. Fíjate en qué la provocó.',
    resistNote: 'Cada vez que dices que no, se vuelve más fácil.',
    savedObstacle: 'Obstáculo guardado',
    savedBody: '',
    createdBody: 'Registra cada tentación que resistas.',
    saveFailed: 'No se pudo guardar el obstáculo',
    createFailed: 'No se pudo crear el obstáculo',
    newObstacle: 'Nuevo obstáculo',
    editObstacle: 'Editar obstáculo',
    avoidQ: '¿Qué quieres evitar?',
    avoidPh: 'Ej. Redes sociales después de las 23:00',
    category: 'Categoría',
    categoryPh: 'salud, dinero, pantallas…',
    trigger: 'Detonante (opcional)',
    triggerPh: 'Aburrimiento, estrés, después de cenar…',
    limit: 'Límite semanal (opcional)',
    limitHelp: 'Cuántas caídas a la semana aceptas como máximo.',
    limitPh: 'Ej. 2',
    cancel: 'Cancelar',
    save: 'Guardar',
    create: 'Crear',
    add: 'Anotar',
    fallLogged: 'Caída anotada',
    fallLoggedBody: 'Mañana es otro intento. Fíjate en qué la provocó.',
    resistedLogged: 'Tentación resistida',
    resistedLoggedBody: 'Cada vez que dices que no, se vuelve más fácil.',
    logFailed: 'No se pudo registrar',
    undoneLast: 'Último registro deshecho',
    undoFailed: 'No se pudo deshacer',
    archiveQ: (t) => `¿Archivar «${t}»? Sus registros se conservan.`,
    archiveFailed: 'No se pudo archivar',
    archived: 'Obstáculo archivado',
    removeQ: (t) => `¿Eliminar «${t}» para siempre? Se borran también sus registros.`,
    removeFailed: 'No se pudo eliminar',
    removed: 'Obstáculo eliminado',
    superceded: 'Obstáculo anotado',
    overLimit: '· superaste tu límite semanal',
    hide: 'Ocultar detalle',
    viewDetail: 'Ver detalle',
    daysOfWeek: 'semana',
    fallsDay: 'Caídas',
    resistedLabel: 'Resistidas',
    resistedTitle: 'Resistidas',
    edit: 'Editar',
    undoLast: 'Deshacer el último',
    archiveBtn: 'Archivar',
    notePlural: 'caídas',
    summaryLine: (today, week, weekTarget, month) => `Hoy ${today} · semana ${week}${weekTarget} · mes ${month} caídas`,
    chartLabel: (t) => `Caídas diarias de ${t} en los últimos 30 días`,
    period: 'Periodo',
    newObstacleBtn: 'Nuevo obstáculo',
    loading: 'Cargando tus obstáculos…',
    loadFailed: 'No pudimos cargar tus obstáculos',
    emptyTitle: 'Sin obstáculos anotados',
    emptyBody: 'Anota algo que quieras dejar (redes de noche, azúcar, fumar…) y registra cada tentación que resistas.',
    emptyCta: 'Anotar un obstáculo',
    dayLabel: 'Caídas',
    resistBtn: 'Resistí', slipBtn: 'Caí', deleteLabel: (t) => `Eliminar ${t}`,
  },
  en: {
    periods: { today: 'Today', week: 'Week', month: 'Month' },
    fall: (n) => `${n} ${n === 1 ? 'slip' : 'slips'}`,
    resisted: (n) => `${n} ${n === 1 ? 'temptation resisted' : 'temptations resisted'}`,
    clean: (n) => `${n} ${n === 1 ? 'day' : 'days'} clean`,
    fallNote: 'Tomorrow is another try. Notice what triggered it.',
    resistNote: 'Every time you say no, it gets easier.',
    savedObstacle: 'Obstacle saved',
    savedBody: '',
    createdBody: 'Log every temptation you resist.',
    saveFailed: "We couldn't save the obstacle",
    createFailed: "We couldn't create the obstacle",
    newObstacle: 'New obstacle',
    editObstacle: 'Edit obstacle',
    avoidQ: 'What do you want to avoid?',
    avoidPh: 'E.g. Social media after 11 p.m.',
    category: 'Category',
    categoryPh: 'health, money, screens…',
    trigger: 'Trigger (optional)',
    triggerPh: 'Boredom, stress, after dinner…',
    limit: 'Weekly limit (optional)',
    limitHelp: 'How many slips a week you accept at most.',
    limitPh: 'E.g. 2',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    add: 'Add',
    fallLogged: 'Slip logged',
    fallLoggedBody: 'Tomorrow is another try. Notice what triggered it.',
    resistedLogged: 'Temptation resisted',
    resistedLoggedBody: 'Every time you say no, it gets easier.',
    logFailed: "We couldn't log it",
    undoneLast: 'Last entry undone',
    undoFailed: "We couldn't undo it",
    archiveQ: (t) => `Archive “${t}”? Its entries are kept.`,
    archiveFailed: "We couldn't archive it",
    archived: 'Obstacle archived',
    removeQ: (t) => `Delete “${t}” forever? Its entries are deleted too.`,
    removeFailed: "We couldn't delete it",
    removed: 'Obstacle deleted',
    superceded: 'Obstacle added',
    overLimit: '· you went over your weekly limit',
    hide: 'Hide details',
    viewDetail: 'View details',
    daysOfWeek: 'week',
    fallsDay: 'Slips',
    resistedLabel: 'Resisted',
    resistedTitle: 'Resisted',
    edit: 'Edit',
    undoLast: 'Undo the last one',
    archiveBtn: 'Archive',
    notePlural: 'slips',
    summaryLine: (today, week, weekTarget, month) => `Today ${today} · week ${week}${weekTarget} · month ${month} slips`,
    chartLabel: (t) => `Daily slips for ${t} over the last 30 days`,
    period: 'Period',
    newObstacleBtn: 'New obstacle',
    loading: 'Loading your obstacles…',
    loadFailed: "We couldn't load your obstacles",
    emptyTitle: 'No obstacles noted',
    emptyBody: 'Note something you want to leave behind (late-night scrolling, sugar, smoking…) and log every temptation you resist.',
    emptyCta: 'Note an obstacle',
    dayLabel: 'Slips',
    resistBtn: 'Resisted', slipBtn: 'Slipped', deleteLabel: (t) => `Delete ${t}`,
  },
};

/** Periodos de la hoja de obstáculos en el idioma indicado. */
export function obstaclePeriodsFor(locale: Locale): { value: ObstaclePeriod; label: string }[] {
  const p = COPY[locale].periods;
  return (['today', 'week', 'month'] as const).map((value) => ({ value, label: p[value] }));
}

const row: Variants = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.12 } } };

type FormState = { title: string; category: string; cue: string; limit: string };
const EMPTY: FormState = { title: '', category: 'general', cue: '', limit: '' };
const formOf = (o: AntiHabit): FormState => ({ title: o.title, category: o.category, cue: o.cue ?? '', limit: o.targetPerWeek ? String(o.targetPerWeek) : '' });

/** Crear o editar un obstáculo (mismo formulario). */
export function ObstacleFormDialog({ open, obstacle, onClose, onSaved }: { open: boolean; obstacle: AntiHabit | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useText(COPY);
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  // Al abrir, el formulario arranca con el obstáculo (o vacío).
  const key = open ? obstacle?.id ?? 'new' : null;
  if (key !== seen) { setSeen(key); if (key) setForm(obstacle ? formOf(obstacle) : EMPTY); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const limit = Number(form.limit);
    const targetPerWeek = form.limit.trim() && Number.isInteger(limit) && limit >= 1 ? limit : null;
    try {
      if (obstacle) {
        await antiHabits.updateAntiHabit(obstacle.id, { title: form.title.trim(), category: form.category.trim() || 'general', cue: form.cue.trim() || null, targetPerWeek });
        toast.success(t.savedObstacle);
      } else {
        await antiHabits.createAntiHabit({ title: form.title.trim(), category: form.category.trim() || 'general', cue: form.cue.trim() || undefined, targetPerWeek: targetPerWeek ?? undefined });
        toast.success(t.superceded, t.createdBody);
      }
      await onSaved();
      onClose();
    } catch { toast.error(obstacle ? t.saveFailed : t.createFailed); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={obstacle ? t.editObstacle : t.newObstacle}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t.avoidQ}><Input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={100} placeholder={t.avoidPh} required /></Field>
        <Field label={t.category}><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} maxLength={32} placeholder={t.categoryPh} /></Field>
        <Field label={t.trigger}><Input value={form.cue} onChange={(e) => setForm((f) => ({ ...f, cue: e.target.value }))} maxLength={200} placeholder={t.triggerPh} /></Field>
        <Field label={t.limit} help={t.limitHelp}><Input type="number" inputMode="numeric" min={1} max={100} value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))} placeholder={t.limitPh} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" loading={saving} disabled={!form.title.trim()}>{obstacle ? t.save : <><Plus aria-hidden className="size-4" />{t.create}</>}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Una línea de la hoja: el obstáculo, sus registros rápidos y, al abrirla, su detalle. */
function ObstacleRow({ obstacle, period, onChanged, onEdit }: { obstacle: AntiHabit; period: ObstaclePeriod; onChanged: () => Promise<void>; onEdit: () => void }) {
  const locale = useLocale();
  const t = useText(COPY);
  const toast = useToast();
  const [busy, setBusy] = useState<'fall' | 'resist' | null>(null);
  const [open, setOpen] = useState(false);
  const m = obstacle.metrics;
  const current = m[period];
  const over = obstacle.targetPerWeek != null && m.week.falls > obstacle.targetPerWeek;
  const detailId = `obstacle-${obstacle.id}`;
  const bars: BarDatum[] = m.daily.map((d, i) => ({
    label: i % 5 === 0 || i === m.daily.length - 1 ? new Date(`${d.date}T12:00:00`).getDate().toString() : '',
    value: d.falls,
    tip: `${new Date(`${d.date}T12:00:00`).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short' })}: ${t.fall(d.falls)}, ${t.resisted(d.resisted)}`,
    highlight: i === m.daily.length - 1,
  }));

  async function log(occurred: boolean) {
    setBusy(occurred ? 'fall' : 'resist');
    try {
      await antiHabits.logAntiHabit(obstacle.id, { occurred });
      await onChanged();
      if (occurred) toast.info(t.fallLogged, t.fallLoggedBody);
      else toast.success(t.resistedLogged, t.resistedLoggedBody);
    } catch { toast.error(t.logFailed); }
    finally { setBusy(null); }
  }
  async function undoLast() {
    const last = obstacle.logs[0];
    if (!last) return;
    try { await antiHabits.deleteAntiHabitLog(last.id); await onChanged(); toast.info(t.undoneLast); }
    catch { toast.error(t.undoFailed); }
  }
  async function archive() {
    if (!window.confirm(t.archiveQ(obstacle.title))) return;
    try { await antiHabits.archiveAntiHabit(obstacle.id); await onChanged(); toast.info(t.archived); }
    catch { toast.error(t.archiveFailed); }
  }
  async function remove() {
    if (!window.confirm(t.removeQ(obstacle.title))) return;
    try { await antiHabits.deleteAntiHabitPermanently(obstacle.id); await onChanged(); toast.info(t.removed); }
    catch { toast.error(t.removeFailed); }
  }

  return (
    <motion.li variants={row} layout className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-info/25" />
      <div className="grid min-h-[calc(var(--lq-rule)*2)] grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 py-2 pr-2 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:gap-x-5 md:pr-4">
        <span className="flex justify-center"><IconChip icon={over ? ShieldAlert : ShieldCheck} tone={over ? 'error' : 'warning'} size="sm" /></span>
        <button
          type="button" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((o) => !o)}
          className="group flex min-h-11 min-w-0 flex-col items-start gap-0.5 rounded-md text-left"
        >
          <span className="flex min-w-0 max-w-full items-center gap-1.5">
            <span className="truncate text-body-md font-semibold text-on-background md:text-heading-sm">{obstacle.title}</span>
            <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-on-surface-light transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)]', open && 'rotate-180')} strokeWidth={1.75} />
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-light">
            <span className="capitalize">{obstacle.category}</span>
            {obstacle.cue && <span className="truncate">· {obstacle.cue}</span>}
            {m.daysClean !== null && <Badge variant={m.daysClean >= 7 ? 'success' : 'neutral'}>{t.clean(m.daysClean)}</Badge>}
            {over && <span className="text-error-text">{t.overLimit}</span>}
          </span>
          <span className="sr-only">{open ? t.hide : t.viewDetail}</span>
        </button>
        <div className="col-span-2 flex flex-wrap gap-2 pl-[3.75rem] md:col-span-1 md:pl-0">
          <Button variant="secondary" size="sm" loading={busy === 'resist'} onClick={() => void log(false)}><ShieldCheck aria-hidden className="size-4" />{t.resistBtn}</Button>
          <Button variant="ghost" size="sm" loading={busy === 'fall'} onClick={() => void log(true)} className="text-error-text"><ShieldAlert aria-hidden className="size-4" />{t.slipBtn}</Button>
          <Button variant="icon" aria-label={t.deleteLabel(obstacle.title)} onClick={() => void remove()} className="ml-auto text-on-surface-light md:ml-0"><Trash2 aria-hidden className="size-4" strokeWidth={1.75} /></Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={detailId}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: springs.natural }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="flex flex-col gap-4 pb-4 pl-[3.75rem] pr-3 md:pl-[6rem] md:pr-4"
          >
            <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-xl bg-error/[var(--lq-soft-alpha)] p-3">
                <dt className="text-body-sm text-error-text">{t.fallsDay} · {obstaclePeriodsFor(locale).find((p) => p.value === period)?.label.toLowerCase()}</dt>
                <dd className="font-mono text-heading-lg tabular-nums">{current.falls}</dd>
              </div>
              <div className="rounded-xl bg-success/[var(--lq-soft-alpha)] p-3">
                <dt className="text-body-sm text-success-text">{t.resistedLabel}</dt>
                <dd className="font-mono text-heading-lg tabular-nums">{current.resisted}</dd>
              </div>
            </dl>
            <p className="text-body-sm text-on-surface-light">
              {t.summaryLine(m.today.falls, m.week.falls, obstacle.targetPerWeek != null ? `/${obstacle.targetPerWeek}` : '', m.month.falls)}
            </p>
            <BarChart data={bars} label={t.chartLabel(obstacle.title)} tone="warning" highlightTone="error" height={80} />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit}><Pencil aria-hidden className="size-4" />{t.edit}</Button>
              {obstacle.logs.length > 0 && <Button variant="ghost" size="sm" onClick={() => void undoLast()}><Undo2 aria-hidden className="size-4" />{t.undoLast}</Button>}
              <Button variant="ghost" size="sm" onClick={() => void archive()} className="ml-auto"><Archive aria-hidden className="size-4" />{t.archiveBtn}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** La hoja de obstáculos. El estado vive en Hábitos (resumen del aside y contador de la pestaña). */
export function ObstaclesSheet({ list, state, period, onPeriod, onReload, onNew, onEdit, panelId, labelledBy }: {
  list: AntiHabit[];
  state: 'loading' | 'error' | 'ready';
  period: ObstaclePeriod;
  onPeriod: (p: ObstaclePeriod) => void;
  onReload: () => Promise<void>;
  onNew: () => void;
  onEdit: (o: AntiHabit) => void;
  panelId: string;
  labelledBy: string;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  return (
    <NotebookSheet
      id={panelId} labelledBy={labelledBy} tabbed
      header={(
        <>
          <SegmentedControl label={t.period} value={period} onChange={onPeriod} options={obstaclePeriodsFor(locale)} className="w-full md:max-w-[360px]" />
          <Button size="md" onClick={onNew}><Plus aria-hidden className="size-4" />{t.newObstacleBtn}</Button>
        </>
      )}
    >
      {state === 'loading' ? <PageLoader size="sm" label={t.loading} /> : state === 'error' ? (
        <ErrorState title={t.loadFailed} onRetry={() => void onReload()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ShieldAlert} tone="muted" className="py-12"
          title={t.emptyTitle}
          description={t.emptyBody}
          action={<Button onClick={onNew}><Plus aria-hidden className="size-4" />{t.emptyCta}</Button>}
        />
      ) : (
        <motion.ul key={period} initial="initial" animate="animate" variants={{ animate: { transition: { staggerChildren: 0.05 } } }} className="flex flex-col">
          <AnimatePresence initial={false}>
            {list.map((o) => <ObstacleRow key={o.id} obstacle={o} period={period} onChanged={onReload} onEdit={() => onEdit(o)} />)}
          </AnimatePresence>
        </motion.ul>
      )}
    </NotebookSheet>
  );
}
