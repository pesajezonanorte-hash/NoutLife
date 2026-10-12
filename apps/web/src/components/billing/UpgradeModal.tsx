// Diálogo de Pro. Se abre por un límite de Lite (402 de la API o bloqueo en la
// interfaz), al pasar la cuenta a Lite o para empezar la prueba. El botón
// principal lleva directo al método de pago, sin salir de la pantalla:
// motivo → método de pago → listo.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2 } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { Button, ResponsiveDialog } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore, type UpgradeReason } from '@/store/planStore';
import { useToastStore } from '@/hooks/useToast';
import { ease, useMotionReduced } from '@/lib/motion';
import { LITE_LIMITS, PRO_PER_DAY_COP, PRO_PRICE_COP, TRIAL_DAYS, formatCop, longDay } from '@/lib/plan';
import { getBillingStatus, subscribe } from '@/services/billing.service';
import { PaymentMethodForm, type PaymentMethodFormProps } from './PaymentMethodForm';

const PRICE = formatCop(PRO_PRICE_COP);

const BENEFITS = [
  'El Sabio con IA y análisis de hábitos, finanzas y entrenos',
  'Hábitos ilimitados',
  'Historial y analíticas completas',
  `Tarifa congelada: ${PRICE}/mes mientras sigas en Pro`,
];

/** Panel esmerilado estilo iOS (lo de atrás se ve difuminado). */
const GLASS = 'bg-background/80 backdrop-blur-2xl backdrop-saturate-150';

function copyFor(reason: UpgradeReason, sub: Subscription | null | undefined): { title: string; body: string } {
  switch (reason) {
    case 'habits':
      return { title: 'Hábitos ilimitados con Pro', body: `NoutLife Lite admite ${LITE_LIMITS.activeHabits} hábitos activos. Los que ya tienes siguen ahí.` };
    case 'history':
      return { title: 'Tu historial completo está en Pro', body: `En Lite ves tus últimos ${LITE_LIMITS.historyDays} días. Nada se borra: con Pro vuelves a verlo todo.` };
    case 'ai':
      return { title: 'La IA es de NoutLife Pro', body: 'El Sabio y sus análisis de tus hábitos, finanzas y entrenos se desbloquean con Pro.' };
    case 'downgraded':
      return {
        title: 'Tu cuenta pasó a NoutLife Lite',
        body: `${sub?.lastPaymentError ? `${sub.lastPaymentError} ` : 'Terminó tu periodo Pro. '}Tu cuenta sigue funcionando con los límites de Lite y no perdiste nada.`,
      };
    case 'trial':
      return sub?.status === 'trialing'
        ? { title: 'Tu prueba Pro ya empezó', body: `Vincula un método de pago para seguir sin cortes. El primer cobro es el ${longDay(sub.trialEndsAt)}.` }
        : { title: `Prueba NoutLife Pro ${TRIAL_DAYS} días gratis`, body: 'Vincula un método de pago y empieza hoy. Durante la prueba no se cobra nada.' };
  }
}

export function UpgradeModal() {
  const reason = usePlanStore((s) => s.reason);
  const close = usePlanStore((s) => s.closeUpgrade);
  const subscription = useAuthStore((s) => s.user?.subscription);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();
  const reduce = useMotionReduced();
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
  const trial = Boolean(subscription?.trialAvailable);
  // Qué hace el formulario: empezar la prueba, cobrar desde Lite o solo vincular (prueba o mes en curso).
  const intent: PaymentMethodFormProps['intent'] = trial ? 'trial' : lite ? 'charge' : 'save';
  const payDirectly = lite && !trial && subscription?.hasPaymentMethod;

  async function activate() {
    if (!payDirectly) { setStep('card'); return; }
    setBusy(true);
    setError('');
    try {
      const next = await subscribe();
      updateUser({ subscription: next });
      if (next.plan === 'pro' || next.pendingPayment) setStep('done');
      else setError(next.lastPaymentError ?? 'No se pudo completar el cobro. Prueba con otro método de pago.');
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'No se pudo activar Pro. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function finish(next: Subscription) {
    setStep('done');
    if (next.plan === 'pro' && lite) useToastStore.getState().success(next.status === 'trialing' ? 'Empezó tu prueba Pro' : 'Ya tienes NoutLife Pro');
  }

  const title = step === 'card'
    ? (intent === 'trial' ? `${TRIAL_DAYS} días de Pro gratis` : intent === 'charge' ? 'Activa NoutLife Pro' : 'Tu método de pago')
    : step === 'done' ? 'Listo' : copy.title;
  const primaryLabel = trial
    ? `Empezar mis ${TRIAL_DAYS} días gratis`
    : lite
      ? `Activar Pro por ${PRICE}/mes`
      : subscription?.hasPaymentMethod ? 'Ver mi plan' : 'Vincular método de pago';
  const fade = reduce
    ? {}
    : { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 }, transition: { duration: 0.3, ease } };

  return (
    <ResponsiveDialog open onClose={close} title={title} className={GLASS}>
      <AnimatePresence mode="wait" initial={false}>
        {step === 'pitch' && (
          <motion.div key="pitch" {...fade} className="flex flex-col gap-5">
            <p className="text-body-md text-on-surface">{copy.body}</p>

            {/* Ancla: el precio grande y lo que cuesta al día; con prueba, el $0 de hoy manda. */}
            <div className="flex flex-col items-center gap-1 rounded-3xl border border-secondary/40 bg-secondary/[var(--lq-soft-alpha)] px-4 py-5 text-center">
              {trial ? (
                <>
                  <p className="text-display-md font-semibold tracking-tight tabular-nums">$0 hoy</p>
                  <p className="text-body-sm text-on-surface-light">{TRIAL_DAYS} días gratis, luego {PRICE} COP/mes.</p>
                </>
              ) : (
                <>
                  <p className="flex items-baseline gap-1.5"><span className="text-display-md font-semibold tracking-tight tabular-nums">{PRICE}</span><span className="text-body-md text-on-surface-light">COP/mes</span></p>
                  <p className="text-body-sm text-on-surface-light">Unos {formatCop(PRO_PER_DAY_COP)} al día.</p>
                </>
              )}
              <p className="text-body-sm font-semibold text-on-background">Cancela en cualquier momento con 1 clic.</p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-body-md text-on-background">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary-text" strokeWidth={2.25} />{b}
                </li>
              ))}
            </ul>

            {error && <p role="alert" className="rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">{error}</p>}
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                block
                loading={busy}
                onClick={() => {
                  if (!lite && !trial && subscription?.hasPaymentMethod) { close(); navigate('/plan'); return; }
                  void activate();
                }}
              >
                {primaryLabel}
              </Button>
              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => { close(); navigate('/plan'); }}>Comparar planes</Button>
                <Button variant="ghost" size="sm" onClick={close}>Ahora no</Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'card' && (
          <motion.div key="card" {...fade}>
            <PaymentMethodForm intent={intent} chargeDate={subscription?.accessEndsAt} onDone={finish} onCancel={() => setStep('pitch')} />
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div key="done" {...fade} className="flex flex-col items-center gap-4 py-2 text-center">
            <motion.span
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            >
              <CheckCircle2 aria-hidden className="size-12 text-success-text" strokeWidth={1.5} />
            </motion.span>
            <p className="text-body-md text-on-surface">
              {subscription?.pendingPayment
                ? subscription.paymentMethodType === 'NEQUI'
                  ? 'Revisa tu app de Nequi y aprueba el cobro si te lo pide. Tu cuenta se actualiza sola en unos minutos.'
                  : 'Estamos confirmando tu pago con Wompi. Tu cuenta se actualiza sola en unos minutos.'
                : subscription?.status === 'trialing'
                  ? `Tienes NoutLife Pro gratis hasta el ${longDay(subscription.trialEndsAt)}. $0 hoy; puedes cancelar con 1 clic en Plan.`
                  : intent === 'save'
                    ? 'Método de pago actualizado.'
                    : 'Ya tienes NoutLife Pro. Hábitos ilimitados, tu historial completo y la IA del Sabio están listos.'}
            </p>
            <Button size="lg" block onClick={close}>Seguir</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveDialog>
  );
}
