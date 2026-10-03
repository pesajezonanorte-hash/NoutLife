import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { Button, Field, ResponsiveDialog, SegmentedControl, Textarea } from '@/components/ui/lq';
import { useShellStore } from '@/store/shellStore';

type Kind = 'bug' | 'idea' | 'other';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'idea', label: 'Idea' }, { value: 'bug', label: 'Error' }, { value: 'other', label: 'Otro' },
];

/** Feedback (POST /feedback, mismo contrato que el FeedbackButton heredado). */
export function FeedbackDialog() {
  const open = useShellStore((s) => s.feedbackOpen);
  const setOpen = useShellStore((s) => s.setFeedbackOpen);
  const [kind, setKind] = useState<Kind>('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => { setOpen(false); setSent(false); setError(null); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) { setError('Escribe al menos 3 caracteres.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post('/feedback', { kind, message: message.trim(), url: window.location.pathname });
      setSent(true);
      setMessage('');
    } catch {
      setError('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={close} title={sent ? '¡Gracias!' : 'Enviar feedback'}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center" role="status">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-success/[var(--lq-soft-alpha)] text-success-text">
            <CheckCircle2 aria-hidden className="size-8" strokeWidth={1.75} />
          </span>
          <p className="text-body-md text-on-surface">Recibimos tu comentario. Nos ayuda a mejorar la aventura.</p>
          <Button block onClick={close} data-autofocus>Cerrar</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <SegmentedControl role="radiogroup" label="Tipo de feedback" value={kind} onChange={setKind} options={KINDS} />
          <Field label="Tu mensaje" error={error ?? undefined} help={`${message.length}/2000`}>
            <Textarea data-autofocus maxLength={2000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Cuéntanos qué mejorarías…" />
          </Field>
          <Button type="submit" block loading={saving}>Enviar</Button>
        </form>
      )}
    </ResponsiveDialog>
  );
}
