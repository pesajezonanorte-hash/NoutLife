// Diálogo de Pro. Se abre por un límite de Lite (402 de la API o bloqueo en la
// interfaz), al pasar la cuenta a Lite o para empezar la prueba. El botón
// principal lleva directo al método de pago, sin salir de la pantalla:
// motivo → plan (anual recomendado) → método de pago → listo.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2 } from 'lucide-react';
import type { BillingInterval, Subscription } from '@noutlife/shared';
import { Button, ResponsiveDialog } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore, type UpgradeReason } from '@/store/planStore';
import { useToastStore } from '@/hooks/useToast';
import { ease, useMotionReduced } from '@/lib/motion';
import { track } from '@/lib/analytics';
import {
  ANNUAL_PITCH, LITE_LIMITS, PRO_ZONES, PRO_ZONE_COUNT, TRIAL_DAYS,
  annualAvailable, firstPaymentCop, firstPriceLabel, formatCop, framingFor, intervalName, intervalUnit, longDay, priceFor,
} from '@/lib/plan';
import { getBillingStatus, getPlanPreview, subscribe } from '@/services/billing.service';
import { contextFor, trialDoneLine, type PlanPreview } from '@/lib/planPreview';
import { PaymentMethodForm, type PaymentMethodFormProps } from './PaymentMethodForm';
import { PlanIntervalPicker } from './PlanIntervalPicker';
import { CreatorCodeField } from './CreatorCodeField';

const BENEFITS = [
  `Las ${PRO_ZONE_COUNT} zonas Pro: Finanzas, Coliseo, Comida, Sueño, Diario y más`,
  'El Sabio con IA y análisis de hábitos, finanzas y entrenos',
  'Hábitos y rutinas ilimitados',
  'Historial y analíticas completas',
  'Tarifa congelada mientras sigas en Pro',
];

/** Panel esmerilado estilo iOS (lo de atrás se ve difuminado). */
const GLASS = 'bg-background/80 backdrop-blur-2xl backdrop-saturate-150';

function copyFor(reason: UpgradeReason, sub: Subscription | null | undefined): { title: string; body: string } {
  if (Object.prototype.hasOwnProperty.call(PRO_ZONES, reason)) {
    const zone = PRO_ZONES[reason as keyof typeof PRO_ZONES];
    return { title: `${zone.label} es de NoutLife Pro`, body: `${zone.pitch} Lo que ya guardaste sigue ahí y vuelve a abrirse con Pro.` };
  }
  switch (reason) {
    case 'routines':
      return { title: 'Rutinas ilimitadas con Pro', body: `NoutLife Lite admite ${LITE_LIMITS.activeRoutines} rutinas activas. Las que ya tienes siguen ahí.` };
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
        ? { title: `Tu Pro gratis termina el ${longDay(sub.trialEndsAt)}`, body: 'Todo lo que creaste se queda contigo. Para seguir con Pro sin cortes, vincula un método de pago; si no, sigues en Lite sin perder nada.' }
        : { title: `Prueba NoutLife Pro ${TRIAL_DAYS} días gratis`, body: 'Vincula un método de pago y empieza hoy. Durante la prueba no se cobra nada.' };
    case 'notebooks':
      return { title: 'Libretas ilimitadas con Pro', body: `NoutLife Lite admite ${LITE_LIMITS.notebooks} libretas. Las que ya tienes siguen ahí.` };
    case 'notebook-pages':
      return { title: 'Páginas sin límite con Pro', body: `En Lite cada libreta tiene hasta ${LITE_LIMITS.notebookPages} páginas. Lo que ya escribiste sigue ahí.` };
    case 'notebook-draw':
      return { title: 'El dibujo libre es de Pro', body: 'Con Pro dibujas con pluma, marcador y borrador, en todas las tintas. Lo que ya tienes sigue ahí.' };
    case 'notebook-images':
      return { title: 'Imágenes en la libreta con Pro', body: 'Con Pro pegas las fotos que quieras y las mueves por la página.' };
    case 'notebook-stickies':
      return { title: 'Notas de colores con Pro', body: 'Con Pro eliges el color de cada nota adhesiva. Las amarillas siguen siendo gratis.' };
    default:
      // Un motivo nuevo de la API que esta versión aún no conoce.
      return { title: 'Esto es de NoutLife Pro', body: 'Activa Pro para desbloquearlo. Lo que ya guardaste sigue ahí.' };
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
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  // El anual va elegido por defecto: es el mejor valor y el compromiso que más acompaña.
  const [interval, setInterval] = useState<BillingInterval>('year');

  // Cada apertura empieza de cero y trae el estado real (el 402 puede llegar con datos viejos).
  useEffect(() => {
    if (!reason) return;
    setStep('pitch');
    setError('');
    setInterval('year');
    track('upgrade_prompt_viewed', { reason });
    getBillingStatus().then(({ subscription: fresh }) => updateUser({ subscription: fresh })).catch(() => null);
    getPlanPreview().then(setPreview).catch(() => setPreview(null));
  }, [reason, updateUser]);

  if (!reason) return <ResponsiveDialog open={false} onClose={close} title="" />;

  const copy = copyFor(reason, subscription);
  // Datos reales de la persona (T11): «Tus 23 días de historial están guardados…».
  const context = contextFor(reason, preview);
  const lite = subscription?.plan === 'lite';
  const trial = Boolean(subscription?.trialAvailable);
  // Qué hace el formulario: empezar la prueba, cobrar desde Lite o solo vincular (prueba o mes en curso).
  const intent: PaymentMethodFormProps['intent'] = trial ? 'trial' : lite ? 'charge' : 'save';
  const payDirectly = lite && !trial && subscription?.hasPaymentMethod;
  // El plan se elige si lo que sigue es el primer cobro: prueba, activar desde Lite o la prueba inversa sin tarjeta.
  const choosesPlan = annualAvailable(subscription)
    && (trial || lite || (subscription?.status === 'trialing' && !subscription.hasPaymentMethod));
  const planInterval: BillingInterval = choosesPlan ? interval : subscription?.interval ?? 'month';
  const codeDiscount = subscription?.creatorCodeEditable ? subscription.creatorCode?.discountPercent ?? 0 : 0;
  const firstCop = firstPaymentCop(planInterval, codeDiscount);

  async function activate() {
    if (!payDirectly) { setStep('card'); return; }
    setBusy(true);
    setError('');
    try {
      const next = await subscribe(choosesPlan ? interval : undefined);
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
    ? (intent === 'trial' ? `${TRIAL_DAYS} días de Pro gratis` : intent === 'charge' ? `Activa ${choosesPlan ? intervalName(planInterval) : 'NoutLife Pro'}` : 'Tu método de pago')
    : step === 'done' ? 'Listo' : copy.title;
  const primaryLabel = trial
    ? `Empezar mis ${TRIAL_DAYS} días gratis`
    : lite
      ? payDirectly ? `Pagar ${formatCop(firstCop)} y activar Pro` : `Continuar con ${intervalName(planInterval)}`
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
            {context && <p className="rounded-2xl bg-surface-variant px-4 py-3 text-body-md text-on-surface">{context}</p>}

            {choosesPlan && <PlanIntervalPicker value={interval} onChange={setInterval} discountPercent={codeDiscount} surface="upgrade_modal" />}

            {/* Ancla: con prueba, el $0 de hoy manda. Con el selector a la vista, solo el precio dicho por día. */}
            {choosesPlan && !trial ? (
              <p className="-mt-1 text-center text-body-sm text-on-background">
                {framingFor(planInterval)} <span className="font-semibold">Cancela en cualquier momento con 1 clic.</span>
              </p>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-3xl border border-secondary/40 bg-secondary/[var(--lq-soft-alpha)] px-4 py-4 text-center">
                {trial ? (
                  <>
                    <p className="text-display-md font-semibold tracking-tight tabular-nums">$0 hoy</p>
                    <p className="text-body-sm text-on-surface-light">{TRIAL_DAYS} días gratis, luego {firstPriceLabel(planInterval, firstCop)}.</p>
                    <p className="text-body-sm text-on-background">{framingFor(planInterval, true)}</p>
                  </>
                ) : (
                  <>
                    <p className="flex items-baseline gap-1.5"><span className="text-display-md font-semibold tracking-tight tabular-nums">{formatCop(priceFor(planInterval))}</span><span className="text-body-md text-on-surface-light">COP/{intervalUnit(planInterval)}</span></p>
                    <p className="text-body-sm text-on-background">{framingFor(planInterval)}</p>
                  </>
                )}
                <p className="text-body-sm font-semibold text-on-background">Cancela en cualquier momento con 1 clic.</p>
              </div>
            )}

            {/* Por qué un año: el compromiso con tu propio sistema, en un solo espacio. */}
            {choosesPlan && planInterval === 'year' && (
              <p className="text-body-md text-on-surface"><span className="font-semibold text-on-background">{ANNUAL_PITCH.title}.</span> {ANNUAL_PITCH.body}</p>
            )}

            <ul className="flex flex-col gap-2.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-body-md text-on-background">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-secondary-text" strokeWidth={2.25} />{b}
                </li>
              ))}
            </ul>

            {/* Con tarjeta guardada no hay paso de pago: el código va aquí. */}
            {payDirectly && <CreatorCodeField />}

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
            <PaymentMethodForm
              intent={intent}
              interval={choosesPlan ? interval : undefined}
              chargeDate={subscription?.accessEndsAt}
              onDone={finish}
              onCancel={() => setStep('pitch')}
            />
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
                  ? trialDoneLine(subscription)
                  : intent === 'save'
                    ? 'Método de pago actualizado.'
                    : subscription?.interval === 'year'
                      ? 'Ya tienes NoutLife Pro Anual: un año completo con todas las zonas, hábitos ilimitados, tu historial y la IA del Sabio.'
                      : 'Ya tienes NoutLife Pro. Todas las zonas, hábitos ilimitados, tu historial completo y la IA del Sabio están listos.'}
            </p>
            <Button size="lg" block onClick={close}>Seguir</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveDialog>
  );
}
