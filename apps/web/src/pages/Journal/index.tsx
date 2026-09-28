import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useDebounce } from '../../hooks/useDebounce';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { PixelButton } from '../../components/ui/PixelButton';
import { ModalFrame } from '../../components/ui/ModalFrame';
import type { JournalEntry, JournalStreak } from '@lifequest/shared';
import * as journalService from '../../services/journal.service';
import { relativeTime } from '../../lib/time';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const MOOD_EMOJIS = ['', '😢', '😔', '😐', '😊', '😄'];

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

function EntryEditor({ entry, onClose, onSave }: { entry?: JournalEntry; onClose: () => void; onSave: (entry: JournalEntry) => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [mood, setMood] = useState(entry?.mood ?? 3);
  const [date, setDate] = useState(entry?.date?.split('T')[0] ?? today);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();
  const inputClass = 'min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]';

  useEffect(() => {
    if (!entry) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (!entry.id || !content) return;
      try {
        await journalService.updateJournalEntry(entry.id, { title: title || undefined, content, mood, tags });
        setLastSaved(new Date());
      } catch {
        // Autosave should not interrupt the editor when the network is offline.
      }
    }, 30000);
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
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
    if (nextTag && !tags.includes(nextTag)) setTags((current) => [...current, nextTag]);
    setTagInput('');
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return (
    <ModalFrame
      title={entry ? 'Editar entrada' : 'Nueva entrada'}
      description={entry ? 'Actualiza tu registro sin perder el hilo de tu historia.' : 'Registra lo que quieres recordar de este día.'}
      icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
      onClose={onClose}
      size="lg"
      contentClassName="space-y-5"
      footer={(
        <div className="grid grid-cols-2 gap-2.5">
          <PixelButton variant="ghost" onClick={onClose} className="w-full">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={save} disabled={!content.trim() || saving} className="w-full">
            {saving ? 'Guardando…' : 'Guardar entrada'}
          </PixelButton>
        </div>
      )}
    >
      {lastSaved && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span>Guardado automático activo</span>
          <span className="tabular-nums text-[var(--text-muted)]">{lastSaved.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Título <span className="font-normal text-[var(--text-muted)]">(opcional)</span></span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ponle un nombre a este momento"
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Fecha</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
        </label>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">Humor</legend>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Humor de la entrada">
            {[1, 2, 3, 4, 5].map((rating) => {
              const selected = mood === rating;
              return (
                <motion.button
                  key={rating}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setMood(rating)}
                  aria-pressed={selected}
                  aria-label={`Humor ${rating} de 5`}
                  className={`flex h-11 items-center justify-center rounded-xl border text-base transition-colors ${
                    selected
                      ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <E e={MOOD_EMOJIS[rating]} />
                </motion.button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Tu entrada</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escribe aquí tu entrada..."
          autoFocus={!entry}
          rows={10}
          className={`${inputClass} min-h-56 resize-y leading-6`}
        />
        <span className="mt-1.5 flex justify-end text-xs tabular-nums text-[var(--text-muted)]">{content.length} caracteres · {wordCount} palabras</span>
      </label>

      <section>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Etiquetas</p>
          <p className="text-xs text-[var(--text-muted)]">Presiona Enter para añadir</p>
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ',') && (event.preventDefault(), addTag())}
            placeholder="#reflexión"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={addTag}
            aria-label="Añadir etiqueta"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-lg text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]"
          >
            +
          </button>
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                className="min-h-11 rounded-full border border-[var(--border)] bg-[var(--bg-panel-light)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]"
              >
                #{tag} ×
              </button>
            ))}
          </div>
        )}
      </section>
    </ModalFrame>
  );
}

export default function JournalPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [streak, setStreak] = useState<JournalStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [search, setSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState<number | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const todayPrompt = DAILY_PROMPTS[new Date().getDate() % DAILY_PROMPTS.length];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([journalService.fetchJournal({ search: debouncedSearch || undefined }), journalService.fetchJournalStreak()]);
      setEntries(e);
      setStreak(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(entry: JournalEntry) {
    setEntries(prev => {
      const exists = prev.find(e => e.id === entry.id);
      if (exists) return prev.map(e => e.id === entry.id ? entry : e);
      return [entry, ...prev];
    });
    setShowEditor(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id));
    try { await journalService.deleteJournalEntry(id); }
    catch { toast.error('Error al eliminar'); load(); }
  }

  const todayEntry = entries.find(e => e.date.split('T')[0] === new Date().toISOString().split('T')[0]);
  const filteredEntries = moodFilter ? entries.filter(e => e.mood === moodFilter) : entries;
  const remainingFilteredEntries = todayEntry
    ? filteredEntries.filter((entry) => entry.id !== todayEntry.id)
    : filteredEntries;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="📜" /> DIARIO DE AVENTURAS</h1>
          <p className="font-vt text-text-secondary text-base">El registro de tu historia, héroe</p>
        </div>
        <div className="flex items-center gap-2">
          <SageContextButton message="Dame un tema profundo para reflexionar hoy en mi diario." label="Tema de reflexión" />
          <PixelButton variant="primary" onClick={() => { setEditing(null); setShowEditor(true); }}><E e="✍" /> ESCRIBIR</PixelButton>
        </div>
      </div>

      {/* Streak + Today status */}
      <div className="grid grid-cols-2 gap-3">
        {streak && (
          <PixelPanel className="p-3 text-center">
            <p className="text-2xl"><E e="🔥" /></p>
            <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '14px' }}>{streak.currentStreak}</p>
            <p className="font-pixel text-text-secondary" style={{ fontSize: '6px' }}>DÍAS SEGUIDOS</p>
          </PixelPanel>
        )}
        <PixelPanel className="p-3 text-center cursor-pointer hover:border-accent-gold/50 transition-colors" onClick={() => { setEditing(todayEntry ?? null); setShowEditor(true); }}>
          <p className="text-2xl">{todayEntry ? <E e="✅" s={14} /> : <E e="📝" s={14} />}</p>
          <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '10px' }}>{todayEntry ? 'HOY ESCRITO' : 'ESCRIBIR HOY'}</p>
          {todayEntry && <p className="font-vt text-text-secondary text-base mt-0.5">{todayEntry.title ?? 'Sin título'}</p>}
        </PixelPanel>
      </div>

      {/* Daily prompt */}
      {!todayEntry && (
        <PixelPanel className="p-4 border-accent-purple/50">
          <p className="font-pixel text-accent-purple mb-2" style={{ fontSize: '8px' }}><E e="💬" /> PROMPT DEL DÍA</p>
          <p className="font-vt text-text-primary text-lg italic">"{todayPrompt}"</p>
          <PixelButton variant="secondary" onClick={() => { setEditing(null); setShowEditor(true); }} className="mt-3 w-full">
            <E e="✍" /> RESPONDER PROMPT
          </PixelButton>
        </PixelPanel>
      )}

      {!loading && todayEntry && (
        <LifeQuestFlipCard
          eyebrow="Entrada destacada"
          title={todayEntry?.title ?? (todayEntry ? 'Tu reflexión de hoy' : 'Tu página de hoy sigue en blanco')}
          description={todayEntry ? `Escribiste hoy. ${todayEntry.content.slice(0, 120)}${todayEntry.content.length > 120 ? '…' : ''}` : 'Reserva un momento para dejar una idea, emoción o logro de esta jornada.'}
          visual={<span className="text-6xl" aria-hidden="true"><E e={todayEntry?.mood ? MOOD_EMOJIS[todayEntry.mood] : '📜'} s={64} /></span>}
          visualLabel={todayEntry ? 'Entrada de diario de hoy' : 'Diario listo para una nueva entrada'}
          badge={todayEntry ? 'Hoy escrito' : 'Pendiente hoy'}
          frontFooter={<p className="text-xs font-semibold [color:var(--flip-accent)]">{streak ? `${streak.currentStreak} días de racha` : `${entries.length} entradas guardadas`}</p>}
          backDescription={<p>{todayEntry ? 'Abre la entrada para continuarla, editarla o releer la reflexión que dejaste hoy.' : `Prompt sugerido: “${todayPrompt}”`}</p>}
          metrics={[
            { label: 'Racha', value: `${streak?.currentStreak ?? 0} días` },
            { label: 'Entradas', value: entries.length },
            { label: 'Estado', value: todayEntry ? 'Escrito' : 'Por escribir' },
          ]}
          actionLabel={todayEntry ? 'Abrir entrada' : 'Escribir hoy'}
          onAction={() => { setEditing(todayEntry ?? null); setShowEditor(true); }}
          accent="var(--accent-gold)"
        />
      )}

            {/* Search + mood filter */}
      <div className="space-y-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en el diario..." className="min-h-11 w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-base text-text-primary outline-none focus:border-accent-gold" />
        <div className="grid grid-cols-3 gap-1.5">
          <span className="col-span-3 font-pixel text-text-secondary" style={{ fontSize: '7px' }}>FILTRAR HUMOR:</span>
          <button onClick={() => setMoodFilter(null)} className={`min-h-11 border px-2 py-0.5 font-pixel transition-all ${moodFilter === null ? 'border-accent-gold text-accent-gold' : 'border-border-pixel text-text-secondary'}`} style={{ fontSize: '7px' }}>
            TODOS
          </button>
          {[1, 2, 3, 4, 5].map(m => (
            <button key={m} onClick={() => setMoodFilter(moodFilter === m ? null : m)} className={`min-h-11 border px-2 py-0.5 transition-all ${moodFilter === m ? 'border-accent-gold' : 'border-border-pixel'}`}>
              <span className={moodFilter === m ? 'opacity-100' : 'opacity-50'}><E e={MOOD_EMOJIS[m]} /></span>
            </button>
          ))}
        </div>
      </div>

      {/* Entries list */}
      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.journal]} />}>
        {loading ? null : remainingFilteredEntries.length === 0 ? (
          todayEntry && !search && moodFilter === null ? null : (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2"><E e="📜" /></p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '9px' }}>{entries.length === 0 ? 'EL DIARIO ESTÁ EN BLANCO' : 'SIN RESULTADOS'}</p>
              <p className="font-vt text-text-secondary text-base mt-1">{entries.length === 0 ? 'El héroe no ha escrito aún...' : 'Prueba otro filtro'}</p>
            </PixelPanel>
          )
        ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {remainingFilteredEntries.map((e, i) => (
              <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <PixelPanel className="p-3 cursor-pointer hover:border-accent-gold/50 transition-colors" onClick={() => { setEditing(e); setShowEditor(true); }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {e.mood && <span className="text-xl flex-shrink-0"><E e={MOOD_EMOJIS[e.mood]} /></span>}
                        <p className="font-vt text-text-primary text-lg truncate">{e.title ?? `Día ${new Date(e.date).toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}`}</p>
                      </div>
                      <p className="font-pixel text-text-secondary mt-0.5" style={{ fontSize: '7px' }} title={new Date(e.date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}>{relativeTime(e.date)}</p>
                      <p className="font-vt text-text-secondary text-base mt-1 line-clamp-2">{e.content.substring(0, 120)}{e.content.length > 120 ? '...' : ''}</p>
                      {e.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {e.tags.map(t => <span key={t} className="font-pixel text-accent-cyan" style={{ fontSize: '7px' }}>#{t}</span>)}
                        </div>
                      )}
                    </div>
                    <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} className="flex h-11 w-11 shrink-0 items-center justify-center font-pixel text-accent-red hover:opacity-70" style={{ fontSize: '8px' }}><E e="✕" /></button>
                  </div>
                </PixelPanel>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
        )}
      </LoadingGate>

      <AnimatePresence>
        {showEditor && <EntryEditor entry={editing ?? undefined} onClose={() => { setShowEditor(false); setEditing(null); }} onSave={handleSaved} />}
      </AnimatePresence>
    </div>
  );
}
