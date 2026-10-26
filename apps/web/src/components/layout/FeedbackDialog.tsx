import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { Button, Field, ResponsiveDialog, SegmentedControl, Textarea } from '@/components/ui/lq';
import { useShellStore } from '@/store/shellStore';
import { useLocale, type Copy } from '@/lib/i18n';

type Kind = 'bug' | 'idea' | 'other';

const es = {
  kinds: [{ value: 'idea', label: 'Idea' }, { value: 'bug', label: 'Error' }, { value: 'other', label: 'Otro' }] as { value: Kind; label: string }[],
  thanks: '¡Gracias!',
  title: 'Enviar feedback',
  group: 'Tipo de feedback',
  message: 'Tu mensaje',
  placeholder: 'Cuéntanos qué mejorarías…',
  send: 'Enviar',
  close: 'Cerrar',
  received: 'Recibimos tu comentario. Nos ayuda a mejorar la aventura.',
  tooShort: 'Escribe al menos 3 caracteres.',
  failed: 'No se pudo enviar. Inténtalo de nuevo.',
};

const en: typeof es = {
  kinds: [{ value: 'idea', label: 'Idea' }, { value: 'bug', label: 'Bug' }, { value: 'other', label: 'Other' }],
  thanks: 'Thank you!',
  title: 'Send feedback',
  group: 'Feedback type',
  message: 'Your message',
  placeholder: 'Tell us what you would improve…',
  send: 'Send',
  close: 'Close',
  received: 'We received your feedback. It helps us make NoutLife better.',
  tooShort: 'Write at least 3 characters.',
  failed: "It couldn't be sent. Try again.",
};

const COPY: Copy<typeof es> = { es, en };

/** Feedback (POST /feedback, mismo contrato que el FeedbackButton heredado). */
export function FeedbackDialog() {
  const t = COPY[useLocale()];
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
    if (message.trim().length < 3) { setError(t.tooShort); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post('/feedback', { kind, message: message.trim(), url: window.location.pathname });
      setSent(true);
      setMessage('');
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={close} title={sent ? t.thanks : t.title}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center" role="status">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-success/[var(--lq-soft-alpha)] text-success-text">
            <CheckCircle2 aria-hidden className="size-8" strokeWidth={1.75} />
          </span>
          <p className="text-body-md text-on-surface">{t.received}</p>
          <Button block onClick={close} data-autofocus>{t.close}</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <SegmentedControl role="radiogroup" label={t.group} value={kind} onChange={setKind} options={t.kinds} />
          <Field label={t.message} error={error ?? undefined} help={`${message.length}/2000`}>
            <Textarea data-autofocus maxLength={2000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.placeholder} />
          </Field>
          <Button type="submit" block loading={saving}>{t.send}</Button>
        </form>
      )}
    </ResponsiveDialog>
  );
}
