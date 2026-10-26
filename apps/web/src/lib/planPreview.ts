// Textos del cambio a Lite con los datos reales de la persona (aviso de los días 5 y 6 y
// diálogo de Pro). Son reglas puras: lo que dicen coincide con lo que hace la API.
import type { Subscription } from '@noutlife/shared';
import { PRO_ANNUAL_PER_DAY_COP, PRO_ANNUAL_PRICE_COP, PRO_PRICE_COP, formatCop, PRO_PER_DAY_COP, longDay } from '@/lib/plan';

export interface PlanPreview {
  activeHabits: number; habitLimit: number;
  activeRoutines: number; routineLimit: number;
  notebooks: number; notebookLimit: number;
  historyDays: number; historyLimit: number;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Hábitos: Lite no pausa los que hay; solo bloquea crear más por encima del límite. */
export function habitsLine(p: PlanPreview): string {
  const { activeHabits: a, habitLimit: l } = p;
  if (a > l) return `Tienes ${a} ${plural(a, 'hábito activo', 'hábitos activos')}. En Lite puedes tener ${l} activos: los demás siguen aquí, pero no podrás crear más hasta bajar de ${l}.`;
  return `Tienes ${a} ${plural(a, 'hábito activo', 'hábitos activos')}. ${a === 1 ? 'Cabe' : 'Caben'} en Lite.`;
}

export function historyLine(p: PlanPreview): string {
  const { historyDays: d, historyLimit: l } = p;
  if (d > l) return `Tu historial tiene ${d} días guardados. En Lite ves los últimos ${l}; nada se borra.`;
  return `Tu historial de ${d} ${plural(d, 'día', 'días')} cabe en Lite.`;
}

export function notebooksLine(p: PlanPreview): string | null {
  if (p.notebooks <= p.notebookLimit) return null;
  return `Tienes ${p.notebooks} libretas. En Lite abren ${p.notebookLimit}; las demás se conservan.`;
}

export function routinesLine(p: PlanPreview): string | null {
  if (p.activeRoutines <= p.routineLimit) return null;
  return `Tienes ${p.activeRoutines} rutinas activas. En Lite puedes tener ${p.routineLimit}; las demás siguen guardadas.`;
}

/** Línea de contexto del diálogo de Pro para el motivo que lo abrió (null si no aplica). */
export function contextFor(reason: string, p: PlanPreview | null): string | null {
  if (!p) return null;
  switch (reason) {
    case 'habits': return habitsLine(p);
    case 'history': return historyLine(p);
    case 'notebooks': return notebooksLine(p);
    case 'routines': return routinesLine(p);
    default: return null;
  }
}

/** Días de prueba que quedan si cae en el aviso (días 5 y 6 de 7), o null. */
export function trialNoticeDaysLeft(sub: { status: string; hasPaymentMethod: boolean; trialEndsAt: string } | null | undefined, now = Date.now()): number | null {
  if (!sub || sub.status !== 'trialing' || sub.hasPaymentMethod) return null;
  const left = Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now) / (24 * 60 * 60_000)));
  return left === 2 || left === 3 ? left : null;
}

export const trialNoticeTitle = (daysLeft: number) => (daysLeft === 1 ? 'Mañana vuelves a Lite' : `En ${daysLeft} días vuelves a Lite`);

/** Precio de Miembro Fundador: se congela mientras sigas en Pro. Con el plan anual, las dos opciones. */
export const foundingPriceLine = (annual = false) => annual
  ? `${formatCop(PRO_PRICE_COP)} COP al mes (unos ${formatCop(PRO_PER_DAY_COP)} al día) o ${formatCop(PRO_ANNUAL_PRICE_COP)} al año (unos ${formatCop(PRO_ANNUAL_PER_DAY_COP)} al día), tarifa congelada mientras sigas en Pro.`
  : `${formatCop(PRO_PRICE_COP)} COP al mes (unos ${formatCop(PRO_PER_DAY_COP)} al día), tarifa congelada mientras sigas en Pro.`;

// ── Cobro al terminar la prueba con tarjeta vinculada (decisión 15, 22 de octubre) ──────────
// Quien vincula un medio de pago durante la prueba sabe cuándo y cuánto se cobra. Los avisos
// dicen solo lo que pasa: la fecha, el monto, cómo cancelar y que, si cancela antes, no se
// cobra. Sin cuenta regresiva ni urgencia. Vale para cualquier prueba con tarjeta, también la
// del regalo: al vincular la tarjeta el servidor quita la marca giftTrial, y el cobro es real.

export type CardTrialKind = 'linked' | 'pre-charge';

type TrialSub = Pick<Subscription, 'status' | 'trialEndsAt' | 'hasPaymentMethod' | 'paymentMethodLabel' | 'paymentMethodType' | 'interval' | 'nextChargeCop'> & { complimentary?: boolean };

const DAY_MS = 24 * 60 * 60_000;

/**
 * El cobro al terminar la prueba, como lo calcula la API (plan elegido y descuento del código).
 * Una API anterior no lo manda: ahí el cobro es el mensual de siempre.
 */
function trialCharge(sub: TrialSub): { price: string; perDay: string; annual: boolean } {
  const annual = sub.interval === 'year';
  const cop = sub.nextChargeCop ?? PRO_PRICE_COP;
  return { price: formatCop(cop), perDay: formatCop(Math.round(cop / (annual ? 365 : 30))), annual };
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

const medioDePago = (sub: TrialSub) => sub.paymentMethodLabel ?? (sub.paymentMethodType === 'NEQUI' ? 'Nequi' : 'tarjeta');

/** Texto del aviso, con la fecha de fin de prueba y el medio de pago de la persona. */
export function cardTrialCopy(kind: CardTrialKind, sub: TrialSub): { title: string; body: string; primary: string; secondary: string } {
  const fecha = longDay(sub.trialEndsAt);
  const { price, perDay, annual } = trialCharge(sub);
  if (kind === 'linked') {
    return {
      title: `Tu prueba Pro termina el ${fecha}`,
      body: `Hasta el ${fecha} tienes NoutLife Pro completo. Ese día se cobran ${price} COP${annual ? ' por un año completo' : ''} (unos ${perDay} COP al día) para seguir con Pro. Puedes cancelar cuando quieras, con un clic en Plan. Si cancelas antes del ${fecha}, no se cobra nada.`,
      primary: 'Seguir con Pro',
      secondary: 'Ver mi plan',
    };
  }
  return {
    title: `En 2 días se cobra tu primer ${annual ? 'año' : 'mes'}`,
    body: `El ${fecha} se cobran ${price} COP a tu ${medioDePago(sub)}. Lo que construiste (hábitos, libreta e historial) sigue contigo. Si no quieres seguir, cancela con un clic en Plan antes de esa fecha.`,
    primary: 'Seguir con Pro',
    secondary: 'Cancelar en Plan',
  };
}

/** Línea final del paso de vinculación (UpgradeModal): con tarjeta, qué se cobra y cuándo. */
export function trialDoneLine(sub: TrialSub): string {
  const fecha = longDay(sub.trialEndsAt);
  if (!sub.hasPaymentMethod) return `Tienes NoutLife Pro gratis hasta el ${fecha}. $0 hoy; puedes cancelar con 1 clic en Plan.`;
  const { price, annual } = trialCharge(sub);
  return `Tienes NoutLife Pro gratis hasta el ${fecha}. Hoy no se cobra nada. El ${fecha} se cobran ${price} COP${annual ? ' por un año' : ''} para seguir con Pro, y puedes cancelar con un clic en Plan antes de esa fecha.`;
}
