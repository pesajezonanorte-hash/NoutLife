// Diálogo de Pro. Se abre por un límite de Lite (402 de la API o bloqueo en la
// interfaz), al pasar la cuenta a Lite o para guardar la tarjeta en la prueba.
// Pasos: motivo → tarjeta (si hace falta) → listo, sin salir de la pantalla.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2 } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { Button, ResponsiveDialog } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore, type UpgradeReason } from '@/store/planStore';
import { useToastStore } from '@/hooks/useToast';
import { LITE_LIMITS, PRO_PRICE_COP, TRIAL_DAYS, daysUntil, formatCop, longDay } from '@/lib/plan';
import { getBillingStatus, subscribe } from '@/services/billing.service';
import { CardForm } from './CardForm';

const PRICE = formatCop(PRO_PRICE_COP);

const BENEFITS = [
  'Hábitos sin límite y todo tu historial',
  'Análisis de IA de tus hábitos, finanzas y entrenos',
  'Cupo completo de mensajes con el Sabio',
];

function copyFor(reason: UpgradeReason, sub: Subscription | null | undefined): { title: string; body: string } {
  switch (reason) {
    case 'habits':
      return { title: 'Con Pro, tus hábitos no tienen tope', body: `NoutLife Lite admite ${LITE_LIMITS.activeHabits} hábitos activos a la vez. Los que ya tienes siguen ahí.` };
    case 'history':
      return { title: 'Todo tu historial está en Pro', body: `En Lite ves tus últimos ${LITE_LIMITS.historyDays} días. Nada se borra: con Pro vuelves a verlo todo.` };
    case 'ai':
      return { title: 'Los análisis del Sabio son de Pro', body: 'Actualiza a Pro para desbloquear los análisis de IA de tus hábitos, finanzas y entrenos, y más mensajes con el Sabio.' };
    case 'downgraded':
      return {
        title: 'Tu cuenta pasó a NoutLife Lite',
        body: `${sub?.lastPaymentError ? `${sub.lastPaymentError} ` : 'Terminó tu periodo Pro. '}Tu cuenta sigue funcionando con los límites de Lite y no perdiste nada.`,
      };
    case 'trial': {
      const left = daysUntil(sub?.trialEndsAt) || TRIAL_DAYS;
      return {
        title: 'Tu prueba Pro ya empezó',
        body: `Tienes ${left} ${left === 1 ? 'día' : 'días'} de NoutLife Pro gratis. Guarda una tarjeta para seguir sin cortes: no se cobra nada hasta el ${longDay(sub?.trialEndsAt)}.`,
      };
    }
  }
}

export function UpgradeModal() {
  const reason = usePlanStore((s) => s.reason);
  const close = usePlanStore((s) => s.closeUpgrade);
  const subscription = useAuthStore((s) => s.user?.subscription);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();
  const [step, setStep] = useState<'pitch' | 'card' | 'done'>('pitch');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Cada apertura empieza de cero y trae el estado real (el 402 puede llegar con datos viejos).
  useEffect(() => {
    if (!reason) return;
    setStep('pitch');
    setError('');
    getBillingStatus().then(({ subscription: fresh }) => updateUser({ subscription: fresh })).catch(() => null);
  }, [reason, updateUser]);

  if (!reason) return <ResponsiveDialog open={false} onClose={close} title="" />;

  const copy = copyFor(reason, subscription);
  const lite = subscription?.plan === 'lite';
  const saveOnly = !lite; // en prueba o con mes pagado solo se guarda la tarjeta

  async function activate() {
    if (!lite || !subscription?.hasPaymentMethod) { setStep('card'); return; }
    setBusy(true);
    setError('');
    try {
      const next = await subscribe();
      updateUser({ subscription: next });
      if (next.plan === 'pro' || next.pendingPayment) setStep('done');
      else setError(next.lastPaymentError ?? 'No se pudo completar el cobro. Prueba con otra tarjeta.');
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'No se pudo activar Pro. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function finish(next: Subscription) {
    setStep('done');
    if (next.plan === 'pro' && lite) useToastStore.getState().success('Ya tienes NoutLife Pro');
  }

  const title = step === 'card' ? (saveOnly ? 'Guarda tu tarjeta' : 'Activa NoutLife Pro') : step === 'done' ? 'Listo' : copy.title;
  const primaryLabel = lite
    ? subscription?.hasPaymentMethod ? `Activar Pro por ${PRICE}/mes` : 'Continuar con tarjeta'
    : subscription?.hasPaymentMethod ? 'Ver mi plan' : 'Guardar tarjeta';

  return (
    <ResponsiveDialog open onClose={close} title={title}>
      {step === 'pitch' && (
        <div className="flex flex-col gap-5">
          <p className="text-body-md text-on-surface">{copy.body}</p>
          <ul className="flex flex-col gap-2.5 rounded-2xl border border-secondary/50 bg-secondary/[var(--lq-soft-alpha)] p-4">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-body-md text-on-background">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary-text" strokeWidth={2.25} />{b}
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-on-surface-light">
            <span className="font-semibold text-on-background">{PRICE} COP/mes</span>. Cancela cuando quieras con un solo clic.
          </p>
          {error && <p role="alert" className="rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">{error}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="md" onClick={() => { close(); navigate('/plan'); }}>Comparar planes</Button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" size="md" onClick={close}>Ahora no</Button>
              <Button
                size="md"
                loading={busy}
                onClick={() => {
                  if (!lite && subscription?.hasPaymentMethod) { close(); navigate('/plan'); return; }
                  void activate();
                }}
              >
                {primaryLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'card' && (
        <CardForm
          intent={saveOnly ? 'save' : 'charge'}
          chargeDate={subscription?.accessEndsAt}
          onDone={finish}
          onCancel={() => setStep('pitch')}
        />
      )}

      {step === 'done' && (
        <div className="flex flex-col items-start gap-4">
          <CheckCircle2 aria-hidden className="size-10 text-success-text" strokeWidth={1.5} />
          <p className="text-body-md text-on-surface">
            {subscription?.pendingPayment
              ? 'Estamos confirmando tu pago con Wompi. Tu cuenta se actualiza sola en unos minutos.'
              : saveOnly
                ? `Tarjeta guardada. Sigues en Pro y el ${longDay(subscription?.accessEndsAt)} se cobran ${PRICE}. Puedes cancelar antes en Plan.`
                : 'Ya tienes NoutLife Pro. Tus hábitos, tu historial completo y los análisis del Sabio están listos.'}
          </p>
          <Button size="md" onClick={close} className="self-end">Seguir</Button>
        </div>
      )}
    </ResponsiveDialog>
  );
}
