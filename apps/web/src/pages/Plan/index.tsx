// Plan: estado de la suscripción (prueba, periodo pagado, cancelada o Lite), el
// plan (mensual o anual), el método de pago, los cobros y la comparación de
// planes. Cancelar es un clic; pasar a anual rige desde la próxima renovación.
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
import { item, stagger } from '@/lib/motion';
import {
  ANNUAL_SAVINGS_COP, PRO_ANNUAL_PER_DAY_COP, TRIAL_DAYS, annualAvailable, chargeLine, daysUntil, firstPaymentCop, firstPriceLabel, formatCop, framingFor,
  intervalName, intervalUnit, longDate, longDay, priceFor,
} from '@/lib/plan';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import {
  cancelSubscription, getBillingStatus, resumeSubscription, setBillingInterval, subscribe, type BillingPayment,
} from '@/services/billing.service';

const STATUS: Record<SubscriptionStatus, { label: string; badge: BadgeVariant }> = {
  trialing: { label: 'Prueba gratis', badge: 'secondary' },
  active: { label: 'Activo', badge: 'success' },
  canceled: { label: 'Cancelado', badge: 'warning' },
  lite: { label: 'Gratis', badge: 'neutral' },
  pending_approval: { label: 'Esperando aprobación', badge: 'warning' },
};

const PAYMENT_STATUS: Record<string, { label: string; badge: BadgeVariant }> = {
  APPROVED: { label: 'Aprobado', badge: 'success' },
  PENDING: { label: 'En proceso', badge: 'warning' },
  DECLINED: { label: 'Rechazado', badge: 'error' },
  VOIDED: { label: 'Anulado', badge: 'neutral' },
  ERROR: { label: 'Fallido', badge: 'error' },
};

/** Monto del próximo cobro: el que calcula la API (plan y código) o, en APIs anteriores, el precio de lista. */
const nextCharge = (sub: Subscription) => formatCop(sub.nextChargeCop ?? priceFor(sub.interval ?? 'month'));

/** Qué pasa después, en una frase. */
function nextStep(sub: Subscription): string {
  if (sub.pendingPayment) {
    return sub.paymentMethodType === 'NEQUI'
      ? 'Revisa tu app de Nequi: si te pide aprobar el cobro, apruébalo. Puede tardar unos minutos.'
      : 'Estamos confirmando tu pago con Wompi. Puede tardar unos minutos.';
  }
  if (sub.complimentary) return 'Tu Pro es de cortesía: sigue activo, sin cobros ni fecha de vencimiento.';
  const date = longDate(sub.accessEndsAt);
  const annual = sub.interval === 'year';
  switch (sub.status) {
    case 'trialing':
      return sub.hasPaymentMethod
        ? `El ${date} se cobran ${nextCharge(sub)} y empieza tu primer ${annual ? 'año' : 'mes'} Pro.`
        : `El ${date} tu cuenta pasa a NoutLife Lite. Vincula un método de pago para seguir en Pro.`;
    case 'active':
      return `Se renueva el ${date} por ${nextCharge(sub)}${annual ? ' al año' : ''}.`;
    case 'canceled':
      return `Tienes Pro hasta el ${date}. Después pasas a NoutLife Lite, sin más cobros.`;
    case 'pending_approval':
      return 'Aprueba el cobro en tu app de Nequi. Cuando lo apruebes, tu Pro se activa solo.';
    case 'lite':
      if (sub.trialAvailable) return `Prueba Pro ${TRIAL_DAYS} días gratis: $0 hoy y cancelas con 1 clic.`;
      return sub.lastPaymentError
        ? `${sub.lastPaymentError} Tu cuenta sigue en Lite y no perdiste nada.`
        : 'Tu cuenta funciona con los límites de Lite. Todo sigue guardado y vuelve a verse completo con Pro.';
  }
}

type Dialog = 'trial' | 'save' | 'charge' | 'confirm';

export default function PlanPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
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
  const firstCop = firstPaymentCop(planInterval, codeDiscount);

  async function run(action: 'cancel' | 'resume' | 'subscribe') {
    const toast = useToastStore.getState();
    setBusy(action);
    try {
      const next = action === 'cancel'
        ? await cancelSubscription()
        : action === 'resume' ? await resumeSubscription() : await subscribe(canAnnual ? interval : undefined);
      updateUser({ subscription: next });
      if (action === 'cancel') toast.success('Suscripción cancelada', `Tienes Pro hasta el ${longDate(next.accessEndsAt)}. No habrá más cobros.`);
      if (action === 'resume') toast.success('Suscripción reanudada');
      if (action === 'subscribe') {
        if (next.plan === 'pro') { toast.success(next.interval === 'year' ? 'Ya tienes NoutLife Pro Anual' : 'Ya tienes NoutLife Pro'); setDialog(null); }
        else if (next.pendingPayment) setDialog(null);
        else toast.error(next.lastPaymentError ?? 'No se pudo completar el cobro');
      }
      load();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? 'No pudimos actualizar tu plan. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  /** Cambia el plan del próximo cobro. No cobra nada hoy. */
  async function switchInterval(next: BillingInterval) {
    const toast = useToastStore.getState();
    setBusy('interval');
    try {
      const updated = await setBillingInterval(next);
      updateUser({ subscription: updated });
      setInterval(next);
      const when = longDate(updated.accessEndsAt);
      toast.success(
        next === 'year' ? 'Pasaste a Pro Anual' : 'Pasaste a Pro Mensual',
        `Desde el ${when} pagas ${formatCop(updated.nextChargeCop ?? priceFor(next))} ${next === 'year' ? 'por 12 meses' : 'cada mes'}. Hoy no se cobra nada.`,
      );
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? 'No pudimos cambiar tu plan. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  function activatePro() {
    if (sub?.trialAvailable) setDialog('trial');
    else if (sub?.hasPaymentMethod) setDialog('confirm');
    else setDialog('charge');
  }

  if (state === 'loading') return <PageLoader label="Cargando tu plan" />;
  if (state === 'error' || !sub) return <ErrorState onRetry={() => { setState('loading'); load(); }} />;

  const lite = sub.status === 'lite';
  const proLabel = sub.trialAvailable
    ? `Empezar mis ${TRIAL_DAYS} días gratis`
    : canAnnual ? `Continuar con ${intervalName(planInterval)}` : `Activar Pro por ${formatCop(priceFor('month'))}/mes`;
  const trialLeft = daysUntil(sub.trialEndsAt);
  const status = sub.complimentary ? { label: 'De cortesía', badge: 'secondary' as const } : STATUS[sub.status];
  // Quien paga (o tiene tarjeta en su prueba) ve su plan y puede pasar a anual o a mensual desde la próxima renovación.
  const showsPlan = canAnnual && !sub.complimentary && !sub.pendingPayment
    && (sub.status === 'active' || (sub.status === 'trialing' && sub.hasPaymentMethod));
  const savedInterval: BillingInterval = sub.interval ?? 'month';

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader
        eyebrow="Tu cuenta"
        title="Tu plan"
        description={lite ? 'Estás en NoutLife Lite. Vuelve a Pro cuando quieras.' : 'Todo NoutLife Pro, y el control de tu suscripción en un solo lugar.'}
      />

      <motion.div variants={item}>
        <Card padding="lg" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-heading-lg">{lite ? 'NoutLife Lite' : savedInterval === 'year' && !sub.complimentary ? 'NoutLife Pro Anual' : 'NoutLife Pro'}</h2>
              <p className="max-w-[560px] text-body-md text-on-surface" aria-live="polite">{nextStep(sub)}</p>
            </div>
            <Badge variant={status.badge} size="lg">{status.label}</Badge>
          </div>

          {sub.status === 'trialing' && (
            <TrialRibbon
              className="max-w-[560px]"
              elapsed={TRIAL_DAYS - trialLeft}
              chargeLabel={sub.hasPaymentMethod ? `${longDay(sub.trialEndsAt)}: ${nextCharge(sub)}` : `${longDay(sub.trialEndsAt)}: pasa a Lite`}
              summary={`Te ${trialLeft === 1 ? 'queda 1 día' : `quedan ${trialLeft} días`} de prueba. La prueba termina el ${longDay(sub.trialEndsAt)}.`}
            />
          )}

          {showsPlan && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <CalendarRange aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              <span className="min-w-0 flex-[1_1_220px] text-body-md">
                {intervalName(savedInterval)} · {formatCop(priceFor(savedInterval))}/{intervalUnit(savedInterval)}
                <span className="block text-body-sm text-on-surface-light">
                  {savedInterval === 'year'
                    ? 'Un solo pago al año, con tarifa congelada.'
                    : `Con el anual ahorras ${formatCop(ANNUAL_SAVINGS_COP)} al año: unos ${formatCop(PRO_ANNUAL_PER_DAY_COP)} al día.`}
                </span>
              </span>
              <Button
                variant={savedInterval === 'year' ? 'ghost' : 'secondary'}
                size="sm"
                loading={busy === 'interval'}
                onClick={() => void switchInterval(savedInterval === 'year' ? 'month' : 'year')}
              >
                {savedInterval === 'year' ? 'Volver a mensual' : 'Pasar a anual'}
              </Button>
            </div>
          )}

          {/* La cortesía no cobra: no hay método de pago que mostrar ni que cambiar. */}
          {!sub.complimentary && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <CreditCard aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              <span className="min-w-0 flex-[1_1_200px] text-body-md">
                {sub.paymentMethodLabel ?? 'Sin método de pago'}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setDialog(sub.trialAvailable ? 'trial' : 'save')}>
                {sub.hasPaymentMethod ? 'Cambiar método de pago' : 'Vincular método de pago'}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {lite && (
              <Button size="md" loading={busy === 'subscribe'} onClick={activatePro}>{proLabel}</Button>
            )}
            {sub.status === 'canceled' && (
              <Button size="md" loading={busy === 'resume'} onClick={() => void run('resume')}>Reanudar suscripción</Button>
            )}
            {(sub.status === 'trialing' || sub.status === 'active') && !sub.complimentary && (
              <Button variant="ghost" size="md" loading={busy === 'cancel'} onClick={() => void run('cancel')}>Cancelar suscripción</Button>
            )}
          </div>
        </Card>
      </motion.div>

      {payments.length > 0 && (
        <motion.section variants={item} aria-labelledby="plan-payments" className="flex flex-col gap-4">
          <h2 id="plan-payments" className="text-heading-md">Cobros</h2>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {payments.map((p) => {
              const s = PAYMENT_STATUS[p.status] ?? { label: p.status, badge: 'neutral' as const };
              return (
                <li key={p.id} className="flex min-h-14 flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-6">
                  <Receipt aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
                  <span className="min-w-0 flex-[1_1_180px] text-body-md">
                    {new Date(p.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    <span className="block text-body-sm text-on-surface-light">
                      {intervalName(p.interval ?? 'month')} · del {longDay(p.periodStart)} al {longDate(p.periodEnd, new Date(p.periodStart))}
                      {p.discountInCents ? ` · descuento de ${formatCop(p.discountInCents / 100)}` : ''}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatCop(p.amountInCents / 100)}</span>
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
            ? `${TRIAL_DAYS} días de Pro gratis. $0 hoy.`
            : lite ? (canAnnual ? `Vuelve a Pro desde ${formatCop(PRO_ANNUAL_PER_DAY_COP)} COP al día.` : `Vuelve a Pro por ${formatCop(priceFor('month'))} COP/mes.`) : 'Pro y Lite, lado a lado.'}
          description={sub.trialAvailable
            ? `Luego ${firstPriceLabel(planInterval, firstCop)}. Cancela en cualquier momento con 1 clic.`
            : lite
              ? chargeLine(planInterval, firstCop)
              : 'Si cancelas o un cobro falla, tu cuenta pasa a Lite y no pierdes nada.'}
          showRibbon={sub.trialAvailable}
          proAction={lite ? { label: proLabel, onClick: activatePro, loading: busy === 'subscribe' } : undefined}
        />
      </motion.div>

      <ResponsiveDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'trial' ? `${TRIAL_DAYS} días de Pro gratis` : dialog === 'charge' || dialog === 'confirm' ? `Activa ${canAnnual ? intervalName(planInterval) : 'NoutLife Pro'}` : 'Tu método de pago'}
        className="bg-background/80 backdrop-blur-2xl backdrop-saturate-150"
      >
        {dialog === 'confirm' && (
          // Con medio de pago guardado: plan, código y pagar, sin volver a escribir la tarjeta.
          <div className="flex flex-col gap-4">
            {canAnnual && <PlanIntervalPicker value={planInterval} onChange={setInterval} discountPercent={codeDiscount} surface="plan_confirm" />}
            <CreatorCodeField />
            <p className="text-body-sm text-on-surface">{chargeLine(planInterval, firstCop)}</p>
            <p className="rounded-xl bg-secondary/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-on-background">{framingFor(planInterval)}</p>
            <Button size="lg" block loading={busy === 'subscribe'} onClick={() => void run('subscribe')}>
              Pagar {formatCop(firstCop)} con {sub.paymentMethodLabel ?? 'tu método de pago'}
            </Button>
            <Button variant="ghost" size="md" disabled={busy === 'subscribe'} onClick={() => setDialog('charge')}>Usar otro método de pago</Button>
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
              useToastStore.getState().success(
                dialog === 'trial' && next.status === 'trialing' ? 'Empezó tu prueba Pro'
                  : lite && next.plan === 'pro' ? (next.interval === 'year' ? 'Ya tienes NoutLife Pro Anual' : 'Ya tienes NoutLife Pro')
                    : 'Método de pago vinculado',
              );
              load();
            }}
          />
        )}
      </ResponsiveDialog>
    </motion.div>
  );
}
