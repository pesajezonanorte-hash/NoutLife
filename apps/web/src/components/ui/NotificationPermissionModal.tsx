import { useState } from 'react';
import { Bell } from 'lucide-react';
import { requestPermissionAndSubscribe } from '../../services/notification.service';
import { Button, IconChip, ResponsiveDialog } from '@/components/ui/lq';

const PREF_KEY = 'notif-perm-asked';

export function useNotificationModalState() {
  const alreadyAsked = localStorage.getItem(PREF_KEY);
  const permStatus = 'Notification' in window ? Notification.permission : 'denied';
  const [show, setShow] = useState(
    !alreadyAsked && permStatus === 'default',
  );
  return { show, setShow };
}

interface Props {
  onClose: () => void;
}

export function NotificationPermissionModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    localStorage.setItem(PREF_KEY, '1');
    try {
      await requestPermissionAndSubscribe();
    } finally {
      setLoading(false);
      onClose();
    }
  }

  function handleDeny() {
    localStorage.setItem(PREF_KEY, '1');
    onClose();
  }

  return (
    <ResponsiveDialog open onClose={handleDeny} title="¿Activamos los avisos?">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <IconChip icon={Bell} tone="primary" />
          <p className="text-body-lg text-on-surface">
            Te avisaremos cuando estés a punto de perder tu racha o tengas misiones pendientes. Sin spam.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={handleDeny}>Ahora no</Button>
          <Button size="md" loading={loading} onClick={() => void handleAccept()}>Sí, activar</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
