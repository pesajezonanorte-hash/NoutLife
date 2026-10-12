// Acciones irreversibles de la cuenta: reiniciar o eliminar. Se confirman
// escribiendo una palabra. Lo usan Ajustes y el paywall de entrada (quien no
// quiere continuar puede eliminar su cuenta sin vincular un método de pago).
import { useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import * as authService from '@/services/auth.service';
import { Button, Field, Input, Modal } from '@/components/ui/lq';

/** Palabra que se escribe para confirmar cada acción irreversible. */
const DANGER_WORD = { reset: 'REINICIAR', delete: 'ELIMINAR' } as const;

/**
 * Tras reiniciar o eliminar: borra el estado local de la cuenta (tutorial,
 * borradores, Sabio…) y recarga, para que no quede nada de antes en pantalla.
 * Se conservan solo las preferencias del dispositivo.
 */
function clearLocalAccountState() {
  const keep = new Set(['lq_audio', 'lq_pwa_dismissed', 'lq-nav-sections', 'lq_device_id']);
  try {
    for (const k of Object.keys(localStorage)) if (/^lq[-_]/.test(k) && !keep.has(k)) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch { /* sin storage */ }
}

export function DangerDialog({ mode, onClose }: { mode: 'reset' | 'delete' | null; onClose: () => void }) {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (mode) { setWord(''); setError(''); } }, [mode]);
  const target = mode ? DANGER_WORD[mode] : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'delete') await authService.deleteAccount();
      else await api.post('/auth/factory-reset', { confirmation: 'RESET_MY_NOUTLIFE' });
      clearLocalAccountState();
      window.location.assign(mode === 'delete' ? '/login' : '/');
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo completar. Inténtalo de nuevo.');
      setBusy(false);
    }
  }
  return (
    <Modal open={mode !== null} onClose={onClose} title={mode === 'delete' ? '¿Eliminar tu cuenta?' : '¿Reiniciar tu cuenta?'}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">
          {mode === 'delete'
            ? 'Se borran para siempre tu cuenta y todos tus datos: personaje, zonas, cartas, fotos y videos. No se puede deshacer.'
            : 'Se borran para siempre tu personaje, XP, Gold y todos tus registros, también los del gimnasio. Tu cuenta se conserva y empiezas de cero.'}
        </p>
        <Field label={`Escribe ${target} para confirmar`} error={error || undefined}>
          <Input value={word} onChange={(e) => setWord(e.target.value.toUpperCase())} autoCapitalize="characters" spellCheck={false} className="font-mono" />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger" size="md" loading={busy} disabled={word !== target}>{mode === 'delete' ? 'Eliminar cuenta' : 'Reiniciar cuenta'}</Button>
        </div>
      </form>
    </Modal>
  );
}
