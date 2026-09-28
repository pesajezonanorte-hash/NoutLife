import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelPanel } from '../ui/PixelPanel';
import { PixelButton } from '../ui/PixelButton';
import { useUIStore } from '../../store/uiStore';
import { refreshUser } from '../../hooks/useAuth';
import api from '../../lib/api';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader-adapted';
import { useLoadingVisibility } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

// ─── Pomodoro Timer ────────────────────────────────────────────────────────────

const POMODORO_MINUTES = 25;
const BREAK_MINUTES = 5;

export function PomodoroTimer() {
  const [phase, setPhase] = useState<'idle' | 'work' | 'break'>('idle');
  const [seconds, setSeconds] = useState(POMODORO_MINUTES * 60);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { addFloatingXP, flashScreen } = useUIStore();

  const clear = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

  const beep = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    if (phase === 'idle') return;
    clear();
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          beep();
          if (phase === 'work') {
            // Award XP for completed pomodoro
            api.post('/learning/pomodoro').then((r: any) => {
              const xp = r.data?.xp ?? 15;
              addFloatingXP(xp, window.innerWidth / 2, 200);
              flashScreen('#8f8f98');
              void refreshUser();
            }).catch(() => null);
            setSessions(n => n + 1);
            setPhase('break');
            return BREAK_MINUTES * 60;
          } else {
            setPhase('work');
            return POMODORO_MINUTES * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return clear;
  }, [phase, beep, addFloatingXP, flashScreen]);

  function start() { setPhase('work'); setSeconds(POMODORO_MINUTES * 60); }
  function stop() { setPhase('idle'); setSeconds(POMODORO_MINUTES * 60); clear(); }

  const total = phase === 'break' ? BREAK_MINUTES * 60 : POMODORO_MINUTES * 60;
  const progress = 1 - seconds / total;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const circumference = 2 * Math.PI * 54;

  return (
    <PixelPanel className="p-5 text-center space-y-4">
      <p className="font-pixel text-accent-gold" style={{ fontSize: '9px' }}><E e="🍅" /> POMODORO +15 XP</p>

      <div className="flex justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-deep)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={phase === 'break' ? 'var(--accent-green)' : phase === 'work' ? 'var(--accent-gold)' : 'var(--border)'}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-pixel text-text-primary" style={{ fontSize: '22px' }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
            <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
              {phase === 'idle' ? 'LISTO' : phase === 'work' ? 'FOCO' : 'DESCANSO'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {phase === 'idle' ? (
          <PixelButton variant="primary" onClick={start}>▶ INICIAR</PixelButton>
        ) : (
          <PixelButton variant="ghost" onClick={stop}>■ DETENER</PixelButton>
        )}
      </div>

      {sessions > 0 && (
        <p className="font-pixel text-accent-green" style={{ fontSize: '8px' }}>
          {sessions} sesión{sessions > 1 ? 'es' : ''} completada{sessions > 1 ? 's' : ''} · +{sessions * 15} XP
        </p>
      )}
    </PixelPanel>
  );
}

// ─── Notes Panel ──────────────────────────────────────────────────────────────

interface Note { id: string; text: string; createdAt: string }

export function NotesPanel({ itemId }: { itemId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const showLoading = useLoadingVisibility(loading);

  useEffect(() => {
    api.get(`/learning/${itemId}/notes`).then((r: any) => setNotes(r.data?.notes ?? [])).finally(() => setLoading(false));
  }, [itemId]);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const r: any = await api.post(`/learning/${itemId}/notes`, { text });
      setNotes(prev => [...prev, r.data.note]);
      setText('');
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function deleteNote(noteId: string) {
    await api.delete(`/learning/${itemId}/notes/${noteId}`);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }

  if (showLoading) return <ModernLoader variant="compact" words={LOADING_COPY.learningNotes} />;
  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Añadir nota..."
          rows={2}
          className="flex-1 bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none resize-none"
        />
        <PixelButton variant="secondary" onClick={addNote} disabled={saving || !text.trim()}>
          {saving ? '...' : '+ NOTA'}
        </PixelButton>
      </div>

      {notes.length === 0 ? (
        <p className="font-vt text-text-secondary text-base italic text-center py-4">Sin notas aún</p>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.id} className="flex gap-2 items-start">
              <div className="flex-1 bg-bg-deep border border-border-pixel p-2">
                <p className="font-vt text-text-primary text-base whitespace-pre-wrap">{n.text}</p>
                <p className="font-pixel text-text-secondary mt-1" style={{ fontSize: '7px' }}>
                  {new Date(n.createdAt).toLocaleDateString('es-CO')}
                </p>
              </div>
              <button onClick={() => deleteNote(n.id)} className="font-pixel text-accent-red hover:opacity-70 mt-1" style={{ fontSize: '8px' }}><E e="✕" /></button>
            </div>
          ))}
        </div>
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
  const showLoading = useLoadingVisibility(loading);

  const today = new Date().toISOString().slice(0, 10);
  const dueCards = cards.filter(c => c.nextReview <= today);

  useEffect(() => {
    api.get(`/learning/${itemId}/vocab`).then((r: any) => setCards(r.data?.cards ?? [])).finally(() => setLoading(false));
  }, [itemId]);

  async function addCard() {
    if (!form.front.trim() || !form.back.trim()) return;
    const r: any = await api.post(`/learning/${itemId}/vocab`, { front: form.front, back: form.back, example: form.example || undefined });
    setCards(prev => [...prev, r.data.card]);
    setForm({ front: '', back: '', example: '' });
    setShowForm(false);
  }

  async function review(quality: 0 | 1 | 2 | 3 | 4 | 5) {
    if (!reviewing) return;
    const r: any = await api.post(`/learning/${itemId}/vocab/${reviewing.id}/review`, { quality });
    setCards(prev => prev.map(c => c.id === reviewing.id ? r.data.card : c));
    const next = dueCards.find(c => c.id !== reviewing.id) ?? null;
    setReviewing(next);
    setShowBack(false);
  }

  function startReview() {
    setReviewing(dueCards[0] ?? null);
    setShowBack(false);
  }

  if (showLoading) return <ModernLoader variant="compact" words={LOADING_COPY.learningCards} />;
  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>TARJETAS: {cards.length} total · {dueCards.length} para repasar</p>
        </div>
        <div className="flex gap-2">
          {dueCards.length > 0 && !reviewing && (
            <PixelButton variant="primary" onClick={startReview}>▶ REPASAR ({dueCards.length})</PixelButton>
          )}
          <PixelButton variant="secondary" onClick={() => setShowForm(f => !f)}>{showForm ? <E e="✕" s={11} /> : '+ TARJETA'}</PixelButton>
        </div>
      </div>

      {showForm && (
        <PixelPanel className="p-4 space-y-2">
          <input value={form.front} onChange={e => setForm(f => ({ ...f, front: e.target.value }))} placeholder="Frente (palabra/concepto)" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none" />
          <input value={form.back} onChange={e => setForm(f => ({ ...f, back: e.target.value }))} placeholder="Dorso (definición/traducción)" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none" />
          <input value={form.example} onChange={e => setForm(f => ({ ...f, example: e.target.value }))} placeholder="Ejemplo (opcional)" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none" />
          <PixelButton variant="primary" onClick={addCard} className="w-full">GUARDAR TARJETA</PixelButton>
        </PixelPanel>
      )}

      {/* Active review session */}
      <AnimatePresence>
        {reviewing && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <PixelPanel className="p-5 space-y-4 text-center">
              <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>REVISANDO {dueCards.indexOf(reviewing) + 1} / {dueCards.length}</p>
              <p className="font-vt text-text-primary text-2xl">{reviewing.front}</p>

              {!showBack ? (
                <PixelButton variant="secondary" onClick={() => setShowBack(true)} className="w-full">MOSTRAR RESPUESTA</PixelButton>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="border-t border-border-pixel pt-3">
                    <p className="font-vt text-accent-gold text-xl">{reviewing.back}</p>
                    {reviewing.example && <p className="font-vt text-text-secondary text-base italic mt-1">{reviewing.example}</p>}
                  </div>
                  <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>¿QUÉ TAN BIEN LO RECORDASTE?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      [0, ' Nada', 'var(--accent-red)'],
                      [2, ' Difícil', 'var(--accent-gold)'],
                      [4, ' Fácil', 'var(--accent-green)'],
                    ] as [0 | 2 | 4, string, string][]).map(([q, label, color]) => (
                      <button
                        key={q}
                        onClick={() => review(q)}
                        className="py-2 border-2 font-pixel transition-all hover:opacity-80"
                        style={{ borderColor: color, color, fontSize: '8px' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <button onClick={() => setReviewing(null)} className="font-pixel text-text-secondary hover:text-accent-red transition-colors" style={{ fontSize: '7px' }}>
                <E e="✕" /> SALIR DE REVISIÓN
              </button>
            </PixelPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card list */}
      {!reviewing && cards.length > 0 && (
        <div className="space-y-1">
          {cards.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 border border-border-pixel/50">
              <div>
                <p className="font-vt text-text-primary text-base">{c.front} → <span className="text-text-secondary">{c.back}</span></p>
              </div>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '6px' }}>
                {c.nextReview <= today ? ' HOY' : `en ${Math.ceil((new Date(c.nextReview).getTime() - Date.now()) / 86400000)}d`}
              </p>
            </div>
          ))}
        </div>
      )}

      {cards.length === 0 && !showForm && (
        <PixelPanel className="p-6 text-center">
          <p className="text-3xl mb-2"><E e="🃏" /></p>
          <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>SIN TARJETAS AÚN</p>
        </PixelPanel>
      )}
    </div>
  );
}
