// Revisión del plan al entrar (lado cliente). La API ya aplicó el vencimiento
// al iniciar sesión o renovar la sesión; aquí se avisa una sola vez:
//  · la cuenta pasó a Lite → diálogo con el motivo y cómo volver a Pro;
//  · cuenta nueva (o prueba sin método de pago) → invitación a los 7 días gratis, tras el tutorial.
// También aloja el diálogo de Pro que abren los límites de Lite.
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { useTourDone } from '@/components/onboarding/WelcomeTour';
import { UpgradeModal } from './UpgradeModal';

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* sin storage */ } };

/** `blocked`: otro diálogo de arranque está abierto (permiso de avisos). */
export function PlanGate({ blocked = false }: { blocked?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const sub = user?.subscription;
  const tourDone = useTourDone(user?.id);
  const reason = usePlanStore((s) => s.reason);
  const openUpgrade = usePlanStore((s) => s.openUpgrade);

  useEffect(() => {
    if (!user || !sub || blocked || reason) return;
    const key = (name: string) => `lq_plan_${name}_${user.id}`;

    if (sub.status === 'lite' && sub.liteSince && read(key('lite')) !== sub.liteSince) {
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
