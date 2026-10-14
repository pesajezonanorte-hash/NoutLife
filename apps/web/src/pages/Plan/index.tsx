// Plan: estado de la suscripción (prueba, mes pagado, cancelada o Lite), el
// método de pago, los cobros y la comparación de planes. Cancelar es un clic.
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Receipt } from 'lucide-react';
import type { Subscription, SubscriptionStatus } from '@noutlife/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, ErrorState, PageLoader, ResponsiveDialog, type BadgeVariant } from '@/components/ui/lq';
import { PaymentMethodForm } from '@/components/billing/PaymentMethodForm';
import { PricingSection } from '@/components/billing/PricingSection';
import { TrialRibbon } from '@/components/billing/TrialRibbon';
import { item, stagger } from '@/lib/motion';
import { PRO_PRICE_COP, TRIAL_DAYS, daysUntil, formatCop, longDay } from '@/lib/plan';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import {
  cancelSubscription, getBillingStatus, resumeSubscription, subscribe, type BillingPayment,
} from '@/services/billing.service';

const PRICE = formatCop(PRO_PRICE_COP);

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

/** Qué pasa después, en una frase. */
function nextStep(sub: Subscription): string {
  if (sub.pendingPayment) {
    return sub.paymentMethodType === 'NEQUI'
      ? 'Revisa tu app de Nequi: si te pide aprobar el cobro, apruébalo. Puede tardar unos minutos.'
      : 'Estamos confirmando tu pago con Wompi. Puede tardar unos minutos.';
  }
  if (sub.complimentary) return 'Tu Pro es de cortesía: sigue activo, sin cobros ni fecha de vencimiento.';
  const date = longDay(sub.accessEndsAt);
  switch (sub.status) {
    case 'trialing':
      return sub.hasPaymentMethod
        ? `El ${date} se cobran ${PRICE} y empieza tu primer mes Pro.`
        : `El ${date} tu cuenta pasa a NoutLife Lite. Vincula un método de pago para seguir en Pro.`;
    case 'active':
      return `Se renueva el ${date} por ${PRICE}.`;
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

export default function PlanPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(user?.subscription ? 'ready' : 'loading');
  const [busy, setBusy] = useState<'cancel' | 'resume' | 'subscribe' | null>(null);
  const [card, setCard] = useState<'trial' | 'save' | 'charge' | null>(null);
  const sub = user?.subscription ?? null;

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

  async function run(action: 'cancel' | 'resume' | 'subscribe') {
    const toast = useToastStore.getState();
    setBusy(action);
    try {
      const next = action === 'cancel' ? await cancelSubscription() : action === 'resume' ? await resumeSubscription() : await subscribe();
      updateUser({ subscription: next });
      if (action === 'cancel') toast.success('Suscripción cancelada', `Tienes Pro hasta el ${longDay(next.accessEndsAt)}. No habrá más cobros.`);
      if (action === 'resume') toast.success('Suscripción reanudada');
      if (action === 'subscribe') {
        if (next.plan === 'pro') toast.success('Ya tienes NoutLife Pro');
        else if (!next.pendingPayment) toast.error(next.lastPaymentError ?? 'No se pudo completar el cobro');
      }
      load();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? 'No pudimos actualizar tu plan. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  function activatePro() {
    if (sub?.trialAvailable) setCard('trial');
    else if (sub?.hasPaymentMethod) void run('subscribe');
    else setCard('charge');
  }

  if (state === 'loading') return <PageLoader label="Cargando tu plan" />;
  if (state === 'error' || !sub) return <ErrorState onRetry={() => { setState('loading'); load(); }} />;

  const lite = sub.status === 'lite';
  const proLabel = sub.trialAvailable ? `Empezar mis ${TRIAL_DAYS} días gratis` : `Activar Pro por ${PRICE}/mes`;
  const trialLeft = daysUntil(sub.trialEndsAt);
  const status = sub.complimentary ? { label: 'De cortesía', badge: 'secondary' as const } : STATUS[sub.status];

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
              <h2 className="text-heading-lg">{lite ? 'NoutLife Lite' : 'NoutLife Pro'}</h2>
              <p className="max-w-[560px] text-body-md text-on-surface" aria-live="polite">{nextStep(sub)}</p>
            </div>
            <Badge variant={status.badge} size="lg">{status.label}</Badge>
          </div>

          {sub.status === 'trialing' && (
            <TrialRibbon
              className="max-w-[560px]"
              elapsed={TRIAL_DAYS - trialLeft}
              chargeLabel={sub.hasPaymentMethod ? `${longDay(sub.trialEndsAt)}: ${PRICE}` : `${longDay(sub.trialEndsAt)}: pasa a Lite`}
              summary={`Te ${trialLeft === 1 ? 'queda 1 día' : `quedan ${trialLeft} días`} de prueba. La prueba termina el ${longDay(sub.trialEndsAt)}.`}
            />
          )}

          {/* La cortesía no cobra: no hay método de pago que mostrar ni que cambiar. */}
          {!sub.complimentary && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <CreditCard aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              <span className="min-w-0 flex-[1_1_200px] text-body-md">
                {sub.paymentMethodLabel ?? 'Sin método de pago'}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setCard(sub.trialAvailable ? 'trial' : 'save')}>
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
                    <span className="block text-body-sm text-on-surface-light">Del {longDay(p.periodStart)} al {longDay(p.periodEnd)}</span>
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
          title={sub.trialAvailable ? `${TRIAL_DAYS} días de Pro gratis. $0 hoy.` : lite ? `Vuelve a Pro por ${PRICE} COP/mes.` : 'Pro y Lite, lado a lado.'}
          description={sub.trialAvailable
            ? `Luego ${PRICE} COP/mes. Cancela en cualquier momento con 1 clic.`
            : lite
              ? 'Se cobra hoy y después cada mes. Cancela en cualquier momento con 1 clic.'
              : 'Si cancelas o un cobro falla, tu cuenta pasa a Lite y no pierdes nada.'}
          showRibbon={sub.trialAvailable}
          proAction={lite ? { label: proLabel, onClick: activatePro, loading: busy === 'subscribe' } : undefined}
        />
      </motion.div>

      <ResponsiveDialog
        open={card !== null}
        onClose={() => setCard(null)}
        title={card === 'trial' ? `${TRIAL_DAYS} días de Pro gratis` : card === 'charge' ? 'Activa NoutLife Pro' : 'Tu método de pago'}
        className="bg-background/80 backdrop-blur-2xl backdrop-saturate-150"
      >
        {card && (
          <PaymentMethodForm
            intent={card}
            chargeDate={lite ? null : sub.accessEndsAt}
            onCancel={() => setCard(null)}
            onDone={(next) => {
              setCard(null);
              useToastStore.getState().success(
                card === 'trial' && next.status === 'trialing' ? 'Empezó tu prueba Pro'
                  : lite && next.plan === 'pro' ? 'Ya tienes NoutLife Pro'
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
