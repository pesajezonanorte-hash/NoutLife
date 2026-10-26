import type { Locale } from './locale';

export const LEVEL_TITLES: Record<number, string> = {
  1: 'Aventurero',
  2: 'Explorador',
  3: 'Viajero del Reino',
  5: 'Guerrero',
  7: 'Veterano',
  10: 'Campeón',
  15: 'Héroe del Reino',
  20: 'Leyenda',
  25: 'Gran Maestro',
  30: 'Inmortal',
  50: 'Mítico',
};

const LEVEL_TITLES_EN: Record<number, string> = {
  1: 'Adventurer',
  2: 'Explorer',
  3: 'Kingdom Traveler',
  5: 'Warrior',
  7: 'Veteran',
  10: 'Champion',
  15: 'Kingdom Hero',
  20: 'Legend',
  25: 'Grand Master',
  30: 'Immortal',
  50: 'Mythic',
};

export function getLevelTitle(level: number, locale: Locale = 'es') {
  const titles = locale === 'en' ? LEVEL_TITLES_EN : LEVEL_TITLES;
  const unlocked = Object.keys(titles)
    .map(Number)
    .filter((entry) => entry <= level)
    .sort((a, b) => b - a);

  return titles[unlocked[0] ?? 1];
}

const ZONE_TOOLTIPS: Record<string, { title: string; body: string }> = {
  '/quests': { title: 'Misiones', body: 'Aquí conviertes objetivos grandes y pequeños en progreso medible.' },
  '/habits': { title: 'Hábitos', body: 'Tu fuego diario vive aquí: constancia, rachas y disciplina visible.' },
  '/finances': { title: 'Finanzas', body: 'Registra ingresos y gastos para que tu oro tenga dirección.' },
  '/recreacion': { title: 'Recreación', body: 'Lo que ves, juegas o vives para desconectar. El descanso activo también sube de nivel.' },
  '/coliseo': { title: 'Coliseo', body: 'Pesas, cardio, deporte o caminatas: cada sesión suma y fortalece tu versión física.' },
  '/wisdom': { title: 'Sabiduría', body: 'Citas de filósofos, estrategas y atletas históricos. Subir de nivel abre más.' },
  '/journal': { title: 'Diario', body: 'Vacía la mente, captura ideas y ordena lo que estás viviendo.' },
  '/stats': { title: 'Estadísticas', body: 'Aquí ves si tu progreso está realmente equilibrado.' },
  '/learning': { title: 'Aprendizaje', body: 'Convierte estudio y práctica en avance acumulado.' },
  '/food': { title: 'Comida', body: 'Registra comida y nutrición para cuidar el combustible del héroe.' },
  '/sleep': { title: 'Sueño', body: 'Tu descanso también sube de nivel cuando lo haces visible.' },
  '/love': { title: 'Relaciones', body: 'Relaciones, detalles y vínculos importantes viven aquí.' },
  '/social': { title: 'Social', body: 'Tus contactos y gremios en el directorio, y todas tus cartas. Si hablan tres días seguidos con alguien, se enciende su racha.' },
  '/espejo': { title: 'Espejo', body: 'Fotografía tus prendas, clasifícalas y arma combinaciones; también rutinas de cuidado.' },
};

const ZONE_TOOLTIPS_EN: typeof ZONE_TOOLTIPS = {
  '/quests': { title: 'Quests', body: 'Turn big and small goals into measurable progress.' },
  '/habits': { title: 'Habits', body: 'Your daily momentum lives here: consistency, streaks and visible discipline.' },
  '/finances': { title: 'Finances', body: 'Log income and expenses so your money has a clear direction.' },
  '/recreacion': { title: 'Recreation', body: 'What you watch, play or do to unwind. Active rest counts toward your level too.' },
  '/coliseo': { title: 'Coliseum', body: 'Weights, cardio, sports or walks: every session adds up and strengthens your physical self.' },
  '/wisdom': { title: 'Wisdom', body: 'Quotes from philosophers, strategists and great athletes. Leveling up unlocks more.' },
  '/journal': { title: 'Journal', body: 'Clear your mind, capture ideas and make sense of what you are living.' },
  '/stats': { title: 'Stats', body: 'See here whether your progress is truly balanced.' },
  '/learning': { title: 'Learning', body: 'Turn study and practice into progress that adds up.' },
  '/food': { title: 'Food', body: 'Log meals and nutrition to take good care of your fuel.' },
  '/sleep': { title: 'Sleep', body: 'Your rest counts toward your progress once you make it visible.' },
  '/love': { title: 'Relationships', body: 'Important people, thoughtful gestures and meaningful bonds live here.' },
  '/social': { title: 'Social', body: 'Your contacts and guilds in the directory, and all your letters. If two people talk three days in a row, their streak lights up.' },
  '/espejo': { title: 'Mirror', body: 'Photograph your clothes, sort them and build outfits; also your self-care routines.' },
};

/** Explicación de una zona la primera vez que se entra, en el idioma de la persona. */
export function zoneTooltipOf(pathname: string, locale: Locale = 'es') {
  return (locale === 'en' ? ZONE_TOOLTIPS_EN : ZONE_TOOLTIPS)[pathname];
}
