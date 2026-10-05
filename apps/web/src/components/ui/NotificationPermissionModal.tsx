import { useState } from 'react';
import { Bell } from 'lucide-react';
import { enablePush, PUSH_MESSAGES, pushSupport } from '../../services/notification.service';
import { Button, IconChip, ResponsiveDialog } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';

const PREF_KEY = 'notif-perm-asked';

/** Marca que ya se preguntó (p. ej. desde el tutorial de bienvenida). */
export function markNotificationsAsked() {
  try { localStorage.setItem(PREF_KEY, '1'); } catch { /* sin storage */ }
}

export function useNotificationModalState() {
  let alreadyAsked: string | null = null;
  try { alreadyAsked = localStorage.getItem(PREF_KEY); } catch { /* sin storage */ }
  const support = pushSupport();
  const permStatus = 'Notification' in window ? Notification.permission : 'denied';
  const [show, setShow] = useState(!alreadyAsked && (support === 'ios-install' || (support === 'ok' && permStatus === 'default')));
  return { show, setShow };
}

interface Props {
  onClose: () => void;
}

export function NotificationPermissionModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const needsInstall = pushSupport() === 'ios-install';

  async function handleAccept() {
    setLoading(true);
    markNotificationsAsked();
    try {
      const result = await enablePush();
      if (result === 'ok') useToastStore.getState().success(PUSH_MESSAGES.ok);
      else useToastStore.getState().error(PUSH_MESSAGES[result]);
    } finally {
      setLoading(false);
      onClose();
    }
  }

  function handleDeny() {
    markNotificationsAsked();
    onClose();
  }

  return (
    <ResponsiveDialog open onClose={handleDeny} title={needsInstall ? 'Recibe tus recordatorios' : '¿Activamos los avisos?'}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <IconChip icon={Bell} tone="primary" />
          <p className="text-body-lg text-on-surface">
            {needsInstall
              ? PUSH_MESSAGES['ios-install']
              : 'Te avisamos a la hora de tus hábitos, antes de tus eventos y cuando una misión está por vencer. Sin spam.'}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {needsInstall ? (
            <Button size="md" onClick={handleDeny}>Entendido</Button>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={handleDeny}>Ahora no</Button>
              <Button size="md" loading={loading} onClick={() => void handleAccept()}>Sí, activar</Button>
            </>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
