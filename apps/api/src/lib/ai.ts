function splitList(value: string | undefined, fallback: string[] = []): string[] {
  const items = (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  return items.length ? items : fallback;
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

// Groq — OpenAI-compatible, very generous free tier (14,400 req/day)
// Varias llaves (GROQ_API_KEY=k1,k2) multiplican el cupo diario: cada llave es de
// una organización distinta y tiene su propio límite.
const GROQ_API_KEYS = splitList(process.env.GROQ_API_KEY);
// llama-3.1-8b-instant es el default a propósito: en el nivel gratuito de Groq
// da ~14.400 req/día y 500K tokens/día, mientras llama-3.3-70b-versatile solo da
// ~1.000 req/día y 100K tokens/día (se agotaba en horas y la IA "moría" al mediodía).
// Para chat/coaching breve en español basta y sobra; el modelo grande queda
// disponible con GROQ_MODEL=llama-3.3-70b-versatile si se quiere calidad extra.
// Cada modelo tiene su propio cupo diario: si el principal se agota, el Sabio
// sigue con el siguiente en vez de callarse. GROQ_MODEL admite una lista separada por comas.
const GROQ_MODELS = splitList(process.env.GROQ_MODEL, ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']);
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GEMINI_API_KEYS = splitList(process.env.GEMINI_API_KEY);
const GEMINI_MODELS = splitList(process.env.GEMINI_MODEL, ['gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']);
const geminiUrl = (model: string) =>
  process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// One short retry covers a transient per-minute (RPM) blip. Anything longer
// just holds the HTTP request open while the minute resets anyway, and the
// provider chain below already gives real redundancy.
const GEMINI_MAX_RETRIES = 1;

const OPENROUTER_API_KEYS = splitList(process.env.OPENROUTER_API_KEY);
const OPENROUTER_MODELS = splitList(process.env.OPENROUTER_MODEL, ['google/gemini-2.0-flash-lite-preview:free']);
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ─── Per-provider circuit breaker ────────────────────────────────────────────
//
// When a free-tier key runs out of quota, every request used to pay the full
// failure cascade (request → 429 → sleep → retry → 429 → next provider …),
// so "the AI stops working" and every interaction also became slow. The
// breaker remembers which provider is throttled and skips it until its
// cooldown ends, so the next request reaches a healthy provider immediately
// (or fails fast with an AIQuotaError the caller can translate gracefully).

type ProviderName = 'groq' | 'gemini' | 'openrouter' | 'openai';
/** Un carril = proveedor + llave + modelo; cada uno tiene su propio cupo y su propio breaker. */
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
const MAX_COOLDOWN_MS = 10 * 60_000;

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
  } else if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
    state.unavailableUntil = Date.now() + ERROR_COOLDOWN_MS;
  }
  providerStates.set(name, state);
}

export function hasAIProvider(): boolean {
  return buildLanes().length > 0;
}

interface Lane {
  id: LaneId;
  provider: ProviderName;
  run: (messages: ChatMessage[], options: ChatOptions) => Promise<string>;
}

/** Orden de prioridad: Groq → Gemini → OpenRouter → OpenAI; dentro de cada uno, modelos y luego llaves. */
function buildLanes(): Lane[] {
  const lanes: Lane[] = [];
  const compat = (provider: ProviderName, url: string, keys: string[], models: string[]) => {
    for (const model of models) {
      keys.forEach((key, i) => {
        lanes.push({
          id: `${provider}:${model}:${i}`,
          provider,
          run: (m, o) => generateWithOpenAICompat(m, o, url, key, model),
        });
      });
    }
  };
  compat('groq', GROQ_API_URL, GROQ_API_KEYS, GROQ_MODELS);
  for (const model of GEMINI_MODELS) {
    GEMINI_API_KEYS.forEach((key, i) => {
      lanes.push({ id: `gemini:${model}:${i}`, provider: 'gemini', run: (m, o) => generateWithGemini(m, o, geminiUrl(model), key) });
    });
  }
  compat('openrouter', OPENROUTER_API_URL, OPENROUTER_API_KEYS, OPENROUTER_MODELS);
  compat('openai', OPENAI_API_URL, OPENAI_API_KEYS, OPENAI_MODELS);
  return lanes;
}

export async function generateText(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const errors: string[] = [];
  let quotaBlocked = 0;

  const lanes = buildLanes();

  for (const lane of lanes) {
    if (!isProviderAvailable(lane.id)) {
      if (providerStates.get(lane.id)?.lastFailureWasQuota) quotaBlocked += 1;
      errors.push(`${lane.id}: en espera por fallo reciente (circuit breaker abierto)`);
      continue;
    }

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

  if (errors.length > 0) {
    if (lanes.length > 0 && quotaBlocked === lanes.length) {
      throw new AIQuotaError(`Los proveedores de IA están en pausa por límite de uso: ${errors.join(' | ')}`);
    }
    throw new Error(`Fallaron los proveedores de IA configurados: ${errors.join(' | ')}`);
  }

  throw new Error('No hay ningún proveedor de IA configurado. Por favor define GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY o OPENAI_API_KEY en Vercel.');
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
