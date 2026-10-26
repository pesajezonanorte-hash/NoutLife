// Planes de NoutLife: lo que el cliente necesita saber para mostrar precios,
// límites de Lite y el estado de la suscripción. La regla real vive en la API
// (apps/api/src/lib/plans.ts); estos valores solo sirven para los textos.
import type { BillingInterval, Subscription } from '@noutlife/shared';

export const PRO_PRICE_COP = 9900;
/** Pro Anual: 12 meses de una vez (plan v3, Rev7). Igual que en la API (PRO_ANNUAL_PRICE_COP). */
export const PRO_ANNUAL_PRICE_COP = 89900;
export const TRIAL_DAYS = 7;
/** NoutLife Lite. La IA es solo de Pro. */
export const LITE_LIMITS = { activeHabits: 3, activeRoutines: 3, historyDays: 5, notebooks: 2, notebookPages: 10 } as const;

/** Funciones que Lite limita (la API responde 402 con `feature`). */
export type ProFeature = 'habits' | 'history' | 'ai';

/** Zonas solo de Pro. En Lite se ven con candado (la API responde 402 con `lock`). */
export type ProZone = 'finances' | 'coliseo' | 'recreation' | 'food' | 'sleep' | 'journal' | 'learning' | 'love' | 'mirror' | 'wisdom' | 'custom-zones';
/** Candados de la Libreta en Lite (la API responde 402 con `lock`). */
export type NotebookLock = 'notebooks' | 'notebook-pages' | 'notebook-draw' | 'notebook-images' | 'notebook-stickies';
/** Candados de Lite: una zona Pro, el límite de rutinas activas o lo que es de Pro en la Libreta. */
export type ProLock = ProZone | 'routines' | NotebookLock;

export interface ProZoneInfo {
  label: string;
  /** Qué desbloquea, en una frase. */
  pitch: string;
}

export const PRO_ZONES: Record<ProZone, ProZoneInfo> = {
  finances: { label: 'Finanzas', pitch: 'Presupuestos, metas de ahorro y cada gasto bajo control.' },
  coliseo: { label: 'Coliseo', pitch: 'Cualquier entrenamiento: rutinas, cardio, caminatas, récords y fotos de progreso.' },
  recreation: { label: 'Recreación', pitch: 'Tu sala de cine: películas, series, juegos y salidas que también suman XP.' },
  food: { label: 'Comida', pitch: 'Comidas, macros y tus platos guardados en un solo lugar.' },
  sleep: { label: 'Sueño', pitch: 'Tus horas de descanso, su calidad y cómo evoluciona noche a noche.' },
  journal: { label: 'Diario', pitch: 'Tu diario privado, con tu ánimo y lo que vives cada día.' },
  learning: { label: 'Aprendizaje', pitch: 'Tus libros y cursos, con el progreso de cada uno.' },
  love: { label: 'Relaciones', pitch: 'Fechas importantes, ideas de regalo y las personas que te importan.' },
  mirror: { label: 'Espejo', pitch: 'Tu armario, outfits y rutinas de cuidado personal.' },
  wisdom: { label: 'Sabiduría', pitch: 'Citas de filósofos, estrategas y atletas históricos. Subir de nivel abre más.' },
  'custom-zones': { label: 'Mis zonas', pitch: 'Zonas a tu medida, con sus propios hábitos, misiones y métricas.' },
};

/** Ruta de cada zona Pro. Las zonas personalizadas (/zonas/:id) cuentan como «Mis zonas». */
const PRO_ZONE_PATHS: Record<string, ProZone> = {
  '/finances': 'finances', '/coliseo': 'coliseo', '/gym': 'coliseo', '/recreacion': 'recreation', '/food': 'food', '/sleep': 'sleep', '/journal': 'journal',
  '/learning': 'learning', '/love': 'love', '/espejo': 'mirror', '/wisdom': 'wisdom', '/custom-zones': 'custom-zones',
};

/** Zona Pro de una ruta (o null si la ruta es de Lite). */
export function proZoneOf(pathname: string): ProZone | null {
  if (pathname.startsWith('/zonas/')) return 'custom-zones';
  const base = `/${pathname.split('/')[1] ?? ''}`;
  return PRO_ZONE_PATHS[base] ?? null;
}

/**
 * En Lite, las zonas principales de la barra son las primeras que sí se pueden usar
 * y no están ocultas (el orden elegido se respeta dentro de cada grupo).
 */
export function usableOrder(order: string[], lite: boolean, hidden: string[] = []): string[] {
  if (!lite) return order;
  const shown = order.filter((to) => !hidden.includes(to));
  return [...shown.filter((to) => !proZoneOf(to)), ...shown.filter((to) => proZoneOf(to))];
}

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

/** «19 de octubre» si es este año; «19 de octubre de 2027» si no (renovaciones anuales). */
export function longDate(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (date.getFullYear() === now.getFullYear()) return longDay(iso);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
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

/** Reencuadre del precio (framing): la cuota dicha en días, justo antes de pagar. Igual en todas las pantallas Pro. */
export const PRO_FRAMING = `Solo ${formatCop(PRO_PER_DAY_COP)} COP al día para desbloquear todo tu potencial.`;
/** Lo mismo durante la prueba: el primer cobro llega después de los días gratis. */
export const PRO_FRAMING_TRIAL = `Después de tu prueba: solo ${formatCop(PRO_PER_DAY_COP)} COP al día para desbloquear todo tu potencial.`;

// ── Plan anual ─────────────────────────────────────────────────────────────────────────────
// Todo sale de la aritmética de los dos precios, así los textos siguen siendo ciertos si cambian.

/** Doce meses pagando mes a mes. */
const TWELVE_MONTHS_COP = PRO_PRICE_COP * 12;
/** Lo que ahorra el anual frente a 12 cobros mensuales ($28.900). */
export const ANNUAL_SAVINGS_COP = TWELVE_MONTHS_COP - PRO_ANNUAL_PRICE_COP;
/** El ahorro en porcentaje (24 %). */
export const ANNUAL_SAVINGS_PERCENT = Math.round((ANNUAL_SAVINGS_COP / TWELVE_MONTHS_COP) * 100);
/** El anual dicho por mes ($7.492) y por día ($246, sobre 365 días). */
export const PRO_ANNUAL_PER_MONTH_COP = Math.round(PRO_ANNUAL_PRICE_COP / 12);
export const PRO_ANNUAL_PER_DAY_COP = Math.round(PRO_ANNUAL_PRICE_COP / 365);

/** «3 meses gratis», «casi 3 meses gratis» o «más de 2 meses gratis», según cuántas cuotas ahorra el anual. */
export function freeMonthsLabel(savingsCop = ANNUAL_SAVINGS_COP, monthlyCop = PRO_PRICE_COP): string {
  const months = savingsCop / monthlyCop;
  const whole = Math.floor(months + 1e-9);
  const plural = (n: number) => (n === 1 ? '1 mes gratis' : `${n} meses gratis`);
  if (months - whole < 0.01) return plural(whole);
  if (months - whole >= 0.75) return `casi ${plural(whole + 1)}`;
  return `más de ${plural(whole)}`;
}

/** Precio de lista de un periodo. */
export const priceFor = (interval: BillingInterval) => (interval === 'year' ? PRO_ANNUAL_PRICE_COP : PRO_PRICE_COP);
/** El precio de un periodo dicho por día. */
export const perDayFor = (interval: BillingInterval) => (interval === 'year' ? PRO_ANNUAL_PER_DAY_COP : PRO_PER_DAY_COP);
/** «mes» o «año»: para «$9.900/mes» y «$89.900/año». */
export const intervalUnit = (interval: BillingInterval) => (interval === 'year' ? 'año' : 'mes');
/** «Pro Mensual» o «Pro Anual». */
export const intervalName = (interval: BillingInterval) => (interval === 'year' ? 'Pro Anual' : 'Pro Mensual');

/** Primer pago con el descuento de un código de creador: pesos enteros y tope del 50 %, igual que la API (quoteCharge). */
export function firstPaymentCop(interval: BillingInterval, discountPercent = 0): number {
  const list = priceFor(interval);
  const percent = Math.min(50, Math.max(0, Math.round(discountPercent)));
  return list - Math.round((list * percent) / 100);
}

/** «$89.900/año» o, con descuento en el primer pago, «$80.910 el primer año». */
export function firstPriceLabel(interval: BillingInterval, firstCop: number): string {
  const unit = intervalUnit(interval);
  return firstCop < priceFor(interval) ? `${formatCop(firstCop)} el primer ${unit}` : `${formatCop(firstCop)}/${unit}`;
}

/** Qué se cobra hoy al activar Pro desde Lite, y después. */
export function chargeLine(interval: BillingInterval, firstCop: number): string {
  const list = priceFor(interval);
  if (interval === 'year') {
    return firstCop < list
      ? `Hoy ${formatCop(firstCop)} por 12 meses de Pro. Luego ${formatCop(list)} cada año, el mismo día. Cancela la renovación con 1 clic.`
      : `Hoy ${formatCop(list)} por 12 meses de Pro. Se renueva cada año, el mismo día. Cancela la renovación con 1 clic.`;
  }
  return firstCop < list
    ? `Hoy ${formatCop(firstCop)} y luego ${formatCop(list)} cada mes, el mismo día. Cancela en cualquier momento con 1 clic.`
    : `Hoy ${formatCop(list)} y luego cada mes, el mismo día. Cancela en cualquier momento con 1 clic.`;
}

/** Reencuadre por día según el plan, igual que PRO_FRAMING. */
export function framingFor(interval: BillingInterval, trial = false): string {
  if (interval === 'month') return trial ? PRO_FRAMING_TRIAL : PRO_FRAMING;
  const line = `solo ${formatCop(PRO_ANNUAL_PER_DAY_COP)} COP al día por un año completo de Pro.`;
  return trial ? `Después de tu prueba: ${line}` : `${line.charAt(0).toUpperCase()}${line.slice(1)}`;
}

/** El plan anual solo se ofrece si la API ya lo cobra (devuelve `interval`); una API anterior cobraría mensual. */
export const annualAvailable = (subscription?: Subscription | null) => subscription?.interval !== undefined;

/** Por qué comprometerse un año: un solo espacio que crece contigo. Lo usan el diálogo de Pro y Planes. */
export const ANNUAL_PITCH = {
  title: 'Un año de orden en calma',
  body: `Tu rutina, tu mente y tus ideas en un solo espacio durante 12 meses. Un solo pago, y ${freeMonthsLabel()} frente al plan mensual.`,
  points: [
    'Hábitos, libreta, finanzas, sueño y metas creciendo juntos en un mismo lugar.',
    'Un año entero de historial para ver tu progreso real, mes a mes.',
    'Tarifa congelada todo el año, con un solo pago.',
    'Cancelas la renovación con 1 clic y conservas Pro hasta el final de tu año.',
  ],
} as const;

/** Cuántas zonas desbloquea Pro (para los textos). */
export const PRO_ZONE_COUNT = Object.keys(PRO_ZONES).length;

/** Comparación Pro / Lite. true = incluido, false = no incluido, texto = el límite. */
export const PLAN_ROWS: PlanRow[] = [
  { label: `Zonas Pro: Finanzas, Coliseo, Comida, Sueño, Diario y ${PRO_ZONE_COUNT - 5} más`, lite: false, pro: true },
  { label: 'Hábitos activos', lite: `Hasta ${LITE_LIMITS.activeHabits}`, pro: 'Ilimitados' },
  { label: 'Rutinas activas', lite: `Hasta ${LITE_LIMITS.activeRoutines}`, pro: 'Ilimitadas' },
  { label: 'Historial y analíticas', lite: `Últimos ${LITE_LIMITS.historyDays} días`, pro: 'Completos' },
  { label: 'El Sabio con IA', lite: false, pro: true },
  { label: 'Análisis de IA de hábitos, finanzas y entrenos', lite: false, pro: true },
  { label: 'Tarifa congelada mientras sigas en Pro', lite: false, pro: true },
  { label: 'Inicio, misiones, logros, agenda y social', lite: true, pro: true },
  { label: 'Exportar tus datos', lite: true, pro: true },
];
