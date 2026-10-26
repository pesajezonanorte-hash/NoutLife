// Avisos de la prueba (plan v3). Dos casos, nunca a la vez:
// · Sin tarjeta: el aviso de los días 5 y 6 con los datos reales de la persona (T11).
// · Con tarjeta vinculada: qué se cobra y cuándo, una vez al vincular y dos días antes del cobro
//   (decisión 15). Dice la fecha, el monto y cómo cancelar; sin urgencia. Se puede cerrar.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveDialog, Button } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { getPlanPreview } from '@/services/billing.service';
import {
  cardTrialCopy, cardTrialDue, cardTrialKey, contextFor, foundingPriceLine, trialNoticeDaysLeft, trialNoticeTitle,
  type CardTrialKind, type PlanPreview,
} from '@/lib/planPreview';
import { track } from '@/lib/analytics';
import { annualAvailable } from '@/lib/plan';

const shownKey = (userId: string, daysLeft: number) => `lq_trial_notice:${userId}:${daysLeft}`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string) => { try { localStorage.setItem(key, '1'); } catch { /* sin storage: sale otra vez */ } };

export function TrialNotice() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const daysLeft = trialNoticeDaysLeft(user?.subscription);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CardTrialKind | null>(null);

  const sub = user?.subscription;
  const userId = user?.id;

  // Con tarjeta: se recalcula cada vez que cambia la suscripción (al vincular, al cambiar de día).
  useEffect(() => {
    if (!userId || !sub) return;
    const next = cardTrialDue(sub, (kind) => read(cardTrialKey(userId, kind, sub.trialEndsAt)) !== null);
    if (next) setCard(next);
  }, [userId, sub]);

  useEffect(() => {
    if (card) track('upgrade_prompt_viewed', { reason: card === 'linked' ? 'card_trial_linked' : 'card_charge_pre' });
  }, [card]);

  useEffect(() => {
    if (!user || daysLeft === null || read(shownKey(user.id, daysLeft))) return;
    let active = true;
    getPlanPreview()
      .then((p) => { if (active) { setPreview(p); setOpen(true); track('upgrade_prompt_viewed', { reason: 'trial_ending', days_left: daysLeft }); } })
      .catch(() => { /* sin datos no hay aviso: mejor nada que un texto inventado */ });
    return () => { active = false; };
  }, [user, daysLeft]);

  if (card && sub && userId) {
    const copy = cardTrialCopy(card, sub);
    // Cerrar el aviso lo marca como visto para esta prueba: no vuelve a salir por la misma razón.
    const close = (toPlan: boolean) => {
      write(cardTrialKey(userId, card, sub.trialEndsAt));
      setCard(null);
      if (toPlan) navigate('/plan');
    };
    return (
      <ResponsiveDialog open onClose={() => close(false)} title={copy.title}>
        <div className="flex flex-col gap-5">
          <p className="text-body-md text-on-surface">{copy.body}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="md" onClick={() => close(true)}>{copy.secondary}</Button>
            <Button size="md" onClick={() => close(false)}>{copy.primary}</Button>
          </div>
        </div>
      </ResponsiveDialog>
    );
  }

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
          {foundingPriceLine(annualAvailable(sub))} Cancelas con 1 clic.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={close}>Después</Button>
          <Button size="md" onClick={() => { close(); navigate('/plan'); }}>Ver mi plan</Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
