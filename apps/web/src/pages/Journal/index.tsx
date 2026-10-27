// Diario — JournalDesktop.dc.html. Pregunta del día con editor inline + ánimo (5 caras),
// KPIs, entradas con búsqueda y filtro por ánimo, editar/eliminar.
// Zona ambientada: tu diario de cuero. Al llegar se suelta el elástico, la tapa
// gira sobre el lomo y se hojea hasta hoy: a la izquierda la fecha, la pregunta y
// tus notas (racha a palitos); a la derecha la página para escribir sobre
// renglones. El ánimo es un sello, guardar estampa el sello del día y cada entrada
// anterior es una hoja; borrar la tacha a mano y la arranca.
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, MessageCircle, PenLine, Plus, Search, Trash2, X } from 'lucide-react';
import type { JournalEntry, JournalStreak } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { AmbientLight, SketchStrike, SketchUnderline, TallyMarks, ZoneShell } from '@/components/ambience';
import { DayStamp } from '@/components/journal/Notebook';
import { DiaryBook, DiaryLeaf } from '@/components/journal/Diary';
import { useToast } from '../../hooks/useToast';
import { useDebounce } from '../../hooks/useDebounce';
import * as journalService from '../../services/journal.service';
import { relativeTime } from '../../lib/time';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { Badge, Button, Card, ChipGroup, EmptyState, ErrorState, Field, Input, MOODS, MoodFace, MoodPicker, ResponsiveDialog, Textarea, moodOf, moodNameOf, type ChipOption, PageLoader, DatePicker } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';
import { Lettering } from '@/components/layout/Lettering';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  prompts: [
    '¿Qué fue lo mejor que te pasó hoy?',
    '¿Qué aprendiste hoy que no sabías antes?',
    '¿Por qué tres cosas estás agradecido hoy?',
    '¿Qué harías diferente si pudieras repetir este día?',
    '¿Qué te dio energía hoy y qué te la quitó?',
    '¿Cuál fue el momento más difícil del día? ¿Cómo lo manejaste?',
    '¿Qué te acercó hoy a tu versión ideal de ti mismo?',
    '¿Qué conversación del día te quedó dando vueltas?',
    '¿Qué pequeño progreso celebras hoy?',
    '¿Qué harías si supieras que no puedes fallar?',
    '¿En qué área de tu vida quieres enfocar energía mañana?',
    '¿Qué consejo le darías hoy a una versión anterior de ti?',
  ],
  saved: 'Entrada guardada',
  saveFail: 'Error al guardar',
  deleteFail: 'Error al eliminar',
  autoSaved: (time: string): string => `Guardado automático · ${time}`,
  titleField: 'Título (opcional)',
  titlePh: 'Ej. Un día de foco',
  dateField: 'Fecha',
  reflection: 'Tu reflexión',
  counts: (c: number, w: number): string => `${c} caracteres · ${w} palabras`,
  writePh: 'Escribe con calma…',
  howFeel: '¿Cómo te sientes?',
  moodLabel: 'Ánimo de la entrada',
  tagsField: 'Etiquetas',
  tagHelp: 'Enter para añadir',
  tagPh: '#reflexión',
  addTag: 'Añadir etiqueta',
  removeTag: (tag: string): string => `Quitar etiqueta ${tag}`,
  cancel: 'Cancelar',
  saveEntry: 'Guardar entrada',
  todayPage: 'Página de hoy',
  editEntry: 'Editar entrada',
  title: 'Diario',
  tagline: 'Una pausa breve para registrar lo que importa de tu día.',
  sageQ: 'Dame un tema profundo para reflexionar hoy en mi diario.',
  sageLabel: 'Tema de reflexión',
  promptLabel: 'Pregunta del día',
  streak: 'Racha',
  dayRun: (n: number): string => (n === 1 ? 'día seguido' : 'días seguidos'),
  written: 'Escritas',
  pages: (n: number): string => (n === 1 ? 'página' : 'páginas'),
  lastMood: 'Último ánimo',
  whatToday: 'Lo que escribiste hoy',
  openToday: 'Abrir la de hoy',
  writtenToday: 'Hoy escrito',
  answer: 'Responder',
  notYet: 'Hoy aún no escribiste.',
  searchAria: 'Buscar en el diario',
  searchPh: 'Buscar en el diario…',
  entries: 'Entradas',
  filterMood: 'Filtrar por ánimo',
  all: 'Todos',
  loading: 'Abriendo tu diario…',
  loadFail: 'No pudimos cargar tu diario',
  readyTitle: 'Tu diario está listo',
  readyDesc: 'Escribe una primera idea, emoción o momento para empezar a construir tu historia.',
  firstEntry: 'Escribir mi primera entrada',
  noMood: 'Sin entradas con ese ánimo',
  noMoodDesc: 'Prueba otro filtro o escribe la de hoy.',
  clearFilters: 'Quitar filtros',
  moodAria: (name: string): string => `Ánimo: ${name}`,
  deleteAria: (title: string): string => `Eliminar ${title}`,
};

const en: typeof es = {
  prompts: [
    'What was the best thing that happened to you today?',
    'What did you learn today that you did not know before?',
    'What are three things you are grateful for today?',
    'What would you do differently if you could repeat this day?',
    'What gave you energy today, and what drained it?',
    'What was the hardest moment of the day? How did you handle it?',
    'What brought you closer to your ideal version of yourself today?',
    'Which conversation from today keeps coming back to you?',
    'What small progress are you celebrating today?',
    'What would you do if you knew you could not fail?',
    'Which area of your life do you want to focus your energy on tomorrow?',
    'What advice would you give today to an earlier version of yourself?',
  ],
  saved: 'Entry saved',
  saveFail: 'Could not save',
  deleteFail: 'Could not delete',
  autoSaved: (time: string): string => `Auto-saved · ${time}`,
  titleField: 'Title (optional)',
  titlePh: 'E.g. A focused day',
  dateField: 'Date',
  reflection: 'Your reflection',
  counts: (c: number, w: number): string => `${c} characters · ${w} words`,
  writePh: 'Write calmly…',
  howFeel: 'How are you feeling?',
  moodLabel: 'Entry mood',
  tagsField: 'Tags',
  tagHelp: 'Enter to add',
  tagPh: '#reflection',
  addTag: 'Add tag',
  removeTag: (tag: string): string => `Remove tag ${tag}`,
  cancel: 'Cancel',
  saveEntry: 'Save entry',
  todayPage: "Today's page",
  editEntry: 'Edit entry',
  title: 'Journal',
  tagline: 'A short pause to record what matters about your day.',
  sageQ: 'Give me a deep topic to reflect on today in my journal.',
  sageLabel: 'Reflection topic',
  promptLabel: 'Question of the day',
  streak: 'Streak',
  dayRun: (n: number): string => (n === 1 ? 'day in a row' : 'days in a row'),
  written: 'Written',
  pages: (n: number): string => (n === 1 ? 'page' : 'pages'),
  lastMood: 'Last mood',
  whatToday: 'What you wrote today',
  openToday: "Open today's",
  writtenToday: 'Written today',
  answer: 'Answer',
  notYet: "You haven't written today yet.",
  searchAria: 'Search the journal',
  searchPh: 'Search the journal…',
  entries: 'Entries',
  filterMood: 'Filter by mood',
  all: 'All',
  loading: 'Opening your journal…',
  loadFail: "We couldn't load your journal",
  readyTitle: 'Your journal is ready',
  readyDesc: 'Write a first idea, feeling or moment to start building your story.',
  firstEntry: 'Write my first entry',
  noMood: 'No entries with that mood',
  noMoodDesc: "Try another filter or write today's.",
  clearFilters: 'Clear filters',
  moodAria: (name: string): string => `Mood: ${name}`,
  deleteAria: (title: string): string => `Delete ${title}`,
};

const COPY: Copy<typeof es> = { es, en };

const todayStr = () => new Date().toISOString().split('T')[0];

/** Formulario de entrada. Inline (nueva, hoy) o dentro del diálogo (editar). */
function EntryForm({ entry, onCancel, onSave, inline }: { entry?: JournalEntry; onCancel: () => void; onSave: (entry: JournalEntry) => void; inline?: boolean }) {
  const t = useText(COPY);
  const locale = useLocale();
  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [mood, setMood] = useState(entry?.mood ?? 4);
  const [date, setDate] = useState(entry?.date?.split('T')[0] ?? todayStr());
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  // Guardado automático solo al editar una entrada existente (30 s sin cambios).
  useEffect(() => {
    if (!entry) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (!entry.id || !content) return;
      try {
        await journalService.updateJournalEntry(entry.id, { title: title || undefined, content, mood, tags });
        setLastSaved(new Date());
      } catch { /* sin conexión: el guardado automático no interrumpe */ }
    }, 30000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [title, content, mood, tags, entry]);

  async function save() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const saved = entry?.id
        ? await journalService.updateJournalEntry(entry.id, { title: title || undefined, content, mood, date, tags })
        : await journalService.createJournalEntry({ title: title || undefined, content, mood, date, tags });
      onSave(saved);
      toast.success(t.saved);
    } catch {
      toast.error(t.saveFail);
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const nextTag = tagInput.trim().replace(/^#/, '');
    if (nextTag && !tags.includes(nextTag)) setTags((c) => [...c, nextTag]);
    setTagInput('');
  }

  const words = content.split(/\s+/).filter(Boolean).length;

  return (
    <form className={'flex flex-col gap-4'} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {lastSaved && <p role="status" className="rounded-md bg-surface-variant px-3 py-2 text-body-sm text-on-surface">{t.autoSaved(lastSaved.toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' }))}</p>}
      <Field label={t.titleField}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePh} /></Field>
      {!inline && <Field label={t.dateField}><DatePicker value={date} onChange={setDate} /></Field>}
      <Field label={t.reflection} help={t.counts(content.length, words)}>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t.writePh} rows={inline ? 5 : 8} autoFocus={!entry} className="lq-tex-ruled resize-y bg-transparent leading-[1.75rem] [--lq-rule:1.75rem] [background-attachment:local] focus:bg-transparent" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">{t.howFeel} <span className="text-on-background">{moodNameOf(mood, locale)}</span></legend>
        <MoodPicker value={mood} onChange={setMood} label={t.moodLabel} />
      </fieldset>
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <Field label={t.tagsField} help={t.tagHelp} className="flex-1">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())} placeholder={t.tagPh} />
          </Field>
          <Button type="button" variant="secondary" aria-label={t.addTag} onClick={addTag} className="mb-[1.625rem] shrink-0 px-3"><Plus aria-hidden className="size-4" /></Button>
        </div>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <button type="button" aria-label={t.removeTag(tag)} onClick={() => setTags((c) => c.filter((x) => x !== tag))}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-variant px-3 text-label-lg text-on-surface hover:bg-error/[var(--lq-soft-alpha)] hover:text-error-text md:min-h-9">
                  #{tag}<X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>{t.cancel}</Button>
        <Button type="submit" size="md" disabled={!content.trim()} loading={saving}>{t.saveEntry}</Button>
      </div>
    </form>
  );
}

export default function JournalPage() {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState('all');
  /** La página de hoy recibe el sello al guardar. */
  const [stamped, setStamped] = useState(false);
  /** Entradas que se están tachando antes de desaparecer. */
  const [striking, setStriking] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(search, 300);
  const todayPrompt = t.prompts[new Date().getDate() % t.prompts.length];
  const todayLabel = new Date().toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\p{L}/u, (c) => c.toUpperCase());

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [e, s] = await Promise.all([journalService.fetchJournal({ search: debouncedSearch || undefined }), journalService.fetchJournalStreak()]);
      setEntries(e);
      setStreak(s);
      setState('ready');
    } catch { if (!silent) setState('error'); }
  }, [debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  function handleSaved(entry: JournalEntry) {
    if (entry.date.split('T')[0] === todayStr()) setStamped(true);
    setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev]));
    setComposing(false);
    setEditing(null);
    void load(true);
  }

  async function handleDelete(id: string) {
    // Primero se tacha a mano; luego la entrada se va.
    setStriking((prev) => new Set(prev).add(id));
    await new Promise((r) => setTimeout(r, 380));
    setStriking((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try { await journalService.deleteJournalEntry(id); }
    catch { toast.error(t.deleteFail); void load(true); }
  }

  const todayEntry = entries.find((e) => e.date.split('T')[0] === todayStr());
  const shown = moodFilter === 'all' ? entries : entries.filter((e) => e.mood === Number(moodFilter));
  const lastMood = entries[0]?.mood;
  const filterOptions: ChipOption<string>[] = [{ value: 'all', label: t.all }, ...MOODS.map((m) => ({ value: String(m.n), label: moodNameOf(m.n, locale) }))];
  const streakDays = streak?.currentStreak ?? 0;
  const longDate = (d: string) => new Date(d).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\p{L}/u, (c) => c.toUpperCase());

  return (
    <ZoneShell
      zone="journal"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        <>
          {/* La lámpara del escritorio: luz cálida sobre el diario */}
          <AmbientLight tone="warning" alpha={0.1} darkAlpha={0.07} d={16} className="-left-[8%] top-[-6%] h-[32rem] w-[60%]" />
          <AmbientLight tone="secondary" alpha={0.09} darkAlpha={0.07} d={19} className="left-[12%] top-[14%] h-[38rem] w-[78%]" />
        </>
      )}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <h1 className="relative self-start text-display-sm md:text-display-md lg:text-display-lg">
            <Lettering text={t.title} />
            <SketchUnderline className="absolute -bottom-1.5 left-0 w-full text-info md:-bottom-2.5" delay={0.75} />
          </h1>
          <p className="text-body-lg text-on-surface-light">{t.tagline}</p>
        </div>
        <SageContextButton message={t.sageQ} label={t.sageLabel} />
      </motion.section>

      <motion.section variants={item} aria-labelledby="j-prompt" className="pb-12">
        <DiaryBook
          pages={entries.length}
          left={(
            <div className="flex h-full flex-col gap-5 px-6 py-7 pl-8 md:px-10 md:py-9 lg:pr-14">
              <span className="relative self-start text-label-lg text-on-surface">
                <span className="lq-write inline-block" style={{ '--d': '650ms', '--delay': '1.2s' } as CSSProperties}>{todayLabel}</span>
                <SketchUnderline className="absolute -bottom-2 left-0 w-full text-on-surface-light" delay={1.7} duration={0.5} strokeWidth={1.6} />
              </span>
              <span id="j-prompt" className="mt-2 flex items-center gap-2 text-label-lg text-primary-text"><MessageCircle aria-hidden className="size-4" />{t.promptLabel}</span>
              <p className="lq-write text-heading-lg [text-wrap:balance] md:text-display-sm" style={{ '--d': '1000ms', '--delay': '1.45s' } as CSSProperties}>“{todayPrompt}”</p>
              {/* Notas al pie de la página: racha a palitos, páginas escritas y último ánimo */}
              <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-dashed border-on-background/15 pt-5 md:gap-6">
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-md text-on-surface-light">{t.streak}</dt>
                  <dd className="flex flex-col gap-1">
                    {streakDays > 0 && <TallyMarks count={streakDays} />}
                    <span className="text-label-lg text-on-background"><span className="font-mono">{streakDays}</span> {t.dayRun(streakDays)}</span>
                  </dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-md text-on-surface-light">{t.written}</dt>
                  <dd className="text-label-lg text-on-background"><span className="font-mono text-heading-md">{entries.length}</span> {t.pages(entries.length)}</dd>
                </div>
                <div className="flex flex-col gap-1.5">
                  <dt className="text-label-md text-on-surface-light">{t.lastMood}</dt>
                  <dd className="flex items-center gap-2 text-label-lg text-on-background"><MoodFace mood={lastMood ?? 3} className="size-6 text-on-surface" />{lastMood ? moodNameOf(lastMood, locale) : '—'}</dd>
                </div>
              </dl>
            </div>
          )}
          right={(
            <div className="relative flex h-full min-h-[22rem] flex-col gap-4 px-6 py-7 pl-8 md:px-10 md:py-9 lg:pl-16">
              {composing ? (
                <>
                  <span className="text-label-lg text-on-surface-light">{t.todayPage}</span>
                  <EntryForm inline onCancel={() => setComposing(false)} onSave={handleSaved} />
                </>
              ) : todayEntry ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-label-lg text-on-surface-light">{t.whatToday}</span>
                      {todayEntry.title && <h3 className="text-heading-md">{todayEntry.title}</h3>}
                    </div>
                    <DayStamp mood={todayEntry.mood ?? 3} date={new Date()} animate={stamped} className="-mr-1 -mt-1" />
                  </div>
                  <p className="lq-lines lq-write line-clamp-6 text-body-md leading-[var(--lq-rule)] text-on-surface [--lq-rule:1.75rem]" style={{ '--d': '900ms', '--delay': stamped ? '0ms' : '1.5s' } as CSSProperties}>{todayEntry.content}</p>
                  {todayEntry.tags.length > 0 && <ul className="flex flex-wrap gap-1.5">{todayEntry.tags.map((tag) => <li key={tag}><Badge variant="neutral">#{tag}</Badge></li>)}</ul>}
                  {/* El resto de la página sigue rayada */}
                  <span aria-hidden="true" className="lq-lines block min-h-[3.5rem] flex-1 [--lq-rule:1.75rem]" />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={() => setEditing(todayEntry)}>{t.openToday}</Button>
                    <Badge variant="success">{t.writtenToday}</Badge>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-label-lg text-on-surface-light">{t.todayPage}</span>
                  {/* La página en blanco, lista para escribir */}
                  <span aria-hidden="true" className="lq-lines block min-h-[10.5rem] flex-1 [--lq-rule:1.75rem]" />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Button onClick={() => setComposing(true)}><PenLine aria-hidden className="size-4" />{t.answer}</Button>
                    <span className="text-body-sm text-on-surface-light">{t.notYet}</span>
                  </div>
                </>
              )}
            </div>
          )}
        />
      </motion.section>

      <motion.section variants={item} className="flex flex-col gap-5" aria-labelledby="j-entries">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="j-entries" className="text-heading-lg">{t.entries}</h2>
          <div className="relative w-full sm:max-w-[360px]">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-on-surface-light" />
            <Input type="search" aria-label={t.searchAria} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPh} className="pl-11" />
          </div>
        </div>
        <ChipGroup label={t.filterMood} options={filterOptions} value={moodFilter} onChange={setMoodFilter} />

        {state === 'loading' ? (
          <PageLoader label={t.loading} words={LOADING_COPY.journal} size="sm" />
        ) : state === 'error' ? (
          <ErrorState title={t.loadFail} onRetry={() => void load()} />
        ) : entries.length === 0 ? (
          <Card variant="elevated" padding="lg">
            <EmptyState icon={BookOpen} title={t.readyTitle} description={t.readyDesc}
              action={<Button onClick={() => setComposing(true)}><Plus aria-hidden className="size-4" />{t.firstEntry}</Button>} className="py-6" />
          </Card>
        ) : shown.length === 0 ? (
          <EmptyState icon={BookOpen} tone="muted" title={t.noMood} description={t.noMoodDesc}
            action={<Button variant="secondary" onClick={() => { setMoodFilter('all'); setSearch(''); }}>{t.clearFilters}</Button>} className="py-10" />
        ) : (
          <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {shown.map((e, i) => {
                const m = moodOf(e.mood);
                const moodName = moodNameOf(e.mood ?? 3, locale);
                const date = longDate(e.date);
                const title = e.title ?? date;
                return (
                  <motion.li
                    key={e.id} variants={item} layout="position" className="group"
                    // Borrar arranca la hoja: se va girando hacia un lado.
                    exit={{ opacity: 0, x: 56, y: 14, rotate: 5, transition: { duration: 0.34, ease: [0.5, 0, 0.75, 0] } }}
                  >
                    <DiaryLeaf
                      stamp={(
                        // Sello de ánimo en el margen: anillo de tinta torcido
                        <span title={t.moodAria(moodName)} className={cn('flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed transition-transform duration-[560ms] ease-[var(--lq-ease-heavy)] group-hover:rotate-0', i % 2 ? 'rotate-[5deg]' : '-rotate-6', softTone[m.tone])}>
                          <MoodFace mood={m.n} label={t.moodAria(moodName)} />
                        </span>
                      )}
                      aside={<Button variant="icon" aria-label={t.deleteAria(title)} onClick={() => void handleDelete(e.id)} className="-mr-1 -mt-1"><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>}
                    >
                      {e.title && <span className="text-label-md text-on-surface-light">{date}</span>}
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <h3 className="relative text-heading-sm">
                          <button type="button" onClick={() => setEditing(e)} className="rounded-md text-left hover:underline hover:underline-offset-4">{title}</button>
                          {striking.has(e.id) && <SketchStrike className="text-error" duration={0.3} strokeWidth={2.4} />}
                        </h3>
                        <span className="text-body-sm text-on-surface-light" title={new Date(e.date).toLocaleDateString(INTL_LOCALE[locale], { dateStyle: 'long' })}>{relativeTime(e.date, locale)}</span>
                      </div>
                      <p className={cn('lq-lines lq-write line-clamp-2 text-body-md leading-[var(--lq-rule)] text-on-surface transition-opacity duration-300 [--lq-rule:1.75rem]', striking.has(e.id) && 'opacity-40')} style={{ '--d': '700ms', '--delay': `${250 + i * 90}ms` } as CSSProperties}>{e.content}</p>
                      {e.tags.length > 0 && <ul className="flex flex-wrap gap-1.5 pt-1">{e.tags.map((tag) => <li key={tag}><Badge variant="neutral">#{tag}</Badge></li>)}</ul>}
                    </DiaryLeaf>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </motion.section>

      <ResponsiveDialog open={!!editing} onClose={() => setEditing(null)} title={t.editEntry} className="max-w-[560px]">
        {editing && <EntryForm entry={editing} onCancel={() => setEditing(null)} onSave={handleSaved} />}
      </ResponsiveDialog>
    </ZoneShell>
  );
}
