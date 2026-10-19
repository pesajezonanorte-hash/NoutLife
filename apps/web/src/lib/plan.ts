// Planes de NoutLife: lo que el cliente necesita saber para mostrar precios,
// límites de Lite y el estado de la suscripción. La regla real vive en la API
// (apps/api/src/lib/plans.ts); estos valores solo sirven para los textos.
import type { Subscription } from '@noutlife/shared';

export const PRO_PRICE_COP = 9900;
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

/** Reencuadre del precio (framing): la cuota dicha en días, justo antes de pagar. Igual en todas las pantallas Pro. */
export const PRO_FRAMING = `Solo ${formatCop(PRO_PER_DAY_COP)} COP al día para desbloquear todo tu potencial.`;
/** Lo mismo durante la prueba: el primer cobro llega después de los días gratis. */
export const PRO_FRAMING_TRIAL = `Después de tu prueba: solo ${formatCop(PRO_PER_DAY_COP)} COP al día para desbloquear todo tu potencial.`;

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
