import { prisma } from '../lib/prisma';
import { awardXpAndGold } from './xp.service';

export async function listLearning(userId: string) {
  return prisma.learningItem.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
}

export async function createLearning(userId: string, body: { type: string; title: string; author?: string; platform?: string; totalProgress?: number; notes?: string }) {
  return prisma.learningItem.create({
    data: {
      userId,
      type: body.type,
      title: body.title,
      author: body.author,
      platform: body.platform,
      totalProgress: body.totalProgress ?? 0,
      notes: body.notes,
    },
  });
}

export async function updateLearning(userId: string, id: string, body: Record<string, unknown>) {
  const item = await prisma.learningItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error('No encontrado');

  const wasCompleted = item.status === 'COMPLETED';
  const nowCompleted = body.status === 'COMPLETED';

  const updated = await prisma.learningItem.update({
    where: { id },
    data: {
      ...(body.type ? { type: body.type as string } : {}),
      ...(body.title ? { title: body.title as string } : {}),
      ...(body.author !== undefined ? { author: body.author as string } : {}),
      ...(body.platform !== undefined ? { platform: body.platform as string } : {}),
      ...(body.status ? { status: body.status as string } : {}),
      ...(body.currentProgress !== undefined ? { currentProgress: body.currentProgress as number } : {}),
      ...(body.totalProgress !== undefined ? { totalProgress: body.totalProgress as number } : {}),
      ...(body.rating !== undefined ? { rating: body.rating as number } : {}),
      ...(body.notes !== undefined ? { notes: body.notes as string } : {}),
      ...(body.startedAt !== undefined ? { startedAt: body.startedAt ? new Date(body.startedAt as string) : null } : {}),
      ...(nowCompleted && !wasCompleted ? { completedAt: new Date() } : {}),
    },
  });

  let rewards = null;
  if (nowCompleted && !wasCompleted) {
    rewards = await awardXpAndGold(userId, 75, 20, 'learning_complete', { sourceId: id, description: `Completó: ${item.title}` });
  }

  return { item: updated, rewards };
}

export async function deleteLearning(userId: string, id: string) {
  return prisma.learningItem.delete({ where: { id, userId } });
}

// ─── Rich Notes ───────────────────────────────────────────────────────────────

interface LearningNote {
  id: string;
  page?: number | string;
  content: string;
  createdAt: string;
}

export async function addNote(userId: string, itemId: string, note: { page?: number | string; content: string }) {
  const item = await prisma.learningItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('No encontrado');

  const notes = (item.richNotes as unknown as LearningNote[]) ?? [];
  const newNote: LearningNote = { id: Math.random().toString(36).slice(2), ...note, createdAt: new Date().toISOString() };
  return prisma.learningItem.update({ where: { id: itemId }, data: { richNotes: [...notes, newNote] as never } });
}

export async function deleteNote(userId: string, itemId: string, noteId: string) {
  const item = await prisma.learningItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('No encontrado');
  const notes = ((item.richNotes as unknown as LearningNote[]) ?? []).filter((n) => n.id !== noteId);
  return prisma.learningItem.update({ where: { id: itemId }, data: { richNotes: notes as never } });
}

/** Edita el texto de una nota. Devuelve la nota actualizada (o null si no existe). */
export async function updateNote(userId: string, itemId: string, noteId: string, content: string) {
  const item = await prisma.learningItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('No encontrado');
  const notes = (item.richNotes as unknown as LearningNote[]) ?? [];
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx < 0) return null;
  const updated = { ...notes[idx], content, updatedAt: new Date().toISOString() };
  const next = notes.map((n, i) => (i === idx ? updated : n));
  await prisma.learningItem.update({ where: { id: itemId }, data: { richNotes: next as never } });
  return updated;
}

// ─── Vocabulary (Spaced Repetition) ──────────────────────────────────────────

interface VocabCard {
  id: string;
  word: string;
  meaning: string;
  nextReview: string;
  interval: number;
  easiness: number;
  repetitions: number;
}

export async function addVocabCard(userId: string, itemId: string, card: { word: string; meaning: string }) {
  const item = await prisma.learningItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('No encontrado');
  const cards = (item.vocabularyCards as unknown as VocabCard[]) ?? [];
  const newCard: VocabCard = {
    id: Math.random().toString(36).slice(2),
    word: card.word,
    meaning: card.meaning,
    nextReview: new Date().toISOString(),
    interval: 1,
    easiness: 2.5,
    repetitions: 0,
  };
  return prisma.learningItem.update({ where: { id: itemId }, data: { vocabularyCards: [...cards, newCard] as never } });
}

export async function reviewVocabCard(userId: string, itemId: string, cardId: string, quality: number) {
  const item = await prisma.learningItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error('No encontrado');
  const cards = (item.vocabularyCards as unknown as VocabCard[]) ?? [];
  const updated = cards.map((c) => {
    if (c.id !== cardId) return c;
    let { easiness, repetitions, interval } = c;
    easiness = Math.max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (quality < 3) { repetitions = 0; interval = 1; }
    else if (repetitions === 0) { interval = 1; repetitions = 1; }
    else if (repetitions === 1) { interval = 6; repetitions = 2; }
    else { interval = Math.round(interval * easiness); repetitions += 1; }
    const nextReview = new Date(Date.now() + interval * 86400000).toISOString();
    return { ...c, easiness, repetitions, interval, nextReview };
  });
  return prisma.learningItem.update({ where: { id: itemId }, data: { vocabularyCards: updated as never } });
}

// ─── Pomodoro XP ──────────────────────────────────────────────────────────────

export async function completedPomodoro(userId: string) {
  return awardXpAndGold(userId, 15, 3, 'pomodoro', { description: 'Pomodoro completado (25 min de estudio)' });
}

export async function getLearningStats(userId: string) {
  const [all, thisYear] = await Promise.all([
    prisma.learningItem.findMany({ where: { userId } }),
    prisma.learningItem.findMany({
      where: { userId, status: 'COMPLETED', completedAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    }),
  ]);

  const totalCompleted = all.filter(i => i.status === 'COMPLETED').length;
  const inProgress = all.filter(i => i.status === 'IN_PROGRESS').length;
  const totalPages = all.filter(i => i.type === 'BOOK').reduce((a, i) => a + i.currentProgress, 0);

  return { totalCompleted, inProgress, totalPages, completedThisYear: thisYear.length, readingStreak: 0 };
}
