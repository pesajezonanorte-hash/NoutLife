// Aprendizaje — LearningDesktop.dc.html. Biblioteca (KPIs count-up, estantería con
// portadas y filtros de estado) y Pomodoro real. Notas y vocabulario por ítem.
// Zona ambientada: una sala de lectura. Una estantería de madera con un estante
// por estado y su placa de latón; los libros se colocan deslizándose uno a uno
// (grosor según tamaño, marcapáginas según progreso) y asoman al pasar. En el
// escritorio, la lámpara de banquero ilumina tu ficha de lectura; el catálogo son
// fichas con sello. Terminar un libro lo lleva volando al estante de completados
// con un brillo. Polvo flotando bajo la luz. Todo lento.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Globe, Headphones, MonitorPlay, NotebookPen, Plus, TrendingUp, Video,
  type LucideIcon,
} from 'lucide-react';
import type { LearningItem, LearningStats } from '@noutlife/shared';
import { item, stagger } from '@/lib/motion';
import { AmbientLight, Particles, ZoneShell, useParticleBudget } from '@/components/ambience';
import { Bookcase, type Shelf } from '@/components/learning/Bookshelf';
import { BankerLamp, DeskLight, CatalogCard, ReadingCard, StatusStamp } from '@/components/learning/Library';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../hooks/useToast';
import { refreshUser } from '../../hooks/useAuth';
import * as learningService from '../../services/learning.service';
import { PomodoroTimer, NotesPanel, VocabPanel } from '../../components/learning/LearningExtras';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, ProgressBar, SegmentedControl, Select, type BadgeVariant, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { Lettering } from '@/components/layout/Lettering';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  types: { BOOK: 'Libro', COURSE: 'Curso', PODCAST: 'Podcast', VIDEO: 'Video', LANGUAGE: 'Idioma' } as Record<string, string>,
  statuses: { NOT_STARTED: 'Por empezar', IN_PROGRESS: 'En progreso', COMPLETED: 'Completado', ABANDONED: 'Abandonado' } as Record<string, string>,
  shelves: {
    IN_PROGRESS: { label: 'En progreso', empty: 'Empieza un libro o curso y aparecerá aquí.' },
    NOT_STARTED: { label: 'Por empezar', empty: 'Lo que agregues espera aquí su turno.' },
    COMPLETED: { label: 'Completados', empty: 'Aquí irán los que termines.' },
    ABANDONED: { label: 'Abandonados', empty: '' },
  } as Record<string, { label: string; empty: string }>,
  units: { BOOK: 'pág', COURSE: 'lecciones', other: 'unidades' },
  itemAdded: '¡Ítem agregado!',
  addFail: 'Error al agregar',
  addTitle: 'Agregar a tu biblioteca',
  addDesc: 'Elige el formato y guarda algo que quieras estudiar, leer o escuchar.',
  format: 'Formato',
  titleField: 'Título',
  titlePh: 'Ej. Hábitos atómicos',
  authorField: 'Autor o plataforma (opcional)',
  authorPh: 'Ej. James Clear o Coursera',
  pagesField: 'Total de páginas (opcional)',
  pagesPh: 'Ej. 320',
  cancel: 'Cancelar',
  add: 'Agregar',
  updateFail: 'Error al actualizar',
  itemDone: '¡Ítem completado!',
  xpGained: (xp: number): string => `+${xp} XP`,
  progressTitle: 'Actualizar progreso',
  progressField: (total: number): string => `Progreso actual de ${total}`,
  currentPage: 'Página actual',
  progress: 'Progreso',
  percent: (p: number): string => `${p}%`,
  status: 'Estado',
  save: 'Guardar',
  filters: { all: 'Todos', IN_PROGRESS: 'En progreso', NOT_STARTED: 'Por empezar', COMPLETED: 'Completados' } as Record<string, string>,
  eyebrow: 'Aprendizaje',
  title: 'Biblioteca',
  subtitle: 'Reúne lo que quieres aprender y vuelve a ello con claridad.',
  sageQ: '¿Qué debería estudiar o leer ahora dado lo que llevo en la Biblioteca?',
  sageLabel: 'Recomendación del Sabio',
  add2: 'Agregar',
  view: 'Vista',
  tabLibrary: 'Biblioteca',
  tabPomodoro: 'Pomodoro',
  back: 'Volver',
  notes: 'Notas',
  vocab: 'Vocabulario',
  contentOf: 'Contenido del ítem',
  loadingLib: 'Abriendo la biblioteca…',
  loadFail: 'No pudimos cargar tu biblioteca',
  loadFailDesc: 'Tus libros y cursos siguen guardados. Revisa tu conexión e inténtalo de nuevo.',
  shelfTitle: 'Tu estantería',
  kpiInProgress: 'En progreso',
  kpiCompleted: 'Completados',
  kpiYear: 'Este año',
  kpiPages: 'Páginas leídas',
  catalog: 'Catálogo',
  statusFilter: 'Estado',
  readyTitle: 'Tu biblioteca está lista',
  readyDesc: 'Agrega un libro, curso o idioma para convertir lo que quieres aprender en progreso visible.',
  addToLibrary: 'Agregar a mi biblioteca',
  nothingHere: 'Nada en esta sección',
  nothingHereDesc: 'Agrega un libro o curso para empezar.',
  seeAll: 'Ver todos',
  progressOf: (title: string): string => `Progreso de ${title}`,
  progressLine: (cur: number, tot: number, unit: string, pct: number): string => `${cur}/${tot} ${unit} · ${pct}%`,
  noGoal: 'Sin meta de progreso',
  progressBtn: 'Progreso',
  notesBtn: 'Notas',
  shortTitle: (s: string): string => `${s}…`,
};

const en: typeof es = {
  types: { BOOK: 'Book', COURSE: 'Course', PODCAST: 'Podcast', VIDEO: 'Video', LANGUAGE: 'Language' } as Record<string, string>,
  statuses: { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', ABANDONED: 'Abandoned' } as Record<string, string>,
  shelves: {
    IN_PROGRESS: { label: 'In progress', empty: 'Start a book or course and it will appear here.' },
    NOT_STARTED: { label: 'Not started', empty: 'What you add waits here for its turn.' },
    COMPLETED: { label: 'Completed', empty: 'What you finish goes here.' },
    ABANDONED: { label: 'Abandoned', empty: '' },
  } as Record<string, { label: string; empty: string }>,
  units: { BOOK: 'pp', COURSE: 'lessons', other: 'units' },
  itemAdded: 'Item added!',
  addFail: 'Could not add',
  addTitle: 'Add to your library',
  addDesc: 'Pick the format and save something you want to study, read or listen to.',
  format: 'Format',
  titleField: 'Title',
  titlePh: 'E.g. Atomic Habits',
  authorField: 'Author or platform (optional)',
  authorPh: 'E.g. James Clear or Coursera',
  pagesField: 'Total pages (optional)',
  pagesPh: 'E.g. 320',
  cancel: 'Cancel',
  add: 'Add',
  updateFail: 'Could not update',
  itemDone: 'Item completed!',
  xpGained: (xp: number): string => `+${xp} XP`,
  progressTitle: 'Update progress',
  progressField: (total: number): string => `Current progress of ${total}`,
  currentPage: 'Current page',
  progress: 'Progress',
  percent: (p: number): string => `${p}%`,
  status: 'Status',
  save: 'Save',
  filters: { all: 'All', IN_PROGRESS: 'In progress', NOT_STARTED: 'Not started', COMPLETED: 'Completed' } as Record<string, string>,
  eyebrow: 'Learning',
  title: 'Library',
  subtitle: 'Gather what you want to learn and come back to it with clarity.',
  sageQ: 'What should I study or read now, given what I have in the Library?',
  sageLabel: 'Sage recommendation',
  add2: 'Add',
  view: 'View',
  tabLibrary: 'Library',
  tabPomodoro: 'Pomodoro',
  back: 'Back',
  notes: 'Notes',
  vocab: 'Vocabulary',
  contentOf: 'Item content',
  loadingLib: 'Opening the library…',
  loadFail: 'We could not load your library',
  loadFailDesc: 'Your books and courses are still saved. Check your connection and try again.',
  shelfTitle: 'Your shelf',
  kpiInProgress: 'In progress',
  kpiCompleted: 'Completed',
  kpiYear: 'This year',
  kpiPages: 'Pages read',
  catalog: 'Catalog',
  statusFilter: 'Status',
  readyTitle: 'Your library is ready',
  readyDesc: 'Add a book, course or language to turn what you want to learn into visible progress.',
  addToLibrary: 'Add to my library',
  nothingHere: 'Nothing in this section',
  nothingHereDesc: 'Add a book or course to start.',
  seeAll: 'See all',
  progressOf: (title: string): string => `Progress of ${title}`,
  progressLine: (cur: number, tot: number, unit: string, pct: number): string => `${cur}/${tot} ${unit} · ${pct}%`,
  noGoal: 'No progress goal',
  progressBtn: 'Progress',
  notesBtn: 'Notes',
  shortTitle: (s: string): string => `${s}…`,
};

const COPY: Copy<typeof es> = { es, en };

const TYPE_META: Record<string, { icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  BOOK: { icon: BookOpen, tone: 'primary' },
  COURSE: { icon: MonitorPlay, tone: 'info' },
  PODCAST: { icon: Headphones, tone: 'forest' },
  VIDEO: { icon: Video, tone: 'warning' },
  LANGUAGE: { icon: Globe, tone: 'success' },
};
const STATUS_META: Record<string, { badge: BadgeVariant; bar: 'primary' | 'success' | 'warning' | 'error' }> = {
  NOT_STARTED: { badge: 'neutral', bar: 'primary' },
  IN_PROGRESS: { badge: 'primary', bar: 'primary' },
  COMPLETED: { badge: 'success', bar: 'success' },
  ABANDONED: { badge: 'error', bar: 'error' },
};

/** Sello de goma de cada estado en su ficha. */
const STAMP: Record<string, string> = {
  neutral: 'border-on-surface-light/50 text-on-surface-light', primary: 'border-primary-text/60 text-primary-text',
  success: 'border-success-text/60 text-success-text', error: 'border-error-text/60 text-error-text',
};
/** Un estante por estado (el de abandonados solo si hay alguno). */
const SHELF_IDS: LearningItem['status'][] = ['IN_PROGRESS', 'NOT_STARTED', 'COMPLETED', 'ABANDONED'];
const FILTER_IDS = ['all', 'IN_PROGRESS', 'NOT_STARTED', 'COMPLETED'];

const pctOf = (i: LearningItem) => (i.totalProgress > 0 ? Math.min(Math.round((i.currentProgress / i.totalProgress) * 100), 100) : 0);
const unitOf = (t: typeof es, i: LearningItem) => (i.type === 'BOOK' ? t.units.BOOK : i.type === 'COURSE' ? t.units.COURSE : t.units.other);

function AddItemModal({ onClose, onSave }: { onClose: () => void; onSave: (item: LearningItem) => void }) {
  const t = useText(COPY);
  const [type, setType] = useState('BOOK');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalProgress, setTotalProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const created = await learningService.createLearning({
        type, title, author: author || undefined, totalProgress: totalProgress ? Number(totalProgress) : 0,
      });
      onSave(created);
      toast.success(t.itemAdded);
    } catch {
      toast.error(t.addFail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.addTitle}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="-mt-2 text-body-sm text-on-surface-light">{t.addDesc}</p>
        <fieldset>
          <legend className="mb-2 text-label-lg text-on-surface">{t.format}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(TYPE_META).map(([key, m]) => {
              const on = type === key;
              return (
                <button
                  key={key} type="button" aria-pressed={on} onClick={() => setType(key)}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-label-lg transition-colors ${on ? 'border-primary/50 bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border bg-background text-on-surface hover:border-primary/40'}`}
                >
                  <m.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />{t.types[key]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label={t.titleField}><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePh} /></Field>
        <Field label={t.authorField}><Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t.authorPh} /></Field>
        {type === 'BOOK' && (
          <Field label={t.pagesField}><Input type="number" min="0" inputMode="numeric" value={totalProgress} onChange={(e) => setTotalProgress(e.target.value)} placeholder={t.pagesPh} /></Field>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={!title.trim()} loading={saving}>{t.add}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProgressModal({ item: it, onClose, onUpdate }: { item: LearningItem; onClose: () => void; onUpdate: (item: LearningItem) => void }) {
  const t = useText(COPY);
  const [progress, setProgress] = useState(String(it.currentProgress));
  const [status, setStatus] = useState(it.status);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { addFloatingXP } = useUIStore();

  async function save() {
    setSaving(true);
    try {
      const result = await learningService.updateLearning(it.id, { currentProgress: Number(progress), status });
      onUpdate(result.item);
      const xp = (result.rewards as { xpGained?: number } | null)?.xpGained;
      if (xp) {
        addFloatingXP(xp, window.innerWidth / 2, 200);
        toast.success(t.itemDone, t.xpGained(xp));
        void refreshUser();
      }
      onClose();
    } catch {
      toast.error(t.updateFail);
    } finally {
      setSaving(false);
    }
  }

  const pct = it.totalProgress > 0 ? Math.min((Number(progress) / it.totalProgress) * 100, 100) : 0;

  return (
    <Modal open onClose={onClose} title={t.progressTitle}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="-mt-2 text-body-md text-on-surface">{it.title}</p>
        {it.totalProgress > 0 && (
          <div className="flex flex-col gap-3">
            <Field label={t.progressField(it.totalProgress)}><Input type="number" min="0" inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value)} placeholder={t.currentPage} /></Field>
            <ProgressBar value={pct} label={t.progress} valueText={t.percent(Math.round(pct))} />
            <p className="text-right font-mono text-label-lg tabular-nums text-primary-text">{t.percent(Math.round(pct))}</p>
          </div>
        )}
        <Field label={t.status}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as LearningItem['status'])}>
            {Object.keys(STATUS_META).map((key) => <option key={key} value={key}>{t.statuses[key]}</option>)}
          </Select>
        </Field>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" className="flex-1" loading={saving}>{t.save}</Button>
        </div>
      </form>
    </Modal>
  );
}

type Mode = 'biblioteca' | 'pomodoro' | 'detalle';

export default function LearningPage() {
  const t = useText(COPY);
  const [items, setItems] = useState<LearningItem[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showAdd, setShowAdd] = useState(false);
  const [updating, setUpdating] = useState<LearningItem | null>(null);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState<Mode>('biblioteca');
  const [selectedItem, setSelectedItem] = useState<LearningItem | null>(null);
  const [detailTab, setDetailTab] = useState<'notas' | 'vocab'>('notas');
  /** Libro que se acaba de terminar: se cierra y vuelve al estante. */
  const [closing, setClosing] = useState<string | null>(null);
  const budget = useParticleBudget();
  /** La lámpara del escritorio (su cadena la enciende o la apaga). */
  const [lamp, setLamp] = useState(true);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [it, st] = await Promise.all([learningService.fetchLearning(), learningService.fetchLearningStats()]);
      setItems(it);
      setStats(st);
      setState('ready');
    } catch { setState('error'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const reading = items.find((i) => i.status === 'IN_PROGRESS');
  const modes = useMemo(() => [
    { value: 'biblioteca' as const, label: t.tabLibrary },
    { value: 'pomodoro' as const, label: t.tabPomodoro },
    ...(selectedItem ? [{ value: 'detalle' as const, label: selectedItem.title.length > 18 ? t.shortTitle(selectedItem.title.slice(0, 17)) : selectedItem.title }] : []),
  ], [selectedItem, t]);

  const openDetail = (it: LearningItem) => { setSelectedItem(it); setTab('detalle'); setDetailTab('notas'); };

  const kpis = stats ? [
    { label: t.kpiInProgress, value: stats.inProgress },
    { label: t.kpiCompleted, value: stats.totalCompleted },
    { label: t.kpiYear, value: stats.completedThisYear },
    { label: t.kpiPages, value: stats.totalPages },
  ] : [];
  const toBook = (b: LearningItem) => ({ item: b, tone: (TYPE_META[b.type] ?? TYPE_META.BOOK).tone, label: t.statuses[b.status] ?? t.statuses.NOT_STARTED, pct: pctOf(b) });
  const shelves: Shelf[] = SHELF_IDS
    .map((id) => ({ id, label: t.shelves[id].label, empty: t.shelves[id].empty, books: items.filter((i) => i.status === id).map(toBook) }))
    .filter((sh) => sh.id !== 'ABANDONED' || sh.books.length > 0);

  return (
    <ZoneShell
      zone="learning"
      contentClassName="gap-6 md:gap-8"
      ambience={<AmbientLight tone="warning" alpha={0.12} darkAlpha={0.07} d={18} className="right-[-6%] top-[-8%] h-[34rem] w-[46%]" />}
      view={(
        // Motas de polvo que flotan despacio bajo la lámpara.
        <Particles
          count={budget(14)} kind="drift" seed={23} x={[52, 98]} y={[4, 60]} duration={[14, 24]} alpha={[0.2, 0.45]} size={[1.5, 3]} sx={[-20, 20]} sy={[-26, 14]}
          render={(sz) => <span className="block rounded-full bg-warning" style={{ width: sz, height: sz }} />}
        />
      )}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">{t.eyebrow}</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.title} /></h1>
          <p className="text-body-lg text-on-surface-light">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SageContextButton message={t.sageQ} label={t.sageLabel} />
          <Button onClick={() => setShowAdd(true)}><Plus aria-hidden className="size-4" />{t.add2}</Button>
        </div>
      </motion.section>

      <motion.div variants={item} className="w-full max-w-[360px]">
        <SegmentedControl
          options={modes} value={tab} label={t.view}
          onChange={(v) => { setTab(v); if (v !== 'detalle') setSelectedItem(null); }}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6 md:gap-8">
          {tab === 'pomodoro' && <PomodoroTimer itemTitle={reading?.title} />}

          {tab === 'detalle' && selectedItem && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => { setTab('biblioteca'); setSelectedItem(null); }}><ArrowLeft aria-hidden className="size-4" />{t.back}</Button>
                <h2 className="min-w-0 truncate text-heading-md">{selectedItem.title}</h2>
              </div>
              <SegmentedControl options={[{ value: 'notas', label: t.notes }, { value: 'vocab', label: t.vocab }]} value={detailTab} onChange={setDetailTab} label={t.contentOf} className="max-w-[320px]" />
              {detailTab === 'notas' ? <NotesPanel itemId={selectedItem.id} /> : <VocabPanel itemId={selectedItem.id} />}
            </div>
          )}

          {tab === 'biblioteca' && (
            state === 'loading' ? (
              <PageLoader label={t.loadingLib} words={LOADING_COPY.learning} />
            ) : state === 'error' ? (
              <ErrorState title={t.loadFail} description={t.loadFailDesc} onRetry={() => void load()} />
            ) : (
              <>
                <section className="flex flex-col gap-6" aria-labelledby="lib-shelf">
                  <h2 id="lib-shelf" className="text-heading-lg">{t.shelfTitle}</h2>
                  <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
                    <Bookcase shelves={shelves} onPick={setUpdating} closing={closing} />
                    {/* El escritorio: la lámpara ilumina tu ficha de lectura */}
                    {stats && (
                      <div className="relative mx-auto flex w-full max-w-[19rem] flex-col overflow-x-clip pt-2">
                        <BankerLamp on={lamp} onToggle={() => setLamp((v) => !v)} className="relative z-10 -mb-3 mr-1 w-40 self-end" />
                        {/* El escritorio de madera, con la ficha apoyada encima */}
                        <div className="lq-wood lq-desk rounded-lg p-4 pb-5">
                          <ReadingCard rows={kpis} className="-rotate-1" />
                        </div>
                        <DeskLight on={lamp} />
                      </div>
                    )}
                  </div>
                </section>

                <section className="flex flex-col gap-6" aria-labelledby="lib-catalog">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h2 id="lib-catalog" className="text-heading-lg">{t.catalog}</h2>
                    <SegmentedControl options={FILTER_IDS.map((id) => ({ value: id, label: t.filters[id] }))} value={filter} onChange={setFilter} label={t.statusFilter} className="w-full overflow-x-auto sm:max-w-[520px]" />
                  </div>

                  {items.length === 0 ? (
                    <Card variant="elevated" padding="lg">
                      <EmptyState icon={BookOpen} title={t.readyTitle} description={t.readyDesc}
                        action={<Button onClick={() => setShowAdd(true)}><Plus aria-hidden className="size-4" />{t.addToLibrary}</Button>} className="py-6" />
                    </Card>
                  ) : filtered.length === 0 ? (
                    <EmptyState icon={BookOpen} title={t.nothingHere} description={t.nothingHereDesc}
                      action={<Button variant="secondary" onClick={() => setFilter('all')}>{t.seeAll}</Button>} className="py-10" />
                  ) : (
                    <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filtered.map((b) => {
                        const meta = TYPE_META[b.type] ?? TYPE_META.BOOK;
                        const s = STATUS_META[b.status] ?? STATUS_META.NOT_STARTED;
                        const pct = pctOf(b);
                        return (
                          <motion.li key={b.id} variants={item}>
                            <CatalogCard edge={`var(--lq-${meta.tone})`} aria-labelledby={`bk-${b.id}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-mono text-label-md text-on-surface-light"><meta.icon aria-hidden className="size-4" strokeWidth={1.75} />{t.types[b.type] ?? t.types.BOOK}</span>
                                <StatusStamp label={t.statuses[b.status] ?? t.statuses.NOT_STARTED} tone={STAMP[s.badge] ?? STAMP.neutral} />
                              </div>
                              <div className="mt-2 flex flex-col gap-1">
                                <h3 id={`bk-${b.id}`} className="text-heading-sm">{b.title}</h3>
                                {(b.author || b.platform) && <p className="font-mono text-body-sm text-on-surface-light">{b.author ?? b.platform}</p>}
                              </div>
                              <div className="mt-auto flex flex-col gap-1.5">
                                {b.totalProgress > 0 && <ProgressBar value={pct} tone={s.bar} label={t.progressOf(b.title)} />}
                                <span className="font-mono text-body-sm tabular-nums text-on-surface-light">
                                  {b.totalProgress > 0 ? t.progressLine(b.currentProgress, b.totalProgress, unitOf(t, b), pct) : t.noGoal}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setUpdating(b)}><TrendingUp aria-hidden className="size-4" />{t.progressBtn}</Button>
                                <Button variant="ghost" size="sm" onClick={() => openDetail(b)}><NotebookPen aria-hidden className="size-4" />{t.notesBtn}</Button>
                              </div>
                            </CatalogCard>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </section>
              </>
            )
          )}
        </motion.div>
      </AnimatePresence>

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSave={(it) => { setItems((prev) => [it, ...prev]); setShowAdd(false); }} />}
      {updating && <ProgressModal item={updating} onClose={() => setUpdating(null)} onUpdate={(u) => {
        // Terminado ahora: el libro se cierra y vuelve al estante con un brillo.
        if (u.status === 'COMPLETED' && updating.status !== 'COMPLETED') { setClosing(u.id); window.setTimeout(() => setClosing(null), 2600); }
        setItems((prev) => prev.map((i) => (i.id === u.id ? u : i))); setUpdating(null);
      }} />}
    </ZoneShell>
  );
}
