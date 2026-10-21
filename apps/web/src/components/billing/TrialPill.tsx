// «Pro · día 2 de 7»: indicador discreto de la prueba en la barra superior. Lleva a Plan.
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { daysUntil } from '@/lib/plan';
import { useAuthStore } from '@/store/authStore';

/** Día de la prueba (1…N) o null si la cuenta no está en prueba. */
export function useTrialDay(): { day: number; of: number } | null {
  const sub = useAuthStore((s) => s.user?.subscription);
  if (!sub || sub.status !== 'trialing' || sub.complimentary) return null;
  const of = sub.trialDays;
  return { day: Math.min(of, Math.max(1, of - daysUntil(sub.trialEndsAt) + 1)), of };
}

export function TrialPill({ className }: { className?: string }) {
  const trial = useTrialDay();
  if (!trial) return null;
  return (
    <Link to="/plan" aria-label={`NoutLife Pro, día ${trial.day} de ${trial.of} de tu prueba. Ver tu plan`}
      className={cn('inline-flex min-h-11 shrink-0 items-center rounded-full', className)}>
      <span className="rounded-full border border-secondary/50 bg-secondary/[var(--lq-soft-alpha)] px-2.5 py-1 text-label-sm tabular-nums text-secondary-text">
        Pro · día {trial.day} de {trial.of}
      </span>
    </Link>
  );
}
