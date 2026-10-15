import type { Gender } from '@noutlife/shared';

/** Cómo se identifica la persona (onboarding y Ajustes). */
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: 'other', label: 'Otro' },
  { value: 'unspecified', label: 'Prefiero no decirlo' },
];

/** La zona Ciclo solo existe para quien indica que es mujer (la API aplica la misma regla). */
export const canUseCycle = (gender: Gender | null | undefined) => gender === 'female';

/** Cuerpo del personaje que sigue al género elegido (luego se cambia en el estudio). */
export const bodyFor = (gender: Gender | null | undefined): 'male' | 'female' => (gender === 'female' ? 'female' : 'male');

export function getHeroLabel(gender: Gender | null | undefined): string {
  return gender === 'female' ? 'heroína' : gender === 'male' ? 'héroe' : 'personaje';
}

/** «lista» / «listo» para acompañar a getHeroLabel. */
export function getReadyLabel(gender: Gender | null | undefined): string {
  return gender === 'female' ? 'lista' : 'listo';
}

export function getWelcomeLabel(gender: Gender | null | undefined): string {
  return gender === 'female' ? 'Bienvenida' : gender === 'male' ? 'Bienvenido' : 'Te damos la bienvenida';
}
