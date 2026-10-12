// Planes de NoutLife: lo que el cliente necesita saber para mostrar precios,
// límites de Lite y el estado de la suscripción. La regla real vive en la API
// (apps/api/src/lib/plans.ts); estos valores solo sirven para los textos.
import type { Subscription } from '@noutlife/shared';

export const PRO_PRICE_COP = 9900;
export const TRIAL_DAYS = 7;
/** NoutLife Lite. La IA es solo de Pro. */
export const LITE_LIMITS = { activeHabits: 3, historyDays: 5 } as const;

/** Funciones que Lite limita (la API responde 402 con `feature`). */
export type ProFeature = 'habits' | 'history' | 'ai';

/** «$9.900» con separador de miles colombiano. */
export const formatCop = (value: number) => `$${value.toLocaleString('es-CO')}`;

const DAY_MS = 24 * 60 * 60_000;

/** Días que faltan hasta `iso` (0 si ya pasó). */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS));
}

/** «19 de octubre». */
export function longDay(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

export const isLite = (subscription?: Subscription | null) => subscription?.plan === 'lite';

/** Error de axios con el 402 de un límite de Lite. */
export function isProRequired(error: unknown): boolean {
  const res = (error as { response?: { status?: number; data?: { code?: string } } })?.response;
  return res?.status === 402 && res.data?.code === 'PRO_REQUIRED';
}

export interface PlanRow {
  label: string;
  lite: string | boolean;
  pro: string | boolean;
}

/** «$9.900 → $330 al día»: ancla el precio en algo pequeño y cotidiano. */
export const PRO_PER_DAY_COP = Math.round(PRO_PRICE_COP / 30);

/** Comparación Pro / Lite. true = incluido, false = no incluido, texto = el límite. */
export const PLAN_ROWS: PlanRow[] = [
  { label: 'Hábitos activos', lite: `Hasta ${LITE_LIMITS.activeHabits}`, pro: 'Ilimitados' },
  { label: 'Historial y analíticas', lite: `Últimos ${LITE_LIMITS.historyDays} días`, pro: 'Completos' },
  { label: 'El Sabio con IA', lite: false, pro: true },
  { label: 'Análisis de IA de hábitos, finanzas y entrenos', lite: false, pro: true },
  { label: 'Tarifa congelada mientras sigas en Pro', lite: false, pro: true },
  { label: 'Zonas, misiones, logros y social', lite: true, pro: true },
  { label: 'Exportar tus datos', lite: true, pro: true },
];
