/** Cómo se identifica la persona (onboarding y Ajustes). Null en cuentas anteriores. */
export const GENDERS = ['female', 'male', 'other', 'unspecified'] as const;
export type Gender = (typeof GENDERS)[number];

/** La zona Ciclo solo existe para quien indica que es mujer. */
export const canUseCycle = (gender: string | null | undefined) => gender === 'female';
