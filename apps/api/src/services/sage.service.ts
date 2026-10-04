import { generateText, hasAIProvider } from '../lib/ai';
import { prisma } from '../lib/prisma';

const SAGE_RATE_LIMIT = 20;

async function callAI(prompt: string): Promise<string> {
  if (!hasAIProvider()) {
    throw new Error('API Key no configurada (OPENAI_API_KEY o GEMINI_API_KEY)');
  }

  const text = await generateText([{ role: 'user', content: prompt }], {
    temperature: 0.8,
    maxTokens: 600,
  });

  return text;
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

  const responseText = await generateText(messages, {
    temperature: 0.8,
    maxTokens: 600,
  });

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
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return 'Llegaste al limite de consultas por hoy. Intenta de nuevo manana.';

  const context = await buildSageContext(userId);
  return callAIWithMemory(userId, context, message);
}

export async function sageSuggestQuests(userId: string): Promise<string> {
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return '[]';

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

  return callAI(fullPrompt.trim());
}

export async function sageAnalyzeHabits(userId: string): Promise<string> {
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return 'Llegaste al limite de consultas por hoy. Intenta de nuevo manana.';

  const context = await buildSageContext(userId);
  return callAI(`${context}\n\nAnaliza los habitos del heroe. En 3 parrafos: cual tiene mas riesgo de romperse esta semana y por que, cual esta mas consolidado, y que habito nuevo recomendarias agregar dado sus metas actuales.`);
}

export async function sageAnalyzeFinances(userId: string): Promise<string> {
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return 'Llegaste al limite de consultas por hoy. Intenta de nuevo manana.';

  const context = await buildSageContext(userId);
  return callAI(`${context}\n\nAnaliza las finanzas del heroe este mes. En 3 parrafos concretos: en que categoria gasta mas de lo optimo, cuanto podria ahorrar mensualmente si ajusta eso, y cuando alcanzaria su meta de ahorro mas cercana.`);
}

export async function sagePlanWorkout(userId: string): Promise<string> {
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return 'Llegaste al limite de consultas por hoy. Intenta de nuevo manana.';

  const context = await buildSageContext(userId);
  return callAI(`${context}\n\nBasandote en el historial de entrenamientos del heroe, sugiere el proximo entrenamiento ideal: grupo muscular a trabajar, 4-5 ejercicios especificos con series y reps sugeridas, y justifica brevemente la eleccion.`);
}

export async function sageDailyTip(userId: string): Promise<string> {
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return 'Sigue con tu racha — cada día cuenta.';

  const context = await buildSageContext(userId);
  return callAI(`${context}\n\nDa UNA sola frase de consejo o motivación para hoy, basada en el estado actual del usuario. Máximo 15 palabras. Sin saludos, sin introducciones. Solo la frase, directa y útil.`);
}

export async function sageDailySummary(userId: string): Promise<string> {
  const allowed = await checkAndIncrementRateLimit(userId);
  if (!allowed) return 'Llegaste al limite de consultas por hoy. Intenta de nuevo manana.';

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true },
  });

  const context = await buildSageContext(userId);
  return callAI(`${context}\n\nEs el inicio del dia de ${user.displayName}. En 2 parrafos: resume que logro ayer y que deberia priorizar hoy segun sus misiones activas, habitos con riesgo de romperse y estado financiero.`);
}

export async function getSageRateInfo(
  userId: string
): Promise<{ callsToday: number; limit: number; remaining: number }> {
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

  const callsToday = isNewDay ? 0 : user.sageCallsToday;
  return { callsToday, limit: SAGE_RATE_LIMIT, remaining: Math.max(0, SAGE_RATE_LIMIT - callsToday) };
}
