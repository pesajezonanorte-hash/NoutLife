// Plan: estado de la suscripción (prueba, periodo pagado, cancelada o Lite), el
// plan (mensual o anual), el método de pago, los cobros y la comparación de
// planes. Cancelar es un clic; pasar a anual rige desde la próxima renovación.
// Montos e idioma salen de la oferta de la cuenta (lib/offer): pesos en Colombia,
// dólares fuera (cobrados en pesos por Wompi; cada cobro muestra también lo cobrado en COP).
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarRange, CreditCard, Receipt } from 'lucide-react';
import type { BillingInterval, Subscription, SubscriptionStatus } from '@noutlife/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, ErrorState, PageLoader, ResponsiveDialog, type BadgeVariant } from '@/components/ui/lq';
import { PaymentMethodForm } from '@/components/billing/PaymentMethodForm';
import { PricingSection } from '@/components/billing/PricingSection';
import { PlanIntervalPicker } from '@/components/billing/PlanIntervalPicker';
import { CreatorCodeField } from '@/components/billing/CreatorCodeField';
import { TrialRibbon } from '@/components/billing/TrialRibbon';
import { FxNote } from '@/components/billing/FxNote';
import { item, stagger } from '@/lib/motion';
import { apiErrorMessage, localizeBillingMessage } from '@/lib/billing-messages';
import { INTL_LOCALE, getLocale, type Copy } from '@/lib/i18n';
import { offerFor, type Offer } from '@/lib/offer';
import { useOffer } from '@/lib/useOffer';
import { TRIAL_DAYS, annualAvailable, daysUntil, formatMoney, longDate, longDay, priceListFor } from '@/lib/plan';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import {
  cancelSubscription, getBillingStatus, resumeSubscription, setBillingInterval, subscribe, type BillingPayment,
} from '@/services/billing.service';

const es = {
  status: {
    trialing: { label: 'Prueba gratis', badge: 'secondary' },
    active: { label: 'Activo', badge: 'success' },
    canceled: { label: 'Cancelado', badge: 'warning' },
    lite: { label: 'Gratis', badge: 'neutral' },
    pending_approval: { label: 'Esperando aprobación', badge: 'warning' },
  } as Record<SubscriptionStatus, { label: string; badge: BadgeVariant }>,
  complimentary: 'De cortesía',
  paymentStatus: {
    APPROVED: { label: 'Aprobado', badge: 'success' },
    PENDING: { label: 'En proceso', badge: 'warning' },
    DECLINED: { label: 'Rechazado', badge: 'error' },
    VOIDED: { label: 'Anulado', badge: 'neutral' },
    ERROR: { label: 'Fallido', badge: 'error' },
  } as Record<string, { label: string; badge: BadgeVariant }>,
  pendingNequi: 'Revisa tu app de Nequi: si te pide aprobar el cobro, apruébalo. Puede tardar unos minutos.',
  pendingCard: 'Estamos confirmando tu pago con Wompi. Puede tardar unos minutos.',
  courtesy: 'Tu Pro es de cortesía: sigue activo, sin cobros ni fecha de vencimiento.',
  trialCharge: (date: string, price: string, annual: boolean) => `El ${date} se cobran ${price} y empieza tu primer ${annual ? 'año' : 'mes'} Pro.`,
  trialToLite: (date: string) => `El ${date} tu cuenta pasa a NoutLife Lite. Vincula un método de pago para seguir en Pro.`,
  renews: (date: string, price: string, annual: boolean) => `Se renueva el ${date} por ${price}${annual ? ' al año' : ''}.`,
  canceledUntil: (date: string) => `Tienes Pro hasta el ${date}. Después pasas a NoutLife Lite, sin más cobros.`,
  approveNequi: 'Aprueba el cobro en tu app de Nequi. Cuando lo apruebes, tu Pro se activa solo.',
  liteTrial: `Prueba Pro ${TRIAL_DAYS} días gratis: $0 hoy y cancelas con 1 clic.`,
  liteError: (error: string) => `${error} Tu cuenta sigue en Lite y no perdiste nada.`,
  lite: 'Tu cuenta funciona con los límites de Lite. Todo sigue guardado y vuelve a verse completo con Pro.',
  canceledToast: 'Suscripción cancelada',
  canceledBody: (date: string) => `Tienes Pro hasta el ${date}. No habrá más cobros.`,
  resumed: 'Suscripción reanudada',
  havePro: (annual: boolean): string => (annual ? 'Ya tienes NoutLife Pro Anual' : 'Ya tienes NoutLife Pro'),
  chargeFailed: 'No se pudo completar el cobro',
  updateFailed: 'No pudimos actualizar tu plan. Inténtalo de nuevo.',
  switched: (annual: boolean): string => (annual ? 'Pasaste a Pro Anual' : 'Pasaste a Pro Mensual'),
  switchedBody: (date: string, price: string, annual: boolean) => `Desde el ${date} pagas ${price} ${annual ? 'por 12 meses' : 'cada mes'}. Hoy no se cobra nada.`,
  switchFailed: 'No pudimos cambiar tu plan. Inténtalo de nuevo.',
  loading: 'Cargando tu plan',
  startTrial: `Empezar mis ${TRIAL_DAYS} días gratis`,
  continueWith: (name: string) => `Continuar con ${name}`,
  activateFor: (price: string) => `Activar Pro por ${price}/mes`,
  eyebrow: 'Tu cuenta',
  title: 'Tu plan',
  descriptionLite: 'Estás en NoutLife Lite. Vuelve a Pro cuando quieras.',
  descriptionPro: 'Todo NoutLife Pro, y el control de tu suscripción en un solo lugar.',
  proAnnual: 'NoutLife Pro Anual',
  ribbonCharge: (date: string, price: string) => `${date}: ${price}`,
  ribbonLite: (date: string) => `${date}: pasa a Lite`,
  ribbonSummary: (left: number, date: string) => `Te ${left === 1 ? 'queda 1 día' : `quedan ${left} días`} de prueba. La prueba termina el ${date}.`,
  annualNote: 'Un solo pago al año, con tarifa congelada.',
  monthlyNote: (o: Offer) => `Con el anual ahorras ${o.money(o.savings)} al año: unos ${o.perDay(o.perDayFor('year'))} al día.`,
  toMonthly: 'Volver a mensual',
  toAnnual: 'Pasar a anual',
  noMethod: 'Sin método de pago',
  changeMethod: 'Cambiar método de pago',
  linkMethod: 'Vincular método de pago',
  resume: 'Reanudar suscripción',
  cancel: 'Cancelar suscripción',
  payments: 'Cobros',
  period: (name: string, start: string, end: string) => `${name} · del ${start} al ${end}`,
  discount: (amount: string) => ` · descuento de ${amount}`,
  codeApplied: ' · con código de creador',
  charged: (cop: string) => ` · se cobraron ${cop}`,
  titleTrial: `${TRIAL_DAYS} días de Pro gratis. $0 hoy.`,
  titleLiteAnnual: (o: Offer) => `Vuelve a Pro desde ${o.perDay(o.perDayFor('year'), true)} al día.`,
  titleLiteMonthly: (o: Offer) => `Vuelve a Pro por ${o.moneyCode(o.listFor('month'))}/mes.`,
  titlePro: 'Pro y Lite, lado a lado.',
  thenCancel: (price: string) => `Luego ${price}. Cancela en cualquier momento con 1 clic.`,
  keepsLite: 'Si cancelas o un cobro falla, tu cuenta pasa a Lite y no pierdes nada.',
  dialogTrial: `${TRIAL_DAYS} días de Pro gratis`,
  dialogActivate: (name: string) => `Activa ${name}`,
  dialogMethod: 'Tu método de pago',
  payWith: (price: string, method: string | null) => `Pagar ${price} con ${method ?? 'tu método de pago'}`,
  otherMethod: 'Usar otro método de pago',
  trialStarted: 'Empezó tu prueba Pro',
  methodLinked: 'Método de pago vinculado',
};

const en: typeof es = {
  status: {
    trialing: { label: 'Free trial', badge: 'secondary' },
    active: { label: 'Active', badge: 'success' },
    canceled: { label: 'Canceled', badge: 'warning' },
    lite: { label: 'Free', badge: 'neutral' },
    pending_approval: { label: 'Awaiting approval', badge: 'warning' },
  },
  complimentary: 'Complimentary',
  paymentStatus: {
    APPROVED: { label: 'Approved', badge: 'success' },
    PENDING: { label: 'Processing', badge: 'warning' },
    DECLINED: { label: 'Declined', badge: 'error' },
    VOIDED: { label: 'Voided', badge: 'neutral' },
    ERROR: { label: 'Failed', badge: 'error' },
  },
  pendingNequi: 'Check your Nequi app: if it asks you to approve the charge, approve it. It can take a few minutes.',
  pendingCard: 'We’re confirming your payment with Wompi. It can take a few minutes.',
  courtesy: 'Your Pro is complimentary: it stays active, with no charges or end date.',
  trialCharge: (date, price, annual) => `On ${date} you’ll be charged ${price} and your first ${annual ? 'year' : 'month'} of Pro begins.`,
  trialToLite: (date) => `On ${date} your account moves to NoutLife Lite. Link a payment method to stay on Pro.`,
  renews: (date, price, annual) => `Renews on ${date} for ${price}${annual ? ' a year' : ''}.`,
  canceledUntil: (date) => `You have Pro until ${date}. Then you move to NoutLife Lite, with no more charges.`,
  approveNequi: 'Approve the charge in your Nequi app. Once you do, your Pro activates on its own.',
  liteTrial: `Try Pro free for ${TRIAL_DAYS} days: $0 today and cancel in 1 click.`,
  liteError: (error) => `${error} Your account stays on Lite and you haven’t lost anything.`,
  lite: 'Your account works with Lite limits. Everything stays saved and shows in full again with Pro.',
  canceledToast: 'Subscription canceled',
  canceledBody: (date) => `You have Pro until ${date}. There will be no more charges.`,
  resumed: 'Subscription resumed',
  havePro: (annual) => (annual ? 'You now have NoutLife Pro Annual' : 'You now have NoutLife Pro'),
  chargeFailed: 'The charge couldn’t be completed',
  updateFailed: 'We couldn’t update your plan. Please try again.',
  switched: (annual) => (annual ? 'You switched to Pro Annual' : 'You switched to Pro Monthly'),
  switchedBody: (date, price, annual) => `From ${date} you pay ${price} ${annual ? 'for 12 months' : 'every month'}. Nothing is charged today.`,
  switchFailed: 'We couldn’t change your plan. Please try again.',
  loading: 'Loading your plan',
  startTrial: `Start my ${TRIAL_DAYS} free days`,
  continueWith: (name) => `Continue with ${name}`,
  activateFor: (price) => `Activate Pro for ${price}/month`,
  eyebrow: 'Your account',
  title: 'Your plan',
  descriptionLite: 'You’re on NoutLife Lite. Come back to Pro whenever you like.',
  descriptionPro: 'All of NoutLife Pro, and control of your subscription, in one place.',
  proAnnual: 'NoutLife Pro Annual',
  ribbonCharge: (date, price) => `${date}: ${price}`,
  ribbonLite: (date) => `${date}: moves to Lite`,
  ribbonSummary: (left, date) => `You have ${left === 1 ? '1 day' : `${left} days`} of trial left. The trial ends on ${date}.`,
  annualNote: 'One payment a year, with your price locked.',
  monthlyNote: (o) => `With annual you save ${o.money(o.savings)} a year: about ${o.perDay(o.perDayFor('year'))} a day.`,
  toMonthly: 'Back to monthly',
  toAnnual: 'Switch to annual',
  noMethod: 'No payment method',
  changeMethod: 'Change payment method',
  linkMethod: 'Link payment method',
  resume: 'Resume subscription',
  cancel: 'Cancel subscription',
  payments: 'Payments',
  period: (name, start, end) => `${name} · ${start} to ${end}`,
  discount: (amount) => ` · ${amount} discount`,
  codeApplied: ' · creator code applied',
  charged: (cop) => ` · charged ${cop}`,
  titleTrial: `${TRIAL_DAYS} days of Pro, free. $0 today.`,
  titleLiteAnnual: (o) => `Come back to Pro from ${o.perDay(o.perDayFor('year'), true)} a day.`,
  titleLiteMonthly: (o) => `Come back to Pro for ${o.moneyCode(o.listFor('month'))}/month.`,
  titlePro: 'Pro and Lite, side by side.',
  thenCancel: (price) => `Then ${price}. Cancel anytime in 1 click.`,
  keepsLite: 'If you cancel or a charge fails, your account moves to Lite and you lose nothing.',
  dialogTrial: `${TRIAL_DAYS} days of Pro, free`,
  dialogActivate: (name) => `Activate ${name}`,
  dialogMethod: 'Your payment method',
  payWith: (price, method) => `Pay ${price} with ${method ?? 'your payment method'}`,
  otherMethod: 'Use another payment method',
  trialStarted: 'Your Pro trial has started',
  methodLinked: 'Payment method linked',
};

const COPY: Copy<typeof es> = { es, en };

/** Monto del próximo cobro en la moneda de la cuenta: el de la API (plan y código) o, en APIs anteriores, el de lista. */
function nextChargeCents(sub: Subscription, offer: Offer): number {
  return sub.nextChargeInCents ?? (sub.nextChargeCop != null ? sub.nextChargeCop * 100 : offer.listFor(sub.interval ?? 'month'));
}

/** Qué pasa después, en una frase. */
function nextStep(sub: Subscription, offer: Offer, t: typeof es): string {
  if (sub.pendingPayment) return sub.paymentMethodType === 'NEQUI' ? t.pendingNequi : t.pendingCard;
  if (sub.complimentary) return t.courtesy;
  const date = longDate(sub.accessEndsAt, new Date(), offer.locale);
  const annual = sub.interval === 'year';
  const next = offer.money(nextChargeCents(sub, offer));
  switch (sub.status) {
    case 'trialing':
      return sub.hasPaymentMethod ? t.trialCharge(date, next, annual) : t.trialToLite(date);
    case 'active':
      return t.renews(date, next, annual);
    case 'canceled':
      return t.canceledUntil(date);
    case 'pending_approval':
      return t.approveNequi;
    case 'lite': {
      if (sub.trialAvailable) return t.liteTrial;
      const error = localizeBillingMessage(sub.lastPaymentError, offer.locale);
      return error ? t.liteError(error) : t.lite;
    }
  }
}

type Dialog = 'trial' | 'save' | 'charge' | 'confirm';

export default function PlanPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const offer = useOffer();
  const { locale } = offer;
  const t = COPY[locale];
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(user?.subscription ? 'ready' : 'loading');
  const [busy, setBusy] = useState<'cancel' | 'resume' | 'subscribe' | 'interval' | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const sub = user?.subscription ?? null;
  // Plan del checkout: quien ya paga o tiene tarjeta en prueba conserva el suyo; si no, el anual recomendado.
  const [interval, setInterval] = useState<BillingInterval>(() => (
    sub?.interval && (sub.status === 'active' || (sub.status === 'trialing' && sub.hasPaymentMethod)) ? sub.interval : 'year'
  ));

  const load = useCallback(() => {
    getBillingStatus()
      .then(({ subscription, payments: list }) => {
        updateUser({ subscription });
        setPayments(list);
        setState('ready');
      })
      .catch(() => setState((s) => (s === 'ready' ? s : 'error')));
  }, [updateUser]);

  useEffect(load, [load]);

  // Un cobro en curso se resuelve en segundos o minutos: se consulta de nuevo.
  useEffect(() => {
    if (!sub?.pendingPayment) return;
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
  }, [sub?.pendingPayment, load]);

  const canAnnual = annualAvailable(sub);
  const planInterval: BillingInterval = canAnnual ? interval : 'month';
  const codeDiscount = sub?.creatorCodeEditable ? sub.creatorCode?.discountPercent ?? 0 : 0;
  const firstCents = offer.firstPayment(planInterval, codeDiscount);

  async function run(action: 'cancel' | 'resume' | 'subscribe') {
    const toast = useToastStore.getState();
    // Los avisos salen en el idioma de ese momento (la respuesta puede llegar tras un cambio de idioma).
    const now = COPY[getLocale()];
    setBusy(action);
    try {
      const next = action === 'cancel'
        ? await cancelSubscription()
        : action === 'resume' ? await resumeSubscription() : await subscribe(canAnnual ? interval : undefined);
      updateUser({ subscription: next });
      if (action === 'cancel') toast.success(now.canceledToast, now.canceledBody(longDate(next.accessEndsAt, new Date(), getLocale())));
      if (action === 'resume') toast.success(now.resumed);
      if (action === 'subscribe') {
        if (next.plan === 'pro') { toast.success(now.havePro(next.interval === 'year')); setDialog(null); }
        else if (next.pendingPayment) setDialog(null);
        else toast.error(localizeBillingMessage(next.lastPaymentError, getLocale()) ?? now.chargeFailed);
      }
      load();
    } catch (error) {
      toast.error(apiErrorMessage(error, getLocale(), now.updateFailed));
    } finally {
      setBusy(null);
    }
  }

  /** Cambia el plan del próximo cobro. No cobra nada hoy. */
  async function switchInterval(next: BillingInterval) {
    const toast = useToastStore.getState();
    const now = COPY[getLocale()];
    setBusy('interval');
    try {
      const updated = await setBillingInterval(next);
      updateUser({ subscription: updated });
      setInterval(next);
      const nowOffer = offerFor(getLocale(), priceListFor(updated));
      const when = longDate(updated.accessEndsAt, new Date(), getLocale());
      const amount = updated.nextChargeInCents ?? (updated.nextChargeCop != null ? updated.nextChargeCop * 100 : nowOffer.listFor(next));
      toast.success(now.switched(next === 'year'), now.switchedBody(when, nowOffer.money(amount), next === 'year'));
    } catch (error) {
      toast.error(apiErrorMessage(error, getLocale(), now.switchFailed));
    } finally {
      setBusy(null);
    }
  }

  function activatePro() {
    if (sub?.trialAvailable) setDialog('trial');
    else if (sub?.hasPaymentMethod) setDialog('confirm');
    else setDialog('charge');
  }

  if (state === 'loading') return <PageLoader label={t.loading} />;
  if (state === 'error' || !sub) return <ErrorState onRetry={() => { setState('loading'); load(); }} />;

  const lite = sub.status === 'lite';
  const proLabel = sub.trialAvailable
    ? t.startTrial
    : canAnnual ? t.continueWith(offer.name(planInterval)) : t.activateFor(offer.money(offer.listFor('month')));
  const trialLeft = daysUntil(sub.trialEndsAt);
  const status = sub.complimentary ? { label: t.complimentary, badge: 'secondary' as const } : t.status[sub.status];
  // Quien paga (o tiene tarjeta en su prueba) ve su plan y puede pasar a anual o a mensual desde la próxima renovación.
  const showsPlan = canAnnual && !sub.complimentary && !sub.pendingPayment
    && (sub.status === 'active' || (sub.status === 'trialing' && sub.hasPaymentMethod));
  const savedInterval: BillingInterval = sub.interval ?? 'month';
  const trialEnd = longDay(sub.trialEndsAt, locale);
  const nextCents = nextChargeCents(sub, offer);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" lang={locale} className="flex flex-col gap-8 md:gap-12">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={lite ? t.descriptionLite : t.descriptionPro} />

      <motion.div variants={item}>
        <Card padding="lg" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-heading-lg">{lite ? 'NoutLife Lite' : savedInterval === 'year' && !sub.complimentary ? t.proAnnual : 'NoutLife Pro'}</h2>
              <p className="max-w-[560px] text-body-md text-on-surface" aria-live="polite">{nextStep(sub, offer, t)}</p>
            </div>
            <Badge variant={status.badge} size="lg">{status.label}</Badge>
          </div>

          {sub.status === 'trialing' && (
            <TrialRibbon
              className="max-w-[560px]"
              elapsed={TRIAL_DAYS - trialLeft}
              chargeLabel={sub.hasPaymentMethod ? t.ribbonCharge(trialEnd, offer.money(nextCents)) : t.ribbonLite(trialEnd)}
              summary={t.ribbonSummary(trialLeft, trialEnd)}
            />
          )}

          {showsPlan && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <CalendarRange aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              <span className="min-w-0 flex-[1_1_220px] text-body-md">
                {offer.name(savedInterval)} · {offer.money(offer.listFor(savedInterval))}/{offer.unit(savedInterval)}
                <span className="block text-body-sm text-on-surface-light">
                  {savedInterval === 'year' ? t.annualNote : t.monthlyNote(offer)}
                </span>
              </span>
              <Button
                variant={savedInterval === 'year' ? 'ghost' : 'secondary'}
                size="sm"
                loading={busy === 'interval'}
                onClick={() => void switchInterval(savedInterval === 'year' ? 'month' : 'year')}
              >
                {savedInterval === 'year' ? t.toMonthly : t.toAnnual}
              </Button>
            </div>
          )}

          {/* La cortesía no cobra: no hay método de pago que mostrar ni que cambiar. */}
          {!sub.complimentary && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <CreditCard aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              <span className="min-w-0 flex-[1_1_200px] text-body-md">
                {sub.paymentMethodLabel ?? t.noMethod}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setDialog(sub.trialAvailable ? 'trial' : 'save')}>
                {sub.hasPaymentMethod ? t.changeMethod : t.linkMethod}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {lite && (
              <Button size="md" loading={busy === 'subscribe'} onClick={activatePro}>{proLabel}</Button>
            )}
            {sub.status === 'canceled' && (
              <Button size="md" loading={busy === 'resume'} onClick={() => void run('resume')}>{t.resume}</Button>
            )}
            {(sub.status === 'trialing' || sub.status === 'active') && !sub.complimentary && (
              <Button variant="ghost" size="md" loading={busy === 'cancel'} onClick={() => void run('cancel')}>{t.cancel}</Button>
            )}
          </div>
        </Card>
      </motion.div>

      {payments.length > 0 && (
        <motion.section variants={item} aria-labelledby="plan-payments" className="flex flex-col gap-4">
          <h2 id="plan-payments" className="text-heading-md">{t.payments}</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {payments.map((p) => {
              const s = t.paymentStatus[p.status] ?? { label: p.status, badge: 'neutral' as const };
              // El precio en la moneda de la cuenta; si fue en dólares, también lo que Wompi cobró en pesos.
              const priceCurrency = p.priceCurrency === 'USD' ? 'USD' : 'COP';
              const price = formatMoney(p.priceAmountInCents ?? p.amountInCents, priceCurrency, locale);
              const chargedCop = priceCurrency === 'USD' ? formatMoney(p.amountInCents, 'COP', locale) + ' COP' : null;
              const discount = p.discountInCents
                ? (priceCurrency === 'USD' ? t.codeApplied : t.discount(formatMoney(p.discountInCents, 'COP', locale)))
                : '';
              return (
                <li key={p.id} className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-6">
                  <Receipt aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
                  <span className="min-w-0 flex-[1_1_180px] text-body-md">
                    {new Date(p.createdAt).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short', year: 'numeric' })}
                    <span className="block text-body-sm text-on-surface-light">
                      {t.period(offer.name(p.interval ?? 'month'), longDay(p.periodStart, locale), longDate(p.periodEnd, new Date(p.periodStart), locale))}
                      {discount}
                      {chargedCop ? t.charged(chargedCop) : ''}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{price}</span>
                  <Badge variant={s.badge}>{s.label}</Badge>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      <motion.div variants={item}>
        <PricingSection
          mode="app"
          subscription={sub}
          interval={planInterval}
          onIntervalChange={setInterval}
          discountPercent={codeDiscount}
          title={sub.trialAvailable
            ? t.titleTrial
            : lite ? (canAnnual ? t.titleLiteAnnual(offer) : t.titleLiteMonthly(offer)) : t.titlePro}
          description={sub.trialAvailable
            ? t.thenCancel(offer.priceLabel(planInterval, firstCents))
            : lite
              ? offer.chargeLine(planInterval, firstCents)
              : t.keepsLite}
          showRibbon={sub.trialAvailable}
          proAction={lite ? { label: proLabel, onClick: activatePro, loading: busy === 'subscribe' } : undefined}
        />
      </motion.div>

      <ResponsiveDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'trial' ? t.dialogTrial : dialog === 'charge' || dialog === 'confirm' ? t.dialogActivate(canAnnual ? offer.name(planInterval) : 'NoutLife Pro') : t.dialogMethod}
        className="bg-background/80 backdrop-blur-2xl backdrop-saturate-150"
      >
        {dialog === 'confirm' && (
          // Con medio de pago guardado: plan, código y pagar, sin volver a escribir la tarjeta.
          <div lang={locale} className="flex flex-col gap-4">
            {canAnnual && <PlanIntervalPicker value={planInterval} onChange={setInterval} discountPercent={codeDiscount} surface="plan_confirm" />}
            <CreatorCodeField />
            <p className="text-body-sm text-on-surface">{offer.chargeLine(planInterval, firstCents)}</p>
            <p className="rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-on-background">{offer.framing(planInterval)}</p>
            <FxNote usdCents={firstCents} later={false} />
            <Button size="lg" block loading={busy === 'subscribe'} onClick={() => void run('subscribe')}>
              {t.payWith(offer.money(firstCents), sub.paymentMethodLabel)}
            </Button>
            <Button variant="ghost" size="md" disabled={busy === 'subscribe'} onClick={() => setDialog('charge')}>{t.otherMethod}</Button>
          </div>
        )}
        {dialog && dialog !== 'confirm' && (
          <PaymentMethodForm
            intent={dialog}
            interval={canAnnual ? planInterval : undefined}
            chargeDate={lite ? null : sub.accessEndsAt}
            onCancel={() => setDialog(null)}
            onDone={(next) => {
              setDialog(null);
              const now = COPY[getLocale()];
              useToastStore.getState().success(
                dialog === 'trial' && next.status === 'trialing' ? now.trialStarted
                  : lite && next.plan === 'pro' ? now.havePro(next.interval === 'year')
                    : now.methodLinked,
              );
              load();
            }}
          />
        )}
      </ResponsiveDialog>
    </motion.div>
  );
}
