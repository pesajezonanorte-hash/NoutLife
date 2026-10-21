// Aviso de los días 5 y 6 de la prueba (plan v3, T11): dice qué cambia al pasar a Lite con
// los datos reales de la persona y el precio de Miembro Fundador. Sale una vez por día de
// prueba y se puede cerrar; no bloquea la app.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveDialog, Button } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { getPlanPreview } from '@/services/billing.service';
import { contextFor, foundingPriceLine, trialNoticeDaysLeft, trialNoticeTitle, type PlanPreview } from '@/lib/planPreview';
import { track } from '@/lib/analytics';

const shownKey = (userId: string, daysLeft: number) => `lq_trial_notice:${userId}:${daysLeft}`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* sin storage: sale otra vez */ } };

export function TrialNotice() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const daysLeft = trialNoticeDaysLeft(user?.subscription);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || daysLeft === null || read(shownKey(user.id, daysLeft))) return;
    let active = true;
    getPlanPreview()
      .then((p) => { if (active) { setPreview(p); setOpen(true); track('upgrade_prompt_viewed', { reason: 'trial_ending', days_left: daysLeft }); } })
      .catch(() => { /* sin datos no hay aviso: mejor nada que un texto inventado */ });
    return () => { active = false; };
  }, [user, daysLeft]);

  if (!open || !user || daysLeft === null || !preview) return null;

  function close() {
    write(shownKey(user!.id, daysLeft!));
    setOpen(false);
  }

  const lines = [
    contextFor('habits', preview),
    contextFor('history', preview),
    contextFor('notebooks', preview),
    contextFor('routines', preview),
  ].filter((line): line is string => Boolean(line));

  return (
    <ResponsiveDialog open onClose={close} title={trialNoticeTitle(daysLeft)}>
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2 text-body-md text-on-surface">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="rounded-2xl bg-primary/[var(--lq-soft-alpha)] px-4 py-3 text-body-md text-primary-text">
          {foundingPriceLine()} Cancelas con 1 clic.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={close}>Después</Button>
          <Button size="md" onClick={() => { close(); navigate('/plan'); }}>Ver mi plan</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
