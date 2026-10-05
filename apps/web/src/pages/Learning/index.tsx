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
import type { LearningItem, LearningStats } from '@lifequest/shared';
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

const TYPE_META: Record<string, { label: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  BOOK: { label: 'Libro', icon: BookOpen, tone: 'primary' },
  COURSE: { label: 'Curso', icon: MonitorPlay, tone: 'info' },
  PODCAST: { label: 'Podcast', icon: Headphones, tone: 'forest' },
  VIDEO: { label: 'Video', icon: Video, tone: 'warning' },
  LANGUAGE: { label: 'Idioma', icon: Globe, tone: 'success' },
};
const STATUS_META: Record<string, { label: string; badge: BadgeVariant; bar: 'primary' | 'success' | 'warning' | 'error' }> = {
  NOT_STARTED: { label: 'Por empezar', badge: 'neutral', bar: 'primary' },
  IN_PROGRESS: { label: 'En progreso', badge: 'primary', bar: 'primary' },
  COMPLETED: { label: 'Completado', badge: 'success', bar: 'success' },
  ABANDONED: { label: 'Abandonado', badge: 'error', bar: 'error' },
};

/** Sello de goma de cada estado en su ficha. */
const STAMP: Record<string, string> = {
  neutral: 'border-on-surface-light/50 text-on-surface-light', primary: 'border-primary-text/60 text-primary-text',
  success: 'border-success-text/60 text-success-text', error: 'border-error-text/60 text-error-text',
};
/** Un estante por estado (el de abandonados solo si hay alguno). */
const SHELVES: { id: LearningItem['status']; label: string; empty: string }[] = [
  { id: 'IN_PROGRESS', label: 'En progreso', empty: 'Empieza un libro o curso y aparecerá aquí.' },
  { id: 'NOT_STARTED', label: 'Por empezar', empty: 'Lo que agregues espera aquí su turno.' },
  { id: 'COMPLETED', label: 'Completados', empty: 'Aquí irán los que termines.' },
  { id: 'ABANDONED', label: 'Abandonados', empty: '' },
];

const pctOf = (i: LearningItem) => (i.totalProgress > 0 ? Math.min(Math.round((i.currentProgress / i.totalProgress) * 100), 100) : 0);
const unitOf = (i: LearningItem) => (i.type === 'BOOK' ? 'pág' : i.type === 'COURSE' ? 'lecciones' : 'unidades');

function AddItemModal({ onClose, onSave }: { onClose: () => void; onSave: (item: LearningItem) => void }) {
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
      toast.success('¡Ítem agregado!');
    } catch {
      toast.error('Error al agregar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Agregar a tu biblioteca">
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="-mt-2 text-body-sm text-on-surface-light">Elige el formato y guarda algo que quieras estudiar, leer o escuchar.</p>
        <fieldset>
          <legend className="mb-2 text-label-lg text-on-surface">Formato</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(TYPE_META).map(([key, m]) => {
              const on = type === key;
              return (
                <button
                  key={key} type="button" aria-pressed={on} onClick={() => setType(key)}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-left text-label-lg transition-colors ${on ? 'border-primary/50 bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border bg-background text-on-surface hover:border-primary/40'}`}
                >
                  <m.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />{m.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Título"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Hábitos atómicos" /></Field>
        <Field label="Autor o plataforma (opcional)"><Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Ej. James Clear o Coursera" /></Field>
        {type === 'BOOK' && (
          <Field label="Total de páginas (opcional)"><Input type="number" min="0" inputMode="numeric" value={totalProgress} onChange={(e) => setTotalProgress(e.target.value)} placeholder="Ej. 320" /></Field>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={!title.trim()} loading={saving}>Agregar</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProgressModal({ item: it, onClose, onUpdate }: { item: LearningItem; onClose: () => void; onUpdate: (item: LearningItem) => void }) {
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
        toast.success('¡Ítem completado!', `+${xp} XP`);
        void refreshUser();
      }
      onClose();
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  const pct = it.totalProgress > 0 ? Math.min((Number(progress) / it.totalProgress) * 100, 100) : 0;

  return (
    <Modal open onClose={onClose} title="Actualizar progreso">
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="-mt-2 text-body-md text-on-surface">{it.title}</p>
        {it.totalProgress > 0 && (
          <div className="flex flex-col gap-3">
            <Field label={`Progreso actual de ${it.totalProgress}`}><Input type="number" min="0" inputMode="numeric" value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="Página actual" /></Field>
            <ProgressBar value={pct} label="Progreso" valueText={`${Math.round(pct)}%`} />
            <p className="text-right font-mono text-label-lg tabular-nums text-primary-text">{Math.round(pct)}%</p>
          </div>
        )}
        <Field label="Estado">
          <Select value={status} onChange={(e) => setStatus(e.target.value as LearningItem['status'])}>
            {Object.entries(STATUS_META).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
          </Select>
        </Field>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

type Mode = 'biblioteca' | 'pomodoro' | 'detalle';
const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'NOT_STARTED', label: 'Por empezar' },
  { value: 'COMPLETED', label: 'Completados' },
];

export default function LearningPage() {
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
    { value: 'biblioteca' as const, label: 'Biblioteca' },
    { value: 'pomodoro' as const, label: 'Pomodoro' },
    ...(selectedItem ? [{ value: 'detalle' as const, label: selectedItem.title.length > 18 ? `${selectedItem.title.slice(0, 17)}…` : selectedItem.title }] : []),
  ], [selectedItem]);

  const openDetail = (it: LearningItem) => { setSelectedItem(it); setTab('detalle'); setDetailTab('notas'); };

  const kpis = stats ? [
    { label: 'En progreso', value: stats.inProgress },
    { label: 'Completados', value: stats.totalCompleted },
    { label: 'Este año', value: stats.completedThisYear },
    { label: 'Páginas leídas', value: stats.totalPages },
  ] : [];
  const toBook = (b: LearningItem) => ({ item: b, tone: (TYPE_META[b.type] ?? TYPE_META.BOOK).tone, label: (STATUS_META[b.status] ?? STATUS_META.NOT_STARTED).label, pct: pctOf(b) });
  const shelves: Shelf[] = SHELVES
    .map((sh) => ({ id: sh.id, label: sh.label, empty: sh.empty, books: items.filter((i) => i.status === sh.id).map(toBook) }))
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
          <span className="text-label-lg text-primary-text">Aprendizaje</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Biblioteca" /></h1>
          <p className="text-body-lg text-on-surface-light">Reúne lo que quieres aprender y vuelve a ello con claridad.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SageContextButton message="¿Qué debería estudiar o leer ahora dado lo que llevo en la Biblioteca?" label="Recomendación del Sabio" />
          <Button onClick={() => setShowAdd(true)}><Plus aria-hidden className="size-4" />Agregar</Button>
        </div>
      </motion.section>

      <motion.div variants={item} className="w-full max-w-[360px]">
        <SegmentedControl
          options={modes} value={tab} label="Vista"
          onChange={(v) => { setTab(v); if (v !== 'detalle') setSelectedItem(null); }}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6 md:gap-8">
          {tab === 'pomodoro' && <PomodoroTimer itemTitle={reading?.title} />}

          {tab === 'detalle' && selectedItem && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => { setTab('biblioteca'); setSelectedItem(null); }}><ArrowLeft aria-hidden className="size-4" />Volver</Button>
                <h2 className="min-w-0 truncate text-heading-md">{selectedItem.title}</h2>
              </div>
              <SegmentedControl options={[{ value: 'notas', label: 'Notas' }, { value: 'vocab', label: 'Vocabulario' }]} value={detailTab} onChange={setDetailTab} label="Contenido del ítem" className="max-w-[320px]" />
              {detailTab === 'notas' ? <NotesPanel itemId={selectedItem.id} /> : <VocabPanel itemId={selectedItem.id} />}
            </div>
          )}

          {tab === 'biblioteca' && (
            state === 'loading' ? (
              <PageLoader label="Abriendo la biblioteca…" words={LOADING_COPY.learning} />
            ) : state === 'error' ? (
              <ErrorState title="No pudimos cargar tu biblioteca" description="Tus libros y cursos siguen guardados. Revisa tu conexión e inténtalo de nuevo." onRetry={() => void load()} />
            ) : (
              <>
                <section className="flex flex-col gap-6" aria-labelledby="lib-shelf">
                  <h2 id="lib-shelf" className="text-heading-lg">Tu estantería</h2>
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
                    <h2 id="lib-catalog" className="text-heading-lg">Catálogo</h2>
                    <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} label="Estado" className="w-full overflow-x-auto sm:max-w-[520px]" />
                  </div>

                  {items.length === 0 ? (
                    <Card variant="elevated" padding="lg">
                      <EmptyState icon={BookOpen} title="Tu biblioteca está lista" description="Agrega un libro, curso o idioma para convertir lo que quieres aprender en progreso visible."
                        action={<Button onClick={() => setShowAdd(true)}><Plus aria-hidden className="size-4" />Agregar a mi biblioteca</Button>} className="py-6" />
                    </Card>
                  ) : filtered.length === 0 ? (
                    <EmptyState icon={BookOpen} title="Nada en esta sección" description="Agrega un libro o curso para empezar."
                      action={<Button variant="secondary" onClick={() => setFilter('all')}>Ver todos</Button>} className="py-10" />
                  ) : (
                    <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filtered.map((b) => {
                        const t = TYPE_META[b.type] ?? TYPE_META.BOOK;
                        const s = STATUS_META[b.status] ?? STATUS_META.NOT_STARTED;
                        const pct = pctOf(b);
                        return (
                          <motion.li key={b.id} variants={item}>
                            <CatalogCard edge={`var(--lq-${t.tone})`} aria-labelledby={`bk-${b.id}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-mono text-label-md text-on-surface-light"><t.icon aria-hidden className="size-4" strokeWidth={1.75} />{t.label}</span>
                                <StatusStamp label={s.label} tone={STAMP[s.badge] ?? STAMP.neutral} />
                              </div>
                              <div className="mt-2 flex flex-col gap-1">
                                <h3 id={`bk-${b.id}`} className="text-heading-sm">{b.title}</h3>
                                {(b.author || b.platform) && <p className="font-mono text-body-sm text-on-surface-light">{b.author ?? b.platform}</p>}
                              </div>
                              <div className="mt-auto flex flex-col gap-1.5">
                                {b.totalProgress > 0 && <ProgressBar value={pct} tone={s.bar} label={`Progreso de ${b.title}`} />}
                                <span className="font-mono text-body-sm tabular-nums text-on-surface-light">
                                  {b.totalProgress > 0 ? `${b.currentProgress}/${b.totalProgress} ${unitOf(b)} · ${pct}%` : 'Sin meta de progreso'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setUpdating(b)}><TrendingUp aria-hidden className="size-4" />Progreso</Button>
                                <Button variant="ghost" size="sm" onClick={() => openDetail(b)}><NotebookPen aria-hidden className="size-4" />Notas</Button>
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
