// Invitación a los avisos al entrar por primera vez (al terminar el registro o en el primer inicio de sesión
// en este dispositivo). El permiso del sistema solo se pide al pulsar «Activar»: si no, un rechazo aquí sería
// para siempre. «Ahora no» deja la segunda oportunidad tras el primer hábito cumplido (NotificationPermissionModal).
import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock, ReceiptText, Sprout, type LucideIcon } from 'lucide-react';
import { Button, IconChip, ResponsiveDialog } from '@/components/ui/lq';
import { IosInstallSteps } from '@/components/ui/PWAInstallBanner';
import { useToastStore } from '@/hooks/useToast';
import { track } from '@/lib/analytics';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { enablePush, notificationPermission, pushMessagesFor, pushSupport } from '@/services/notification.service';
import { useShellStore } from '@/store/shellStore';
import { markNotificationsAsked, wasAskedAboutNotifications } from './NotificationPermissionModal';

const es = {
  title: 'Que nada importante se te pase',
  body: 'NoutLife te avisa con calma, solo de lo que te importa:',
  habits: 'Tus hábitos, cuando les toca',
  agenda: 'Tu agenda, antes de que empiece',
  money: 'Deudas y recibos, antes de que venzan',
  note: 'Tú eliges qué y cuándo, desde Ajustes.',
  enable: 'Activar avisos',
  notNow: 'Ahora no',
  titleIos: 'Recibe tus avisos en iPhone',
  bodyIos: 'En iPhone los avisos llegan solo con NoutLife en tu pantalla de inicio. Añádela así y actívalos desde Ajustes.',
  gotIt: 'Entendido',
};

const en: typeof es = {
  title: 'Never miss what matters',
  body: 'NoutLife gives you a calm heads-up, only about what matters to you:',
  habits: 'Your habits, right when they’re due',
  agenda: 'Your agenda, before it starts',
  money: 'Debts and bills, before they’re due',
  note: 'You choose what and when, in Settings.',
  enable: 'Turn on alerts',
  notNow: 'Not now',
  titleIos: 'Get your alerts on iPhone',
  bodyIos: 'On iPhone, alerts only arrive with NoutLife on your home screen. Add it that way, then turn them on in Settings.',
  gotIt: 'Got it',
};

const COPY: Copy<typeof es> = { es, en };

const inviteKey = (userId: string) => `lq-notif-invite:${userId}`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* sin storage: se verá otra vez */ } };

/** El splash de arranque (#lq-boot, por encima de todo) sigue a la vista un momento después de montar la app. */
function useSplashGone() {
  const [gone, setGone] = useState(() => !document.getElementById('lq-boot'));
  useEffect(() => {
    if (gone) return undefined;
    const observer = new MutationObserver(() => { if (!document.getElementById('lq-boot')) setGone(true); });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, [gone]);
  return gone;
}

/** Abre la invitación una vez por cuenta y dispositivo, si el sistema aún no tiene respuesta. Mientras se decide y mientras está abierta, lo demás espera. */
export function useNotificationInvite(userId: string | undefined, ready: boolean) {
  const open = useShellStore((s) => s.inviteOpen);
  const settled = useShellStore((s) => s.inviteSettled);
  const splashGone = useSplashGone();
  const decidedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !userId || !splashGone || decidedFor.current === userId) return;
    decidedFor.current = userId;
    const settle = () => useShellStore.setState({ inviteOpen: false, inviteSettled: true });
    const support = pushSupport();
    if (read(inviteKey(userId)) || wasAskedAboutNotifications() || support === 'unsupported') { settle(); return; }
    useShellStore.setState({ inviteSettled: false });
    void notificationPermission().then((permission) => {
      if (support === 'ios-install' || permission === 'default') useShellStore.setState({ inviteOpen: true });
      else settle();
    }, settle);
  }, [userId, ready, splashGone]);
  return { open, settled };
}

export function NotificationInvite({ userId }: { userId: string }) {
  const t = useText(COPY);
  const locale = useLocale();
  const messages = pushMessagesFor(locale);
  const [loading, setLoading] = useState(false);
  const needsInstall = pushSupport() === 'ios-install';
  const close = () => {
    write(inviteKey(userId));
    useShellStore.setState({ inviteOpen: false, inviteSettled: true });
  };

  useEffect(() => { track('push_prompt_shown', { surface: 'welcome', ios_install: needsInstall }); }, [needsInstall]);

  async function enable() {
    setLoading(true);
    markNotificationsAsked();
    const result = await enablePush();
    track('push_permission_result', { result, surface: 'welcome' });
    setLoading(false);
    if (result === 'ok') useToastStore.getState().success(messages.ok);
    else useToastStore.getState().error(messages[result]);
    close();
  }

  function later() {
    // Sin marcar «ya se preguntó»: tras el primer hábito cumplido se ofrece otra vez, con su contexto.
    track('push_permission_result', { result: needsInstall ? 'ios-install' : 'dismissed', surface: 'welcome' });
    close();
  }

  const rows: { icon: LucideIcon; text: string }[] = [
    { icon: Sprout, text: t.habits },
    { icon: CalendarClock, text: t.agenda },
    { icon: ReceiptText, text: t.money },
  ];

  return (
    <ResponsiveDialog open onClose={later} title={needsInstall ? t.titleIos : t.title}>
      <div className="flex flex-col gap-5">
        {needsInstall ? (
          <>
            <p data-autofocus tabIndex={-1} className="text-body-lg text-on-surface outline-none">{t.bodyIos}</p>
            <IosInstallSteps />
            <Button size="md" onClick={later}>{t.gotIt}</Button>
          </>
        ) : (
          <>
            {/* El foco empieza en el texto, sin anillo: nada de resaltar la X al abrirse. */}
            <p data-autofocus tabIndex={-1} className="text-body-lg text-on-surface outline-none">{t.body}</p>
            <ul className="flex flex-col gap-3">
              {rows.map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <IconChip icon={icon} tone="primary" size="sm" />
                  <span className="text-body-md text-on-background">{text}</span>
                </li>
              ))}
            </ul>
            <p className="text-body-sm text-on-surface-light">{t.note}</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" size="md" onClick={later}>{t.notNow}</Button>
              <Button size="md" loading={loading} onClick={() => void enable()}>
                {!loading && <Bell aria-hidden className="size-4" strokeWidth={1.75} />}
                {t.enable}
              </Button>
            </div>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
