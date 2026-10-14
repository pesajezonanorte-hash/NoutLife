// Planes: Pro y Lite lado a lado. Se usa en la portada pública (debajo del
// inicio de sesión) y en /plan. Anclaje: Pro va primero, grande y completo;
// Lite después, con sus límites a la vista. Pro lleva el oro champán del
// sistema de diseño (reservado a lo premium); Lite, el jade neutro. El único
// momento animado es la cinta de la prueba.
import { useId, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import type { Subscription } from '@noutlife/shared';
import { AccordionItem, Badge, Button, Card } from '@/components/ui/lq';
import { cn } from '@/lib/utils';
import { useMotionReduced } from '@/lib/motion';
import { LITE_LIMITS, PLAN_ROWS, PRO_FRAMING, PRO_PRICE_COP, PRO_ZONE_COUNT, TRIAL_DAYS, formatCop } from '@/lib/plan';
import { TrialRibbon } from './TrialRibbon';

const PRICE = formatCop(PRO_PRICE_COP);

export const PRICING_HOOK = `${TRIAL_DAYS} días de Pro gratis. $0 hoy.`;

const LITE_POINTS = [
  'Inicio, misiones, logros, agenda y social',
  `Hasta ${LITE_LIMITS.activeHabits} hábitos y ${LITE_LIMITS.activeRoutines} rutinas activos`,
  `Historial de los últimos ${LITE_LIMITS.historyDays} días`,
  'Zonas Pro con candado y sin IA',
];

const PRO_POINTS = [
  `Las ${PRO_ZONE_COUNT} zonas: Finanzas, Coliseo, Comida, Sueño, Diario y más`,
  'El Sabio con IA y análisis de hábitos, finanzas y entrenos',
  'Hábitos y rutinas ilimitados',
  'Historial y analíticas completas',
  `Tarifa congelada: ${PRICE}/mes mientras sigas en Pro`,
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: '¿Me cobran algo al empezar la prueba?',
    a: `No: $0 hoy. Para empezar la prueba vinculas una tarjeta o tu Nequi con Wompi desde el primer día, y durante ${TRIAL_DAYS} días no se cobra nada. El día ${TRIAL_DAYS + 1} se cobran ${PRICE} y después cada mes, el mismo día. La prueba es una por persona y por medio de pago.`,
  },
  {
    q: '¿Cómo cancelo?',
    a: 'En Plan, con el botón Cancelar suscripción. Es un clic, sin llamadas ni formularios. Conservas Pro hasta el final del periodo que ya tienes y no se vuelve a cobrar.',
  },
  {
    q: '¿Qué pasa si cancelo o falla el cobro?',
    a: `Tu cuenta pasa a NoutLife Lite y sigue funcionando. No se borra nada: si tenías más de ${LITE_LIMITS.activeHabits} hábitos se conservan todos, y las zonas Pro y tu historial completo vuelven a abrirse cuando activas Pro.`,
  },
  {
    q: '¿Mi método de pago está seguro?',
    a: 'Los datos viajan cifrados directo a Wompi, la pasarela de pagos. NoutLife nunca recibe ni guarda el número de tu tarjeta. Con Nequi guardamos tu celular para cobrar y una huella cifrada de tu cédula para evitar pruebas repetidas.',
  },
];

function Mark({ value }: { value: string | boolean }) {
  if (value === true) return <><Check aria-hidden className="mx-auto size-5 text-success-text" strokeWidth={2} /><span className="sr-only">Incluido</span></>;
  if (value === false) return <><Minus aria-hidden className="mx-auto size-5 text-on-surface-light" strokeWidth={1.75} /><span className="sr-only">No incluido</span></>;
  return <span>{value}</span>;
}

function Points({ items, tone }: { items: string[]; tone: 'lite' | 'pro' }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((text) => (
        <li key={text} className="flex items-start gap-2.5 text-body-md">
          <Check aria-hidden strokeWidth={2.25} className={cn('mt-0.5 size-4 shrink-0', tone === 'pro' ? 'text-secondary-text' : 'text-primary-text')} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

export interface PricingSectionProps {
  /** public: portada sin sesión · app: dentro de /plan. */
  mode: 'public' | 'app';
  subscription?: Subscription | null;
  title?: ReactNode;
  description?: ReactNode;
  /** Muestra la cinta de los 7 días (solo tiene sentido si la prueba aún está por empezar). */
  showRibbon?: boolean;
  /** Botón de Pro. Sin él, la tarjeta solo informa. */
  proAction?: { label: string; onClick: () => void; loading?: boolean; note?: string };
  id?: string;
  className?: string;
}

export function PricingSection({ mode, subscription, title, description, showRibbon = mode === 'public', proAction, id = 'planes', className }: PricingSectionProps) {
  const headingId = useId();
  const reduce = useMotionReduced();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const current = mode === 'app' ? subscription?.plan : undefined;

  return (
    <motion.section
      id={id}
      aria-labelledby={headingId}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex scroll-mt-24 flex-col gap-8 md:gap-10', className)}
    >
      <div className="flex max-w-[640px] flex-col gap-3">
        <h2 id={headingId} className="text-display-sm [text-wrap:balance] md:text-display-md">{title ?? PRICING_HOOK}</h2>
        <p className="text-body-lg text-on-surface-light">
          {description ?? `Luego ${PRICE} COP/mes. Cancela en cualquier momento con 1 clic. Si cancelas o un cobro falla, tu cuenta sigue en NoutLife Lite y no pierdes nada.`}
        </p>
      </div>

      {showRibbon && (
        <TrialRibbon
          className="max-w-[560px]"
          chargeLabel={`Día ${TRIAL_DAYS + 1}: ${PRICE}/mes`}
          summary={`Los primeros ${TRIAL_DAYS} días son gratis. El día ${TRIAL_DAYS + 1} empieza el cobro de ${PRICE} COP al mes.`}
        />
      )}

      <div className="grid items-stretch gap-4 lg:grid-cols-[7fr_5fr] lg:gap-6">
        <Card
          padding="lg"
          variant="elevated"
          className={cn(
            'relative flex flex-col gap-6 border-secondary/60 bg-surface',
            'transition-[transform,box-shadow] duration-300 ease-expo hover:-translate-y-0.5 hover:shadow-lg [.reduce-motion_&]:hover:translate-y-0',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-heading-md">NoutLife Pro</h3>
              <p className="text-body-sm text-on-surface-light">Todo NoutLife, sin topes.</p>
            </div>
            {current === 'pro'
              ? <Badge variant="secondary">Tu plan</Badge>
              : (mode === 'public' || subscription?.trialAvailable) && <Badge variant="secondary">{TRIAL_DAYS} días gratis</Badge>}
          </div>
          <div className="flex flex-col gap-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-display-md tabular-nums tracking-tight md:text-display-lg">{PRICE}</span>
              <span className="text-body-lg text-on-surface-light">COP/mes</span>
            </p>
            <p className="text-body-sm text-on-background">{PRO_FRAMING}</p>
          </div>
          <Points items={PRO_POINTS} tone="pro" />
          {proAction && (
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button size="lg" block loading={proAction.loading} onClick={proAction.onClick}>{proAction.label}</Button>
              {proAction.note && <p className="text-center text-body-sm text-on-surface-light">{proAction.note}</p>}
            </div>
          )}
        </Card>

        <Card padding="lg" className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-heading-md">NoutLife Lite</h3>
              <p className="text-body-sm text-on-surface-light">Lo esencial, gratis para siempre.</p>
            </div>
            {current === 'lite' && <Badge variant="neutral">Tu plan</Badge>}
          </div>
          <p className="flex items-baseline gap-2">
            <span className="text-display-sm tabular-nums">$0</span>
            <span className="text-body-md text-on-surface-light">siempre</span>
          </p>
          <Points items={LITE_POINTS} tone="lite" />
          <p className="mt-auto border-t border-border pt-4 text-body-sm text-on-surface-light">Nunca se cobra. Es donde queda tu cuenta si no continúas con Pro, con todo lo que ya guardaste.</p>
        </Card>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-body-sm md:text-body-md">
          <caption className="sr-only">Comparación entre NoutLife Pro y NoutLife Lite</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-3 font-semibold md:px-6">Qué incluye</th>
              <th scope="col" className="w-[28%] bg-secondary/[var(--lq-soft-alpha)] px-2 py-3 text-center font-semibold text-secondary-text md:px-4">Pro</th>
              <th scope="col" className="w-[26%] px-2 py-3 text-center font-semibold md:px-4">Lite</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-3 py-3 font-normal text-on-background md:px-6">{row.label}</th>
                <td className="bg-secondary/[var(--lq-soft-alpha)] px-2 py-3 text-center font-semibold text-on-background md:px-4"><Mark value={row.pro} /></td>
                <td className="px-2 py-3 text-center text-on-surface-light md:px-4"><Mark value={row.lite} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-heading-md">Preguntas sobre el plan</h3>
        <div className="flex flex-col gap-3">
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} title={item.q} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)}>
              <p className="max-w-prose px-4 pb-4 text-body-md text-on-surface md:px-5">{item.a}</p>
            </AccordionItem>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
