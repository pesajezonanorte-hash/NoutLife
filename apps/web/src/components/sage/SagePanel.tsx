import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Sparkles, Sword, BarChart2, DollarSign, Dumbbell } from 'lucide-react';
import {
  sageChat,
  sageSuggestQuests,
  sageAnalyzeHabits,
  sageAnalyzeFinances,
  sagePlanWorkout,
} from '../../services/sage.service';
import { useUIStore } from '../../store/uiStore';
import { E } from '@/components/ui/glyphs';

interface Props {
  onClose: () => void;
}

type TabId = 'chat' | 'quests' | 'habits' | 'finances' | 'gym';

interface Message {
  from: 'user' | 'sage';
  text: string;
}

const STORAGE_KEY = 'sage-history';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'chat', label: 'Chat', icon: <Sparkles size={14} /> },
  { id: 'quests', label: 'Misiones', icon: <Sword size={14} /> },
  { id: 'habits', label: 'Habitos', icon: <BarChart2 size={14} /> },
  { id: 'finances', label: 'Finanzas', icon: <DollarSign size={14} /> },
  { id: 'gym', label: 'Gym', icon: <Dumbbell size={14} /> },
];

function TypewriterText({ text, onDone }: { text: string; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
        onDone?.();
      }
    }, 14);
    return () => clearInterval(interval);
  }, [text, onDone]);

  return <span>{displayed}{!done && <span className="animate-pulse">|</span>}</span>;
}

export function SagePanel({ onClose }: Props) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const { sagePendingMessage, clearSagePending } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(saved)
        ? saved.filter((message): message is Message => (
          typeof message === 'object'
          && message !== null
          && (message as Message).from !== undefined
          && ((message as Message).from === 'user' || (message as Message).from === 'sage')
          && typeof (message as Message).text === 'string'
        ))
        : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestSageMsg, setLatestSageMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-send contextual message if one is pending
  useEffect(() => {
    if (sagePendingMessage) {
      clearSagePending();
      const msg = sagePendingMessage;
      setMessages((prev) => [...prev, { from: 'user', text: msg }]);
      setLoading(true);
      sageChat(msg)
        .then(({ reply }) => {
          const safeReply = typeof reply === 'string' && reply.trim()
            ? reply
            : 'No pude responder ahora mismo.';
          setLatestSageMsg(safeReply);
          setMessages((prev) => [...prev, { from: 'sage', text: safeReply }]);
        })
        .catch(() => {
          setMessages((prev) => [...prev, { from: 'sage', text: 'No pude responder ahora mismo.' }]);
        })
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-8)));
  }, [messages]);

  const addSageReply = (text: string) => {
    setLatestSageMsg(text);
    setMessages((prev) => [...prev, { from: 'sage', text }]);
  };

  const handleChat = async () => {
    if (!input.trim() || loading) return;
    const message = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { from: 'user', text: message }]);
    setLoading(true);
    try {
      const { reply } = await sageChat(message);
      addSageReply(typeof reply === 'string' && reply.trim() ? reply : 'No pude responder ahora mismo.');
    } catch {
      addSageReply('No pude responder eso ahora mismo. Intentalo de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: TabId) => {
    if (loading) return;
    setLoading(true);
    try {
      let reply = '';

      if (action === 'quests') {
        const { quests } = await sageSuggestQuests();
        if (Array.isArray(quests) && quests.length > 0) {
          reply = `Nuevas misiones sugeridas:\n\n${(quests as Array<{ type: string; title: string; description: string; difficulty: string }>).map(
            (q) => `- [${q.type}] ${q.title}\n  ${q.description} (${q.difficulty})`
          ).join('\n\n')}`;
        } else {
          reply = 'No hay sugerencias de misiones por el momento.';
        }
      } else if (action === 'habits') {
        reply = (await sageAnalyzeHabits()).reply;
      } else if (action === 'finances') {
        reply = (await sageAnalyzeFinances()).reply;
      } else if (action === 'gym') {
        reply = (await sagePlanWorkout()).reply;
      }

      addSageReply(typeof reply === 'string' && reply.trim() ? reply : 'No pude terminar ese análisis ahora mismo.');
    } catch {
      addSageReply('No pude terminar ese analisis ahora mismo. Intentalo en un rato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex justify-end bg-[var(--bg-overlay)] backdrop-blur-[2px]" onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Asistente IA"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[420px] flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl"
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-panel-light)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
              <Sparkles size={18} className="text-[var(--accent-gold)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em]">Asistente IA</h2>
              <p className="text-xs text-[var(--text-secondary)]">Claro, motivador y adaptado a ti</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] sm:h-9 sm:w-9"
          >
            <X size={18} />
          </button>
        </header>

        <nav className="grid grid-cols-3 gap-1.5 border-b border-[var(--border)] px-4 py-3 sm:flex sm:gap-2 sm:overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'chat') handleAction(tab.id);
              }}
              className={[
                'flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors sm:px-3',
                activeTab === tab.id
                  ? 'bg-[var(--text-primary)] text-white'
                  : 'bg-[var(--bg-panel-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-panel-light)]">
                <Sparkles size={22} className="text-[var(--accent-gold)]" />
              </div>
              <div>
                <p className="text-sm font-medium">Tu asistente esta listo.</p>
                <p className="mt-1 max-w-[280px] text-sm text-[var(--text-secondary)]">
                  Pide ideas para misiones, analiza tus finanzas o recibe una rutina de ejercicios.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                    msg.from === 'user'
                      ? 'rounded-tr-md bg-[var(--text-primary)] text-[var(--bg-deep)] font-medium'
                      : 'rounded-tl-md border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  {msg.from === 'sage' && index === messages.length - 1 && msg.text === latestSageMsg ? (
                    <TypewriterText text={msg.text} />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-[var(--text-muted)]"
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {activeTab === 'chat' && (
          <div className="border-t border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-4">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                placeholder="Escribe lo que necesitas..."
                disabled={loading}
                className="flex-1 bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleChat}
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--text-primary)] text-white disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
              La IA puede equivocarse. Verifica decisiones importantes.
            </p>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}
