// Espera de un cobro de Nequi: mientras la persona aprueba el cobro en su celular, la app se
// queda en esta pantalla. Revisa el estado cada 5 s (lectura sin consultar a Wompi) y se cierra
// sola cuando el cobro se confirma. «Ya lo aprobé» sí le pide a Wompi el estado en ese momento.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/lq';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { localizeBillingMessage } from '@/lib/billing-messages';
import { getLocale, useLocale, type Copy } from '@/lib/i18n';
import { getSubscriptionState, refreshPendingApproval } from '@/services/billing.service';

const POLL_MS = 5_000;

const es = {
  notApproved: 'No se aprobó el cobro en Nequi. Sigues en NoutLife Lite.',
  approved: 'Pago aprobado',
  active: 'Tu NoutLife Pro está activo.',
  notYet: 'Todavía no vemos la aprobación',
  checkNequi: 'Revisa tu app de Nequi y aprueba el cobro.',
  checkError: 'No pudimos revisar tu pago. Inténtalo de nuevo.',
  title: 'Aprueba el pago en tu Nequi',
  body: 'Te hemos enviado una notificación a tu Nequi. Por favor aprueba el pago en tu celular para continuar disfrutando de NoutLife Pro.',
  wait: 'Tienes hasta 45 minutos. Cuando Wompi lo confirme, esta pantalla se cierra sola.',
  done: 'Ya lo aprobé en mi Nequi',
};
const en: typeof es = {
  notApproved: 'The charge wasn’t approved in Nequi. You’re still on NoutLife Lite.',
  approved: 'Payment approved',
  active: 'Your NoutLife Pro is active.',
  notYet: 'We don’t see the approval yet',
  checkNequi: 'Check your Nequi app and approve the charge.',
  checkError: 'We couldn’t check your payment. Please try again.',
  title: 'Approve the payment in Nequi',
  body: 'We sent a notification to your Nequi. Approve the payment on your phone to keep enjoying NoutLife Pro.',
  wait: 'You have up to 45 minutes. Once Wompi confirms it, this screen closes on its own.',
  done: 'I approved it in Nequi',
};
const COPY: Copy<typeof es> = { es, en };

export function PendingApprovalGate() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const locale = useLocale();
  const t = COPY[locale];
  const titleId = useId();
  const descId = useId();
  const status = user?.subscription?.status;
  const pending = status === 'pending_approval';
  const [busy, setBusy] = useState(false);
  const previous = useRef(status);

  // Si el cobro se resolvió con la pantalla abierta, dice qué pasó.
  useEffect(() => {
    const before = previous.current;
    previous.current = status;
    if (before !== 'pending_approval' || !status || status === 'pending_approval') return;
    const toast = useToastStore.getState();
    const now = getLocale();
    if (status === 'lite') {
      toast.error(localizeBillingMessage(useAuthStore.getState().user?.subscription?.lastPaymentError, now) ?? COPY[now].notApproved);
    } else {
      toast.success(COPY[now].approved, COPY[now].active);
    }
  }, [status]);

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => {
      getSubscriptionState().then((subscription) => updateUser({ subscription })).catch(() => null);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [pending, updateUser]);

  useEffect(() => {
    if (!pending) return;
    lockScroll();
    return () => unlockScroll();
  }, [pending]);

  if (!pending) return null;

  async function checkNow() {
    setBusy(true);
    try {
      const subscription = await refreshPendingApproval();
      updateUser({ subscription });
      if (subscription.status === 'pending_approval') {
        useToastStore.getState().info(t.notYet, t.checkNequi);
      }
    } catch {
      useToastStore.getState().error(t.checkError);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      lang={locale}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-5 backdrop-blur-xl"
    >
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[28px] border border-border bg-surface p-6 text-center shadow-xl">
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary/[var(--lq-soft-alpha)]">
          <Smartphone aria-hidden className="size-8 text-secondary-text" strokeWidth={1.75} />
        </span>
        <h2 id={titleId} className="text-heading-md">{t.title}</h2>
        <p id={descId} className="text-body-md text-on-surface">{t.body}</p>
        <p className="text-body-sm text-on-surface-light" aria-live="polite">{t.wait}</p>
        <Button size="lg" block loading={busy} onClick={() => void checkNow()}>{t.done}</Button>
      </div>
    </div>,
    document.body,
  );
}
