// Permiso de avisos en contexto (plan v3, T6): se pide justo después del primer
// hábito o ritual cumplido, con la hora a la que la persona quiere el recordatorio.
// En iPhone sin instalar, los avisos web no llegan: se muestra la guía para añadir
// NoutLife a la pantalla de inicio.
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { enablePush, pushMessagesFor, pushSupport } from '../../services/notification.service';
import { FIRST_CHECK_EVENT, FIRST_CHECK_KEY, updateHabit } from '../../services/habit.service';
import { Button, Field, IconChip, Input, ResponsiveDialog } from '@/components/ui/lq';
import { IosInstallSteps } from '@/components/ui/PWAInstallBanner';
import { useToastStore } from '@/hooks/useToast';
import { track } from '@/lib/analytics';
import { useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  titleIos: 'Recibe tus recordatorios en iPhone',
  title: '¿Te aviso mañana a esta hora?',
  bodyIos: 'En iPhone los avisos llegan solo con NoutLife en tu pantalla de inicio. Instálala así y actívalos desde Ajustes.',
  body: 'Un recordatorio para seguir con lo que empezaste hoy. Nada de lo que ya hiciste te va a sonar.',
  timeLabel: 'Hora del recordatorio',
  gotIt: 'Entendido',
  notNow: 'Ahora no',
  yes: 'Sí, avísame',
};

const en: typeof es = {
  titleIos: 'Get your reminders on iPhone',
  title: 'Remind you tomorrow at this time?',
  bodyIos: 'On iPhone, alerts only arrive with NoutLife on your home screen. Add it that way, then turn them on in Settings.',
  body: 'A reminder to keep going with what you started today. Nothing you already did will ring.',
  timeLabel: 'Reminder time',
  gotIt: 'Got it',
  notNow: 'Not now',
  yes: 'Yes, remind me',
};

const COPY: Copy<typeof es> = { es, en };

const PREF_KEY = 'notif-perm-asked';

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };

/** Marca que ya se preguntó. */
export function markNotificationsAsked() {
  try { localStorage.setItem(PREF_KEY, '1'); } catch { /* sin storage */ }
}

function canAsk() {
  const support = pushSupport();
  const permission = 'Notification' in window ? Notification.permission : 'denied';
  return !read(PREF_KEY) && (support === 'ios-install' || (support === 'ok' && permission === 'default'));
}

/** Abierto tras el primer hábito cumplido (también si fue en otra visita y aún no se preguntó). */
export function useNotificationModalState() {
  const [show, setShow] = useState(() => Boolean(read(FIRST_CHECK_KEY)) && canAsk());
  useEffect(() => {
    const open = () => { if (canAsk()) setShow(true); };
    window.addEventListener(FIRST_CHECK_EVENT, open);
    return () => window.removeEventListener(FIRST_CHECK_EVENT, open);
  }, []);
  return { show, setShow };
}

/** La hora de ahora, redondeada a 5 minutos («HH:mm»): «¿te aviso mañana a esta hora?». */
function nowRounded() {
  const d = new Date(Math.round(Date.now() / 300_000) * 300_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function NotificationPermissionModal({ onClose }: { onClose: () => void }) {
  const t = useText(COPY);
  const PUSH_MESSAGES = pushMessagesFor(useLocale());
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(nowRounded);
  const needsInstall = pushSupport() === 'ios-install';
  // El hábito que se acaba de cumplir (un ritual guarda '1': sin hora propia que fijar).
  const habitId = read(FIRST_CHECK_KEY);

  useEffect(() => { track('push_prompt_shown', { ios_install: needsInstall }); }, [needsInstall]);

  async function handleAccept() {
    setLoading(true);
    markNotificationsAsked();
    try {
      const result = await enablePush();
      track('push_permission_result', { result });
      if (result !== 'ok') { useToastStore.getState().error(PUSH_MESSAGES[result]); return; }
      if (habitId && habitId !== '1') await updateHabit(habitId, { reminderTime: time }).catch(() => null);
      useToastStore.getState().success(PUSH_MESSAGES.ok);
    } finally {
      setLoading(false);
      onClose();
    }
  }

  function handleDeny() {
    markNotificationsAsked();
    track('push_permission_result', { result: needsInstall ? 'ios-install' : 'dismissed' });
    onClose();
  }

  return (
    <ResponsiveDialog open onClose={handleDeny} title={needsInstall ? t.titleIos : t.title}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <IconChip icon={Bell} tone="primary" />
          <p className="text-body-lg text-on-surface">
            {needsInstall ? t.bodyIos : t.body}
          </p>
        </div>
        {needsInstall ? (
          <IosInstallSteps />
        ) : habitId && habitId !== '1' && (
          <Field label={t.timeLabel}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value || time)} />
          </Field>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {needsInstall ? (
            <Button size="md" onClick={handleDeny}>{t.gotIt}</Button>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={handleDeny}>{t.notNow}</Button>
              <Button size="md" loading={loading} onClick={() => void handleAccept()}>{t.yes}</Button>
            </>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
