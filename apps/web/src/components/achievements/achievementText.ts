// Títulos y descripciones de los logros según el idioma. El catálogo llega de la API
// con su texto en español y una clave estable (`key`); aquí está la versión en inglés
// por clave. Si una clave no tiene traducción, se muestra el texto que mandó la API.
import type { Locale } from '@/lib/locale';

interface AchievementCopy { title: string; description: string }

const EN: Record<string, AchievementCopy> = {
  first_login: { title: 'The Hero Awakens!', description: 'You logged in for the first time' },
  first_quest: { title: 'First Blood', description: 'You completed your first quest' },
  quests_10: { title: 'Novice Warrior', description: 'You completed 10 quests' },
  quests_50: { title: 'Veteran of the Field', description: 'You completed 50 quests' },
  quests_100: { title: 'Quest Master', description: 'You completed 100 quests' },
  quests_500: { title: 'Legend', description: 'You completed 500 quests' },
  streak_7: { title: 'Week of Fire', description: '7 days in a row completing a habit' },
  streak_30: { title: 'Starry Month', description: '30 days in a row on a habit' },
  streak_100: { title: 'Unbreakable Diamond', description: '100 days in a row on a habit' },
  habits_5: { title: 'Creature of Habit', description: 'You created 5 active habits' },
  level_5: { title: 'Adventurer', description: 'You reached level 5' },
  level_10: { title: 'Tempered Warrior', description: 'You reached level 10' },
  level_25: { title: 'Legendary Hero', description: 'You reached level 25' },
  level_50: { title: 'Demigod', description: 'You reached level 50' },
  level_100: { title: 'Ascended', description: 'You reached level 100' },
  fitness_25: { title: 'Iron Arms', description: 'Complete 25 Fitness quests' },
  learning_10: { title: 'Scholar', description: 'Complete 10 Learning quests' },
  finance_goal: { title: 'Millionaire in the Making', description: 'Complete your first financial goal' },
  love_10: { title: 'Hopeless Romantic', description: 'Complete 10 Love quests' },
  health_20: { title: 'Temple Body', description: 'Complete 20 Health quests' },
  early_bird: { title: 'Early Bird', description: 'Complete a quest before 7am' },
  night_owl: { title: 'Night Owl', description: 'Complete a quest after 11pm' },
  birthday: { title: 'Happy Birthday to Noutlife', description: 'You completed a quest on your birthday' },
  login_30: { title: 'Sentinel', description: 'Log in 30 days in a row' },
  first_habit: { title: 'First Habit', description: 'You created your first habit' },
  perfect_week: { title: 'Perfect Week', description: 'You completed all your daily habits in one week' },
  social_butterfly: { title: 'Social Butterfly', description: 'Complete 10 Social quests' },
  creative_mind: { title: 'Creative Mind', description: 'Complete 10 Creative quests' },
  epic_quest: { title: 'Epic Among Epics', description: 'Complete your first EPIC quest' },
  first_workout: { title: 'Iron Baptism', description: 'You completed your first workout at the Coliseum' },
  workouts_10: { title: 'Gladiator', description: 'You completed 10 workouts' },
  workouts_50: { title: 'Coliseum Champion', description: 'You completed 50 workouts' },
  speed_run: { title: 'Speedster', description: 'Complete 5 quests in a single day' },
};

/** Título y descripción de un logro en el idioma indicado (la API manda el español). */
export function achievementText(a: { key?: string; title: string; description?: string }, locale: Locale = 'es'): AchievementCopy {
  const es = { title: a.title, description: a.description ?? '' };
  if (locale !== 'en' || !a.key) return es;
  return EN[a.key] ?? es;
}
