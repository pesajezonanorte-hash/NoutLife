import { prisma } from '../lib/prisma';
import { getCalendarDay } from '../lib/calendar';
import type { QuestCategory } from '@prisma/client';
import { damageSeasonBoss } from './season.service';

export function xpForLevel(level: number): number {
  return Math.round(level * 100 * Math.pow(1.15, level));
}

export function xpForNextLevel(currentLevel: number): number {
  return Math.floor(100 * currentLevel * Math.pow(1.15, currentLevel - 1));
}

export interface StatIncreases {
  strength?: number;
  intelligence?: number;
  charisma?: number;
  hp?: number;
  mp?: number;
}

export interface AwardResult {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  xpGained: number;
  goldGained: number;
  statIncreases: StatIncreases;
}

const CATEGORY_WEIGHTS: Record<QuestCategory, { str: number; int: number; cha: number }> = {
  FITNESS:  { str: 0.6,  int: 0.2, cha: 0.2 },
  HEALTH:   { str: 0.3,  int: 0.4, cha: 0.3 },
  FINANCE:  { str: 0.1,  int: 0.6, cha: 0.3 },
  LEARNING: { str: 0.1,  int: 0.7, cha: 0.2 },
  LOVE:     { str: 0.1,  int: 0.2, cha: 0.7 },
  SOCIAL:   { str: 0.1,  int: 0.3, cha: 0.6 },
  PERSONAL: { str: 0.2,  int: 0.4, cha: 0.4 },
  CREATIVE: { str: 0.1,  int: 0.5, cha: 0.4 },
};

function pickStatFromCategory(category: QuestCategory | undefined): 'strength' | 'intelligence' | 'charisma' {
  const weights = category ? CATEGORY_WEIGHTS[category] : { str: 0.33, int: 0.34, cha: 0.33 };
  const roll = Math.random();
  if (roll < weights.str) return 'strength';
  if (roll < weights.str + weights.int) return 'intelligence';
  return 'charisma';
}

const CLASS_MULTIPLIERS: Record<string, Partial<Record<QuestCategory, number>>> = {
  warrior: { FITNESS: 1.2, HEALTH: 1.1 },
  mage: { LEARNING: 1.2, CREATIVE: 1.1 },
  merchant: { FINANCE: 1.2 },
  paladin: { LOVE: 1.2, HEALTH: 1.2, SOCIAL: 1.1 },
};

const CLASS_GOLD_MULT: Record<string, number> = {
  merchant: 1.2,
};

function applyClassMultiplier(playerClass: string | null, category: QuestCategory | undefined, xp: number, gold: number): { xp: number; gold: number } {
  if (!playerClass) return { xp, gold };
  const catMult = category ? (CLASS_MULTIPLIERS[playerClass]?.[category] ?? 1) : 1;
  const goldMult = CLASS_GOLD_MULT[playerClass] ?? 1;
  return { xp: Math.round(xp * catMult), gold: Math.round(gold * goldMult) };
}

/**
 * Racha general vigente sin escribir en la base: la guardada sigue viva si la última
 * actividad fue hoy o ayer (en la zona horaria del usuario); si fue antes, ya hubo un
 * día entero perdido y vale 0. La racha guardada solo se corrige cuando el propio
 * usuario entra, así que quien lea rachas de otros (ranking, amigos) debe usar esto.
 */
export function effectiveActivityStreak(
  user: { currentStreak: number; lastActivityDate: Date | null; timezone: string | null },
  now = new Date(),
): number {
  if (user.currentStreak === 0 || !user.lastActivityDate) return user.currentStreak;
  const today = getCalendarDay(user.timezone, now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return getCalendarDay(user.timezone, user.lastActivityDate).getTime() < yesterday.getTime() ? 0 : user.currentStreak;
}

/** Restablece la racha general si ya pasó un día calendario completo sin actividad. */
export async function reconcileUserActivityStreak(userId: string, now = new Date()): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentStreak: true, lastActivityDate: true, timezone: true },
  });

  if (!user || user.currentStreak === 0 || !user.lastActivityDate) return user?.currentStreak ?? 0;

  const today = getCalendarDay(user.timezone, now);

  // Ayer todavía deja la racha viva: el usuario tiene hasta terminar hoy para
  // continuarla. Antes de ayer significa que ya hubo un día entero perdido.
  if (effectiveActivityStreak(user, now) === 0) {
    await prisma.user.update({ where: { id: userId }, data: { currentStreak: 0 } });
    // Un mensaje del Sabio guardado antes del reinicio puede mencionar una racha
    // que ya no existe. Se regenerará en la siguiente lectura con datos reales.
    await prisma.sageProactiveNote.deleteMany({
      where: { userId, createdAt: { gte: today } },
    });
    return 0;
  }

  return user.currentStreak;
}

export async function awardXpAndGold(
  userId: string,
  xp: number,
  gold: number,
  source: string,
  options?: { sourceId?: string; description?: string; category?: QuestCategory }
): Promise<AwardResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const multiplied = applyClassMultiplier(user.playerClass, options?.category, xp, gold);
  xp = multiplied.xp;
  gold = multiplied.gold;

  let currentXp = user.xp + xp;
  let currentLevel = user.level;
  let currentXpToNext = user.xpToNextLevel;
  const oldLevel = user.level;
  const levelsGained: number[] = [];

  while (currentXp >= currentXpToNext) {
    currentXp -= currentXpToNext;
    currentLevel += 1;
    currentXpToNext = xpForLevel(currentLevel);
    levelsGained.push(currentLevel);
  }

  const leveledUp = currentLevel > oldLevel;
  const statIncreases: StatIncreases = {};

  if (leveledUp) {
    // HP/MP increase per level
    const hpIncrease = levelsGained.length * 10;
    const mpIncrease = levelsGained.length * 5;
    statIncreases.hp = hpIncrease;
    statIncreases.mp = mpIncrease;

    // Stat increase per level (weighted by category)
    for (const lvl of levelsGained) {
      const statKey = pickStatFromCategory(options?.category);
      statIncreases[statKey] = (statIncreases[statKey] ?? 0) + 1;

      // Every 5 levels: all stats +1 bonus
      if (lvl % 5 === 0) {
        statIncreases.strength = (statIncreases.strength ?? 0) + 1;
        statIncreases.intelligence = (statIncreases.intelligence ?? 0) + 1;
        statIncreases.charisma = (statIncreases.charisma ?? 0) + 1;
      }
    }
  }

  const newMaxHp = Math.min(user.maxHp + (statIncreases.hp ?? 0), 300);
  const newMaxMp = Math.min(user.maxMp + (statIncreases.mp ?? 0), 250);

  // Update streak according to the player's own calendar day, not the API host's UTC day.
  const today = getCalendarDay(user.timezone);
  const lastActivity = user.lastActivityDate
    ? getCalendarDay(user.timezone, user.lastActivityDate)
    : null;

  const isNewDay = !lastActivity || lastActivity.getTime() < today.getTime();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const isYesterday = lastActivity && lastActivity.getTime() === yesterday.getTime();

  let newStreak = user.currentStreak;
  if (isNewDay) {
    newStreak = isYesterday ? user.currentStreak + 1 : 1;
  }
  const newLongest = Math.max(user.longestStreak, newStreak);

  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: currentXp,
      level: currentLevel,
      xpToNextLevel: currentXpToNext,
      gold: { increment: gold },
      lastActivityDate: new Date(),
      currentStreak: newStreak,
      longestStreak: newLongest,
      ...(leveledUp && {
        maxHp: newMaxHp,
        maxMp: newMaxMp,
        strength: { increment: statIncreases.strength ?? 0 },
        intelligence: { increment: statIncreases.intelligence ?? 0 },
        charisma: { increment: statIncreases.charisma ?? 0 },
      }),
    },
  });

  // Log the event
  await prisma.xpEvent.create({
    data: {
      userId,
      xpAmount: xp,
      goldAmount: gold,
      source,
      sourceId: options?.sourceId,
      description: options?.description ?? source,
    },
  });

  // Deal damage to the active season boss (fire-and-forget)
  const bossDamage = Math.max(1, Math.floor(xp / 5));
  damageSeasonBoss(userId, bossDamage).catch(() => null);

  return { leveledUp, oldLevel, newLevel: currentLevel, xpGained: xp, goldGained: gold, statIncreases };
}
