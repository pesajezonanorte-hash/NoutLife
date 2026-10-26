// «Pro · día 2 de 7» o «Pro · Regalo (día 2 de 7)»: indicador discreto de la prueba en la barra
// superior. Lleva a Plan.
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { daysUntil } from '@/lib/plan';
import { giftProgress } from '@/lib/gift';
import { useLocale } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';

/** Día de la prueba (1…N) o null si la cuenta no está en prueba. `gift`: es un regalo sin cobro. */
export function useTrialDay(): { day: number; of: number; gift: boolean } | null {
  const sub = useAuthStore((s) => s.user?.subscription);
  const gift = giftProgress(sub);
  if (gift) return { ...gift, gift: true };
  if (!sub || sub.status !== 'trialing' || sub.complimentary) return null;
  const of = sub.trialDays;
  return { day: Math.min(of, Math.max(1, of - daysUntil(sub.trialEndsAt) + 1)), of, gift: false };
}

export function TrialPill({ className }: { className?: string }) {
  const trial = useTrialDay();
  const en = useLocale() === 'en';
  if (!trial) return null;
  const full = en
    ? (trial.gift ? `Pro · Gift (day ${trial.day} of ${trial.of})` : `Pro · day ${trial.day} of ${trial.of}`)
    : (trial.gift ? `Pro · Regalo (día ${trial.day} de ${trial.of})` : `Pro · día ${trial.day} de ${trial.of}`);
  // En el móvil la cabecera tiene poco sitio: el regalo se abrevia a «Pro · Regalo 1/7».
  const short = `Pro · ${en ? 'Gift' : 'Regalo'} ${trial.day}/${trial.of}`;
  return (
    <Link to="/plan" aria-label={`${full}. ${en ? 'View your plan' : 'Ver tu plan'}`} lang={en ? 'en' : 'es'}
      className={cn('inline-flex min-h-11 min-w-0 items-center rounded-full', className)}>
      <span className="truncate rounded-full border border-secondary/50 bg-secondary/[var(--lq-soft-alpha)] px-2.5 py-1 text-label-sm tabular-nums text-secondary-text">
        {trial.gift ? (
          <>
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{full}</span>
          </>
        ) : full}
      </span>
    </Link>
  );
}
