import { generateText, hasAIProvider, AIQuotaError } from '../lib/ai';
import { prisma } from '../lib/prisma';

const SAGE_RATE_LIMIT = 1000;

// El CHAT del Sabio (mensajes y botones de acción del panel) es lo único que
// tiene tope: cuesta una llamada a la IA por mensaje y es lo que más se puede
// disparar. El resto de la IA (comida, dashboard, pergaminos, metas, consejo del
// día...) NO pasa por este contador y sigue funcionando aunque el chat descanse.
// El tope por persona deja margen para que varios usuarios nunca lleguen a él en
// un día normal; SAGE_DAILY_AI_LIMIT lo sobreescribe.
export const SAGE_DAILY_AI_LIMIT = Number(process.env.SAGE_DAILY_AI_LIMIT || 30);

// Presupuesto global del chat por día (de este proceso): evita que muchos
// usuarios charlando agoten las llaves y se lleven por delante las demás zonas.
// Al llegar, el Sabio "descansa" para todos hasta medianoche.
const SAGE_GLOBAL_CHAT_LIMIT = Number(process.env.SAGE_GLOBAL_CHAT_LIMIT || 4000);
let globalChat = { day: '', count: 0 };
function takeGlobalChatSlot(): boolean {
  const day = new Date().toDateString();
  if (globalChat.day !== day) globalChat = { day, count: 0 };
  if (globalChat.count >= SAGE_GLOBAL_CHAT_LIMIT) return false;
  globalChat.count += 1;
  return true;
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

/** Tope diario por usuario: el menor entre el configurado y el anti-spam del día. */
export function sageDailyCap(): number {
  return Math.min(SAGE_DAILY_AI_LIMIT, SAGE_RATE_LIMIT);
}

/**
 * Consume una respuesta IA del día. Devuelve el uso actualizado, o null si el
 * usuario ya llegó a su tope diario (y entonces NO se consume contador).
 */
export async function consumeSageDailyAI(userId: string): Promise<SageDailyUsage | null> {
  const usage = await getSageDailyUsage(userId);
  if (usage.count >= sageDailyCap()) return null;
  const allowed = await checkAndIncrementRateLimit(userId); // contador diario anti-spam
  if (!allowed) return null;
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
  if (globalChat.count > 0) globalChat.count -= 1;
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
  const usage = await consumeSageDailyAI(userId);
  if (!usage) return null;
  if (!takeGlobalChatSlot()) return null;
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
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.sageInsight.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const conversationHistory = memories.reverse().map((memory) => ({
    role: memory.role === 'user' ? 'user' : 'assistant',
    content: memory.content,
  })) as Array<{ role: 'user' | 'assistant'; content: string }>;

  const insightContext = insights.length > 0
    ? `\n\nPATRONES QUE HAS OBSERVADO DE MIGUEL:\n${insights.map((insight) => `- ${insight.insight}`).join('\n')}`
    : '';

  const fullSystemPrompt = systemPrompt + insightContext;
  const messages = [
    { role: 'system' as const, content: fullSystemPrompt },
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
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

async function checkAndIncrementRateLimit(userId: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { sageCallsToday: true, sageCallsResetAt: true },
  });

  const now = new Date();
  const resetAt = new Date(user.sageCallsResetAt);
  const isNewDay =
    now.getFullYear() !== resetAt.getFullYear() ||
    now.getMonth() !== resetAt.getMonth() ||
    now.getDate() !== resetAt.getDate();

  if (isNewDay) {
    await prisma.user.update({
      where: { id: userId },
      data: { sageCallsToday: 1, sageCallsResetAt: now },
    });
    return true;
  }

  if (user.sageCallsToday >= SAGE_RATE_LIMIT) return false;

  await prisma.user.update({
    where: { id: userId },
    data: { sageCallsToday: { increment: 1 } },
  });
  return true;
}

async function buildSageContext(userId: string): Promise<string> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [user, activeQuests, habits, monthTx, workouts, sleepLogs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        displayName: true,
        level: true,
        xp: true,
        xpToNextLevel: true,
        gold: true,
        hp: true,
        maxHp: true,
        currentStreak: true,
        strength: true,
        intelligence: true,
        charisma: true,
      },
    }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { deadline: 'asc' },
      take: 8,
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      select: { title: true, currentStreak: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfMonth } },
      select: { type: true, amount: true },
    }),
    prisma.workout.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      select: { date: true },
    }),
    prisma.sleepLog.findMany({
      where: { userId, isNap: false, date: { gte: sevenDaysAgo } },
      select: { duration: true },
    }),
  ]);

  let monthIncome = 0;
  let monthExpenses = 0;
  for (const transaction of monthTx) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'INCOME') monthIncome += amount;
    else monthExpenses += amount;
  }

  const avgSleep =
    sleepLogs.length > 0
      ? sleepLogs.reduce((sum, log) => sum + log.duration, 0) / sleepLogs.length
      : 0;

  const lastWorkout = workouts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
  const daysSinceLast = lastWorkout
    ? Math.floor((now.getTime() - new Date(lastWorkout.date).getTime()) / 86400000)
    : 99;

  const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);

  return `
Eres el asistente personal de ${user.displayName} dentro de LifeQuest.
Hablas en espanol con un tono natural, claro, cercano y motivador.
Tu estilo debe sentirse humano y practico, no como personaje de fantasia.
Evita hablar como sabio, heroe, reino, castillo o con frases demasiado teatrales, salvo que el usuario te lo pida.
Adapta tu forma de responder al estilo del usuario: conversacional, simple, directa y con buena energia.
Eres conciso: maximo 3 parrafos por respuesta. Nunca listas largas ni relleno.
Prioriza claridad, utilidad y recomendaciones concretas.

ESTADO ACTUAL DEL HEROE:
- Nivel: ${user.level} | XP: ${user.xp}/${user.xpToNextLevel} | Racha: ${user.currentStreak} dias
- HP: ${user.hp}/${user.maxHp} | Gold: ${user.gold}
- Stats: STR ${user.strength} | INT ${user.intelligence} | CHA ${user.charisma}

MISIONES ACTIVAS (${activeQuests.length}):
${activeQuests.length > 0
  ? activeQuests.map((quest) => `- [${quest.type}][${quest.difficulty}] ${quest.title} - vence: ${quest.deadline ? new Date(quest.deadline).toLocaleDateString('es-CO') : 'sin limite'}`).join('\n')
  : '- Sin misiones activas aun'}

HABITOS:
${habits.length > 0
  ? habits.map((habit) => `- ${habit.title}: racha ${habit.currentStreak} dias`).join('\n')
  : '- Sin habitos creados aun'}

FINANZAS ESTE MES:
- Ingresos: ${formatCOP(monthIncome)} | Gastos: ${formatCOP(monthExpenses)} | Balance: ${formatCOP(monthIncome - monthExpenses)}

GYM: ${workouts.length} entrenamientos esta semana. Ultimo hace ${daysSinceLast} dias.
SUENO: Promedio ${avgSleep.toFixed(1)}h ultimos 7 dias.

Responde siempre en espanol. Usa los datos reales de arriba y nunca inventes datos.
  `.trim();
}

export async function sageChat(userId: string, message: string): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  return chatTurn(userId, async () => callAIWithMemory(userId, await buildSageContext(userId), message));
}

export async function sageSuggestQuests(userId: string): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId);
  const fullPrompt = `${context}

Sugiere exactamente 3 misiones nuevas y especificas para esta semana.
Una MAIN quest, una SIDE quest y una DAILY.
Responde SOLO con este JSON sin markdown ni texto extra:
[
  {"type":"MAIN","title":"...","description":"...","difficulty":"HARD","category":"FITNESS","xpReward":200,"goldReward":50},
  {"type":"SIDE","title":"...","description":"...","difficulty":"NORMAL","category":"FINANCE","xpReward":80,"goldReward":20},
  {"type":"DAILY","title":"...","description":"...","difficulty":"EASY","category":"HEALTH","xpReward":20,"goldReward":5}
]`;

  return chatTurn(userId, () => callAI(fullPrompt.trim()));
}

export async function sageAnalyzeHabits(userId: string): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId);
  return chatTurn(userId, () => callAI(`${context}\n\nAnaliza los habitos del heroe. En 3 parrafos: cual tiene mas riesgo de romperse esta semana y por que, cual esta mas consolidado, y que habito nuevo recomendarias agregar dado sus metas actuales.`));
}

export async function sageAnalyzeFinances(userId: string): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId);
  return chatTurn(userId, () => callAI(`${context}\n\nAnaliza las finanzas del heroe este mes. En 3 parrafos concretos: en que categoria gasta mas de lo optimo, cuanto podria ahorrar mensualmente si ajusta eso, y cuando alcanzaria su meta de ahorro mas cercana.`));
}

export async function sagePlanWorkout(userId: string): Promise<string> {
  const usage = await takeChatSlot(userId);
  if (!usage) return SAGE_TIRED_REPLY;

  const context = await buildSageContext(userId);
  return chatTurn(userId, () => callAI(`${context}\n\nBasandote en el historial de entrenamientos del heroe, sugiere el proximo entrenamiento ideal: grupo muscular a trabajar, 4-5 ejercicios especificos con series y reps sugeridas, y justifica brevemente la eleccion.`));
}

// Cache del consejo diario en memoria de proceso: la llaman el scheduler (un
// disparo diario por usuario) y el frontend (cada vez que abres la app). Con la
// cache, la IA solo se consulta UNA vez al dia por usuario, como mucho.
const dailyTipCache = new Map<string, { date: string; tip: string }>();

const DAILY_TIP_FALLBACK = 'Sigue con tu racha — cada día cuenta.';

export async function sageDailyTip(userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const hit = dailyTipCache.get(userId);
  if (hit?.date === today) return hit.tip;

  const context = await buildSageContext(userId);
  const tip = await callAI(`${context}\\n\\nDa UNA sola frase de consejo o motivación para hoy, basada en el estado actual del usuario. Máximo 15 palabras. Sin saludos, sin introducciones. Solo la frase, directa y útil.`);
  // No cachear la respuesta de cuota agotada ni el fallback: mañana podría
  // haber cuota de nuevo y queremos reintentar la llamada a la IA.
  if (tip === SAGE_QUOTA_REPLY || tip === SAGE_ERROR_REPLY) return DAILY_TIP_FALLBACK;
  if (tip !== DAILY_TIP_FALLBACK) {
    dailyTipCache.set(userId, { date: today, tip });
  }
  return tip;
}

const dailySummaryCache = new Map<string, { date: string; text: string }>();

export async function sageDailySummary(userId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const hit = dailySummaryCache.get(userId);
  if (hit?.date === today) return hit.text;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true },
  });

  const context = await buildSageContext(userId);
  const text = await callAI(`${context}\n\nEs el inicio del dia de ${user.displayName}. En 2 parrafos: resume que logro ayer y que deberia priorizar hoy segun sus misiones activas, habitos con riesgo de romperse y estado financiero.`);
  if (text !== SAGE_QUOTA_REPLY && text !== SAGE_ERROR_REPLY) dailySummaryCache.set(userId, { date: today, text });
  return text;
}

// Información de cupo para el frontend: cuántas respuestas IA lleva el usuario
// hoy, el tope diario (la repartición real del nivel gratuito, no solo el
// anti-spam), cuántas quedan y cuándo se reinicia.
export async function getSageRateInfo(
  userId: string
): Promise<{ callsToday: number; limit: number; remaining: number; resetAt: string }> {
  const usage = await getSageDailyUsage(userId);
  const limit = sageDailyCap();
  return {
    callsToday: usage.count,
    limit,
    remaining: Math.max(0, limit - usage.count),
    resetAt: usage.nextReset.toISOString(),
  };
}
