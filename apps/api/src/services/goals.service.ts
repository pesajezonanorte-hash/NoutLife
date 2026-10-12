import { prisma } from '../lib/prisma';
import { generateText, hasAIProvider } from '../lib/ai';

export async function listGoals(userId: string) {
  return prisma.masterGoal.findMany({
    where: { userId },
    include: { milestones: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createGoal(
  userId: string,
  data: {
    title: string;
    description?: string;
    category: string;
    icon?: string;
    targetDate?: string;
    why?: string;
    milestones?: { title: string; order: number }[];
  }
) {
  return prisma.masterGoal.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      category: data.category,
      icon: data.icon ?? '🎯',
      targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
      why: data.why,
      milestones: data.milestones
        ? { create: data.milestones }
        : undefined,
    },
    include: { milestones: { orderBy: { order: 'asc' } } },
  });
}

export async function updateGoal(
  userId: string,
  goalId: string,
  data: Partial<{
    title: string;
    description: string;
    category: string;
    icon: string;
    targetDate: string | null;
    why: string;
    status: string;
  }>
) {
  await prisma.masterGoal.findFirstOrThrow({ where: { id: goalId, userId } });
  const updateData: Record<string, unknown> = { ...data };
  if (data.targetDate !== undefined) {
    updateData.targetDate = data.targetDate ? new Date(data.targetDate) : null;
  }
  if (data.status === 'ACHIEVED') {
    updateData.achievedAt = new Date();
  }
  return prisma.masterGoal.update({
    where: { id: goalId },
    data: updateData,
    include: { milestones: { orderBy: { order: 'asc' } } },
  });
}

export async function deleteGoal(userId: string, goalId: string) {
  await prisma.masterGoal.findFirstOrThrow({ where: { id: goalId, userId } });
  await prisma.resourceShare.updateMany({ where: { ownerId: userId, resourceType: 'GOAL', resourceId: goalId }, data: { isActive: false } });
  return prisma.masterGoal.delete({ where: { id: goalId } });
}

export async function toggleMilestone(userId: string, milestoneId: string) {
  const milestone = await prisma.goalMilestone.findFirstOrThrow({
    where: { id: milestoneId, goal: { userId } },
    include: { goal: { include: { milestones: true } } },
  });

  const nowCompleted = !milestone.isCompleted;
  await prisma.goalMilestone.update({
    where: { id: milestoneId },
    data: {
      isCompleted: nowCompleted,
      completedAt: nowCompleted ? new Date() : null,
    },
  });

  const allMilestones = milestone.goal.milestones;
  const completedCount = allMilestones.filter(
    (m) => (m.id === milestoneId ? nowCompleted : m.isCompleted)
  ).length;
  const progress =
    allMilestones.length > 0
      ? Math.round((completedCount / allMilestones.length) * 100)
      : 0;

  const status =
    progress === 100 ? 'ACHIEVED' : milestone.goal.status === 'ACHIEVED' ? 'ACTIVE' : milestone.goal.status;

  return prisma.masterGoal.update({
    where: { id: milestone.goalId },
    data: {
      progress,
      status,
      achievedAt: status === 'ACHIEVED' ? new Date() : null,
    },
    include: { milestones: { orderBy: { order: 'asc' } } },
  });
}

export async function addMilestone(
  userId: string,
  goalId: string,
  title: string
) {
  await prisma.masterGoal.findFirstOrThrow({ where: { id: goalId, userId } });
  const count = await prisma.goalMilestone.count({ where: { goalId } });
  return prisma.goalMilestone.create({
    data: { goalId, title, order: count },
  });
}

export async function deleteMilestone(userId: string, milestoneId: string) {
  await prisma.goalMilestone.findFirstOrThrow({
    where: { id: milestoneId, goal: { userId } },
  });
  return prisma.goalMilestone.delete({ where: { id: milestoneId } });
}

export async function aiBreakdownGoal(
  userId: string,
  goalId: string
): Promise<{ title: string; order: number }[]> {
  if (!hasAIProvider()) throw new Error('No hay proveedor de IA configurado');

  const goal = await prisma.masterGoal.findFirstOrThrow({
    where: { id: goalId, userId },
  });

  const prompt = `Eres un coach personal experto. El usuario tiene esta Meta Maestra:
Título: "${goal.title}"
Descripción: ${goal.description ?? '(ninguna)'}
Categoría: ${goal.category}
¿Por qué?: ${goal.why ?? '(no especificado)'}

Genera exactamente 6 milestones progresivos y específicos para alcanzar esta meta.
Responde SOLO con JSON sin markdown:
[
  {"title": "Milestone 1 claro y específico", "order": 0},
  {"title": "Milestone 2", "order": 1},
  ...
]`;

  const result = await generateText([{ role: 'user', content: prompt }], {
    temperature: 0.7,
    maxTokens: 400,
  });

  const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as { title: string; order: number }[];
}
