// Bienvenida al regalo de 7 días de Pro (plan v3, cuentas Lite actuales). Se abre una vez por
// cuenta y dispositivo en cuanto el regalo se activa (en una cuenta nueva, después del tutorial). No bloquea la app.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ResponsiveDialog } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { useTourDone } from '@/components/onboarding/WelcomeTour';
import { GIFT_WELCOME, giftWelcomeKey, giftWelcomeWaitsForTour, shouldShowGiftWelcome } from '@/lib/gift';
import { track } from '@/lib/analytics';

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* sin storage: se verá otra vez */ } };

export function GiftWelcome() {
  const user = useAuthStore((s) => s.user);
  const sub = user?.subscription;
  const tourDone = useTourDone(user?.id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Se evalúa al cambiar de cuenta o de estado del regalo (no en cada render).
  const waitsForTour = giftWelcomeWaitsForTour(tourDone, user?.createdAt);
  useEffect(() => {
    if (!user || waitsForTour) return;
    const dismissed = read(giftWelcomeKey(user.id)) === '1';
    if (shouldShowGiftWelcome(sub, dismissed)) {
      setOpen(true);
      track('gift_welcome_viewed');
    }
    // sub se reduce a sus campos que deciden el aviso: el objeto cambia en cada lectura de /auth/me.
  }, [user?.id, sub?.giftTrial, sub?.status, sub?.plan, waitsForTour]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !user) return null;

  function close() {
    write(giftWelcomeKey(user!.id));
    setOpen(false);
  }

  return (
    <ResponsiveDialog open onClose={close} title={GIFT_WELCOME.title}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 text-body-md text-on-surface">
          <p>{GIFT_WELCOME.body}</p>
          <p className="text-on-surface-light">{GIFT_WELCOME.ending}</p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={() => { close(); navigate('/plan'); }}>Ver mi plan</Button>
          <Button size="md" onClick={close}>Empezar</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
