// Diario — JournalDesktop.dc.html. Pregunta del día con editor inline + ánimo (5 caras),
// KPIs, entradas con búsqueda y filtro por ánimo, editar/eliminar.
// Zona ambientada: tu libreta del día. La tapa se abre sobre la página de hoy,
// se escribe sobre renglones, el ánimo es un sello y borrar tacha a mano.
// Guardar asienta la tinta y marca la página con el sello del día.
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Flame, MessageCircle, Plus, Search, Trash2, X } from 'lucide-react';
import type { JournalEntry, JournalStreak } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { AmbientLight, SketchStrike, SketchUnderline, ZoneShell } from '@/components/ambience';
import { DayStamp, NotebookPage } from '@/components/journal/Notebook';
import { useToast } from '../../hooks/useToast';
import { useDebounce } from '../../hooks/useDebounce';
import * as journalService from '../../services/journal.service';
import { relativeTime } from '../../lib/time';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { Badge, Button, Card, ChipGroup, EmptyState, ErrorState, Field, IconChip, Input, MOODS, MoodFace, MoodPicker, ResponsiveDialog, StatCard, Textarea, moodOf, type ChipOption, PageLoader, DatePicker } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { softTone } from '@/components/ui/lq/tones';

const DAILY_PROMPTS = [
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
];

const todayStr = () => new Date().toISOString().split('T')[0];

/** Formulario de entrada. Inline (nueva, hoy) o dentro del diálogo (editar). */
function EntryForm({ entry, onCancel, onSave, inline }: { entry?: JournalEntry; onCancel: () => void; onSave: (entry: JournalEntry) => void; inline?: boolean }) {
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
      toast.success('Entrada guardada');
    } catch {
      toast.error('Error al guardar');
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
      {lastSaved && <p role="status" className="rounded-md bg-surface-variant px-3 py-2 text-body-sm text-on-surface">Guardado automático · {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>}
      <Field label="Título (opcional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Un día de foco" /></Field>
      {!inline && <Field label="Fecha"><DatePicker value={date} onChange={setDate} /></Field>}
      <Field label="Tu reflexión" help={`${content.length} caracteres · ${words} palabras`}>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Escribe con calma…" rows={inline ? 5 : 8} autoFocus={!entry} className="lq-tex-ruled resize-y bg-transparent leading-[1.75rem] [--lq-rule:1.75rem] [background-attachment:local] focus:bg-transparent" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label-lg text-on-surface">¿Cómo te sientes? <span className="text-on-background">{moodOf(mood).name}</span></legend>
        <MoodPicker value={mood} onChange={setMood} label="Ánimo de la entrada" />
      </fieldset>
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <Field label="Etiquetas" help="Enter para añadir" className="flex-1">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())} placeholder="#reflexión" />
          </Field>
          <Button type="button" variant="secondary" aria-label="Añadir etiqueta" onClick={addTag} className="mb-[1.625rem] shrink-0 px-3"><Plus aria-hidden className="size-4" /></Button>
        </div>
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag}>
                <button type="button" aria-label={`Quitar etiqueta ${tag}`} onClick={() => setTags((c) => c.filter((t) => t !== tag))}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-variant px-3 text-label-lg text-on-surface hover:bg-error/[var(--lq-soft-alpha)] hover:text-error-text md:min-h-9">
                  #{tag}<X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="md" disabled={!content.trim()} loading={saving}>Guardar entrada</Button>
      </div>
    </form>
  );
}

export default function JournalPage() {
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
  const todayPrompt = DAILY_PROMPTS[new Date().getDate() % DAILY_PROMPTS.length];
  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\p{L}/u, (c) => c.toUpperCase());

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
    catch { toast.error('Error al eliminar'); void load(true); }
  }

  const todayEntry = entries.find((e) => e.date.split('T')[0] === todayStr());
  const shown = moodFilter === 'all' ? entries : entries.filter((e) => e.mood === Number(moodFilter));
  const lastMood = entries[0]?.mood;
  const filterOptions: ChipOption<string>[] = [{ value: 'all', label: 'Todos' }, ...MOODS.map((m) => ({ value: String(m.n), label: m.name }))];

  return (
    <ZoneShell
      zone="journal"
      contentClassName="gap-6 md:gap-8"
      ambience={<AmbientLight tone="warning" alpha={0.08} darkAlpha={0.05} d={16} className="-left-[8%] top-[-6%] h-[32rem] w-[60%]" />}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">{todayLabel}</span>
          <h1 className="relative self-start text-display-sm md:text-display-md lg:text-display-lg">
            Diario
            <SketchUnderline className="absolute -bottom-1.5 left-0 w-full text-info md:-bottom-2.5" delay={0.5} />
          </h1>
          <p className="text-body-lg text-on-surface-light">Una pausa breve para registrar lo que importa de tu día.</p>
        </div>
        <SageContextButton message="Dame un tema profundo para reflexionar hoy en mi diario." label="Tema de reflexión" />
      </motion.section>

      <motion.section variants={item} aria-label="Resumen" className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
        <StatCard icon={Flame} tone="warning" value={streak?.currentStreak ?? 0} label={(streak?.currentStreak ?? 0) === 1 ? 'Día seguido' : 'Días seguidos'} />
        <StatCard icon={BookOpen} tone="primary" value={entries.length} label="Entradas" />
        <Card padding="lg" interactive className="flex flex-col gap-3">
          <IconChip tone={lastMood ? moodOf(lastMood).tone : 'muted'}><MoodFace mood={lastMood ?? 3} className="size-6" /></IconChip>
          <span className="text-display-sm font-mono tabular-nums">{lastMood ? moodOf(lastMood).name : '—'}</span>
          <span className="text-body-md text-on-surface-light">Último ánimo</span>
        </Card>
      </motion.section>

      <motion.section variants={item} aria-labelledby="j-prompt">
        <NotebookPage>
        <div className="relative flex flex-col gap-5 p-6 pl-11 md:p-8 md:pl-16">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="relative self-start text-label-lg text-on-surface">
                {todayLabel}
                <SketchUnderline className="absolute -bottom-2 left-0 w-full text-on-surface-light" delay={0.9} duration={0.5} strokeWidth={1.6} />
              </span>
              <span id="j-prompt" className="mt-2 flex items-center gap-2 text-label-lg text-primary-text"><MessageCircle aria-hidden className="size-4" />Pregunta del día</span>
            </div>
            {todayEntry && <DayStamp mood={todayEntry.mood ?? 3} date={new Date()} animate={stamped} className="-mr-1 -mt-1" />}
          </div>
          <p className="text-heading-lg [text-wrap:balance] md:text-display-sm">“{todayPrompt}”</p>
          {composing ? (
            <EntryForm inline onCancel={() => setComposing(false)} onSave={handleSaved} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => (todayEntry ? setEditing(todayEntry) : setComposing(true))}>{todayEntry ? 'Abrir la de hoy' : 'Responder'}</Button>
              {todayEntry && <Badge variant="success">Hoy escrito{todayEntry.title ? ` · ${todayEntry.title}` : ''}</Badge>}
            </div>
          )}
        </div>
        </NotebookPage>
      </motion.section>

      <motion.section variants={item} className="flex flex-col gap-5" aria-labelledby="j-entries">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="j-entries" className="text-heading-lg">Entradas</h2>
          <div className="relative w-full sm:max-w-[360px]">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-on-surface-light" />
            <Input type="search" aria-label="Buscar en el diario" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en el diario…" className="pl-11" />
          </div>
        </div>
        <ChipGroup label="Filtrar por ánimo" options={filterOptions} value={moodFilter} onChange={setMoodFilter} />

        {state === 'loading' ? (
          <PageLoader label="Abriendo tu diario…" words={LOADING_COPY.journal} size="sm" />
        ) : state === 'error' ? (
          <ErrorState title="No pudimos cargar tu diario" onRetry={() => void load()} />
        ) : entries.length === 0 ? (
          <Card variant="elevated" padding="lg">
            <EmptyState icon={BookOpen} title="Tu diario está listo" description="Escribe una primera idea, emoción o momento para empezar a construir tu historia."
              action={<Button onClick={() => setComposing(true)}><Plus aria-hidden className="size-4" />Escribir mi primera entrada</Button>} className="py-6" />
          </Card>
        ) : shown.length === 0 ? (
          <EmptyState icon={BookOpen} tone="muted" title="Sin entradas con ese ánimo" description="Prueba otro filtro o escribe la de hoy."
            action={<Button variant="secondary" onClick={() => { setMoodFilter('all'); setSearch(''); }}>Quitar filtros</Button>} className="py-10" />
        ) : (
          <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {shown.map((e) => {
                const m = moodOf(e.mood);
                const title = e.title ?? `Día ${new Date(e.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
                return (
                  <motion.li key={e.id} variants={item} exit={{ opacity: 0, x: 24, transition: { duration: 0.22 } }} layout="position" className="group">
                    <Card padding="lg" interactive className="lq-tex-paper relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 md:gap-5">
                      {/* Sello de ánimo: anillo de tinta torcido */}
                      <span title={`Ánimo: ${m.name}`} className={cn('flex size-12 shrink-0 -rotate-6 items-center justify-center rounded-full border-2 border-dashed transition-transform duration-[560ms] ease-[var(--lq-ease-heavy)] group-hover:rotate-0', softTone[m.tone])}>
                        <MoodFace mood={m.n} label={`Ánimo: ${m.name}`} />
                      </span>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <h3 className="relative text-heading-sm">
                            <button type="button" onClick={() => setEditing(e)} className="rounded-md text-left hover:underline hover:underline-offset-4">{title}</button>
                            {striking.has(e.id) && <SketchStrike className="text-error" duration={0.3} strokeWidth={2.4} />}
                          </h3>
                          <span className="text-body-sm text-on-surface-light" title={new Date(e.date).toLocaleDateString('es-ES', { dateStyle: 'long' })}>{relativeTime(e.date)}</span>
                        </div>
                        <p className={cn('lq-write line-clamp-2 text-body-md text-on-surface transition-opacity duration-300', striking.has(e.id) && 'opacity-40')} style={{ '--d': '700ms', '--delay': '250ms' } as CSSProperties}>{e.content}</p>
                        {e.tags.length > 0 && <ul className="flex flex-wrap gap-1.5">{e.tags.map((t) => <li key={t}><Badge variant="neutral">#{t}</Badge></li>)}</ul>}
                      </div>
                      <Button variant="icon" aria-label={`Eliminar ${title}`} onClick={() => void handleDelete(e.id)} className="-mr-2 -mt-2"><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                    </Card>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </motion.section>

      <ResponsiveDialog open={!!editing} onClose={() => setEditing(null)} title="Editar entrada" className="max-w-[560px]">
        {editing && <EntryForm entry={editing} onCancel={() => setEditing(null)} onSave={handleSaved} />}
      </ResponsiveDialog>
    </ZoneShell>
  );
}
