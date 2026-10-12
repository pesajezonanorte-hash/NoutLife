/** Categorías sugeridas para las checklists; las tres primeras son las principales. */
export const CHECKLIST_CATEGORIES = ['Compras', 'Tareas del hogar', 'Finanzas', 'personal', 'rutina', 'gimnasio', 'alimentación', 'estudio', 'viaje'];

const norm = (value: string) => value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** «Compras», «compras» y «  COMPRAS » son la misma categoría. */
export const sameCategory = (a: string, b: string) => norm(a) === norm(b);
