type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Groq — OpenAI-compatible, very generous free tier (14,400 req/day)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// llama-3.1-8b-instant es el default a propósito: en el nivel gratuito de Groq
// da ~14.400 req/día y 500K tokens/día, mientras llama-3.3-70b-versatile solo da
// ~1.000 req/día y 100K tokens/día (se agotaba en horas y la IA "moría" al mediodía).
// Para chat/coaching breve en español basta y sobra; el modelo grande queda
// disponible con GROQ_MODEL=llama-3.3-70b-versatile si se quiere calidad extra.
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const GEMINI_API_URL =
  process.env.GEMINI_API_URL ||
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// One short retry covers a transient per-minute (RPM) blip. Anything longer
// just holds the HTTP request open while the minute resets anyway, and the
// provider chain below already gives real redundancy.
const GEMINI_MAX_RETRIES = 1;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview:free';
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

interface ProviderState {
  consecutiveFailures: number;
  unavailableUntil: number; // epoch ms; 0 = available
  lastFailureWasQuota: boolean;
}

const providerStates = new Map<ProviderName, ProviderState>();

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

function isProviderAvailable(name: ProviderName): boolean {
  const state = providerStates.get(name);
  return !state || state.unavailableUntil <= Date.now();
}

function registerProviderSuccess(name: ProviderName): void {
  providerStates.delete(name);
}

function registerProviderFailure(name: ProviderName, error: unknown): void {
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
  return Boolean(GROQ_API_KEY || GEMINI_API_KEY || OPENROUTER_API_KEY || OPENAI_API_KEY);
}

export async function generateText(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const errors: string[] = [];
  let quotaBlocked = 0;
  let configured = 0;

  const attempts: Array<{ name: ProviderName; apiKey?: string; run: () => Promise<string> }> = [
    // 1. Prioritize GROQ (100% Free: 14,400 requests/day)
    { name: 'groq', apiKey: GROQ_API_KEY, run: () => generateWithOpenAICompat(messages, options, GROQ_API_URL, GROQ_API_KEY!, GROQ_MODEL) },
    // 2. Fallback to Gemini API Studio (100% Free: 1,500 requests/day)
    { name: 'gemini', apiKey: GEMINI_API_KEY, run: () => generateWithGemini(messages, options) },
    // 3. Fallback to OpenRouter (Free models)
    { name: 'openrouter', apiKey: OPENROUTER_API_KEY, run: () => generateWithOpenAICompat(messages, options, OPENROUTER_API_URL, OPENROUTER_API_KEY!, OPENROUTER_MODEL) },
    // 4. Fallback to OpenAI
    { name: 'openai', apiKey: OPENAI_API_KEY, run: () => generateWithOpenAICompat(messages, options, OPENAI_API_URL, OPENAI_API_KEY!, OPENAI_MODEL) },
  ];

  for (const attempt of attempts) {
    if (!attempt.apiKey) continue;
    configured += 1;

    if (!isProviderAvailable(attempt.name)) {
      if (providerStates.get(attempt.name)?.lastFailureWasQuota) quotaBlocked += 1;
      errors.push(`${attempt.name}: en espera por fallo reciente (circuit breaker abierto)`);
      continue;
    }

    try {
      const text = await attempt.run();
      registerProviderSuccess(attempt.name);
      return text;
    } catch (err) {
      registerProviderFailure(attempt.name, err);
      if (looksLikeQuotaFailure(err)) quotaBlocked += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI_${attempt.name.toUpperCase()}_FALLBACK]`, msg);
      errors.push(`${attempt.name}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    if (configured > 0 && quotaBlocked === configured) {
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

async function generateWithGemini(messages: ChatMessage[], options: ChatOptions): Promise<string> {
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
    response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
