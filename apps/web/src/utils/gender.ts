import type { Gender } from '@noutlife/shared';
import type { Locale } from '@/lib/locale';

const LABELS: Record<Locale, Record<Gender, string>> = {
  es: { female: 'Mujer', male: 'Hombre', other: 'Otro', unspecified: 'Prefiero no decirlo' },
  en: { female: 'Woman', male: 'Man', other: 'Another gender', unspecified: 'Prefer not to say' },
};

/** Cómo se identifica la persona (onboarding y Ajustes), en el idioma indicado. */
export function genderOptionsFor(locale: Locale): { value: Gender; label: string }[] {
  return (['female', 'male', 'other', 'unspecified'] as const).map((value) => ({ value, label: LABELS[locale][value] }));
}

/** La zona Ciclo solo existe para quien indica que es mujer (la API aplica la misma regla). */
export const canUseCycle = (gender: Gender | null | undefined) => gender === 'female';

/** Cuerpo del personaje que sigue al género elegido (luego se cambia en el estudio). */
export const bodyFor = (gender: Gender | null | undefined): 'male' | 'female' => (gender === 'female' ? 'female' : 'male');
