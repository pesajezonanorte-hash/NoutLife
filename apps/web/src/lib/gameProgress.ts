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

export function getLevelTitle(level: number) {
  const unlocked = Object.keys(LEVEL_TITLES)
    .map(Number)
    .filter((entry) => entry <= level)
    .sort((a, b) => b - a);

  return LEVEL_TITLES[unlocked[0] ?? 1];
}

export const ZONE_TOOLTIPS: Record<string, { title: string; body: string }> = {
  '/quests': { title: 'Misiones', body: 'Aquí conviertes objetivos grandes y pequeños en progreso medible.' },
  '/habits': { title: 'Hábitos', body: 'Tu fuego diario vive aquí: constancia, rachas y disciplina visible.' },
  '/finances': { title: 'Bóveda', body: 'Registra ingresos y gastos para que tu oro tenga dirección.' },
  '/gym': { title: 'Gimnasio', body: 'Entrena, suma sesiones y fortalece tu versión física.' },
  '/wisdom': { title: 'Sabio', body: 'Pide contexto, claridad o estrategia cuando te sientas bloqueado.' },
  '/journal': { title: 'Diario', body: 'Vacía la mente, captura ideas y ordena lo que estás viviendo.' },
  '/stats': { title: 'Life Score', body: 'Aquí ves si tu progreso está realmente equilibrado.' },
  '/learning': { title: 'Biblioteca', body: 'Convierte estudio y práctica en avance acumulado.' },
  '/food': { title: 'Posada', body: 'Registra comida y nutrición para cuidar el combustible del héroe.' },
  '/sleep': { title: 'Torre', body: 'Tu descanso también sube de nivel cuando lo haces visible.' },
  '/love': { title: 'Jardín', body: 'Relaciones, detalles y vínculos importantes viven aquí.' },
  '/social': { title: 'Social', body: 'Tus contactos y gremios en el directorio, y todas tus cartas. Si hablan tres días seguidos con alguien, se enciende su racha.' },
  '/armario': { title: 'Armario', body: 'Rutinas de cuidado, prendas y combinaciones para expresar tu estilo.' },
};
