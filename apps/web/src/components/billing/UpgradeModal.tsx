// Diálogo de Pro. Se abre por un límite de Lite (402 de la API o bloqueo en la
// interfaz), al pasar la cuenta a Lite o para empezar la prueba. El botón
// principal lleva directo al método de pago, sin salir de la pantalla:
// motivo → plan (anual recomendado) → método de pago → listo.
// Idioma y moneda salen de la oferta de la cuenta (lib/offer).
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
import { apiErrorMessage, localizeBillingMessage } from '@/lib/billing-messages';
import type { Copy, Locale } from '@/lib/i18n';
import { useOffer } from '@/lib/useOffer';
import { LITE_LIMITS, PRO_ZONES, PRO_ZONE_COUNT, TRIAL_DAYS, annualAvailable, isProZone, longDay } from '@/lib/plan';
import { getBillingStatus, getPlanPreview, subscribe } from '@/services/billing.service';
import { contextFor, trialDoneLine, type PlanPreview } from '@/lib/planPreview';
import { PaymentMethodForm, type PaymentMethodFormProps } from './PaymentMethodForm';
import { PlanIntervalPicker } from './PlanIntervalPicker';
import { CreatorCodeField } from './CreatorCodeField';

/** Panel esmerilado estilo iOS (lo de atrás se ve difuminado). */
const GLASS = 'bg-background/80 backdrop-blur-2xl backdrop-saturate-150';

type Pitch = { title: string; body: string };

const es = {
  benefits: [
    `Las ${PRO_ZONE_COUNT} zonas Pro: Finanzas, Coliseo, Comida, Sueño, Diario y más`,
    'El Sabio con IA y análisis de hábitos, finanzas y entrenos',
    'Hábitos y rutinas ilimitados',
    'Historial y analíticas completas',
    'Tarifa congelada mientras sigas en Pro',
  ],
  zone: (label: string, pitch: string): Pitch => ({ title: `${label} es de NoutLife Pro`, body: `${pitch} Lo que ya guardaste sigue ahí y vuelve a abrirse con Pro.` }),
  reasons: {
    routines: { title: 'Rutinas ilimitadas con Pro', body: `NoutLife Lite admite ${LITE_LIMITS.activeRoutines} rutinas activas. Las que ya tienes siguen ahí.` },
    habits: { title: 'Hábitos ilimitados con Pro', body: `NoutLife Lite admite ${LITE_LIMITS.activeHabits} hábitos activos. Los que ya tienes siguen ahí.` },
    history: { title: 'Tu historial completo está en Pro', body: `En Lite ves tus últimos ${LITE_LIMITS.historyDays} días. Nada se borra: con Pro vuelves a verlo todo.` },
    ai: { title: 'La IA es de NoutLife Pro', body: 'El Sabio y sus análisis de tus hábitos, finanzas y entrenos se desbloquean con Pro.' },
    notebooks: { title: 'Libretas ilimitadas con Pro', body: `NoutLife Lite admite ${LITE_LIMITS.notebooks} libretas. Las que ya tienes siguen ahí.` },
    'notebook-pages': { title: 'Páginas sin límite con Pro', body: `En Lite cada libreta tiene hasta ${LITE_LIMITS.notebookPages} páginas. Lo que ya escribiste sigue ahí.` },
    'notebook-draw': { title: 'El dibujo libre es de Pro', body: 'Con Pro dibujas con pluma, marcador y borrador, en todas las tintas. Lo que ya tienes sigue ahí.' },
    'notebook-images': { title: 'Imágenes en la libreta con Pro', body: 'Con Pro pegas las fotos que quieras y las mueves por la página.' },
    'notebook-stickies': { title: 'Notas de colores con Pro', body: 'Con Pro eliges el color de cada nota adhesiva. Las amarillas siguen siendo gratis.' },
  } as Record<string, Pitch>,
  downgraded: (reason: string | null): Pitch => ({
    title: 'Tu cuenta pasó a NoutLife Lite',
    body: `${reason ? `${reason} ` : 'Terminó tu periodo Pro. '}Tu cuenta sigue funcionando con los límites de Lite y no perdiste nada.`,
  }),
  trialEnding: (date: string): Pitch => ({
    title: `Tu Pro gratis termina el ${date}`,
    body: 'Todo lo que creaste se queda contigo. Para seguir con Pro sin cortes, vincula un método de pago; si no, sigues en Lite sin perder nada.',
  }),
  trialStart: { title: `Prueba NoutLife Pro ${TRIAL_DAYS} días gratis`, body: 'Vincula un método de pago y empieza hoy. Durante la prueba no se cobra nada.' } as Pitch,
  fallback: { title: 'Esto es de NoutLife Pro', body: 'Activa Pro para desbloquearlo. Lo que ya guardaste sigue ahí.' } as Pitch,
  chargeFailed: 'No se pudo completar el cobro. Prueba con otro método de pago.',
  activateFailed: 'No se pudo activar Pro. Inténtalo de nuevo.',
  trialStarted: 'Empezó tu prueba Pro',
  havePro: 'Ya tienes NoutLife Pro',
  trialTitle: `${TRIAL_DAYS} días de Pro gratis`,
  activateTitle: (name: string) => `Activa ${name}`,
  methodTitle: 'Tu método de pago',
  doneTitle: 'Listo',
  startTrial: `Empezar mis ${TRIAL_DAYS} días gratis`,
  pay: (price: string) => `Pagar ${price} y activar Pro`,
  continueWith: (name: string) => `Continuar con ${name}`,
  viewPlan: 'Ver mi plan',
  linkMethod: 'Vincular método de pago',
  cancelAnytime: 'Cancela en cualquier momento con 1 clic.',
  zeroToday: '$0 hoy',
  trialThen: (price: string) => `${TRIAL_DAYS} días gratis, luego ${price}.`,
  compare: 'Comparar planes',
  notNow: 'Ahora no',
  next: 'Seguir',
  pendingNequi: 'Revisa tu app de Nequi y aprueba el cobro si te lo pide. Tu cuenta se actualiza sola en unos minutos.',
  pendingCard: 'Estamos confirmando tu pago con Wompi. Tu cuenta se actualiza sola en unos minutos.',
  methodUpdated: 'Método de pago actualizado.',
  doneYear: 'Ya tienes NoutLife Pro Anual: un año completo con todas las zonas, hábitos ilimitados, tu historial y la IA del Sabio.',
  doneMonth: 'Ya tienes NoutLife Pro. Todas las zonas, hábitos ilimitados, tu historial completo y la IA del Sabio están listos.',
};

const en: typeof es = {
  benefits: [
    `All ${PRO_ZONE_COUNT} Pro zones: Finances, Coliseum, Food, Sleep, Journal and more`,
    'The Sage, with AI insights on your habits, finances and workouts',
    'Unlimited habits and routines',
    'Full history and insights',
    'Price locked while you stay on Pro',
  ],
  zone: (label, pitch) => ({ title: `${label} is part of NoutLife Pro`, body: `${pitch} Everything you’ve saved is still there and opens again with Pro.` }),
  reasons: {
    routines: { title: 'Unlimited routines with Pro', body: `NoutLife Lite allows ${LITE_LIMITS.activeRoutines} active routines. The ones you have stay put.` },
    habits: { title: 'Unlimited habits with Pro', body: `NoutLife Lite allows ${LITE_LIMITS.activeHabits} active habits. The ones you have stay put.` },
    history: { title: 'Your full history is on Pro', body: `On Lite you see your last ${LITE_LIMITS.historyDays} days. Nothing is deleted: with Pro you see it all again.` },
    ai: { title: 'AI is part of NoutLife Pro', body: 'The Sage and its insights on your habits, finances and workouts unlock with Pro.' },
    notebooks: { title: 'Unlimited notebooks with Pro', body: `NoutLife Lite allows ${LITE_LIMITS.notebooks} notebooks. The ones you have stay put.` },
    'notebook-pages': { title: 'Unlimited pages with Pro', body: `On Lite each notebook has up to ${LITE_LIMITS.notebookPages} pages. What you’ve written stays.` },
    'notebook-draw': { title: 'Freehand drawing is part of Pro', body: 'With Pro you draw with pen, marker and eraser, in every ink. What you have stays.' },
    'notebook-images': { title: 'Images in your notebook with Pro', body: 'With Pro you paste as many photos as you like and move them around the page.' },
    'notebook-stickies': { title: 'Colored notes with Pro', body: 'With Pro you choose the color of each sticky note. Yellow ones stay free.' },
  },
  downgraded: (reason) => ({
    title: 'Your account moved to NoutLife Lite',
    body: `${reason ? `${reason} ` : 'Your Pro period ended. '}Your account keeps working with Lite limits and you haven’t lost anything.`,
  }),
  trialEnding: (date) => ({
    title: `Your free Pro ends on ${date}`,
    body: 'Everything you created stays with you. To keep Pro without interruption, link a payment method; otherwise you stay on Lite and lose nothing.',
  }),
  trialStart: { title: `Try NoutLife Pro free for ${TRIAL_DAYS} days`, body: 'Link a payment method and start today. Nothing is charged during the trial.' },
  fallback: { title: 'This is part of NoutLife Pro', body: 'Activate Pro to unlock it. Everything you saved is still there.' },
  chargeFailed: 'The charge couldn’t be completed. Try another payment method.',
  activateFailed: 'We couldn’t activate Pro. Please try again.',
  trialStarted: 'Your Pro trial has started',
  havePro: 'You now have NoutLife Pro',
  trialTitle: `${TRIAL_DAYS} days of Pro, free`,
  activateTitle: (name) => `Activate ${name}`,
  methodTitle: 'Your payment method',
  doneTitle: 'All set',
  startTrial: `Start my ${TRIAL_DAYS} free days`,
  pay: (price) => `Pay ${price} and activate Pro`,
  continueWith: (name) => `Continue with ${name}`,
  viewPlan: 'View my plan',
  linkMethod: 'Link payment method',
  cancelAnytime: 'Cancel anytime in 1 click.',
  zeroToday: '$0 today',
  trialThen: (price) => `${TRIAL_DAYS} days free, then ${price}.`,
  compare: 'Compare plans',
  notNow: 'Not now',
  next: 'Continue',
  pendingNequi: 'Check your Nequi app and approve the charge if it asks. Your account updates on its own in a few minutes.',
  pendingCard: 'We’re confirming your payment with Wompi. Your account updates on its own in a few minutes.',
  methodUpdated: 'Payment method updated.',
  doneYear: 'You now have NoutLife Pro Annual: a full year with every zone, unlimited habits, your history and the Sage’s AI.',
  doneMonth: 'You now have NoutLife Pro. Every zone, unlimited habits, your full history and the Sage’s AI are ready.',
};

const COPY: Copy<typeof es> = { es, en };

function copyFor(reason: UpgradeReason, sub: Subscription | null | undefined, locale: Locale): Pitch {
  const t = COPY[locale];
  if (isProZone(reason)) {
    const zone = PRO_ZONES[locale][reason];
    return t.zone(zone.label, zone.pitch);
  }
  if (t.reasons[reason]) return t.reasons[reason];
  switch (reason) {
    case 'downgraded':
      return t.downgraded(sub?.lastPaymentError ? localizeBillingMessage(sub.lastPaymentError, locale) : null);
    case 'trial':
      return sub?.status === 'trialing' ? t.trialEnding(longDay(sub.trialEndsAt, locale)) : t.trialStart;
    default:
      // Un motivo nuevo de la API que esta versión aún no conoce.
      return t.fallback;
  }
}

export function UpgradeModal() {
  const reason = usePlanStore((s) => s.reason);
  const close = usePlanStore((s) => s.closeUpgrade);
  const subscription = useAuthStore((s) => s.user?.subscription);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();
  const reduce = useMotionReduced();
  const offer = useOffer();
  const { locale } = offer;
  const t = COPY[locale];
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

  const copy = copyFor(reason, subscription, locale);
  // Datos reales de la persona (T11): «Tus 23 días de historial están guardados…».
  const context = contextFor(reason, preview, locale);
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
  const firstCents = offer.firstPayment(planInterval, codeDiscount);

  async function activate() {
    if (!payDirectly) { setStep('card'); return; }
    setBusy(true);
    setError('');
    try {
      const next = await subscribe(choosesPlan ? interval : undefined);
      updateUser({ subscription: next });
      if (next.plan === 'pro' || next.pendingPayment) setStep('done');
      else setError(localizeBillingMessage(next.lastPaymentError, locale) ?? t.chargeFailed);
    } catch (err) {
      setError(apiErrorMessage(err, locale, t.activateFailed));
    } finally {
      setBusy(false);
    }
  }

  function finish(next: Subscription) {
    setStep('done');
    if (next.plan === 'pro' && lite) useToastStore.getState().success(next.status === 'trialing' ? t.trialStarted : t.havePro);
  }

  const title = step === 'card'
    ? (intent === 'trial' ? t.trialTitle : intent === 'charge' ? t.activateTitle(choosesPlan ? offer.name(planInterval) : 'NoutLife Pro') : t.methodTitle)
    : step === 'done' ? t.doneTitle : copy.title;
  const primaryLabel = trial
    ? t.startTrial
    : lite
      ? payDirectly ? t.pay(offer.money(firstCents)) : t.continueWith(offer.name(planInterval))
      : subscription?.hasPaymentMethod ? t.viewPlan : t.linkMethod;
  const fade = reduce
    ? {}
    : { initial: { opacity: 0, x: 16 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -16 }, transition: { duration: 0.3, ease } };

  return (
    <ResponsiveDialog open onClose={close} title={title} className={GLASS}>
      <AnimatePresence mode="wait" initial={false}>
        {step === 'pitch' && (
          <motion.div key="pitch" lang={locale} {...fade} className="flex flex-col gap-5">
            <p className="text-body-md text-on-surface">{copy.body}</p>
            {context && <p className="rounded-2xl bg-surface-variant px-4 py-3 text-body-md text-on-surface">{context}</p>}

            {choosesPlan && <PlanIntervalPicker value={interval} onChange={setInterval} discountPercent={codeDiscount} surface="upgrade_modal" />}

            {/* Ancla: con prueba, el $0 de hoy manda. Con el selector a la vista, solo el precio dicho por día. */}
            {choosesPlan && !trial ? (
              <p className="-mt-1 text-center text-body-sm text-on-background">
                {offer.framing(planInterval)} <span className="font-semibold">{t.cancelAnytime}</span>
              </p>
            ) : (
              <div className="flex flex-col items-center gap-1 rounded-3xl border border-secondary/40 bg-secondary/[var(--lq-soft-alpha)] px-4 py-4 text-center">
                {trial ? (
                  <>
                    <p className="text-display-md font-semibold tracking-tight tabular-nums">{t.zeroToday}</p>
                    <p className="text-body-sm text-on-surface-light">{t.trialThen(offer.priceLabel(planInterval, firstCents))}</p>
                    <p className="text-body-sm text-on-background">{offer.framing(planInterval, true)}</p>
                  </>
                ) : (
                  <>
                    <p className="flex items-baseline gap-1.5">
                      <span className="text-display-md font-semibold tracking-tight tabular-nums">{offer.money(offer.listFor(planInterval))}</span>
                      <span className="text-body-md text-on-surface-light">{offer.list.currency === 'COP' ? 'COP' : ''}/{offer.unit(planInterval)}</span>
                    </p>
                    <p className="text-body-sm text-on-background">{offer.framing(planInterval)}</p>
                  </>
                )}
                <p className="text-body-sm font-semibold text-on-background">{t.cancelAnytime}</p>
              </div>
            )}

            {/* Por qué un año: el compromiso con tu propio sistema, en un solo espacio. */}
            {choosesPlan && planInterval === 'year' && (
              <p className="text-body-md text-on-surface"><span className="font-semibold text-on-background">{offer.annualPitch.title}.</span> {offer.annualPitch.body}</p>
            )}

            <ul className="flex flex-col gap-2.5">
              {t.benefits.map((b) => (
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
                <Button variant="ghost" size="sm" onClick={() => { close(); navigate('/plan'); }}>{t.compare}</Button>
                <Button variant="ghost" size="sm" onClick={close}>{t.notNow}</Button>
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
          <motion.div key="done" lang={locale} {...fade} className="flex flex-col items-center gap-4 py-2 text-center">
            <motion.span
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            >
              <CheckCircle2 aria-hidden className="size-12 text-success-text" strokeWidth={1.5} />
            </motion.span>
            <p className="text-body-md text-on-surface">
              {subscription?.pendingPayment
                ? subscription.paymentMethodType === 'NEQUI' ? t.pendingNequi : t.pendingCard
                : subscription?.status === 'trialing'
                  ? trialDoneLine(subscription, locale)
                  : intent === 'save'
                    ? t.methodUpdated
                    : subscription?.interval === 'year' ? t.doneYear : t.doneMonth}
            </p>
            <Button size="lg" block onClick={close}>{t.next}</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveDialog>
  );
}
