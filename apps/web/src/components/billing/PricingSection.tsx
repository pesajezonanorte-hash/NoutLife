// Planes: Pro y Lite lado a lado. Se usa en la portada pública (debajo del
// inicio de sesión) y en /plan. Anclaje: Pro va primero, grande y completo, con
// el anual elegido por defecto como mejor valor; Lite después, con sus límites a
// la vista. Pro lleva el oro champán del sistema de diseño (reservado a lo
// premium); Lite, el jade neutro. El único momento animado es la cinta de la prueba.
// Precios e idioma salen de la oferta de quien mira (lib/offer): pesos en Colombia, dólares fuera.
import { useId, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import type { BillingInterval, Subscription } from '@noutlife/shared';
import { AccordionItem, Badge, Button, Card } from '@/components/ui/lq';
import { cn } from '@/lib/utils';
import { useMotionReduced } from '@/lib/motion';
import type { Copy } from '@/lib/i18n';
import type { Offer } from '@/lib/offer';
import { useOffer } from '@/lib/useOffer';
import { LITE_LIMITS, PRO_ZONE_COUNT, TRIAL_DAYS, annualAvailable } from '@/lib/plan';
import { TrialRibbon } from './TrialRibbon';
import { PlanIntervalPicker } from './PlanIntervalPicker';

type Faq = Array<{ q: string; a: string }>;

const es = {
  hook: `${TRIAL_DAYS} días de Pro incluidos, sin tarjeta.`,
  litePoints: [
    'Inicio, misiones, logros, agenda y social',
    `Hasta ${LITE_LIMITS.activeHabits} hábitos y ${LITE_LIMITS.activeRoutines} rutinas activos`,
    `Historial de los últimos ${LITE_LIMITS.historyDays} días`,
    'Zonas Pro con candado y sin IA',
  ],
  proPoints: [
    `Las ${PRO_ZONE_COUNT} zonas: Finanzas, Coliseo, Comida, Sueño, Diario y más`,
    'El Sabio con IA y análisis de hábitos, finanzas y entrenos',
    'Hábitos y rutinas ilimitados',
    'Historial y analíticas completas',
    'Tarifa congelada mientras sigas en Pro',
  ],
  description: (o: Offer, annual: boolean) => (annual
    ? `Luego ${o.moneyCode(o.listFor('month'))}/mes, o ${o.money(o.listFor('year'))} al año con ${o.freeMonths}. Cancela en cualquier momento con 1 clic. Si cancelas o un cobro falla, tu cuenta sigue en NoutLife Lite y no pierdes nada.`
    : `Luego ${o.moneyCode(o.listFor('month'))}/mes. Cancela en cualquier momento con 1 clic. Si cancelas o un cobro falla, tu cuenta sigue en NoutLife Lite y no pierdes nada.`),
  ribbonCharge: (o: Offer, interval: BillingInterval) => `Día ${TRIAL_DAYS + 1}: ${o.money(o.listFor(interval))}/${o.unit(interval)}`,
  ribbonSummary: (o: Offer, interval: BillingInterval) =>
    `Los primeros ${TRIAL_DAYS} días son gratis. El día ${TRIAL_DAYS + 1} empieza el cobro de ${o.moneyCode(o.listFor(interval))} ${interval === 'year' ? 'por el año' : 'al mes'}.`,
  proTagline: 'Todo NoutLife, sin topes.',
  yourPlan: (annual: boolean): string => (annual ? 'Tu plan · Anual' : 'Tu plan'),
  trialBadge: `${TRIAL_DAYS} días gratis`,
  liteTagline: 'Lo esencial, gratis para siempre.',
  forever: 'siempre',
  liteFoot: 'Nunca se cobra. Es donde queda tu cuenta si no continúas con Pro, con todo lo que ya guardaste.',
  included: 'Incluido',
  notIncluded: 'No incluido',
  caption: 'Comparación entre NoutLife Pro y NoutLife Lite',
  whatsIncluded: 'Qué incluye',
  faqTitle: 'Preguntas sobre el plan',
  faq: (o: Offer, annual: boolean): Faq => {
    const co = o.list.currency === 'COP';
    const month = o.money(o.listFor('month'));
    const price = annual ? `${month} al mes o ${o.money(o.listFor('year'))} al año, según el plan que elijas` : `${month} al mes`;
    return [
      {
        q: '¿Necesito tarjeta para empezar?',
        a: `No. Toda cuenta nueva tiene ${TRIAL_DAYS} días de Pro completo, sin tarjeta. El día ${TRIAL_DAYS + 1} pasa sola a NoutLife Lite, gratis para siempre, sin perder nada. Si quieres seguir en Pro, vinculas ${co ? 'tu tarjeta o tu Nequi' : 'tu tarjeta'} y se cobran ${price}. La prueba es una por persona.`,
      },
      ...(annual ? [{
        q: '¿Qué incluye el plan anual?',
        a: `Todo NoutLife Pro, pagado una vez al año: ${o.moneyCode(o.listFor('year'))} por 12 meses, unos ${o.perDay(o.perDayFor('year'))} al día. Frente a pagar mes a mes ahorras ${o.money(o.savings)} (${o.savingsPercent} %), ${o.freeMonths}. Si cancelas, no se renueva y conservas Pro hasta el final de tu año.`,
      }, {
        q: '¿Qué es un código de creador?',
        a: 'Si llegaste a NoutLife por un creador, escribe su código al pagar. Apoyas a quien te lo recomendó y, si el código trae descuento, se aplica a tu primer pago, mensual o anual. Se usa una vez, antes de tu primer pago.',
      }] : []),
      ...(co ? [] : [{
        q: '¿Por qué se cobra en pesos colombianos?',
        a: 'NoutLife cobra a través de Wompi, una pasarela de pagos de Colombia. Tu precio está en dólares; en cada cobro lo convertimos a pesos colombianos con la TRM oficial de ese día, y tu banco lo vuelve a pasar a tu moneda. El valor de tu extracto puede variar unos centavos, y algunos bancos cobran una comisión por compras internacionales.',
      }]),
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
        a: co
          ? 'Los datos viajan cifrados directo a Wompi, la pasarela de pagos. NoutLife nunca recibe ni guarda el número de tu tarjeta. Con Nequi guardamos tu celular para cobrar y una huella cifrada de tu cédula para evitar pruebas repetidas.'
          : 'Los datos viajan cifrados directo a Wompi, la pasarela de pagos. NoutLife nunca recibe ni guarda el número de tu tarjeta.',
      },
    ];
  },
};

const en: typeof es = {
  hook: `${TRIAL_DAYS} days of Pro included, no card required.`,
  litePoints: [
    'Home, goals, achievements, agenda and social',
    `Up to ${LITE_LIMITS.activeHabits} active habits and ${LITE_LIMITS.activeRoutines} routines`,
    `History for the last ${LITE_LIMITS.historyDays} days`,
    'Pro zones locked, no AI',
  ],
  proPoints: [
    `All ${PRO_ZONE_COUNT} zones: Finances, Coliseum, Food, Sleep, Journal and more`,
    'The Sage, with AI insights on your habits, finances and workouts',
    'Unlimited habits and routines',
    'Full history and insights',
    'Price locked while you stay on Pro',
  ],
  description: (o, annual) => (annual
    ? `Then ${o.moneyCode(o.listFor('month'))}/month, or ${o.money(o.listFor('year'))}/year with ${o.freeMonths}. Cancel anytime in 1 click. If you cancel or a charge fails, your account stays on NoutLife Lite and you lose nothing.`
    : `Then ${o.moneyCode(o.listFor('month'))}/month. Cancel anytime in 1 click. If you cancel or a charge fails, your account stays on NoutLife Lite and you lose nothing.`),
  ribbonCharge: (o, interval) => `Day ${TRIAL_DAYS + 1}: ${o.money(o.listFor(interval))}/${o.unit(interval)}`,
  ribbonSummary: (o, interval) =>
    `The first ${TRIAL_DAYS} days are free. On day ${TRIAL_DAYS + 1}, the ${o.moneyCode(o.listFor(interval))} ${interval === 'year' ? 'annual' : 'monthly'} charge begins.`,
  proTagline: 'All of NoutLife, no limits.',
  yourPlan: (annual) => (annual ? 'Your plan · Annual' : 'Your plan'),
  trialBadge: `${TRIAL_DAYS} days free`,
  liteTagline: 'The essentials, free forever.',
  forever: 'forever',
  liteFoot: 'Never charged. It’s where your account stays if you don’t continue with Pro, with everything you’ve saved.',
  included: 'Included',
  notIncluded: 'Not included',
  caption: 'Comparison of NoutLife Pro and NoutLife Lite',
  whatsIncluded: 'What’s included',
  faqTitle: 'Plan questions',
  faq: (o, annual) => {
    const co = o.list.currency === 'COP';
    const month = o.money(o.listFor('month'));
    const price = annual ? `${month} a month or ${o.money(o.listFor('year'))} a year, depending on the plan you choose` : `${month} a month`;
    return [
      {
        q: 'Do I need a card to start?',
        a: `No. Every new account gets ${TRIAL_DAYS} days of full Pro, no card required. On day ${TRIAL_DAYS + 1} it moves to NoutLife Lite on its own, free forever, and you keep everything. To stay on Pro, add ${co ? 'your card or Nequi' : 'your card'} and you’ll be charged ${price}. One trial per person.`,
      },
      ...(annual ? [{
        q: 'What’s included in the annual plan?',
        a: `All of NoutLife Pro, paid once a year: ${o.moneyCode(o.listFor('year'))} for 12 months, about ${o.perDay(o.perDayFor('year'))} a day. Compared with paying monthly you save ${o.money(o.savings)} (${o.savingsPercent}%), ${o.freeMonths}. If you cancel, it won’t renew and you keep Pro until the end of your year.`,
      }, {
        q: 'What’s a creator code?',
        a: 'If a creator brought you to NoutLife, enter their code at checkout. You support the person who recommended it and, if the code includes a discount, it applies to your first payment, monthly or annual. It can be used once, before your first payment.',
      }] : []),
      ...(co ? [] : [{
        q: 'Why is my card charged in Colombian pesos?',
        a: 'NoutLife bills through Wompi, a payment processor in Colombia. Your price is set in US dollars; on each charge we convert it to Colombian pesos at that day’s official exchange rate, and your bank converts it back to dollars. Your statement may differ by a few cents, and some banks add a foreign transaction fee.',
      }]),
      {
        q: 'How do I cancel?',
        a: 'In Plan, with the Cancel subscription button. One click, no calls or forms. You keep Pro until the end of the period you’ve already paid for, and you won’t be charged again.',
      },
      {
        q: 'What happens if I cancel or a charge fails?',
        a: `Your account moves to NoutLife Lite and keeps working. Nothing is deleted: if you had more than ${LITE_LIMITS.activeHabits} habits you keep them all, and Pro zones and your full history open again when you activate Pro.`,
      },
      {
        q: 'Is my payment method secure?',
        a: co
          ? 'Your details travel encrypted straight to Wompi, our payment processor. NoutLife never receives or stores your card number. With Nequi we store your phone number to charge it and an encrypted fingerprint of your ID to prevent repeated trials.'
          : 'Your details travel encrypted straight to Wompi, our payment processor. NoutLife never receives or stores your card number.',
      },
    ];
  },
};

const COPY: Copy<typeof es> = { es, en };

function Mark({ value, t }: { value: string | boolean; t: typeof es }) {
  if (value === true) return <><Check aria-hidden className="mx-auto size-5 text-success-text" strokeWidth={2} /><span className="sr-only">{t.included}</span></>;
  if (value === false) return <><Minus aria-hidden className="mx-auto size-5 text-on-surface-light" strokeWidth={1.75} /><span className="sr-only">{t.notIncluded}</span></>;
  return <span>{value}</span>;
}

function Points({ items, tone }: { items: readonly string[]; tone: 'lite' | 'pro' }) {
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
  /** Plan elegido (controlado desde /plan). Sin él, la sección guarda el suyo, anual por defecto. */
  interval?: BillingInterval;
  onIntervalChange?: (interval: BillingInterval) => void;
  /** Descuento del código de creador aplicado: el selector muestra el precio del primer pago. */
  discountPercent?: number;
  id?: string;
  className?: string;
}

export function PricingSection({
  mode, subscription, title, description, showRibbon = mode === 'public', proAction, interval: controlled, onIntervalChange, discountPercent = 0, id = 'planes', className,
}: PricingSectionProps) {
  const headingId = useId();
  const reduce = useMotionReduced();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [own, setOwn] = useState<BillingInterval>('year');
  // Idioma de la app (o el fijado por la portada) y lista de la cuenta o, sin sesión, la de este dispositivo.
  const offer = useOffer();
  const t = COPY[offer.locale];
  const current = mode === 'app' ? subscription?.plan : undefined;
  // En la app el anual se ofrece solo si la API ya lo cobra; la portada solo informa.
  const annual = mode === 'public' || annualAvailable(subscription);
  const interval: BillingInterval = annual ? controlled ?? own : 'month';
  const setInterval = (next: BillingInterval) => { setOwn(next); onIntervalChange?.(next); };
  const faq = t.faq(offer, annual);

  return (
    <motion.section
      id={id}
      aria-labelledby={headingId}
      lang={offer.locale}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex scroll-mt-24 flex-col gap-8 md:gap-10', className)}
    >
      <div className="flex max-w-[640px] flex-col gap-3">
        <h2 id={headingId} className="text-display-sm [text-wrap:balance] md:text-display-md">{title ?? t.hook}</h2>
        <p className="text-body-lg text-on-surface-light">{description ?? t.description(offer, annual)}</p>
      </div>

      {showRibbon && (
        <TrialRibbon className="max-w-[560px]" chargeLabel={t.ribbonCharge(offer, interval)} summary={t.ribbonSummary(offer, interval)} />
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
              <p className="text-body-sm text-on-surface-light">{t.proTagline}</p>
            </div>
            {current === 'pro'
              ? <Badge variant="secondary">{t.yourPlan(subscription?.interval === 'year')}</Badge>
              : (mode === 'public' || subscription?.trialAvailable) && <Badge variant="secondary">{t.trialBadge}</Badge>}
          </div>
          {annual ? (
            <div className="flex flex-col gap-3">
              <PlanIntervalPicker value={interval} onChange={setInterval} discountPercent={discountPercent} surface={mode === 'public' ? 'landing' : 'plan'} className="pt-1" />
              <p className="text-body-sm text-on-background">{offer.framing(interval)}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-display-md tabular-nums tracking-tight md:text-display-lg">{offer.money(offer.listFor('month'))}</span>
                <span className="text-body-lg text-on-surface-light">{offer.list.currency === 'COP' ? 'COP' : ''}/{offer.unit('month')}</span>
              </p>
              <p className="text-body-sm text-on-background">{offer.framing('month')}</p>
            </div>
          )}
          <Points items={t.proPoints} tone="pro" />
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
              <p className="text-body-sm text-on-surface-light">{t.liteTagline}</p>
            </div>
            {current === 'lite' && <Badge variant="neutral">{t.yourPlan(false)}</Badge>}
          </div>
          <p className="flex items-baseline gap-2">
            <span className="text-display-sm tabular-nums">$0</span>
            <span className="text-body-md text-on-surface-light">{t.forever}</span>
          </p>
          <Points items={t.litePoints} tone="lite" />
          <p className="mt-auto border-t border-border pt-4 text-body-sm text-on-surface-light">{t.liteFoot}</p>
        </Card>
      </div>

      {/* Por qué un año: el compromiso con tu propio sistema, en un solo espacio. Solo con el anual elegido. */}
      {annual && interval === 'year' && (
        <div className="flex flex-col gap-4 rounded-2xl border border-secondary/40 bg-secondary/[var(--lq-soft-alpha)] p-5 md:p-6">
          <div className="flex max-w-[640px] flex-col gap-1.5">
            <h3 className="text-heading-md">{offer.annualPitch.title}</h3>
            <p className="text-body-md text-on-surface">{offer.annualPitch.body}</p>
          </div>
          <div className="grid gap-x-6 gap-y-2.5 md:grid-cols-2">
            <Points items={offer.annualPitch.points.slice(0, 2)} tone="pro" />
            <Points items={offer.annualPitch.points.slice(2)} tone="pro" />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full border-collapse text-left text-body-sm md:text-body-md">
          <caption className="sr-only">{t.caption}</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-3 font-semibold md:px-6">{t.whatsIncluded}</th>
              <th scope="col" className="w-[28%] bg-secondary/[var(--lq-soft-alpha)] px-2 py-3 text-center font-semibold text-secondary-text md:px-4">Pro</th>
              <th scope="col" className="w-[26%] px-2 py-3 text-center font-semibold md:px-4">Lite</th>
            </tr>
          </thead>
          <tbody>
            {offer.planRows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-3 py-3 font-normal text-on-background md:px-6">{row.label}</th>
                <td className="bg-secondary/[var(--lq-soft-alpha)] px-2 py-3 text-center font-semibold text-on-background md:px-4"><Mark value={row.pro} t={t} /></td>
                <td className="px-2 py-3 text-center text-on-surface-light md:px-4"><Mark value={row.lite} t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-heading-md">{t.faqTitle}</h3>
        <div className="flex flex-col gap-3">
          {faq.map((item, i) => (
            <AccordionItem key={item.q} title={item.q} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)}>
              <p className="max-w-prose px-4 pb-4 text-body-md text-on-surface md:px-5">{item.a}</p>
            </AccordionItem>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
