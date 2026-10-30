// Cuentas de las tarjetas 3D de Estadísticas (reversos y mapa 3D de zonas). Sin React ni
// stores, para probarlas con tsx (tests/unit/stats3d.unit.ts).

export interface DayXp { date: string; xp: number }

export interface WeekdayRhythm {
  /** 0 = domingo … 6 = sábado (Date#getDay). */
  weekday: number;
  /** XP media de ese día de la semana dentro del periodo (días sin XP cuentan como 0). */
  avg: number;
  /** Días del periodo que cayeron en ese día de la semana. */
  days: number;
}

/**
 * XP media por día de la semana, en el orden de la semana local (lunes primero en español,
 * domingo primero en inglés de EE. UU.). Devuelve null si la serie es mensual (YYYY-MM) o
 * está vacía: ahí el día de la semana no significa nada.
 */
export function weekdayRhythm(points: DayXp[], weekStart: 0 | 1 = 1): WeekdayRhythm[] | null {
  if (!points.length || points.some((p) => p.date.length < 10)) return null;
  const sum = new Array<number>(7).fill(0);
  const days = new Array<number>(7).fill(0);
  for (const p of points) {
    // Mediodía local: la fecha no salta de día por la zona horaria.
    const d = new Date(`${p.date.slice(0, 10)}T12:00:00`).getDay();
    sum[d] += p.xp;
    days[d] += 1;
  }
  return Array.from({ length: 7 }, (_, i) => {
    const weekday = (i + weekStart) % 7;
    return { weekday, avg: days[weekday] ? sum[weekday] / days[weekday] : 0, days: days[weekday] };
  });
}

/** Día con más XP del periodo (el primero si hay empate); null si ninguno tiene XP. */
export function bestXpDay<T extends DayXp>(points: T[]): T | null {
  let best: T | null = null;
  for (const p of points) if (p.xp > 0 && (!best || p.xp > best.xp)) best = p;
  return best;
}

/** Porcentaje entero 0–100 del nivel actual (xp dentro del nivel / xp que pide el nivel). */
export function levelPercent(xp: number, xpToNext: number): number {
  if (!(xpToNext > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));
}

export interface ZoneLike {
  id: string;
  name: string;
  score: number;
  scoreAvailable: boolean;
  hasData: boolean;
  isTracking: boolean;
  activityCount: number;
}

/** Zonas con ritmo medible, de mayor a menor (desempate por nombre para un orden estable). */
export function rankZones<T extends ZoneLike>(zones: T[]): T[] {
  return zones
    .filter((z) => z.scoreAvailable)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export interface ZoneInsight {
  /** Puesto por ritmo entre las zonas medibles (1 = la mejor); null si la zona no se mide. */
  rank: number | null;
  ranked: number;
  /** Parte de toda la actividad registrada en el periodo (0–100, entero). */
  share: number;
}

export function zoneInsight(zone: ZoneLike, zones: ZoneLike[]): ZoneInsight {
  const ranked = rankZones(zones);
  const i = ranked.findIndex((z) => z.id === zone.id);
  const total = zones.reduce((a, z) => a + Math.max(0, z.activityCount), 0);
  return {
    rank: i >= 0 ? i + 1 : null,
    ranked: ranked.length,
    share: total > 0 ? Math.round((Math.max(0, zone.activityCount) / total) * 100) : 0,
  };
}

/** Ruta de la zona en la app; las zonas propias viven en /zonas/:id. */
const ZONE_ROUTES: Record<string, string> = {
  quests: '/quests', habits: '/habits', coliseo: '/coliseo', finances: '/finances', sleep: '/sleep',
  learning: '/learning', journal: '/journal', mirror: '/espejo', nutrition: '/food', recreation: '/recreacion',
  relationships: '/love',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function zoneRoute(id: string): string | null {
  return ZONE_ROUTES[id] ?? (UUID.test(id) ? `/zonas/${id}` : null);
}

/* ───────── Mapa 3D de zonas ───────── */

export interface ZoneColumn {
  id: string;
  /** Posición en el suelo (unidades de escena), en círculo alrededor del núcleo. */
  x: number;
  z: number;
  /** Altura de la columna: un muñón mínimo para las zonas sin ritmo, hasta MAX con el 100 %. */
  height: number;
  /** Ritmo 0–1 (0 sin ritmo medible). */
  level: number;
  /** 0 = sin registros (vidrio apagado), 1 = con registros. */
  lit: 0 | 1;
}

export const COLUMN_MIN = 0.12;
export const COLUMN_MAX = 1.3;

/**
 * Columnas del mapa 3D: una por zona en seguimiento o con registros (las zonas sin configurar
 * no se dibujan), repartidas en círculo empezando al frente de la cámara. El radio crece con
 * el número de columnas para que no se toquen. Como mucho `limit` columnas, las de más ritmo.
 */
export function zoneColumns(zones: ZoneLike[], limit = 16): ZoneColumn[] {
  const shown = zones
    .filter((z) => z.isTracking || z.hasData)
    .map((z, i) => ({ z, i }))
    .sort((a, b) => (b.z.scoreAvailable ? b.z.score : -1) - (a.z.scoreAvailable ? a.z.score : -1) || a.i - b.i)
    .slice(0, limit)
    .sort((a, b) => a.i - b.i)
    .map(({ z }) => z);
  const n = shown.length;
  const radius = n <= 1 ? 0 : Math.max(1.05, Math.min(2.1, 0.62 + n * 0.12));
  return shown.map((zone, i) => {
    // π/2 + … : la primera columna queda delante (z positivo, hacia la cámara).
    const a = Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    const level = zone.scoreAvailable ? Math.max(0, Math.min(1, zone.score / 100)) : 0;
    return {
      id: zone.id,
      x: +(Math.cos(a) * radius).toFixed(4),
      z: +(Math.sin(a) * radius).toFixed(4),
      height: +(COLUMN_MIN + (COLUMN_MAX - COLUMN_MIN) * level).toFixed(4),
      level,
      lit: zone.hasData ? 1 : 0,
    };
  });
}
