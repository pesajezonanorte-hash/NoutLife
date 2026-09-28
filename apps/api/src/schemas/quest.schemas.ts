import { z } from 'zod';

const QUEST_TYPES = ['MAIN', 'SIDE', 'DAILY', 'WEEKLY', 'META'] as const;
const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD', 'EPIC'] as const;
const CATEGORIES = ['HEALTH', 'FITNESS', 'FINANCE', 'LEARNING', 'LOVE', 'SOCIAL', 'PERSONAL', 'CREATIVE'] as const;
const STATUSES = ['ACTIVE', 'COMPLETED', 'FAILED', 'ARCHIVED'] as const;
const SORT_OPTIONS = ['deadline', 'xp', 'created', 'difficulty'] as const;

export const createQuestSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  type: z.enum(QUEST_TYPES),
  difficulty: z.enum(DIFFICULTIES),
  category: z.enum(CATEGORIES),
  xpReward: z.number().int().min(0).max(10000).optional(),
  goldReward: z.number().int().min(0).max(5000).optional(),
  deadline: z.string().optional(),
  isRecurring: z.boolean().optional(),
  subObjectives: z.array(z.object({ title: z.string().min(1), completed: z.boolean().optional() })).max(10).optional(),
  parentQuestId: z.string().optional(),
});

export const updateQuestSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  category: z.enum(CATEGORIES).optional(),
  xpReward: z.number().int().min(0).max(10000).optional(),
  goldReward: z.number().int().min(0).max(5000).optional(),
  deadline: z.string().nullable().optional(),
  subObjectives: z.array(z.object({ id: z.string().optional(), title: z.string().min(1), completed: z.boolean().optional() })).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

export const questFiltersSchema = z.object({
  type: z.enum(QUEST_TYPES).optional(),
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(SORT_OPTIONS).optional(),
});

export const subObjectiveToggleSchema = z.object({
  subObjectiveId: z.string().min(1),
  completed: z.boolean(),
});

export const onboardingSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  birthDate: z.string().optional(),
  timezone: z.string().optional(),
  avatarConfig: z.record(z.unknown()).optional(),
  goalCategories: z.array(z.string()).optional(),
  mainQuestTitle: z.string().min(1).max(120).optional(),
  mainQuestCategory: z.string().optional(),
  mainQuestDeadline: z.string().optional(),
});

const AVATAR_MODES = ['pixel', 'photo', 'minecraft'] as const;
const BODY_TYPES = ['male', 'female'] as const;
const HAIR_STYLES = ['short', 'medium', 'long', 'shaved', 'copete', 'afro', 'recogido', 'trenzas', 'ondulado'] as const;
const ACCESSORIES = ['none', 'glasses', 'cap', 'headband', 'earrings', 'scarf'] as const;
const EXPRESSIONS = ['normal', 'smile', 'serious', 'determined'] as const;

export const avatarSchema = z.object({
  bodyType: z.enum(BODY_TYPES).optional(),
  hairStyle: z.enum(HAIR_STYLES).optional(),
  hairColor: z.string().max(32).optional(),
  skinColor: z.string().max(32).optional(),
  shirtColor: z.string().max(32).optional(),
  pants: z.string().max(32).optional(),
  accessory: z.enum(ACCESSORIES).nullable().optional(),
  expression: z.enum(EXPRESSIONS).optional(),
  pet: z.string().max(120).nullable().optional(),
  avatarMode: z.enum(AVATAR_MODES).optional(),
  minecraftSkinUrl: z.string()
    .max(100_000)
    .regex(/^data:image\/png;base64,/i, 'La skin debe ser un PNG válido.')
    .nullable()
    .optional(),
});
