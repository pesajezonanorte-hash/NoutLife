// Textos del cambio a Lite con los datos reales de la persona (aviso de los días 5 y 6 y
// diálogo de Pro). Son reglas puras: lo que dicen coincide con lo que hace la API.
import { PRO_PRICE_COP, formatCop, PRO_PER_DAY_COP } from '@/lib/plan';

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

/** Precio de Miembro Fundador: se congela mientras sigas en Pro. */
export const foundingPriceLine = () => `${formatCop(PRO_PRICE_COP)} COP al mes (unos ${formatCop(PRO_PER_DAY_COP)} al día), tarifa congelada mientras sigas en Pro.`;
