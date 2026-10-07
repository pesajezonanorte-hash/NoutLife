// Denunciar a una persona (y, si se quiere, explicar por qué). Llega al equipo
// como feedback de tipo «report» para revisarlo; bloquear sigue siendo aparte.
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useToastStore } from '@/hooks/useToast';
import { Button, Field, Modal } from '@/components/ui/lq';

const REASONS = ['Acoso o amenazas', 'Contenido sexual o violento', 'Odio o discriminación', 'Spam o estafa', 'Suplantación', 'Otro motivo'];

export function ReportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: { id: string; username?: string; displayName: string } }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason(REASONS[0]); setDetails(''); } }, [open]);

  async function send() {
    setBusy(true);
    try {
      await api.post('/feedback', {
        kind: 'report',
        message: `Denuncia contra @${target.username ?? '?'} (${target.id}) · ${reason}${details.trim() ? ` · ${details.trim()}` : ''}`,
        url: window.location.pathname + window.location.search,
      });
      useToastStore.getState().success('Denuncia enviada', 'La revisaremos. Si te sientes en peligro, bloquea a esta persona.');
      onClose();
    } catch {
      useToastStore.getState().error('No se pudo enviar la denuncia');
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Denunciar a ${target.displayName.split(' ')[0]}`}>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Motivo">
        {REASONS.map((r) => (
          <label key={r} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-body-md hover:bg-surface-variant">
            <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-[rgb(var(--lq-primary))]" />{r}
          </label>
        ))}
      </div>
      <Field label="Detalles (opcional)">
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={3}
          className="w-full rounded-md border border-border-strong bg-surface-variant px-3 py-2 text-body-md focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-primary" />
      </Field>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" size="md" loading={busy} onClick={() => void send()}>Enviar denuncia</Button>
      </div>
    </Modal>
  );
}
