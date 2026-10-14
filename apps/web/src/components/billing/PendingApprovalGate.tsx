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
import { getSubscriptionState, refreshPendingApproval } from '@/services/billing.service';

const POLL_MS = 5_000;

export function PendingApprovalGate() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
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
    if (status === 'lite') {
      toast.error(useAuthStore.getState().user?.subscription?.lastPaymentError ?? 'No se aprobó el cobro en Nequi. Sigues en NoutLife Lite.');
    } else {
      toast.success('Pago aprobado', 'Tu NoutLife Pro está activo.');
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
        useToastStore.getState().info('Todavía no vemos la aprobación', 'Revisa tu app de Nequi y aprueba el cobro.');
      }
    } catch {
      useToastStore.getState().error('No pudimos revisar tu pago. Inténtalo de nuevo.');
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-5 backdrop-blur-xl"
    >
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[28px] border border-border bg-surface p-6 text-center shadow-xl">
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary/[var(--lq-soft-alpha)]">
          <Smartphone aria-hidden className="size-8 text-secondary-text" strokeWidth={1.75} />
        </span>
        <h2 id={titleId} className="text-heading-md">Aprueba el pago en tu Nequi</h2>
        <p id={descId} className="text-body-md text-on-surface">
          Te hemos enviado una notificación a tu Nequi. Por favor aprueba el pago en tu celular para continuar disfrutando de NoutLife Pro.
        </p>
        <p className="text-body-sm text-on-surface-light" aria-live="polite">
          Tienes hasta 45 minutos. Cuando Wompi lo confirme, esta pantalla se cierra sola.
        </p>
        <Button size="lg" block loading={busy} onClick={() => void checkNow()}>Ya lo aprobé en mi Nequi</Button>
      </div>
    </div>,
    document.body,
  );
}
