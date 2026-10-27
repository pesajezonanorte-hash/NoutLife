// Denunciar a una persona (y, si se quiere, explicar por qué). Llega al equipo
// como feedback de tipo «report» para revisarlo; bloquear sigue siendo aparte.
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToastStore } from '@/hooks/useToast';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { Button, Field, Modal } from '@/components/ui/lq';

const es = {
  reasonsLabel: 'Motivo',
  details: 'Detalles (opcional)',
  title: (name: string): string => `Denunciar a ${name}`,
  cancel: 'Cancelar',
  send: 'Enviar denuncia',
  sent: 'Denuncia enviada',
  sentBody: 'La revisaremos. Si te sientes en peligro, bloquea a esta persona.',
  fail: 'No se pudo enviar la denuncia',
};

const en: typeof es = {
  reasonsLabel: 'Reason',
  details: 'Details (optional)',
  title: (name: string): string => `Report ${name}`,
  cancel: 'Cancel',
  send: 'Send report',
  sent: 'Report sent',
  sentBody: 'We will review it. If you feel unsafe, block this person.',
  fail: 'The report could not be sent',
};

const COPY: Copy<typeof es> = { es, en };

/** Motivos: el valor en español es el que llega al equipo; el texto visible cambia con el idioma. */
const REASONS = [
  { value: 'Acoso o amenazas', label: { es: 'Acoso o amenazas', en: 'Harassment or threats' } },
  { value: 'Contenido sexual o violento', label: { es: 'Contenido sexual o violento', en: 'Sexual or violent content' } },
  { value: 'Odio o discriminación', label: { es: 'Odio o discriminación', en: 'Hate or discrimination' } },
  { value: 'Spam o estafa', label: { es: 'Spam o estafa', en: 'Spam or scam' } },
  { value: 'Suplantación', label: { es: 'Suplantación', en: 'Impersonation' } },
  { value: 'Otro motivo', label: { es: 'Otro motivo', en: 'Other reason' } },
];

export function ReportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: { id: string; username?: string; displayName: string } }) {
  const t = useText(COPY);
  const locale = useLocale();
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(REASONS[0].value); setDetails(''); } }, [open]);

  async function send() {
    setBusy(true);
    try {
      await api.post('/feedback', {
        kind: 'report',
        message: `Denuncia contra @${target.username ?? '?'} (${target.id}) · ${reason}${details.trim() ? ` · ${details.trim()}` : ''}`,
        url: window.location.pathname + window.location.search,
      });
      useToastStore.getState().success(t.sent, t.sentBody);
      onClose();
    } catch {
      useToastStore.getState().error(t.fail);
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.title(target.displayName.split(' ')[0])}>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.reasonsLabel}>
        {REASONS.map((r) => (
          <label key={r.value} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-body-md hover:bg-surface-variant">
            <input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} className="size-5 accent-[rgb(var(--lq-primary))]" />{r.label[locale]}
          </label>
        ))}
      </div>
      <Field label={t.details}>
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={3}
          className="w-full rounded-md border border-border-strong bg-surface-variant px-3 py-2 text-body-md focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-primary" />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="md" onClick={onClose}>{t.cancel}</Button>
        <Button variant="danger" size="md" loading={busy} onClick={() => void send()}>{t.send}</Button>
      </div>
    </Modal>
  );
}
