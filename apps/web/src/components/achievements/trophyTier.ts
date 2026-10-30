// Metal de la vitrina 3D de Logros según la parte de logros obtenidos. Puro: lo usan
// TrophyShowcase y los tests.
export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export function trophyTier(share: number): TrophyTier {
  if (share >= 1) return 'platinum';
  if (share >= 2 / 3) return 'gold';
  if (share >= 1 / 3) return 'silver';
  return 'bronze';
}
