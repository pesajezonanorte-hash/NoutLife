/**
 * Tasa para cobrar en pesos los precios en dólares: la TRM oficial vigente (Superintendencia Financiera),
 * publicada en datos abiertos (datos.gov.co, conjunto 32sa-8pi3), sin llave.
 *
 * Se guarda en memoria 6 horas. Si la fuente falla, sirve la última tasa conocida de hasta 7 días y, sin
 * ninguna, USD_COP_FALLBACK_RATE si está definida. Sin ninguna tasa, el cobro en dólares no se hace
 * (FxUnavailableError): el cron lo reintenta y la cuenta conserva el margen de renovación. Nunca se cobra
 * con una tasa inventada.
 */

export class FxUnavailableError extends Error {
  constructor(message = 'No hay tasa de cambio USD/COP disponible.') {
    super(message);
    this.name = 'FxUnavailableError';
  }
}

export interface UsdCopRate {
  /** Pesos por 1 dólar. */
  rate: number;
  /** Día de vigencia de la tasa (AAAA-MM-DD). */
  asOf: string;
  source: 'trm' | 'fallback';
}

const TRM_URL = 'https://www.datos.gov.co/resource/32sa-8pi3.json';
const FRESH_MS = 6 * 60 * 60_000;
const STALE_MS = 7 * 24 * 60 * 60_000;
/** Una TRM fuera de este rango es un dato roto, no una tasa. */
const MIN_RATE = 1000;
const MAX_RATE = 10000;

const validRate = (rate: number) => Number.isFinite(rate) && rate >= MIN_RATE && rate <= MAX_RATE;

/** Día de hoy en Colombia (AAAA-MM-DD): la TRM vigente es la de ese día. */
export function colombiaDay(now = Date.now()): string {
  return new Date(now - 5 * 60 * 60_000).toISOString().slice(0, 10);
}

/** Fila de datos.gov.co → tasa, o null si no trae una TRM creíble. */
export function parseTrm(json: unknown): UsdCopRate | null {
  const row = Array.isArray(json) ? (json[0] as { valor?: unknown; vigenciadesde?: unknown } | undefined) : undefined;
  const rate = Number(row?.valor);
  if (!validRate(rate) || typeof row?.vigenciadesde !== 'string') return null;
  return { rate, asOf: row.vigenciadesde.slice(0, 10), source: 'trm' };
}

async function fetchTrm(now: number, fetcher: typeof fetch): Promise<UsdCopRate> {
  // La TRM más reciente que ya rige hoy: la del viernes vale sábado, domingo y lunes, y la de mañana se publica hoy.
  const where = encodeURIComponent(`vigenciadesde <= '${colombiaDay(now)}T00:00:00.000'`);
  const url = `${TRM_URL}?$where=${where}&$order=${encodeURIComponent('vigenciadesde DESC')}&$limit=1`;
  const res = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5_000) });
  if (!res.ok) throw new FxUnavailableError(`datos.gov.co respondió HTTP ${res.status}`);
  const value = parseTrm(await res.json());
  if (!value) throw new FxUnavailableError('datos.gov.co no devolvió una TRM válida.');
  return value;
}

let cache: { at: number; value: UsdCopRate } | null = null;
let inflight: Promise<UsdCopRate> | null = null;

/** Pesos por dólar para cobrar hoy. Lanza FxUnavailableError si no hay ninguna tasa confiable. */
export async function usdCopRate(options: { now?: number; fetcher?: typeof fetch } = {}): Promise<UsdCopRate> {
  const now = options.now ?? Date.now();
  if (cache && now - cache.at < FRESH_MS) return cache.value;
  try {
    // Varias peticiones a la vez comparten una sola consulta.
    inflight ??= fetchTrm(now, options.fetcher ?? fetch).finally(() => { inflight = null; });
    const value = await inflight;
    cache = { at: now, value };
    return value;
  } catch (error) {
    if (cache && now - cache.at < STALE_MS) return cache.value;
    const fallback = Number(process.env.USD_COP_FALLBACK_RATE);
    if (validRate(fallback)) return { rate: fallback, asOf: colombiaDay(now), source: 'fallback' };
    console.error('[FX_ERROR]', error instanceof Error ? error.message : error);
    throw error instanceof FxUnavailableError ? error : new FxUnavailableError();
  }
}

/** Centavos de COP, en pesos enteros, que equivalen a `usdCents` con la tasa dada. */
export function copCentsFromUsdCents(usdCents: number, rate: number): number {
  return Math.round((usdCents / 100) * rate) * 100;
}

/** Solo para pruebas: olvida la tasa guardada. */
export function resetFxCache(): void {
  cache = null;
  inflight = null;
}
