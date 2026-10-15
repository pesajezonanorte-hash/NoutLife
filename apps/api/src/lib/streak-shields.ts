// Protectores de racha de la Tienda. Se activan al comprarlos: suman días de
// escudo a la racha general, y cada día entero sin actividad gasta uno en vez
// de romperla. Proteger cuesta siempre menos que revivir (streak-revival.service).

/** Días que protege cada artículo, por su imageKey. */
export const STREAK_SHIELDS: Record<string, number> = { streak_pass: 1, streak_shield: 3 };

/** Tope de días de escudo que se pueden tener a la vez. */
export const MAX_SHIELD_DAYS = 7;

export const shieldDaysOf = (imageKey: string | null | undefined): number => (imageKey ? STREAK_SHIELDS[imageKey] ?? 0 : 0);
