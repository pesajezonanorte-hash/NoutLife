// El Sabio — consejero IA. Cajón a la derecha en md+ (el disparador vive en la
// Topbar, a la derecha), pantalla completa en móvil. Modal: foco atrapado,
// Escape cierra, el foco vuelve al disparador. Historial (8 últimos) en
// localStorage como antes; la conversación es un role="log".
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotionConfig, type Variants } from 'framer-motion';
import { BarChart2, Dumbbell, Send, Sparkles, Sword, Trash2, Wallet, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease, scrim } from '@/lib/motion';
import {
  sageAnalyzeFinances, sageAnalyzeHabits, sageChat, sagePlanWorkout, sageSuggestQuests,
} from '@/services/sage.service';
import { useUIStore } from '@/store/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button, IconChip, Input, useDialogBehavior } from '@/components/ui/lq';

interface Message {
  from: 'user' | 'sage';
  text: string;
}

type Action = 'quests' | 'habits' | 'finances' | 'gym';

const ACTIONS: Array<{ id: Action; label: string; icon: LucideIcon }> = [
  { id: 'quests', label: 'Ideas de misiones', icon: Sword },
  { id: 'habits', label: 'Analiza mis hábitos', icon: BarChart2 },
  { id: 'finances', label: 'Revisa mis finanzas', icon: Wallet },
  { id: 'gym', label: 'Plan de entrenamiento', icon: Dumbbell },
];

const STORAGE_KEY = 'sage-history';
const FALLBACK = 'No pude responder ahora mismo. Inténtalo de nuevo en un momento.';

const drawer: Variants = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.3, ease } },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

function loadHistory(): Message[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved)
      ? saved.filter((m): m is Message => typeof m === 'object' && m !== null
        && ((m as Message).from === 'user' || (m as Message).from === 'sage') && typeof (m as Message).text === 'string')
      : [];
  } catch {
    return [];
  }
}

const clean = (reply: unknown) => (typeof reply === 'string' && reply.trim() ? reply : FALLBACK);

/** Escritura progresiva de la última respuesta (visual); el texto completo va en sr-only. */
function Typewriter({ text }: { text: string }) {
  const reduce = useReducedMotionConfig();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    const id = window.setInterval(() => setN((i) => {
      if (i >= text.length) { window.clearInterval(id); return i; }
      return i + 3;
    }), 16);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  return (
    <>
      <span aria-hidden>{text.slice(0, n)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}

export function SagePanel({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const pending = useUIStore((s) => s.sagePendingMessage);
  const clearPending = useUIStore((s) => s.clearSagePending);
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [typing, setTyping] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useDialogBehavior(true, onClose);
  const endRef = useRef<HTMLDivElement>(null);
  const sentPending = useRef(false);
  const reduce = useReducedMotionConfig();
  // En móvil no se enfoca el campo al abrir (abriría el teclado encima).
  const isDesktop = useMediaQuery('(min-width: 768px)');

  async function ask(userText: string, request: () => Promise<string>) {
    setMessages((prev) => [...prev, { from: 'user', text: userText }]);
    setLoading(true);
    let reply = FALLBACK;
    try { reply = clean(await request()); } catch { /* FALLBACK */ }
    setMessages((prev) => {
      setTyping(prev.length);
      return [...prev, { from: 'sage', text: reply }];
    });
    setLoading(false);
  }

  // Mensaje contextual pendiente (Dashboard, menú…): se envía al abrir.
  useEffect(() => {
    if (!pending || sentPending.current) return;
    sentPending.current = true; // StrictMode monta dos veces
    clearPending();
    void ask(pending, async () => (await sageChat(pending)).reply);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages, loading, reduce]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-8))); } catch { /* sin storage */ }
  }, [messages]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    void ask(text, async () => (await sageChat(text)).reply);
  }

  function runAction(a: (typeof ACTIONS)[number]) {
    if (loading) return;
    void ask(a.label, async () => {
      if (a.id === 'quests') {
        const { quests } = await sageSuggestQuests();
        const list = Array.isArray(quests) ? (quests as Array<{ title: string; description: string; difficulty: string }>) : [];
        return list.length
          ? `Te propongo estas misiones:\n\n${list.map((q) => `• ${q.title} (${q.difficulty})\n  ${q.description}`).join('\n\n')}`
          : 'No tengo sugerencias de misiones por ahora.';
      }
      if (a.id === 'habits') return (await sageAnalyzeHabits()).reply;
      if (a.id === 'finances') return (await sageAnalyzeFinances()).reply;
      return (await sagePlanWorkout()).reply;
    });
  }

  return createPortal(
    <motion.div
      variants={scrim} initial="initial" animate="animate" exit="exit"
      className="fixed inset-0 z-[80] flex justify-end bg-[var(--scrim)]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={panelRef}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        variants={drawer}
        className="flex h-full w-full flex-col bg-background text-on-background shadow-lg outline-none md:max-w-[440px] md:rounded-l-3xl md:border-l md:border-border"
      >
        <header className="flex items-center gap-3 border-b border-border py-3 pl-4 pr-2 pt-[max(0.75rem,env(safe-area-inset-top))] md:pl-6">
          <IconChip icon={Sparkles} tone="secondary" size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-heading-sm">El Sabio</h2>
            <p className="text-body-sm text-on-surface-light">Tu consejero IA</p>
          </div>
          {messages.length > 0 && (
            <Button variant="icon" aria-label="Borrar conversación" disabled={loading} onClick={() => { setMessages([]); setTyping(null); }}>
              <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          )}
          <Button variant="icon" aria-label="Cerrar" onClick={onClose}>
            <X aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {messages.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
              <IconChip icon={Sparkles} tone="secondary" size="lg" />
              <div className="flex max-w-[300px] flex-col gap-1">
                <p className="text-heading-sm">¿En qué te ayudo hoy?</p>
                <p className="text-body-md text-on-surface-light">Pide ideas de misiones, analiza tus hábitos o tus finanzas, o pregunta lo que quieras.</p>
              </div>
            </div>
          ) : (
            <div role="log" aria-label="Conversación con el Sabio" className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-body-md',
                    m.from === 'user'
                      ? 'self-end rounded-br-md bg-primary-strong text-on-primary'
                      : 'self-start rounded-bl-md border border-border bg-surface text-on-background',
                  )}
                >
                  <span className="sr-only">{m.from === 'user' ? 'Tú: ' : 'El Sabio: '}</span>
                  {m.from === 'sage' && i === typing ? <Typewriter text={m.text} /> : m.text}
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
                  <span aria-hidden className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="size-2 rounded-full bg-on-surface-light"
                        animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.18 }}
                      />
                    ))}
                  </span>
                  <span className="text-body-sm text-on-surface-light">El Sabio está pensando…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-6">
          <ul aria-label="Acciones rápidas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {ACTIONS.map((a) => (
              <li key={a.id} className="shrink-0">
                <Button variant="secondary" size="sm" disabled={loading} onClick={() => runAction(a)}>
                  <a.icon aria-hidden className="size-4" strokeWidth={1.75} />{a.label}
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={submit} className="flex items-center gap-2">
            <Input
              aria-label="Mensaje para el Sabio"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              maxLength={500}
              data-autofocus={isDesktop || undefined}
            />
            <Button type="submit" aria-label="Enviar" disabled={!input.trim() || loading} className="size-12 shrink-0 rounded-full p-0">
              <Send aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          </form>
          <p className="text-center text-body-sm text-on-surface-light">El Sabio puede equivocarse. Verifica las decisiones importantes.</p>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
