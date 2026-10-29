// Zona Pro vista desde NoutLife Lite: en vez de la página (sus lecturas darían
// 402) se muestra una vitrina con su contenido difuminado, un candado de oro y
// el camino directo al checkout de Pro. Lo guardado en la zona no se toca.
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gem, Lock } from 'lucide-react';
import { Badge, Button, buttonClasses } from '@/components/ui/lq';
import { findNavEntry } from '@/components/layout/nav';
import { TitleText } from '@/components/layout/Lettering';
import { useMotionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PRO_ZONES, TRIAL_DAYS, annualAvailable, type ProZone } from '@/lib/plan';
import { useOffer } from '@/lib/useOffer';
import type { Copy } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';

/** Filas falsas de la vista previa (ancho del título de cada una). */
const GHOST_ROWS = [0.82, 0.6, 0.74];

const es = {
  badge: 'Zona Pro',
  kept: 'Lo que ya guardaste aquí sigue intacto y vuelve a abrirse con NoutLife Pro.',
  trial: `Probar ${TRIAL_DAYS} días gratis`,
  fromPerDay: (perDay: string) => `Desbloquear desde ${perDay} al día`,
  forMonth: (price: string) => `Desbloquear por ${price}/mes`,
  cancel: (trial: boolean) => `${trial ? '$0 hoy. ' : ''}Cancela en cualquier momento con 1 clic.`,
  compare: 'Comparar planes',
};
const en: typeof es = {
  badge: 'Pro zone',
  kept: 'Everything you saved here stays intact and opens again with NoutLife Pro.',
  trial: `Try ${TRIAL_DAYS} days free`,
  fromPerDay: (perDay) => `Unlock from ${perDay} a day`,
  forMonth: (price) => `Unlock for ${price}/month`,
  cancel: (trial) => `${trial ? '$0 today. ' : ''}Cancel anytime in 1 click.`,
  compare: 'Compare plans',
};
const COPY: Copy<typeof es> = { es, en };

export function LockedZone({ zone }: { zone: ProZone }) {
  const { pathname } = useLocation();
  const reduce = useMotionReduced();
  const trial = useAuthStore((s) => Boolean(s.user?.subscription?.trialAvailable));
  // Con el plan anual en la API, el precio más bajo por día es el del anual (el diálogo lo trae elegido).
  const annual = useAuthStore((s) => annualAvailable(s.user?.subscription));
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const offer = useOffer();
  const t = COPY[offer.locale];
  const info = PRO_ZONES[offer.locale][zone];
  const Icon = findNavEntry(pathname)?.icon ?? Lock;

  return (
    <section aria-labelledby="locked-zone-title" lang={offer.locale} className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-6 pb-6 pt-2 text-center md:gap-8 md:py-12">
      <div className="relative w-full max-w-[420px]">
        {/* Así se ve la zona por dentro: presente, pero fuera de alcance. */}
        <div aria-hidden className="pointer-events-none flex select-none flex-col gap-3 opacity-80 blur-[5px]">
          {GHOST_ROWS.map((width, i) => (
            <div key={width} className={cn('items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm', i === 2 ? 'hidden sm:flex' : 'flex')}>
              <span className="size-10 shrink-0 rounded-xl bg-primary/20" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-3 rounded-full bg-on-surface-light/25" style={{ width: `${width * 100}%` }} />
                <span className="h-2.5 w-2/5 rounded-full bg-on-surface-light/15" />
              </span>
              <span className="h-6 w-14 rounded-full bg-secondary/30" />
            </div>
          ))}
        </div>

        <div aria-hidden className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={reduce ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, y: [0, -5, 0] }}
            transition={reduce
              ? { duration: 0 }
              : { scale: { type: 'spring', stiffness: 320, damping: 18 }, opacity: { duration: 0.3 }, y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 } }}
            className="relative flex size-20 items-center justify-center rounded-full border border-secondary/50 bg-background/85 shadow-xl backdrop-blur-xl sm:size-24"
          >
            <Icon className="size-9 text-secondary-text sm:size-10" strokeWidth={1.5} />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-9 items-center justify-center rounded-full bg-background text-secondary-text shadow-md ring-1 ring-secondary/60">
              <Lock className="size-4" strokeWidth={2.25} />
            </span>
          </motion.span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Badge variant="secondary" icon={Gem}>{t.badge}</Badge>
        <h1 id="locked-zone-title" className="text-display-sm"><TitleText>{info.label}</TitleText></h1>
        <p className="max-w-[40ch] text-body-lg text-on-surface-light">{info.pitch}</p>
        <p className="max-w-[44ch] text-body-sm text-on-surface-light">{t.kept}</p>
      </div>

      <div className="flex w-full max-w-[360px] flex-col gap-2">
        <Button size="lg" block onClick={() => openUpgrade(zone)}>
          {trial
            ? t.trial
            : annual ? t.fromPerDay(offer.perDay(offer.perDayFor('year'))) : t.forMonth(offer.money(offer.listFor('month')))}
        </Button>
        <p className="text-body-sm text-on-surface-light">{t.cancel(trial)}</p>
        <Link to="/plan" className={buttonClasses('ghost', 'md', true)}>{t.compare}</Link>
      </div>
    </section>
  );
}
