import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { E } from '@/components/ui/glyphs';
import { ModalFrame } from '@/components/ui/ModalFrame';

type Kind = 'bug' | 'idea' | 'other';

interface FeedbackButtonProps {
  variant?: 'desktop' | 'mobile' | 'inline' | 'dock';
  className?: string;
}

export function FeedbackButton({ variant = 'desktop', className = '' }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('idea');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kbHeight = useKeyboardHeight();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  async function submit() {
    if (message.trim().length < 3) {
      setError('El mensaje es muy corto.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/feedback', { kind, message: message.trim(), url: window.location.pathname });
      setSent(true);
      setMessage('');
      setTimeout(() => { setOpen(false); setSent(false); }, 1800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {variant === 'mobile' || variant === 'dock' ? (
        <motion.button
          onClick={() => setOpen(true)}
          whileTap={{ scale: 0.96 }}
          title="Feedback"
          aria-label="Enviar feedback"
          className={variant === 'dock'
            ? `flex h-full w-full items-center justify-center rounded-[10px] text-[var(--accent-gold)] transition-colors hover:bg-[var(--bg-panel-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${className}`
            : `flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${className}`}
          style={variant === 'dock'
            ? { border: 'none', background: 'transparent' }
            : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent-gold)' }}
        >
          <MessageSquare size={variant === 'dock' ? 16 : 14} className={variant === 'dock' ? 'h-[80%] w-[80%]' : undefined} />
        </motion.button>
      ) : (
        <motion.button
          onClick={() => setOpen(true)}
          whileTap={{ scale: 0.96 }}
          title="Enviar feedback"
          className={`flex items-center gap-1.5 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--accent-gold)] hover:border-[var(--accent-gold)]/60 transition-all font-semibold ${className}`}
          style={{ height: 38 }}
        >
          <MessageSquare size={15} className="text-[var(--accent-gold)]" />
          <span className="hidden xl:inline text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>
            Feedback
          </span>
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <ModalFrame
            title="Enviar feedback"
            description="Comparte una idea, un error o cualquier comentario para mejorar LifeQuest."
            icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
            onClose={() => !submitting && setOpen(false)}
            closeLabel="Cerrar formulario de feedback"
            panelStyle={kbHeight > 0 ? { maxHeight: `calc(100vh - ${kbHeight}px - 20px)` } : undefined}
            footer={!sent ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="min-h-10 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || message.trim().length < 3}
                  className="min-h-10 rounded-xl border border-[var(--accent-gold)] bg-[var(--accent-gold)] px-4 text-sm font-semibold text-[var(--bg-deep)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Enviar feedback'}
                </button>
              </div>
            ) : undefined}
          >
            {sent ? (
              <div className="flex min-h-32 flex-col items-center justify-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-green)]/10 text-2xl"><E e="🙏" /></span>
                <p className="mt-3 text-base font-semibold text-[var(--text-primary)]">¡Gracias! Recibido.</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Tu comentario ayudará a mejorar la aventura.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Tipo de feedback</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {([['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Otro']] as [Kind, string][]).map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        aria-pressed={kind === k}
                        className={`min-h-10 rounded-xl border px-3 text-sm font-medium transition-colors ${
                          kind === k
                            ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--text-primary)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Tu mensaje</span>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Cuéntanos qué pasó, qué te gustaría, o cualquier comentario…"
                    className="min-h-28 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]"
                    maxLength={2000}
                  />
                </label>
                <div className="flex min-h-4 items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{message.length}/2000</span>
                  {error && <span className="text-[var(--accent-red)]">{error}</span>}
                </div>
              </div>
            )}
          </ModalFrame>
        )}
      </AnimatePresence>
    </>
  );
}

