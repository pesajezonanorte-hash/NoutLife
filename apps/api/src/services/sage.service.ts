import { generateText, hasAIProvider, AIQuotaError } from '../lib/ai';
import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { isHabitScheduledForDay } from './habit.service';

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
 */
export async function consumeSageDailyAI(userId: string): Promise<SageDailyUsage | null> {
  const usage = await getSageDailyUsage(userId);
  if (usage.count >= (await sageDailyCap())) return null;
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
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      displayName: true, timezone: true,
      level: true, xp: true, xpToNextLevel: true, gold: true,
      hp: true, maxHp: true, currentStreak: true,
      strength: true, intelligence: true, charisma: true,
    },
  });
  const today = getCalendarDay(user.timezone, now);
  const habitHistoryStart = addCalendarDays(today, -29);
  const tomorrow = addCalendarDays(today, 1);

  const [activeQuests, habits, monthTx, workouts, sleepLogs, habitLogs] = await Promise.all([
    prisma.quest.findMany({ where: { userId, status: 'ACTIVE' }, orderBy: { deadline: 'asc' }, take: 8 }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      orderBy: [{ currentStreak: 'desc' }, { title: 'asc' }],
      take: 20,
      select: { id: true, title: true, frequency: true, currentStreak: true, longestStreak: true },
    }),
    prisma.transaction.findMany({ where: { userId, date: { gte: startOfMonth } }, select: { type: true, amount: true } }),
    prisma.workout.findMany({
      where: { userId, date: { gte: ninetyDaysAgo, lte: now } },
      orderBy: { date: 'desc' },
      select: { date: true, exercises: { select: { exercise: { select: { muscleGroup: true } } } } },
    }),
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: sevenDaysAgo } }, select: { duration: true } }),
    prisma.habitLog.findMany({
      where: { userId, completed: true, date: { gte: habitHistoryStart, lt: tomorrow } },
      select: { habitId: true, date: true },
    }),
  ]);

  let monthIncome = 0;
  let monthExpenses = 0;
  for (const transaction of monthTx) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'INCOME') monthIncome += amount;
    else monthExpenses += amount;
  }

  const avgSleep = sleepLogs.length > 0
    ? sleepLogs.reduce((sum, log) => sum + log.duration, 0) / sleepLogs.length
    : 0;

  const doneByHabit = new Map<string, Set<number>>();
  for (const log of habitLogs) {
    const dates = doneByHabit.get(log.habitId) ?? new Set<number>();
    dates.add(log.date.getTime());
    doneByHabit.set(log.habitId, dates);
  }
  const habitHistory = habits.map((habit) => {
    let scheduled = 0;
    let completed = 0;
    const loggedDays = doneByHabit.get(habit.id) ?? new Set<number>();
    for (let offset = 0; offset < 30; offset += 1) {
      const date = addCalendarDays(habitHistoryStart, offset);
      if (date.getTime() > today.getTime() || !isHabitScheduledForDay(date, habit.frequency)) continue;
      scheduled += 1;
      if (loggedDays.has(date.getTime())) completed += 1;
    }
    const rate = scheduled ? Math.round((completed / scheduled) * 100) : 0;
    return `- ${habit.title}: ${completed}/${scheduled} días programados (${rate}%) en 30 días; racha actual ${habit.currentStreak}, máxima ${habit.longestStreak}.`;
  });

  const lastWorkout = workouts[0];
  const daysSinceLast = lastWorkout ? Math.max(0, Math.floor((now.getTime() - lastWorkout.date.getTime()) / 86400000)) : null;
  const recentWorkouts = workouts.filter((workout) => workout.date >= thirtyDaysAgo).length;
  const previousWorkouts = workouts.filter((workout) => workout.date >= sixtyDaysAgo && workout.date < thirtyDaysAgo).length;
  const muscleCounts = new Map<string, number>();
  for (const workout of workouts) {
    for (const row of workout.exercises) {
      const group = row.exercise.muscleGroup?.trim();
      if (group) muscleCounts.set(group, (muscleCounts.get(group) ?? 0) + 1);
    }
  }
  const muscleSummary = [...muscleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([group, count]) => `${group} (${count})`)
    .join(', ');

  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(value);

  return `
Eres el asistente personal de ${user.displayName} dentro de Noutlife.
Hablas en español con un tono natural, claro, cercano y motivador.
Tu estilo debe sentirse humano y práctico, no como personaje de fantasía.
Evita hablar como sabio, héroe, reino, castillo o con frases demasiado teatrales, salvo que el usuario te lo pida.
Adapta tu forma de responder al estilo del usuario: conversacional, simple, directa y con buena energía.
Eres conciso: máximo 3 párrafos por respuesta. Nunca listas largas ni relleno.
Prioriza claridad, utilidad y recomendaciones concretas.

ESTADO ACTUAL:
- Nivel: ${user.level} | XP: ${user.xp}/${user.xpToNextLevel} | Racha general: ${user.currentStreak} días
- HP: ${user.hp}/${user.maxHp} | Gold: ${user.gold}
- Stats: STR ${user.strength} | INT ${user.intelligence} | CHA ${user.charisma}

MISIONES ACTIVAS (${activeQuests.length}):
${activeQuests.length > 0
  ? activeQuests.map((quest) => `- [${quest.type}][${quest.difficulty}] ${quest.title} - vence: ${quest.deadline ? new Date(quest.deadline).toLocaleDateString('es-CO') : 'sin límite'}`).join('\n')
  : '- Sin misiones activas aún'}

HÁBITOS — HISTORIAL DE LOS ÚLTIMOS 30 DÍAS:
${habitHistory.length > 0 ? habitHistory.join('\n') : '- Sin hábitos creados aún'}

FINANZAS ESTE MES:
- Ingresos: ${formatCOP(monthIncome)} | Gastos: ${formatCOP(monthExpenses)} | Balance: ${formatCOP(monthIncome - monthExpenses)}

GYM — HISTORIAL:
- ${recentWorkouts} entrenamientos en los últimos 30 días; ${previousWorkouts} en los 30 días anteriores; ${workouts.length} en los últimos 90 días.
- ${daysSinceLast === null ? 'Sin entrenamientos registrados en 90 días.' : `Último entrenamiento hace ${daysSinceLast} días.`}${muscleSummary ? ` Grupos más trabajados: ${muscleSummary}.` : ''}
SUEÑO: Promedio ${avgSleep.toFixed(1)} h en los últimos 7 días.

Responde siempre en español. Usa los datos reales de arriba y nunca inventes datos.
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
