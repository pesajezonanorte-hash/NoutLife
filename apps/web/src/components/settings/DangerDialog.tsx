// Acciones irreversibles de la cuenta: reiniciar o eliminar. Se confirman
// escribiendo una palabra. Lo usa Ajustes.
import { useEffect, useState, type FormEvent } from 'react';
import api from '@/lib/api';
import * as authService from '@/services/auth.service';
import { Button, Field, Input, Modal } from '@/components/ui/lq';
import { useLocale, useText, type Copy } from '@/lib/i18n';

/** Palabra que se escribe para confirmar cada acción irreversible. */
const DANGER_WORD = { reset: 'REINICIAR', delete: 'ELIMINAR' } as const;
const DANGER_WORD_EN = { reset: 'RESET', delete: 'DELETE' } as const;

const COPY: Copy<{
  deleteTitle: string; resetTitle: string; deleteBody: string; resetBody: string; confirm: (w: string) => string;
  cancel: string; deleteBtn: string; resetBtn: string; failed: string;
}> = {
  es: {
    deleteTitle: '¿Eliminar tu cuenta?', resetTitle: '¿Reiniciar tu cuenta?',
    deleteBody: 'Se borran para siempre tu cuenta y todos tus datos: personaje, zonas, cartas, fotos y videos. No se puede deshacer.',
    resetBody: 'Se borran para siempre tu personaje, XP, Gold y todos tus registros, también los del Coliseo. Tu cuenta se conserva y empiezas de cero.',
    confirm: (w) => `Escribe ${w} para confirmar`, cancel: 'Cancelar', deleteBtn: 'Eliminar cuenta', resetBtn: 'Reiniciar cuenta',
    failed: 'No se pudo completar. Inténtalo de nuevo.',
  },
  en: {
    deleteTitle: 'Delete your account?', resetTitle: 'Reset your account?',
    deleteBody: 'Your account and all your data are erased forever: character, zones, letters, photos and videos. This cannot be undone.',
    resetBody: 'Your character, XP, Gold and all your records, including Coliseum ones, are erased forever. Your account is kept and you start from zero.',
    confirm: (w) => `Type ${w} to confirm`, cancel: 'Cancel', deleteBtn: 'Delete account', resetBtn: 'Reset account',
    failed: "We couldn't complete it. Try again.",
  },
};

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
  const t = useText(COPY);
  const locale = useLocale();
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (mode) { setWord(''); setError(''); } }, [mode]);
  const words = locale === 'en' ? DANGER_WORD_EN : DANGER_WORD;
  const target = mode ? words[mode] : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'delete') await authService.deleteAccount();
      else await api.post('/auth/factory-reset', { confirmation: 'RESET_MY_NOUTLIFE' });
      clearLocalAccountState();
      window.location.assign(mode === 'delete' ? '/login' : '/');
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t.failed);
      setBusy(false);
    }
  }
  return (
    <Modal open={mode !== null} onClose={onClose} title={mode === 'delete' ? t.deleteTitle : t.resetTitle}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">{mode === 'delete' ? t.deleteBody : t.resetBody}</p>
        <Field label={t.confirm(target)} error={error || undefined}>
          <Input value={word} onChange={(e) => setWord(e.target.value.toUpperCase())} autoCapitalize="characters" spellCheck={false} className="font-mono" />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" variant="danger" size="md" loading={busy} disabled={word !== target}>{mode === 'delete' ? t.deleteBtn : t.resetBtn}</Button>
        </div>
      </form>
    </Modal>
  );
}
