/** Lista separada por comas; los valores del entorno van primero y los defaults detrás (sin duplicados). */
function splitList(value: string | undefined, defaults: string[] = []): string[] {
  const items = (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  return [...new Set([...items, ...defaults])];
}

type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

const OPENAI_API_KEYS = splitList(process.env.OPENAI_API_KEY);
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODELS = splitList(process.env.OPENAI_MODEL, ['gpt-4o-mini']);

// Groq — OpenAI-compatible, el nivel gratuito más generoso.
// Varias llaves (GROQ_API_KEY=k1,k2) multiplican el cupo diario: cada llave es de
// una organización distinta y tiene su propio límite.
const GROQ_API_KEYS = splitList(process.env.GROQ_API_KEY);
// Preferidos (los pequeños tienen el cupo diario más grande). Groq retira modelos
// cada pocos meses: si alguno ya no existe, el catálogo de la llave (/models)
// aporta los que sí están disponibles, así que el Sabio no se rompe por un retiro.
const GROQ_MODELS = splitList(process.env.GROQ_MODEL, ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']);
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

const GEMINI_API_KEYS = splitList(process.env.GEMINI_API_KEY);
// Cada modelo de Gemini tiene su propio cupo gratuito diario (algunos solo 20/día).
const GEMINI_MODELS = splitList(process.env.GEMINI_MODEL, ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']);
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const geminiUrl = (model: string) => process.env.GEMINI_API_URL || `${GEMINI_BASE_URL}/models/${model}:generateContent`;
// One short retry covers a transient per-minute (RPM) blip. Anything longer
// just holds the HTTP request open while the minute resets anyway, and the
// provider chain below already gives real redundancy.
const GEMINI_MAX_RETRIES = 1;

const OPENROUTER_API_KEYS = splitList(process.env.OPENROUTER_API_KEY);
const OPENROUTER_MODELS = splitList(process.env.OPENROUTER_MODEL, ['google/gemini-2.0-flash-lite-preview:free']);
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Per-lane circuit breaker ────────────────────────────────────────────────
//
// When a free-tier key runs out of quota, every request used to pay the full
// failure cascade (request → 429 → sleep → retry → 429 → next provider …),
// so "the AI stops working" and every interaction also became slow. The
// breaker remembers which lane is throttled and skips it until its cooldown
// ends, so the next request reaches a healthy lane immediately (or fails fast
// with an AIQuotaError the caller can translate gracefully).

type ProviderName = 'groq' | 'gemini' | 'openrouter' | 'openai';
/** Un carril = proveedor + modelo + llave; cada uno tiene su propio cupo y su propio breaker. */
type LaneId = string;

interface ProviderState {
  consecutiveFailures: number;
  unavailableUntil: number; // epoch ms; 0 = available
  lastFailureWasQuota: boolean;
}

const providerStates = new Map<LaneId, ProviderState>();

const FAILURE_THRESHOLD = 2;
const ERROR_COOLDOWN_MS = 60_000;
const QUOTA_COOLDOWN_MS = 2 * 60_000;
// Las cuotas diarias avisan con esperas de horas: se respeta hasta 1 h para no
// gastar una llamada por mensaje en un carril que va a seguir agotado.
const MAX_COOLDOWN_MS = 60 * 60_000;
// Un modelo retirado o bloqueado para la llave no vuelve en minutos.
const MISSING_MODEL_COOLDOWN_MS = 6 * 60 * 60_000;

/** Thrown when every configured provider is (or recently was) quota-limited. */
export class AIQuotaError extends Error {
  readonly isAIQuota = true;
  constructor(message: string) {
    super(message);
    this.name = 'AIQuotaError';
  }
}

export function isAIQuotaError(error: unknown): boolean {
  return error instanceof AIQuotaError || (typeof error === 'object' && error !== null && (error as { isAIQuota?: unknown }).isAIQuota === true);
}

function looksLikeQuotaFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const m = message.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('quota') ||
    m.includes('rate limit') ||
    m.includes('rate_limit') ||
    m.includes('too many requests') ||
    m.includes('resource_exhausted') ||
    m.includes('tokens per day') ||
    m.includes('requests per day')
  );
}

/** 404 "model does not exist", modelo retirado o sin acceso para esa llave. */
function looksLikeMissingModel(error: unknown): boolean {
  const m = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    m.includes(' 404') ||
    m.includes('does not exist') ||
    m.includes('decommissioned') ||
    m.includes('model_not_found') ||
    m.includes('is not found') ||
    m.includes('not supported for generatecontent')
  );
}

/** Gemini/Groq errors often hint a retry delay ("retry in 23s", "retryDelay":"23s"). */
function retryDelayMsFrom(error: unknown): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = /retry(?:Delay)["']?:?\s*"?(\d+(?:\.\d+)?)s?/i.exec(message);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1000, MAX_COOLDOWN_MS);
}

function isProviderAvailable(name: LaneId): boolean {
  const state = providerStates.get(name);
  return !state || state.unavailableUntil <= Date.now();
}

function registerProviderSuccess(name: LaneId): void {
  providerStates.delete(name);
}

function registerProviderFailure(name: LaneId, error: unknown): void {
  const state = providerStates.get(name) ?? { consecutiveFailures: 0, unavailableUntil: 0, lastFailureWasQuota: false };
  state.consecutiveFailures += 1;
  state.lastFailureWasQuota = looksLikeQuotaFailure(error);
  if (state.lastFailureWasQuota) {
    state.unavailableUntil = Date.now() + (retryDelayMsFrom(error) ?? QUOTA_COOLDOWN_MS);
  } else if (looksLikeMissingModel(error)) {
    state.unavailableUntil = Date.now() + MISSING_MODEL_COOLDOWN_MS;
  } else if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
    state.unavailableUntil = Date.now() + ERROR_COOLDOWN_MS;
  }
  providerStates.set(name, state);
}

export function hasAIProvider(): boolean {
  return GROQ_API_KEYS.length + GEMINI_API_KEYS.length + OPENROUTER_API_KEYS.length + OPENAI_API_KEYS.length > 0;
}

// ─── Catálogo de modelos por llave ───────────────────────────────────────────
//
// Los modelos por defecto envejecen (Groq/Google los retiran) y cada llave puede
// tener modelos bloqueados. El catálogo real de la llave se consulta una vez cada
// pocas horas y sus modelos de chat se añaden detrás de los preferidos.

const CATALOG_TTL_MS = 6 * 60 * 60_000;
const CATALOG_RETRY_MS = 10 * 60_000;
const catalogs = new Map<string, { until: number; models: string[] }>();

async function cachedCatalog(cacheKey: string, load: () => Promise<string[]>): Promise<string[]> {
  const hit = catalogs.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.models;
  try {
    const models = await load();
    catalogs.set(cacheKey, { until: Date.now() + CATALOG_TTL_MS, models });
    return models;
  } catch (err) {
    console.warn('[AI_CATALOG]', cacheKey, err instanceof Error ? err.message : String(err));
    catalogs.set(cacheKey, { until: Date.now() + CATALOG_RETRY_MS, models: [] });
    return [];
  }
}

/** Primero los modelos ligeros: más rápidos y con el cupo gratuito más grande. */
const lightFirst = (a: string, b: string) => {
  const rank = (m: string) => (/instant|lite|mini|8b|scout|20b|flash/i.test(m) ? 0 : 1);
  return rank(a) - rank(b) || a.localeCompare(b);
};

function groqCatalog(key: string, i: number): Promise<string[]> {
  return cachedCatalog(`groq:${i}`, async () => {
    const res = await fetch(GROQ_MODELS_URL, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id?: string; active?: boolean }> };
    return (data.data ?? [])
      .filter((m) => m.id && m.active !== false)
      .map((m) => m.id!)
      // Solo modelos de chat: fuera audio, voz, moderación, embeddings y agentes.
      .filter((id) => !/whisper|tts|playai|orpheus|guard|embed|compound|distil|vision|audio/i.test(id))
      .sort(lightFirst);
  });
}

function geminiCatalog(key: string, i: number): Promise<string[]> {
  if (process.env.GEMINI_API_URL) return Promise.resolve([]);
  return cachedCatalog(`gemini:${i}`, async () => {
    const res = await fetch(`${GEMINI_BASE_URL}/models?pageSize=200&key=${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    return (data.models ?? [])
      .filter((m) => m.name && m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name!.replace(/^models\//, ''))
      .filter((id) => /^gemini-[\d.]+-flash/i.test(id) && !/image|tts|audio|live|thinking|exp/i.test(id))
      .sort(lightFirst);
  });
}

interface Lane {
  id: LaneId;
  provider: ProviderName;
  run: (messages: ChatMessage[], options: ChatOptions) => Promise<string>;
}

/** Orden de prioridad: Groq → Gemini → OpenRouter → OpenAI; dentro de cada uno, modelos y luego llaves. */
async function buildLanes(): Promise<Lane[]> {
  const lanes: Lane[] = [];
  const push = (provider: ProviderName, model: string, i: number, run: Lane['run']) => {
    const id = `${provider}:${model}:${i}`;
    if (!lanes.some((l) => l.id === id)) lanes.push({ id, provider, run });
  };

  const [groqExtra, geminiExtra] = await Promise.all([
    Promise.all(GROQ_API_KEYS.map((key, i) => groqCatalog(key, i))),
    Promise.all(GEMINI_API_KEYS.map((key, i) => geminiCatalog(key, i))),
  ]);

  GROQ_API_KEYS.forEach((key, i) => {
    // Si el catálogo respondió, solo se usan modelos que existen para esta llave.
    const catalog = groqExtra[i];
    const preferred = catalog.length ? GROQ_MODELS.filter((m) => catalog.includes(m)) : GROQ_MODELS;
    for (const model of [...preferred, ...catalog]) {
      push('groq', model, i, (m, o) => generateWithOpenAICompat(m, o, GROQ_API_URL, key, model));
    }
  });
  GEMINI_API_KEYS.forEach((key, i) => {
    const catalog = geminiExtra[i];
    const preferred = catalog.length ? GEMINI_MODELS.filter((m) => catalog.includes(m)) : GEMINI_MODELS;
    for (const model of [...preferred, ...catalog]) {
      push('gemini', model, i, (m, o) => generateWithGemini(m, o, geminiUrl(model), key));
    }
  });
  for (const model of OPENROUTER_MODELS) {
    OPENROUTER_API_KEYS.forEach((key, i) => push('openrouter', model, i, (m, o) => generateWithOpenAICompat(m, o, OPENROUTER_API_URL, key, model)));
  }
  for (const model of OPENAI_MODELS) {
    OPENAI_API_KEYS.forEach((key, i) => push('openai', model, i, (m, o) => generateWithOpenAICompat(m, o, OPENAI_API_URL, key, model)));
  }
  return lanes;
}

// Tope de carriles probados por petición: con catálogos grandes, un mensaje no
// debe encadenar decenas de llamadas lentas antes de responder.
const MAX_ATTEMPTS_PER_REQUEST = 6;

export async function generateText(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  if (!hasAIProvider()) {
    throw new Error('No hay ningún proveedor de IA configurado. Por favor define GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY o OPENAI_API_KEY en Vercel.');
  }

  const errors: string[] = [];
  let quotaBlocked = 0;
  let attempts = 0;

  const lanes = await buildLanes();

  for (const lane of lanes) {
    if (!isProviderAvailable(lane.id)) {
      if (providerStates.get(lane.id)?.lastFailureWasQuota) quotaBlocked += 1;
      continue;
    }
    if (attempts >= MAX_ATTEMPTS_PER_REQUEST) break;
    attempts += 1;

    try {
      const text = await lane.run(messages, options);
      registerProviderSuccess(lane.id);
      return text;
    } catch (err) {
      registerProviderFailure(lane.id, err);
      if (looksLikeQuotaFailure(err)) quotaBlocked += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI_${lane.provider.toUpperCase()}_FALLBACK]`, lane.id, msg);
      errors.push(`${lane.id}: ${msg}`);
    }
  }

  if (lanes.length > 0 && quotaBlocked === lanes.length) {
    throw new AIQuotaError(`Los proveedores de IA están en pausa por límite de uso: ${errors.join(' | ')}`);
  }
  throw new Error(`Fallaron los proveedores de IA configurados: ${errors.join(' | ') || 'todos en espera por fallos recientes'}`);
}

async function generateWithOpenAICompat(
  messages: ChatMessage[],
  options: ChatOptions,
  apiUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 300,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`AI ${response.status}: ${message}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('El proveedor de IA no devolvió texto');
  }

  return text;
}

async function generateWithGemini(messages: ChatMessage[], options: ChatOptions, apiUrl: string, apiKey: string): Promise<string> {
  const systemMessages = messages.filter((message) => message.role === 'system');
  const nonSystemMessages = messages.filter((message) => message.role !== 'system');

  const contents = nonSystemMessages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.8,
      maxOutputTokens: options.maxTokens ?? 300,
    },
  };

  // Los 2.5 Flash razonan por defecto y gastan en eso el maxOutputTokens: se apaga.
  if (/2\.5-flash/.test(apiUrl)) {
    (body.generationConfig as Record<string, unknown>).thinkingConfig = { thinkingBudget: 0 };
  }

  if (systemMessages.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemMessages.map((message) => message.content).join('\n\n') }],
    };
  }

  let response: Response | null = null;
  let data: any = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    data = await response.json().catch(() => null);
    if (response.ok) break;

    if (response.status !== 429 || attempt === GEMINI_MAX_RETRIES) {
      // Include the quota hints so the breaker can time its cooldown.
      const retryInfo = data?.error?.details?.find?.((d: { retryDelay?: string }) => d?.retryDelay);
      const message = data?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Gemini ${response.status}: ${message}${retryInfo ? ` (retryDelay:${retryInfo.retryDelay})` : ''}`);
    }

    await sleep(2000);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini no devolvió texto en candidates[0].content.parts');
  }

  return text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
