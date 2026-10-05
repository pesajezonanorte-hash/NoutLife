// Extras de Aprendizaje (rediseño): Pomodoro, notas y tarjetas de vocabulario (SM-2).
// Misma lógica y endpoints; piel lq.
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, NotebookPen, Pause, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '../../store/uiStore';
import { refreshUser } from '../../hooks/useAuth';
import { useToastStore } from '../../hooks/useToast';
import api from '../../lib/api';
import { Badge, Button, Card, EmptyState, Field, Input, ProgressBar, ProgressRing, Textarea, formatClock, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { PerspectiveFlipCard } from '@/components/ui/perspective-flip-card';

// ─── Pomodoro Timer ────────────────────────────────────────────────────────────

const POMODORO_MINUTES = 25;
const BREAK_MINUTES = 5;
const DAILY_GOAL_MIN = 100;
const FOCUS_KEY = 'lq-focus-today';

// TODO(api): no hay endpoint de minutos de enfoque; se acumulan en el dispositivo por día.
function readFocus(): number {
  try {
    const v = JSON.parse(localStorage.getItem(FOCUS_KEY) ?? '{}');
    return v.day === new Date().toDateString() ? Number(v.min) || 0 : 0;
  } catch { return 0; }
}
function writeFocus(min: number) {
  try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ day: new Date().toDateString(), min })); } catch { /* sin storage */ }
}

export function PomodoroTimer({ itemTitle }: { itemTitle?: string }) {
  const [phase, setPhase] = useState<'idle' | 'work' | 'break'>('idle');
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(POMODORO_MINUTES * 60);
  const [sessions, setSessions] = useState(0);
  const [focusMin, setFocusMin] = useState(readFocus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addFloatingXP, flashScreen } = useUIStore();

  const clear = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  const beep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
    } catch { /* audio not available */ }
  }, []);

  useEffect(() => {
    if (phase === 'idle' || !running) return;
    clear();
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          beep();
          if (phase === 'work') {
            api.post('/learning/pomodoro').then((r: { data?: { xp?: number } }) => {
              addFloatingXP(r.data?.xp ?? 15, window.innerWidth / 2, 200);
              flashScreen('rgb(var(--lq-primary) / 0.35)');
              void refreshUser();
            }).catch(() => null);
            setSessions((n) => n + 1);
            setFocusMin((m) => { writeFocus(m + POMODORO_MINUTES); return m + POMODORO_MINUTES; });
            setPhase('break');
            return BREAK_MINUTES * 60;
          }
          setPhase('work');
          return POMODORO_MINUTES * 60;
        }
        return s - 1;
      });
    }, 1000);
    return clear;
  }, [phase, running, beep, addFloatingXP, flashScreen]);

  function toggle() {
    if (phase === 'idle') { setPhase('work'); setSeconds(POMODORO_MINUTES * 60); setRunning(true); return; }
    setRunning((r) => !r);
  }
  function reset() { clear(); setPhase('idle'); setRunning(false); setSeconds(POMODORO_MINUTES * 60); }

  const total = phase === 'break' ? BREAK_MINUTES * 60 : POMODORO_MINUTES * 60;
  const pct = phase === 'idle' ? 0 : (1 - seconds / total) * 100;
  const label = phase === 'idle' ? 'Listo para enfocar' : phase === 'work' ? (running ? 'Enfocado' : 'En pausa') : 'Descanso';
  const dots = Math.max(4, sessions);

  return (
    <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]" aria-label="Pomodoro">
      <Card variant="elevated" padding="none" className="flex flex-col items-center gap-6 px-6 py-10 text-center md:px-8 md:py-12">
        <Badge variant={phase === 'break' ? 'success' : phase === 'work' && running ? 'primary' : 'neutral'} size="lg">{label}</Badge>
        <ProgressRing value={pct} tone={phase === 'break' ? 'success' : 'primary'} size={260} stroke={9} label="Progreso del Pomodoro" valueText={formatClock(seconds)}>
          <span className="flex flex-col items-center gap-1">
            <span role="timer" aria-live="off" aria-label={`Tiempo restante ${formatClock(seconds)}`} className="font-mono text-display-md font-bold tabular-nums"><span aria-hidden>{formatClock(seconds)}</span></span>
            {itemTitle && <span className="max-w-[12rem] truncate text-body-sm text-on-surface-light">Leyendo: {itemTitle}</span>}
          </span>
        </ProgressRing>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" onClick={reset}><RotateCcw aria-hidden className="size-4" />Reiniciar</Button>
          <Button className="min-w-40" onClick={toggle}>
            {running ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
            {running ? 'Pausar' : phase === 'idle' ? 'Comenzar' : 'Reanudar'}
          </Button>
        </div>
        <ul className="flex gap-2" aria-label={`${sessions} sesiones completadas`}>
          {Array.from({ length: dots }, (_, i) => (
            <li key={i} aria-hidden className={cn('size-3 rounded-full transition-colors duration-300', i < sessions ? 'bg-primary' : 'bg-surface-variant')} />
          ))}
        </ul>
        {sessions > 0 && <p className="font-mono text-body-sm tabular-nums text-success-text">{sessions} {sessions === 1 ? 'sesión completada' : 'sesiones completadas'} · +{sessions * 15} XP</p>}
      </Card>

      <aside className="flex flex-col gap-6">
        <Card as="section" padding="lg" aria-labelledby="pomo-focus" className="flex flex-col gap-3">
          <h2 id="pomo-focus" className="text-heading-sm">Enfoque de hoy</h2>
          <span className="font-mono text-display-sm font-bold tabular-nums">{focusMin} min</span>
          <span className="text-body-sm text-on-surface-light">Meta diaria {DAILY_GOAL_MIN} min</span>
          <ProgressBar value={Math.min(100, (focusMin / DAILY_GOAL_MIN) * 100)} shine label="Enfoque de hoy" valueText={`${focusMin} de ${DAILY_GOAL_MIN} minutos`} />
        </Card>
        <Card as="section" padding="lg" aria-labelledby="pomo-set" className="flex flex-col gap-2">
          <h2 id="pomo-set" className="mb-1 text-heading-sm">Ajustes</h2>
          <dl>
            {[['Enfoque', `${POMODORO_MINUTES} min`], ['Descanso corto', `${BREAK_MINUTES} min`], ['Descanso largo', '15 min']].map(([k, v]) => (
              <div key={k} className="flex min-h-11 items-center justify-between border-b border-border last:border-0">
                <dt className="text-body-md text-on-surface">{k}</dt><dd className="font-mono text-label-lg tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </aside>
    </section>
  );
}

// ─── Notes Panel ──────────────────────────────────────────────────────────────

interface Note { id: string; text: string; createdAt: string }

export function NotesPanel({ itemId }: { itemId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/learning/${itemId}/notes`).then((r: { data?: { notes?: Note[] } }) => setNotes(r.data?.notes ?? [])).catch(() => null).finally(() => setLoading(false));
  }, [itemId]);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const r: { data: { note: Note } } = await api.post(`/learning/${itemId}/notes`, { text });
      setNotes((prev) => [...prev, r.data.note]);
      setText('');
    } catch { useToastStore.getState().error('No se pudo guardar la nota'); } finally { setSaving(false); }
  }

  async function deleteNote(noteId: string) {
    try {
      await api.delete(`/learning/${itemId}/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch { useToastStore.getState().error('No se pudo eliminar la nota'); }
  }

  if (loading) return <PageLoader label="Abriendo tus apuntes…" words={LOADING_COPY.learningNotes} size="sm" />;

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); void addNote(); }}>
        <Field label="Nueva nota" className="flex-1"><Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Añadir nota…" /></Field>
        <Button type="submit" variant="secondary" loading={saving} disabled={!text.trim()}><Plus aria-hidden className="size-4" />Nota</Button>
      </form>
      {notes.length === 0 ? (
        <Card><EmptyState icon={NotebookPen} tone="info" title="Sin notas aún" description="Guarda ideas y citas mientras avanzas." className="py-4" /></Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id}>
              <Card padding="sm" className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-body-md">{n.text}</p>
                  <p className="mt-1 text-body-sm text-on-surface-light">{new Date(n.createdAt).toLocaleDateString('es-ES')}</p>
                </div>
                <Button variant="icon" aria-label="Eliminar nota" onClick={() => void deleteNote(n.id)} className="-mr-2 -mt-2"><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Vocabulary Flashcards (SRS SM-2) ─────────────────────────────────────────

interface VocabCard {
  id: string; front: string; back: string; example?: string;
  nextReview: string; interval: number; easiness: number; repetitions: number;
}

export function VocabPanel({ itemId }: { itemId: string }) {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<VocabCard | null>(null);
  const [showBack, setShowBack] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ front: '', back: '', example: '' });

  const today = new Date().toISOString().slice(0, 10);
  const dueCards = cards.filter((c) => c.nextReview <= today);

  useEffect(() => {
    api.get(`/learning/${itemId}/vocab`).then((r: { data?: { cards?: VocabCard[] } }) => setCards(r.data?.cards ?? [])).catch(() => null).finally(() => setLoading(false));
  }, [itemId]);

  async function addCard() {
    if (!form.front.trim() || !form.back.trim()) return;
    try {
      const r: { data: { card: VocabCard } } = await api.post(`/learning/${itemId}/vocab`, { front: form.front, back: form.back, example: form.example || undefined });
      setCards((prev) => [...prev, r.data.card]);
      setForm({ front: '', back: '', example: '' });
      setShowForm(false);
    } catch { useToastStore.getState().error('No se pudo guardar la tarjeta'); }
  }

  async function review(quality: 0 | 1 | 2 | 3 | 4 | 5) {
    if (!reviewing) return;
    try {
      const r: { data: { card: VocabCard } } = await api.post(`/learning/${itemId}/vocab/${reviewing.id}/review`, { quality });
      setCards((prev) => prev.map((c) => (c.id === reviewing.id ? r.data.card : c)));
      setReviewing(dueCards.find((c) => c.id !== reviewing.id) ?? null);
      setShowBack(false);
    } catch { useToastStore.getState().error('No se pudo registrar el repaso'); }
  }

  if (loading) return <PageLoader label="Barajando tus tarjetas…" words={LOADING_COPY.learningCards} size="sm" />;

  const grades: Array<[0 | 2 | 4, string, string]> = [
    [0, 'Nada', 'bg-error/[var(--lq-soft-alpha)] text-error-text'],
    [2, 'Difícil', 'bg-warning/[var(--lq-soft-alpha)] text-warning-text'],
    [4, 'Fácil', 'bg-success/[var(--lq-soft-alpha)] text-success-text'],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-body-sm tabular-nums text-on-surface-light">{cards.length} tarjetas · {dueCards.length} para repasar</p>
        <div className="flex gap-2">
          {dueCards.length > 0 && !reviewing && <Button size="md" onClick={() => { setReviewing(dueCards[0] ?? null); setShowBack(false); }}><Play aria-hidden className="size-4" />Repasar ({dueCards.length})</Button>}
          <Button variant="secondary" size="md" onClick={() => setShowForm((f) => !f)}>
            {showForm ? <><X aria-hidden className="size-4" />Cerrar</> : <><Plus aria-hidden className="size-4" />Tarjeta</>}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card as="form" padding="md" className="flex flex-col gap-3" onSubmit={(e: React.FormEvent) => { e.preventDefault(); void addCard(); }}>
          <Field label="Frente"><Input value={form.front} onChange={(e) => setForm((f) => ({ ...f, front: e.target.value }))} placeholder="Palabra o concepto" /></Field>
          <Field label="Dorso"><Input value={form.back} onChange={(e) => setForm((f) => ({ ...f, back: e.target.value }))} placeholder="Definición o traducción" /></Field>
          <Field label="Ejemplo (opcional)"><Input value={form.example} onChange={(e) => setForm((f) => ({ ...f, example: e.target.value }))} /></Field>
          <Button type="submit" block disabled={!form.front.trim() || !form.back.trim()}>Guardar tarjeta</Button>
        </Card>
      )}

      <AnimatePresence>
        {reviewing && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex flex-col items-center gap-4">
              <p className="font-mono text-body-sm tabular-nums text-on-surface-light">Repasando {dueCards.indexOf(reviewing) + 1} / {dueCards.length}</p>
              {/* Pasar la página de la tarjeta: el flip card existente */}
              <PerspectiveFlipCard
                key={reviewing.id}
                label={`Tarjeta ${reviewing.front}`}
                trigger="tap"
                flipped={showBack}
                onFlipChange={setShowBack}
                className="h-72 min-h-0 max-w-[30rem]"
                front={(
                  <div className="lq-tex-paper flex size-full flex-col items-center justify-center gap-3 rounded-[inherit] p-6 text-center">
                    <p className="text-heading-lg [text-wrap:balance]">{reviewing.front}</p>
                    <p className="text-body-sm text-on-surface-light">Toca para ver la respuesta</p>
                  </div>
                )}
                back={(
                  <div className="lq-tex-paper flex size-full flex-col justify-between gap-3 rounded-[inherit] p-6 pt-16 text-center" aria-live="polite">
                    <div>
                      <p className="text-heading-md text-primary-text">{reviewing.back}</p>
                      {reviewing.example && <p className="mt-1 text-body-md italic text-on-surface-light">{reviewing.example}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-label-lg text-on-surface">¿Qué tan bien lo recordaste?</p>
                      <div className="grid grid-cols-3 gap-2">
                        {grades.map(([q, name, cls]) => (
                          <button key={q} type="button" onClick={() => void review(q)} className={cn('min-h-12 rounded-md text-label-lg transition-shadow hover:shadow-md', cls)}>{name}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              />
              <Button variant="ghost" size="sm" onClick={() => setReviewing(null)}><X aria-hidden className="size-4" />Salir de la revisión</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!reviewing && cards.length > 0 && (
        <ul className="flex flex-col">
          {cards.map((c) => (
            <li key={c.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 last:border-0">
              <p className="min-w-0 truncate text-body-md">{c.front} <span aria-hidden>→</span><span className="sr-only">significa</span> <span className="text-on-surface-light">{c.back}</span></p>
              {c.nextReview <= today ? <Badge variant="warning">Hoy</Badge> : <span className="shrink-0 font-mono text-body-sm tabular-nums text-on-surface-light">en {Math.ceil((new Date(c.nextReview).getTime() - Date.now()) / 86400000)} d</span>}
            </li>
          ))}
        </ul>
      )}

      {cards.length === 0 && !showForm && (
        <Card><EmptyState icon={Layers} tone="forest" title="Sin tarjetas aún" description="Crea tarjetas de vocabulario y repásalas con repetición espaciada." className="py-4" /></Card>
      )}
    </div>
  );
}
