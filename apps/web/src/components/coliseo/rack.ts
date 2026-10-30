// Discos de la barra del rack 3D (Coliseo): uno por cada día entrenado esta semana, a cada lado
// por turnos, en las mangas de la barra (unidades del modelo `barbell`, eje x). Puro: lo usan
// GymRack y los tests.
export const RACK_MAX_PLATES = 7;

export function platePositions(n: number): Array<[number, number, number]> {
  return Array.from({ length: Math.max(0, Math.min(RACK_MAX_PLATES, Math.floor(n))) }, (_, k) => [(k % 2 ? -1 : 1) * (0.622 + Math.floor(k / 2) * 0.056), 0, 0]);
}
