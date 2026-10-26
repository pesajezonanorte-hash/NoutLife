// Textos del cambio a Lite con los datos reales de la persona (aviso de los días 5 y 6 y
// diálogo de Pro). Son reglas puras: lo que dicen coincide con lo que hace la API. Cada texto
// existe en español (por defecto) e inglés, y los montos salen de la lista de precios de la cuenta.
import type { Subscription } from '@noutlife/shared';
import type { Locale } from '@/lib/locale';
import { PRICE_LISTS, longDay } from '@/lib/plan';
import { offerFor, type Offer } from '@/lib/offer';

export interface PlanPreview {
  activeHabits: number; habitLimit: number;
  activeRoutines: number; routineLimit: number;
  notebooks: number; notebookLimit: number;
  historyDays: number; historyLimit: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Hábitos: Lite no pausa los que hay; solo bloquea crear más por encima del límite. */
export function habitsLine(p: PlanPreview, locale: Locale = 'es'): string {
  const { activeHabits: a, habitLimit: l } = p;
  if (locale === 'en') {
    if (a > l) return `You have ${a} active ${plural(a, 'habit', 'habits')}. On Lite you can keep ${l} active: the rest stay here, but you can't create more until you have fewer than ${l}.`;
    return `You have ${a} active ${plural(a, 'habit', 'habits')}. ${a === 1 ? 'It fits' : 'They fit'} in Lite.`;
  }
  if (a > l) return `Tienes ${a} ${plural(a, 'hábito activo', 'hábitos activos')}. En Lite puedes tener ${l} activos: los demás siguen aquí, pero no podrás crear más hasta bajar de ${l}.`;
  return `Tienes ${a} ${plural(a, 'hábito activo', 'hábitos activos')}. ${a === 1 ? 'Cabe' : 'Caben'} en Lite.`;
}

export function historyLine(p: PlanPreview, locale: Locale = 'es'): string {
  const { historyDays: d, historyLimit: l } = p;
  if (locale === 'en') {
    if (d > l) return `Your history has ${d} saved days. On Lite you see the last ${l}; nothing is deleted.`;
    return `Your ${d}-day history fits in Lite.`;
  }
  if (d > l) return `Tu historial tiene ${d} días guardados. En Lite ves los últimos ${l}; nada se borra.`;
  return `Tu historial de ${d} ${plural(d, 'día', 'días')} cabe en Lite.`;
}

export function notebooksLine(p: PlanPreview, locale: Locale = 'es'): string | null {
  if (p.notebooks <= p.notebookLimit) return null;
  return locale === 'en'
    ? `You have ${p.notebooks} notebooks. On Lite ${p.notebookLimit} stay open; the others are kept.`
    : `Tienes ${p.notebooks} libretas. En Lite abren ${p.notebookLimit}; las demás se conservan.`;
}

export function routinesLine(p: PlanPreview, locale: Locale = 'es'): string | null {
  if (p.activeRoutines <= p.routineLimit) return null;
  return locale === 'en'
    ? `You have ${p.activeRoutines} active routines. On Lite you can keep ${p.routineLimit}; the others stay saved.`
    : `Tienes ${p.activeRoutines} rutinas activas. En Lite puedes tener ${p.routineLimit}; las demás siguen guardadas.`;
}

/** Línea de contexto del diálogo de Pro para el motivo que lo abrió (null si no aplica). */
export function contextFor(reason: string, p: PlanPreview | null, locale: Locale = 'es'): string | null {
  if (!p) return null;
  switch (reason) {
    case 'habits': return habitsLine(p, locale);
    case 'history': return historyLine(p, locale);
    case 'notebooks': return notebooksLine(p, locale);
    case 'routines': return routinesLine(p, locale);
    default: return null;
  }
}

/** Días de prueba que quedan si cae en el aviso (días 5 y 6 de 7), o null. */
export function trialNoticeDaysLeft(sub: { status: string; hasPaymentMethod: boolean; trialEndsAt: string } | null | undefined, now = Date.now()): number | null {
  if (!sub || sub.status !== 'trialing' || sub.hasPaymentMethod) return null;
  const left = Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now) / (24 * 60 * 60_000)));
  return left === 2 || left === 3 ? left : null;
}

export const trialNoticeTitle = (daysLeft: number, locale: Locale = 'es') => (locale === 'en'
  ? (daysLeft === 1 ? 'Tomorrow your account moves to Lite' : `In ${daysLeft} days your account moves to Lite`)
  : (daysLeft === 1 ? 'Mañana vuelves a Lite' : `En ${daysLeft} días vuelves a Lite`));

/** Precio de Miembro Fundador: se congela mientras sigas en Pro. Con el plan anual, las dos opciones. */
export function foundingPriceLine(annual = false, offer: Offer = offerFor('es', PRICE_LISTS.CO)): string {
  const { money, moneyCode, perDay, perDayFor, listFor } = offer;
  if (offer.locale === 'en') {
    const month = `${money(listFor('month'))} a month (about ${perDay(perDayFor('month'))} a day)`;
    return annual
      ? `${month} or ${money(listFor('year'))} a year (about ${perDay(perDayFor('year'))} a day), price locked while you stay on Pro.`
      : `${month}, price locked while you stay on Pro.`;
  }
  const month = `${moneyCode(listFor('month'))} al mes (unos ${perDay(perDayFor('month'))} al día)`;
  return annual
    ? `${month} o ${money(listFor('year'))} al año (unos ${perDay(perDayFor('year'))} al día), tarifa congelada mientras sigas en Pro.`
    : `${month}, tarifa congelada mientras sigas en Pro.`;
}

// ── Cobro al terminar la prueba con tarjeta vinculada (decisión 15, 22 de octubre) ──────────
// Quien vincula un medio de pago durante la prueba sabe cuándo y cuánto se cobra. Los avisos
// dicen solo lo que pasa: la fecha, el monto, cómo cancelar y que, si cancela antes, no se
// cobra. Sin cuenta regresiva ni urgencia. Vale para cualquier prueba con tarjeta, también la
// del regalo: al vincular la tarjeta el servidor quita la marca giftTrial, y el cobro es real.

export type CardTrialKind = 'linked' | 'pre-charge';

type TrialSub = Pick<Subscription, 'status' | 'trialEndsAt' | 'hasPaymentMethod' | 'paymentMethodLabel' | 'paymentMethodType' | 'interval' | 'nextChargeCop' | 'pricing' | 'nextChargeInCents'>
  & { complimentary?: boolean };

const DAY_MS = 24 * 60 * 60_000;

/**
 * El cobro al terminar la prueba, como lo calcula la API (plan elegido, descuento del código y moneda de la
 * cuenta). Una API anterior lo manda solo en pesos, y una más vieja no lo manda: ahí es la mensual de siempre.
 */
function trialCharge(sub: TrialSub, locale: Locale): { price: string; perDay: string; annual: boolean; usd: boolean } {
  const annual = sub.interval === 'year';
  const offer = offerFor(locale, sub.pricing ?? PRICE_LISTS.CO);
  const cents = sub.nextChargeInCents ?? (sub.nextChargeCop != null ? sub.nextChargeCop * 100 : offer.listFor('month'));
  const unit = offer.list.currency === 'COP' ? 100 : 1;
  const daily = Math.round(cents / (annual ? 365 : 30) / unit) * unit;
  return { price: offer.moneyCode(cents), perDay: offer.perDay(daily, true), annual, usd: offer.list.currency === 'USD' };
}

/** Días de prueba que quedan, redondeando hacia arriba; 0 si ya terminó. */
export function trialDaysLeft(trialEndsAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now) / DAY_MS));
}

/**
 * Qué aviso de cobro toca, si alguno: 'linked' la primera vez que se ve la prueba con tarjeta
 * (justo después de vincularla), y 'pre-charge' dos días antes del cobro. Null si no hay tarjeta
 * vinculada en prueba (ahí aplica el aviso de los días 5 y 6 y su paso a Lite) o si es de cortesía.
 */
export function cardTrialDue(sub: TrialSub | null | undefined, wasShown: (kind: CardTrialKind) => boolean, now = Date.now()): CardTrialKind | null {
  if (!sub || sub.status !== 'trialing' || !sub.hasPaymentMethod || sub.complimentary) return null;
  if (!wasShown('linked')) return 'linked';
  if (trialDaysLeft(sub.trialEndsAt, now) === 2 && !wasShown('pre-charge')) return 'pre-charge';
  return null;
}

/** Clave local por prueba: si hay otra prueba con tarjeta, el aviso vuelve a salir. */
export const cardTrialKey = (userId: string, kind: CardTrialKind, trialEndsAt: string) => `lq_card_trial:${userId}:${kind}:${trialEndsAt.slice(0, 10)}`;

const methodName = (sub: TrialSub, locale: Locale) => sub.paymentMethodLabel
  ?? (sub.paymentMethodType === 'NEQUI' ? 'Nequi' : locale === 'en' ? 'card' : 'tarjeta');

/** Texto del aviso, con la fecha de fin de prueba y el medio de pago de la persona. */
export function cardTrialCopy(kind: CardTrialKind, sub: TrialSub, locale: Locale = 'es'): { title: string; body: string; primary: string; secondary: string } {
  const date = longDay(sub.trialEndsAt, locale);
  const { price, perDay, annual, usd } = trialCharge(sub, locale);
  if (locale === 'en') {
    // Un precio en dólares se cobra en pesos: se dice siempre, también en el aviso del cobro.
    const inPesos = usd ? ' (billed in Colombian pesos at that day’s official rate)' : '';
    if (kind === 'linked') {
      return {
        title: `Your Pro trial ends on ${date}`,
        body: `Until ${date} you have full NoutLife Pro. That day you’ll be charged ${price}${annual ? ' for a full year' : ''} (about ${perDay} a day)${inPesos} to continue with Pro. You can cancel anytime with one click in Plan. If you cancel before ${date}, you won’t be charged.`,
        primary: 'Continue with Pro',
        secondary: 'View my plan',
      };
    }
    return {
      title: `Your first ${annual ? 'year' : 'month'} is charged in 2 days`,
      body: `On ${date} you’ll be charged ${price}${inPesos} to your ${methodName(sub, locale)}. Everything you’ve built (habits, notebook and history) stays with you. If you’d rather not continue, cancel with one click in Plan before that date.`,
      primary: 'Continue with Pro',
      secondary: 'Cancel in Plan',
    };
  }
  const enPesos = usd ? ' (se cobra en pesos colombianos con la TRM de ese día)' : '';
  if (kind === 'linked') {
    return {
      title: `Tu prueba Pro termina el ${date}`,
      body: `Hasta el ${date} tienes NoutLife Pro completo. Ese día se cobran ${price}${annual ? ' por un año completo' : ''} (unos ${perDay} al día)${enPesos} para seguir con Pro. Puedes cancelar cuando quieras, con un clic en Plan. Si cancelas antes del ${date}, no se cobra nada.`,
      primary: 'Seguir con Pro',
      secondary: 'Ver mi plan',
    };
  }
  return {
    title: `En 2 días se cobra tu primer ${annual ? 'año' : 'mes'}`,
    body: `El ${date} se cobran ${price}${enPesos} a tu ${methodName(sub, locale)}. Lo que construiste (hábitos, libreta e historial) sigue contigo. Si no quieres seguir, cancela con un clic en Plan antes de esa fecha.`,
    primary: 'Seguir con Pro',
    secondary: 'Cancelar en Plan',
  };
}

/** Línea final del paso de vinculación (UpgradeModal): con tarjeta, qué se cobra y cuándo. */
export function trialDoneLine(sub: TrialSub, locale: Locale = 'es'): string {
  const date = longDay(sub.trialEndsAt, locale);
  if (locale === 'en') {
    if (!sub.hasPaymentMethod) return `You have NoutLife Pro free until ${date}. $0 today; you can cancel in 1 click in Plan.`;
    const { price, annual } = trialCharge(sub, locale);
    return `You have NoutLife Pro free until ${date}. Nothing is charged today. On ${date} you’ll be charged ${price}${annual ? ' for a year' : ''} to continue with Pro, and you can cancel in one click in Plan before that date.`;
  }
  if (!sub.hasPaymentMethod) return `Tienes NoutLife Pro gratis hasta el ${date}. $0 hoy; puedes cancelar con 1 clic en Plan.`;
  const { price, annual } = trialCharge(sub, locale);
  return `Tienes NoutLife Pro gratis hasta el ${date}. Hoy no se cobra nada. El ${date} se cobran ${price}${annual ? ' por un año' : ''} para seguir con Pro, y puedes cancelar con un clic en Plan antes de esa fecha.`;
}
