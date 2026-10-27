import { generateText, hasAIProvider, AIQuotaError, type ChatMessage } from '../lib/ai';
import { prisma } from '../lib/prisma';
import { canUseAI } from './billing.service';
import { buildLifeSnapshot, packSections, CONTEXT_BUDGET_CHARS, type SectionKey } from './life-context.service';

const SAGE_RATE_LIMIT = 1000;

// El CHAT del Sabio (mensajes y botones de acción del panel) es lo único que
// tiene tope: cuesta una llamada a la IA por mensaje y es lo que más se puede
// disparar. El resto de la IA (comida, dashboard, pergaminos, metas, consejo del
// día...) NO pasa por este contador y sigue funcionando aunque el chat descanse.
//
// El tope por persona es DINÁMICO: el presupuesto diario del chat se reparte
// entre la gente que usa la app y el Sabio hoy. Pocos usuarios = tope alto;
// muchos = tope menor, sin que el chat se coma la IA de las demás zonas.

/** Mensajes de chat al día para TODOS los usuarios juntos (la parte de la cuota IA reservada al Sabio). */
const SAGE_DAILY_CHAT_BUDGET = Number(process.env.SAGE_DAILY_CHAT_BUDGET || process.env.SAGE_GLOBAL_CHAT_LIMIT || 3000);
/** Tope por persona cuando hay poca gente (máximo) y cuando hay muchísima (mínimo). */
export const SAGE_DAILY_AI_LIMIT = Number(process.env.SAGE_DAILY_AI_LIMIT || 60);
const SAGE_MIN_DAILY_LIMIT = Number(process.env.SAGE_MIN_DAILY_LIMIT || 5);
// De la gente que abre la app, cuántos se espera que charlen con el Sabio.
const SAGE_CHAT_SHARE = 0.5;
const PULSE_TTL_MS = 60_000;

interface SagePulse {
  day: string;
  at: number;
  /** Mensajes de chat ya gastados hoy entre todos. */
  used: number;
  /** Personas activas hoy (app o Sabio). */
  activeUsers: number;
  /** Tope por persona para hoy. */
  cap: number;
}

let pulse: SagePulse | null = null;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Reparte el presupuesto: un número redondo (múltiplo de 5) entre el mínimo y el máximo. */
function capFor(activeUsers: number, sageUsers: number): number {
  const expected = Math.max(1, sageUsers + 1, Math.ceil(activeUsers * SAGE_CHAT_SHARE));
  const raw = Math.floor(SAGE_DAILY_CHAT_BUDGET / expected / 5) * 5;
  return Math.max(SAGE_MIN_DAILY_LIMIT, Math.min(SAGE_DAILY_AI_LIMIT, SAGE_RATE_LIMIT, raw));
}

/**
 * Estado del Sabio hoy (cacheado 1 min): cuánto chat se gastó, cuánta gente
 * hay activa y el tope por persona que resulta. Va a la base de datos, así que
 * todas las instancias del API ven lo mismo.
 */
async function sagePulse(): Promise<SagePulse> {
  const day = new Date().toDateString();
  if (pulse && pulse.day === day && Date.now() - pulse.at < PULSE_TTL_MS) return pulse;
  const today = startOfToday();
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const [spent, sageUsers, activeUsers] = await Promise.all([
    prisma.user.aggregate({ where: { sageCallsResetAt: { gte: today } }, _sum: { sageCallsToday: true } }),
    prisma.user.count({ where: { sageCallsResetAt: { gte: today }, sageCallsToday: { gt: 0 } } }),
    prisma.user.count({ where: { OR: [{ lastSeenAt: { gte: since } }, { lastLoginAt: { gte: since } }, { sageCallsResetAt: { gte: today } }] } }),
  ]);
  pulse = { day, at: Date.now(), used: spent._sum.sageCallsToday ?? 0, activeUsers, cap: capFor(activeUsers, sageUsers) };
  return pulse;
}

// Respuesta amable cuando TODO proveedor IA está sin cuota. Se devuelve como
// texto normal (HTTP 200): el usuario recibe una respuesta del Sabio digna,
// no un error rojo roto.
export const SAGE_QUOTA_REPLY =
  'Aghh… he consultado demasiado a los espíritus por hoy y mis pergaminos necesitan descansar. ' +
  'Vuelve mañana y recuperaré mi magia. Mientras tanto, puedes seguir registrando tus hábitos, ' +
  'misiones y finanzas: todo eso funciona sin conjuros y seguirá guardándose con normalidad.';

interface SageDailyUsage {
  /** Respuestas IA consumidas hoy (contador sageCallsToday del usuario). */
  count: number;
  /** Medianoche local: momento en que se reinicia el cupo. */
  nextReset: Date;
}

function nextMidnight(): Date {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow;
}

/** ¿Cuántas respuestas IA lleva el usuario hoy y cuándo se reinicia su cupo? */
export async function getSageDailyUsage(userId: string): Promise<SageDailyUsage> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { sageCallsToday: true, sageCallsResetAt: true },
  });
  const now = new Date();
  const resetBase = new Date(user.sageCallsResetAt);
  const sameDay =
    now.getFullYear() === resetBase.getFullYear() &&
    now.getMonth() === resetBase.getMonth() &&
    now.getDate() === resetBase.getDate();
  return { count: sameDay ? user.sageCallsToday : 0, nextReset: nextMidnight() };
}

/** Tope diario por usuario para hoy, según cuánta gente usa la app y el Sabio. */
export async function sageDailyCap(): Promise<number> {
  return (await sagePulse()).cap;
}

/**
 * Consume una respuesta IA del día. Devuelve el uso actualizado, o null si el
 * usuario ya llegó a su tope diario (y entonces NO se consume contador).
 *
 * Cada paso es un UPDATE condicional de una sola fila: dos mensajes a la vez
 * no pueden leer «queda 1» y pasar los dos (antes se leía y luego se sumaba).
 */
export async function consumeSageDailyAI(userId: string): Promise<SageDailyUsage | null> {
  const cap = Math.min(await sageDailyCap(), SAGE_RATE_LIMIT);
  const today = startOfToday();
  const sameDay = () => prisma.user.updateMany({
    where: { id: userId, sageCallsResetAt: { gte: today }, sageCallsToday: { lt: cap } },
    data: { sageCallsToday: { increment: 1 } },
  });
  if ((await sameDay()).count === 0) {
    // Primer mensaje del día: el contador vuelve a 1. Si otra petición ya lo
    // reinició en paralelo, se intenta sumar otra vez (respetando el tope).
    const fresh = await prisma.user.updateMany({
      where: { id: userId, sageCallsResetAt: { lt: today } },
      data: { sageCallsToday: 1, sageCallsResetAt: new Date() },
    });
    if (fresh.count === 0 && (await sameDay()).count === 0) return null;
  }
  return getSageDailyUsage(userId);
}

// Respuesta del Sabio cuando su cupo de chat del día se agotó: en personaje y
// con HTTP 200, sin error rojo. Aclara que el resto de la app sigue igual.
export const SAGE_TIRED_REPLY =
  'Hoy hemos conversado mucho y necesito reposar los ojos. Vuelve mañana y seguimos. ' +
  'Mientras tanto, tus hábitos, misiones, comidas y todo lo demás siguen funcionando como siempre.';

// Respuesta cuando la IA falla por otra razón (modelo retirado, red...): en
// personaje, nunca el error técnico de los proveedores.
export const SAGE_ERROR_REPLY =
  'Mis pergaminos se enredaron un momento y no pude escucharte bien. Prueba otra vez en unos minutos.';

/** Devuelve el cupo del chat cuando la IA no llegó a responder: ese mensaje no cuenta. */
async function refundChatSlot(userId: string): Promise<void> {
  if (pulse && pulse.used > 0) pulse.used -= 1;
  await prisma.user.updateMany({
    where: { id: userId, sageCallsToday: { gt: 0 } },
    data: { sageCallsToday: { decrement: 1 } },
  }).catch(() => null);
}

/** Ejecuta una respuesta del chat; si la IA no respondió, devuelve el cupo. */
async function chatTurn(userId: string, run: () => Promise<string>): Promise<string> {
  const reply = await run();
  if (reply === SAGE_ERROR_REPLY || reply === SAGE_QUOTA_REPLY) await refundChatSlot(userId);
  return reply;
}

/** Cupo del chat: por persona y global. null = el Sabio descansa. */
async function takeChatSlot(userId: string): Promise<SageDailyUsage | null> {
  const p = await sagePulse();
  // Presupuesto del día agotado entre todos: el Sabio descansa, el resto de la IA sigue.
  if (p.used >= SAGE_DAILY_CHAT_BUDGET) return null;
  const usage = await consumeSageDailyAI(userId);
  if (!usage) return null;
  p.used += 1;
  return usage;
}

async function callAI(prompt: string): Promise<string> {
  if (!hasAIProvider()) {
    throw new Error('API Key no configurada (GROQ_API_KEY / GEMINI_API_KEY / etc.)');
  }

  try {
    return await generateText([{ role: 'user', content: prompt }], {
      temperature: 0.8,
      maxTokens: 600,
    });
  } catch (err) {
    // Cuota agotada en TODOS los proveedores: respuesta digna, nunca 5xx.
    if (err instanceof AIQuotaError) return SAGE_QUOTA_REPLY;
    console.error('[Sage] AI error:', err instanceof Error ? err.message : err);
    return SAGE_ERROR_REPLY;
  }
}

// ─── Presupuesto de tokens del chat ─────────────────────────────────────────
// El contexto de vida va acotado (packSections); el historial también: solo
// los últimos mensajes, recortados, para que una charla larga no multiplique
// el costo de cada respuesta.
const HISTORY_MESSAGES = 6;
const HISTORY_MESSAGE_CHARS = 480;
const HISTORY_TOTAL_CHARS = 2000;
/** Un mensaje del usuario más largo se recorta (pegar un libro no debe vaciar la cuota). */
export const SAGE_MESSAGE_MAX_CHARS = 1500;

const clipText = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Historial que se reenvía al modelo: los más recientes primero hasta llenar el
 * presupuesto, luego en orden cronológico. Empieza por un mensaje del usuario y
 * termina en una respuesta (Gemini exige turnos alternos; el mensaje nuevo va después).
 */
export function trimHistory(memories: Array<{ role: string; content: string }>): ChatMessage[] {
  const picked: ChatMessage[] = [];
  let used = 0;
  for (const memory of memories.slice(0, HISTORY_MESSAGES)) {
    const content = clipText(memory.content, HISTORY_MESSAGE_CHARS);
    if (used + content.length > HISTORY_TOTAL_CHARS) break;
    used += content.length;
    picked.unshift({ role: memory.role === 'user' ? 'user' : 'assistant', content });
  }
  while (picked[0]?.role === 'assistant') picked.shift();
  while (picked.at(-1)?.role === 'user') picked.pop();
  return picked;
}

async function callAIWithMemory(
  userId: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (!hasAIProvider()) {
    throw new Error('No hay proveedor de IA configurado en .env');
  }

  const [memories, insights] = await Promise.all([
    prisma.sageMemory.findMany({
      where: { userId },
      // Cada par pregunta/respuesta se guarda en el mismo instante: el id (cuid, creciente) desempata.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_MESSAGES,
      select: { role: true, content: true },
    }),
    prisma.sageInsight.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { insight: true },
    }),
  ]);

  const insightContext = insights.length > 0
    ? `\nPATRONES QUE YA OBSERVASTE:\n${insights.map((insight) => `- ${clipText(insight.insight, 160)}`).join('\n')}`
    : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt + insightContext },
    ...trimHistory(memories),
    { role: 'user', content: userMessage },
  ];

  let responseText: string;
  try {
    responseText = await generateText(messages, {
      temperature: 0.8,
      maxTokens: 600,
    });
  } catch (err) {
    // Cuota agotada en todos los proveedores: respuesta digna y no quemamos cuota
    // guardando memoria de mensajes que realmente no se procesaron.
    if (err instanceof AIQuotaError) return SAGE_QUOTA_REPLY;
    console.error('[Sage] AI error:', err instanceof Error ? err.message : err);
    return SAGE_ERROR_REPLY;
  }

  // Si la cuota diaria del USUARIO está agotada, la respuesta fija no se
  // guarda como recuerdo (no es contenido real de la conversación).
  if (responseText === SAGE_QUOTA_REPLY) return responseText;

  await prisma.sageMemory.createMany({
    data: [
      { userId, role: 'user', content: userMessage },
      { userId, role: 'sage', content: responseText },
    ],
  });

  const totalMemories = await prisma.sageMemory.count({ where: { userId } });
  if (totalMemories % 10 === 0) {
    extractInsights(userId, responseText).catch(() => null);
  }

  return responseText;
}

async function extractInsights(userId: string, lastResponse: string): Promise<void> {
  if (!hasAIProvider()) return;

  const insightPrompt = `Basandote en esta respuesta que acabas de dar como asistente personal, extrae 1 insight sobre el usuario en formato JSON estricto.
Responde SOLO con el JSON sin markdown ni texto extra:
{"insight": "descripcion breve del patron observado", "category": "pattern"}

Tu respuesta anterior fue: ${lastResponse.slice(0, 300)}`;

  try {
    const result = await callAI(insightPrompt);
    const parsed = JSON.parse(result.trim()) as { insight: string; category: string };
    await prisma.sageInsight.create({
      data: { userId, insight: parsed.insight, category: parsed.category },
    });
  } catch {
    // Non-blocking.
  }
}

export type SageLang = 'es' | 'en';

/** Respuestas fijas del Sabio en inglés: el texto español se conserva para comparar (chatTurn, cachés) y se traduce al salir. */
const SAGE_REPLIES_EN: Record<string, string> = {
  [SAGE_QUOTA_REPLY]: "Aghh… I've consulted the spirits too much today and my scrolls need a rest. Come back tomorrow and my magic will be restored. In the meantime, you can keep logging your habits, quests and finances: all of that works without spells and keeps saving as usual.",
  [SAGE_TIRED_REPLY]: "We've talked a lot today and I need to rest my eyes. Come back tomorrow and we'll pick up where we left off. In the meantime, your habits, quests, meals and everything else keep working as always.",
  [SAGE_ERROR_REPLY]: "My scrolls got tangled for a moment and I couldn't hear you well. Try again in a few minutes.",
  'Sigue con tu racha — cada día cuenta.': 'Keep your streak going — every day counts.',
  'Tu resumen diario con IA es de NoutLife Pro.': 'Your AI daily summary is a NoutLife Pro feature.',
};

/** Texto de salida en el idioma pedido: las respuestas fijas se traducen; la respuesta de la IA pasa tal cual. */
export function localizeSageReply(text: string, lang: SageLang): string {
  return lang === 'en' ? (SAGE_REPLIES_EN[text] ?? text) : text;
}

/** Textos del Sabio por idioma: el encuadre del prompt y la instrucción de cada acción. */
const INSTRUCTIONS: Record<SageLang, {
  system: (name: string, dateLabel: string, data: string) => string;
  questsIntro: string;
  habits: string;
  finances: string;
  workout: string;
  tip: string;
  summary: (name: string) => string;
}> = {
  es: {
    system: (name, dateLabel, data) => `Eres el Sabio, el mentor de ${name} en NoutLife (su vida convertida en un juego de rol).
Habla en español natural, cercano y práctico; nada de tono de fantasía salvo que te lo pidan.
Máximo 3 párrafos cortos, sin listas largas ni relleno.
Usa solo los datos de abajo y nunca los inventes; si falta un dato, dilo.
Ves todas sus zonas: conéctalas cuando ayude (sueño y entreno, comida y energía, ocio y ánimo, gasto y metas).
Sé proactivo: si notas un patrón importante, menciónalo con tacto y propone un solo paso pequeño y concreto.

DATOS DE ${name.toUpperCase()} (${dateLabel}):
${data}`,
    questsIntro: 'Sugiere exactamente 3 misiones nuevas y especificas para esta semana.\nUna MAIN quest, una SIDE quest y una DAILY.\nResponde SOLO con este JSON sin markdown ni texto extra:',
    habits: 'Analiza los habitos del heroe. En 3 parrafos: cual tiene mas riesgo de romperse esta semana y por que, cual esta mas consolidado, y que habito nuevo recomendarias agregar dado sus metas actuales.',
    finances: 'Analiza las finanzas del heroe este mes. En 3 parrafos concretos: en que categoria gasta mas de lo optimo, cuanto podria ahorrar mensualmente si ajusta eso, y cuando alcanzaria su meta de ahorro mas cercana.',
    workout: 'Basandote en su historial del Coliseo, su sueño y su nutrición, sugiere el proximo entrenamiento ideal (puede ser fuerza, cardio, caminata o deporte): que trabajar, 4-5 ejercicios o bloques con series, reps o tiempo, y justifica brevemente la eleccion considerando su recuperacion.',
    tip: 'Da UNA sola frase de consejo o motivación para hoy, basada en el estado actual del usuario. Máximo 15 palabras. Sin saludos, sin introducciones. Solo la frase, directa y útil.',
    summary: (name) => `Es el inicio del dia de ${name}. En 2 parrafos: resume que logro ayer y que deberia priorizar hoy segun sus misiones activas, habitos con riesgo de romperse y estado financiero.`,
  },
  en: {
    system: (name, dateLabel, data) => `You are the Sage, the mentor of ${name} in NoutLife (their life turned into a role-playing game).
Reply in English: natural, friendly and practical; no fantasy tone unless they ask for it.
Maximum 3 short paragraphs, no long lists or filler.
Use only the data below and never invent it; if a piece of data is missing, say so.
You see all their zones: connect them when it helps (sleep and training, food and energy, leisure and mood, spending and goals).
Be proactive: if you notice an important pattern, mention it tactfully and suggest one small, concrete step.
The data below is written in Spanish. Read it, but always answer in English.

DATA OF ${name.toUpperCase()} (${dateLabel}):
${data}`,
    questsIntro: 'Suggest exactly 3 new, specific quests for this week.\nOne MAIN quest, one SIDE quest and one DAILY.\nRespond ONLY with this JSON, no markdown and no extra text. Write "title" and "description" in English:',
    habits: "Analyze the hero's habits. In 3 paragraphs: which one is most at risk of breaking this week and why, which one is the most consolidated, and which new habit you would recommend adding given their current goals.",
    finances: "Analyze the hero's finances this month. In 3 concrete paragraphs: in which category they spend more than is optimal, how much they could save each month if they adjust it, and when they would reach their nearest savings goal.",
    workout: "Based on their Coliseum history, their sleep and their nutrition, suggest the ideal next workout (strength, cardio, a walk or a sport): what to work on, 4-5 exercises or blocks with sets, reps or time, and briefly justify the choice considering their recovery.",
    tip: 'Give ONE single sentence of advice or motivation for today, based on the current state of the user. Maximum 15 words. No greetings, no introductions. Just the sentence, direct and useful.',
    summary: (name) => `It is the start of the day for ${name}. In 2 paragraphs: summarize what they achieved yesterday and what they should prioritize today, based on their active quests, the habits at risk of breaking and their financial status.`,
  },
};

interface ContextOptions {
  /** Sección que el análisis necesita entera (hábitos, finanzas, Coliseo…). */
  focus?: SectionKey;
  /** Presupuesto del bloque de datos, en caracteres. */
  budget?: number;
  /** Idioma de las instrucciones y de la respuesta. */
  lang?: SageLang;
}

/**
 * Prompt de sistema del Sabio: instrucciones breves + los datos de TODAS las
 * zonas (life-context.service), dentro de un presupuesto fijo de caracteres.
 */
async function buildSageContext(userId: string, options: ContextOptions = {}): Promise<string> {
  const snapshot = await buildLifeSnapshot(userId, options.focus);
  const data = packSections(snapshot.sections, options.budget ?? CONTEXT_BUDGET_CHARS);
  const lang = options.lang ?? 'es';
  return INSTRUCTIONS[lang].system(snapshot.name, snapshot.dateLabel, data);
}

export async function sageChat(userId: string, message: string, lang: SageLang = 'es'): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const text = clipText(message, SAGE_MESSAGE_MAX_CHARS);
  return chatTurn(userId, async () => callAIWithMemory(userId, await buildSageContext(userId, { lang }), text));
}

export async function sageSuggestQuests(userId: string, lang: SageLang = 'es'): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId, { lang });
  const fullPrompt = `${context}

${INSTRUCTIONS[lang].questsIntro}
[
  {"type":"MAIN","title":"...","description":"...","difficulty":"HARD","category":"FITNESS","xpReward":200,"goldReward":50},
  {"type":"SIDE","title":"...","description":"...","difficulty":"NORMAL","category":"FINANCE","xpReward":80,"goldReward":20},
  {"type":"DAILY","title":"...","description":"...","difficulty":"EASY","category":"HEALTH","xpReward":20,"goldReward":5}
]`;

  return chatTurn(userId, () => callAI(fullPrompt.trim()));
}

export async function sageAnalyzeHabits(userId: string, lang: SageLang = 'es'): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId, { focus: 'habits', lang });
  return chatTurn(userId, () => callAI(`${context}\n\n${INSTRUCTIONS[lang].habits}`));
}

export async function sageAnalyzeFinances(userId: string, lang: SageLang = 'es'): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId, { focus: 'finances', lang });
  return chatTurn(userId, () => callAI(`${context}\n\n${INSTRUCTIONS[lang].finances}`));
}

export async function sagePlanWorkout(userId: string, lang: SageLang = 'es'): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId, { focus: 'coliseo', lang });
  return chatTurn(userId, () => callAI(`${context}\n\n${INSTRUCTIONS[lang].workout}`));
}

// Cache del consejo diario en memoria de proceso: la llaman el scheduler (un
// disparo diario por usuario) y el frontend (cada vez que abres la app). Con la
// cache, la IA solo se consulta UNA vez al dia por usuario, como mucho.
const dailyTipCache = new Map<string, { date: string; tip: string }>();

const DAILY_TIP_FALLBACK = 'Sigue con tu racha — cada día cuenta.';

export async function sageDailyTip(userId: string, lang: SageLang = 'es'): Promise<string> {
  const cacheKey = `${userId}:${lang}`;
  const today = new Date().toISOString().slice(0, 10);
  const hit = dailyTipCache.get(cacheKey);
  if (hit?.date === today) return hit.tip;
  if (!(await canUseAI(userId))) return localizeSageReply(DAILY_TIP_FALLBACK, lang); // NoutLife Lite: sin IA

  const context = await buildSageContext(userId, { budget: 1200, lang });
  const tip = await callAI(`${context}\n\n${INSTRUCTIONS[lang].tip}`);
  // No cachear la respuesta de cuota agotada ni el fallback: mañana podría
  // haber cuota de nuevo y queremos reintentar la llamada a la IA.
  if (tip === SAGE_QUOTA_REPLY || tip === SAGE_ERROR_REPLY) return localizeSageReply(DAILY_TIP_FALLBACK, lang);
  if (tip !== DAILY_TIP_FALLBACK) {
    dailyTipCache.set(cacheKey, { date: today, tip });
  }
  return tip;
}

const dailySummaryCache = new Map<string, { date: string; text: string }>();

export async function sageDailySummary(userId: string, lang: SageLang = 'es'): Promise<string> {
  const cacheKey = `${userId}:${lang}`;
  const today = new Date().toISOString().slice(0, 10);
  const hit = dailySummaryCache.get(cacheKey);
  if (hit?.date === today) return hit.text;
  if (!(await canUseAI(userId))) return localizeSageReply('Tu resumen diario con IA es de NoutLife Pro.', lang); // Lite: sin IA

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true },
  });

  const context = await buildSageContext(userId, { budget: 2000, lang });
  const text = await callAI(`${context}\n\n${INSTRUCTIONS[lang].summary(user.displayName)}`);
  if (text !== SAGE_QUOTA_REPLY && text !== SAGE_ERROR_REPLY) dailySummaryCache.set(cacheKey, { date: today, text });
  return text;
}

// Información de cupo para el frontend: cuántas respuestas IA lleva el usuario
// hoy, el tope diario (la repartición real del nivel gratuito, no solo el
// anti-spam), cuántas quedan y cuándo se reinicia.
export async function getSageRateInfo(
  userId: string
): Promise<{ callsToday: number; limit: number; remaining: number; resetAt: string; activeUsers: number }> {
  const [usage, p] = await Promise.all([getSageDailyUsage(userId), sagePulse()]);
  const limit = p.cap;
  // Si el presupuesto común se acabó, a nadie le quedan consultas hoy.
  const remaining = p.used >= SAGE_DAILY_CHAT_BUDGET ? 0 : Math.max(0, limit - usage.count);
  return {
    callsToday: usage.count,
    limit,
    activeUsers: p.activeUsers,
    remaining,
    resetAt: usage.nextReset.toISOString(),
  };
}
