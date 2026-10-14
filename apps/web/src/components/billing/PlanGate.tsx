// Revisión del plan al entrar (lado cliente). La API ya aplicó el vencimiento
// al iniciar sesión o renovar la sesión; aquí se avisa una sola vez:
//  · la cuenta con tarjeta pasó a Lite → diálogo con el motivo y cómo volver a Pro;
//  · cuenta en Lite que aún puede probar Pro → invitación a los 7 días gratis, tras el tutorial.
// El paywall de entrada (sin medio de pago) vive en App, antes del Dashboard.
// También aloja el diálogo de Pro que abren los límites y las zonas de Lite, y
// resincroniza el plan cuando la API niega una lectura (el del cliente estaba viejo).
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { useTourDone } from '@/components/onboarding/WelcomeTour';
import { getBillingStatus } from '@/services/billing.service';
import { UpgradeModal } from './UpgradeModal';

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* sin storage */ } };

/** Como mucho una resincronización por minuto, aunque fallen varias lecturas seguidas. */
const SYNC_EVERY_MS = 60_000;

/** `blocked`: otro diálogo de arranque está abierto (permiso de avisos). */
export function PlanGate({ blocked = false }: { blocked?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const sub = user?.subscription;
  const tourDone = useTourDone(user?.id);
  const reason = usePlanStore((s) => s.reason);
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const syncTick = usePlanStore((s) => s.syncTick);
  const lastSync = useRef(0);

  useEffect(() => {
    if (!syncTick || Date.now() - lastSync.current < SYNC_EVERY_MS) return;
    lastSync.current = Date.now();
    getBillingStatus().then(({ subscription }) => updateUser({ subscription })).catch(() => null);
  }, [syncTick, updateUser]);

  useEffect(() => {
    if (!user || !sub || blocked || reason) return;
    const key = (name: string) => `lq_plan_${name}_${user.id}`;

    // Solo con tarjeta: sin ella, elegir Lite fue decisión de la persona y no una baja.
    if (sub.status === 'lite' && sub.liteSince && sub.hasPaymentMethod && read(key('lite')) !== sub.liteSince) {
      write(key('lite'), sub.liteSince);
      openUpgrade('downgraded');
      return;
    }
    const invite = sub.trialAvailable || (sub.status === 'trialing' && !sub.hasPaymentMethod);
    if (invite && user.onboardingCompleted && tourDone && !read(key('trial'))) {
      const timer = window.setTimeout(() => {
        write(key('trial'), '1');
        openUpgrade('trial');
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [user, sub, tourDone, blocked, reason, openUpgrade]);

  return <UpgradeModal />;
}
