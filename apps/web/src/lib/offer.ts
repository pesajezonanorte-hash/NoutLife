// La oferta de Pro tal como la ve cada persona: su idioma y la lista de precios de su mercado (pesos en
// Colombia, dólares en el resto del mundo). Todo sale de la aritmética de los dos precios de la lista, así
// los textos siguen siendo ciertos si un precio cambia. Reglas de copy (memoria del proyecto): el precio se
// dice por día, nunca igualado a un producto (café, sándwich), y sin urgencia.
// Reglas puras (sin React): el hook useOffer, que elige idioma y lista de quien mira, vive en lib/useOffer.
import type { BillingInterval, PriceList } from '@noutlife/shared';
import type { Locale } from './locale';
import { LITE_LIMITS, PRO_ZONE_COUNT, formatMoney, type PlanRow } from './plan';

/** Tope del descuento de un código de creador, igual que la API (MAX_CREATOR_DISCOUNT_PERCENT). */
const MAX_DISCOUNT_PERCENT = 50;

export interface Offer {
  locale: Locale;
  list: PriceList;
  /** «$9.900» · «$4.99» · «US$4.99» */
  money: (cents: number) => string;
  /** Con la moneda cuando hace falta decirla: «$9.900 COP» · «$4.99» · «US$4.99». */
  moneyCode: (cents: number) => string;
  /** Un monto por día: «$330» · «17¢» · «US$0.17» (con `withCode`, «$330 COP»). */
  perDay: (cents: number, withCode?: boolean) => string;
  listFor: (interval: BillingInterval) => number;
  /** El precio de un periodo dicho por día (30 días al mes, 365 al año), redondeado. */
  perDayFor: (interval: BillingInterval) => number;
  /** El anual dicho por mes. */
  perMonthOfYear: number;
  /** Lo que ahorra el anual frente a 12 cobros mensuales, y en porcentaje. */
  savings: number;
  savingsPercent: number;
  /** «casi 3 meses gratis» · «almost 4 months free». */
  freeMonths: string;
  /** Primer pago con el descuento de un código (tope del 50 %), redondeado como la API (quoteCharge). */
  firstPayment: (interval: BillingInterval, discountPercent?: number) => number;
  /** «mes» · «month». */
  unit: (interval: BillingInterval) => string;
  /** «Pro Anual» · «Pro Annual». */
  name: (interval: BillingInterval) => string;
  /** «$89.900/año» o, con descuento en el primer pago, «$80.910 el primer año». */
  priceLabel: (interval: BillingInterval, firstCents: number) => string;
  /** Qué se cobra hoy al activar Pro desde Lite, y después. */
  chargeLine: (interval: BillingInterval, firstCents: number) => string;
  /** Reencuadre por día justo antes de pagar. */
  framing: (interval: BillingInterval, trial?: boolean) => string;
  /** Por qué comprometerse un año: un solo espacio que crece contigo. */
  annualPitch: { title: string; body: string; points: readonly string[] };
  /** Comparación Pro / Lite. true = incluido, false = no incluido, texto = el límite. */
  planRows: PlanRow[];
}

/** «3 meses gratis», «casi 3 meses gratis» o «más de 2 meses gratis», según cuántas cuotas ahorra el anual. */
export function freeMonthsLabel(savings: number, monthly: number, locale: Locale = 'es'): string {
  const months = savings / monthly;
  const whole = Math.floor(months + 1e-9);
  const plural = (n: number) => (locale === 'es'
    ? (n === 1 ? '1 mes gratis' : `${n} meses gratis`)
    : (n === 1 ? '1 month free' : `${n} months free`));
  if (months - whole < 0.01) return plural(whole);
  if (months - whole >= 0.75) return `${locale === 'es' ? 'casi' : 'almost'} ${plural(whole + 1)}`;
  return `${locale === 'es' ? 'más de' : 'more than'} ${plural(whole)}`;
}

export function offerFor(locale: Locale, list: PriceList): Offer {
  const { currency } = list;
  // El COP no usa centavos: los montos derivados se redondean a pesos enteros; el USD, a centavos.
  const unitCents = currency === 'COP' ? 100 : 1;
  const round = (cents: number) => Math.round(cents / unitCents) * unitCents;
  const money = (cents: number) => formatMoney(cents, currency, locale);
  const moneyCode = (cents: number) => (currency === 'COP' ? `${money(cents)} COP` : money(cents));
  const perDay = (cents: number, withCode = false) => (
    currency === 'USD' && locale === 'en' && cents < 100 ? `${cents}¢` : withCode ? moneyCode(cents) : money(cents)
  );
  const listFor = (interval: BillingInterval) => (interval === 'year' ? list.yearInCents : list.monthInCents);
  const perDayFor = (interval: BillingInterval) => round(listFor(interval) / (interval === 'year' ? 365 : 30));
  const twelve = list.monthInCents * 12;
  const savings = twelve - list.yearInCents;
  const savingsPercent = Math.round((savings / twelve) * 100);
  const freeMonths = freeMonthsLabel(savings, list.monthInCents, locale);
  const firstPayment = (interval: BillingInterval, discountPercent = 0) => {
    const price = listFor(interval);
    const percent = Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, Math.round(discountPercent)));
    return price - Math.round(((price / unitCents) * percent) / 100) * unitCents;
  };
  const base = { locale, list, money, moneyCode, perDay, listFor, perDayFor, perMonthOfYear: round(list.yearInCents / 12), savings, savingsPercent, freeMonths, firstPayment };
  const day = (interval: BillingInterval) => perDay(perDayFor(interval), true);

  if (locale === 'en') {
    const unit = (interval: BillingInterval) => (interval === 'year' ? 'year' : 'month');
    return {
      ...base,
      unit,
      name: (interval) => (interval === 'year' ? 'Pro Annual' : 'Pro Monthly'),
      priceLabel: (interval, first) => (first < listFor(interval) ? `${money(first)} for the first ${unit(interval)}` : `${money(first)}/${unit(interval)}`),
      chargeLine: (interval, first) => {
        const price = listFor(interval);
        if (interval === 'year') {
          return first < price
            ? `${money(first)} today for 12 months of Pro. Then ${money(price)} every year on the same date. Turn off renewal anytime in 1 click.`
            : `${money(price)} today for 12 months of Pro. Renews every year on the same date. Turn off renewal anytime in 1 click.`;
        }
        return first < price
          ? `${money(first)} today, then ${money(price)} every month on the same date. Cancel anytime in 1 click.`
          : `${money(price)} today, then every month on the same date. Cancel anytime in 1 click.`;
      },
      framing: (interval, trial = false) => {
        const line = interval === 'year' ? `just ${day('year')} a day for a full year of Pro.` : `just ${day('month')} a day to unlock all of NoutLife.`;
        return trial ? `After your trial: ${line}` : `${line.charAt(0).toUpperCase()}${line.slice(1)}`;
      },
      annualPitch: {
        title: 'A year of calm, in order',
        body: `Your routine, your mind and your ideas in one space for 12 months. One payment, and ${freeMonths} compared with monthly.`,
        points: [
          'Habits, notebook, finances, sleep and goals growing together in one place.',
          'A full year of history to see your real progress, month by month.',
          'Your price stays locked all year, with a single payment.',
          'Turn off renewal in 1 click and keep Pro until the end of your year.',
        ],
      },
      planRows: [
        { label: `Pro zones: Finances, Coliseum, Food, Sleep, Journal and ${PRO_ZONE_COUNT - 5} more`, lite: false, pro: true },
        { label: 'Active habits', lite: `Up to ${LITE_LIMITS.activeHabits}`, pro: 'Unlimited' },
        { label: 'Active routines', lite: `Up to ${LITE_LIMITS.activeRoutines}`, pro: 'Unlimited' },
        { label: 'History and insights', lite: `Last ${LITE_LIMITS.historyDays} days`, pro: 'Full' },
        { label: 'The Sage, your AI guide', lite: false, pro: true },
        { label: 'AI insights on habits, finances and workouts', lite: false, pro: true },
        { label: 'Price locked while you stay on Pro', lite: false, pro: true },
        { label: 'Home, goals, achievements, agenda and social', lite: true, pro: true },
        { label: 'Export your data', lite: true, pro: true },
      ],
    };
  }

  const unit = (interval: BillingInterval) => (interval === 'year' ? 'año' : 'mes');
  return {
    ...base,
    unit,
    name: (interval) => (interval === 'year' ? 'Pro Anual' : 'Pro Mensual'),
    priceLabel: (interval, first) => (first < listFor(interval) ? `${money(first)} el primer ${unit(interval)}` : `${money(first)}/${unit(interval)}`),
    chargeLine: (interval, first) => {
      const price = listFor(interval);
      if (interval === 'year') {
        return first < price
          ? `Hoy ${money(first)} por 12 meses de Pro. Luego ${money(price)} cada año, el mismo día. Cancela la renovación con 1 clic.`
          : `Hoy ${money(price)} por 12 meses de Pro. Se renueva cada año, el mismo día. Cancela la renovación con 1 clic.`;
      }
      return first < price
        ? `Hoy ${money(first)} y luego ${money(price)} cada mes, el mismo día. Cancela en cualquier momento con 1 clic.`
        : `Hoy ${money(price)} y luego cada mes, el mismo día. Cancela en cualquier momento con 1 clic.`;
    },
    framing: (interval, trial = false) => {
      const line = interval === 'year' ? `solo ${day('year')} al día por un año completo de Pro.` : `solo ${day('month')} al día para desbloquear todo tu potencial.`;
      return trial ? `Después de tu prueba: ${line}` : `${line.charAt(0).toUpperCase()}${line.slice(1)}`;
    },
    annualPitch: {
      title: 'Un año de orden en calma',
      body: `Tu rutina, tu mente y tus ideas en un solo espacio durante 12 meses. Un solo pago, y ${freeMonths} frente al plan mensual.`,
      points: [
        'Hábitos, libreta, finanzas, sueño y metas creciendo juntos en un mismo lugar.',
        'Un año entero de historial para ver tu progreso real, mes a mes.',
        'Tarifa congelada todo el año, con un solo pago.',
        'Cancelas la renovación con 1 clic y conservas Pro hasta el final de tu año.',
      ],
    },
    planRows: [
      { label: `Zonas Pro: Finanzas, Coliseo, Comida, Sueño, Diario y ${PRO_ZONE_COUNT - 5} más`, lite: false, pro: true },
      { label: 'Hábitos activos', lite: `Hasta ${LITE_LIMITS.activeHabits}`, pro: 'Ilimitados' },
      { label: 'Rutinas activas', lite: `Hasta ${LITE_LIMITS.activeRoutines}`, pro: 'Ilimitadas' },
      { label: 'Historial y analíticas', lite: `Últimos ${LITE_LIMITS.historyDays} días`, pro: 'Completos' },
      { label: 'El Sabio con IA', lite: false, pro: true },
      { label: 'Análisis de IA de hábitos, finanzas y entrenos', lite: false, pro: true },
      { label: 'Tarifa congelada mientras sigas en Pro', lite: false, pro: true },
      { label: 'Inicio, misiones, logros, agenda y social', lite: true, pro: true },
      { label: 'Exportar tus datos', lite: true, pro: true },
    ],
  };
}
