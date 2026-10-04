import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Zonas principales de la navegación: Inicio y Perfil son fijos; entre ellos van
// PINNED_COUNT zonas que el usuario elige y ordena (Ajustes → Zonas). El resto
// se agrupa en las secciones de "Más zonas". Se guarda por usuario en este
// dispositivo.
// TODO(api): persistir el orden en la cuenta para que viaje entre dispositivos.

export const PINNED_COUNT = 3;
export const DEFAULT_ORDER = ['/habits', '/quests', '/gym'];

/** Áreas del onboarding (GOALS) y la zona que abren. */
export const GOAL_ZONE: Record<string, string> = {
  FITNESS: '/gym',
  HEALTH: '/food',
  SLEEP: '/sleep',
  FINANCE: '/finances',
  LEARNING: '/learning',
  LOVE: '/love',
  PERSONAL: '/rituals',
  CREATIVE: '/journal',
};

/** Las áreas elegidas en el onboarding, completadas con las zonas por defecto. */
export function orderFromGoals(goals: string[]): string[] {
  const picked = goals.map((g) => GOAL_ZONE[g]).filter(Boolean);
  return [...new Set([...picked, ...DEFAULT_ORDER])];
}

interface NavState {
  /** Orden de zonas por id de usuario; las PINNED_COUNT primeras son las principales. */
  byUser: Record<string, string[]>;
  setOrder: (userId: string, order: string[]) => void;
}

export const useNavStore = create<NavState>()(
  persist(
    (set) => ({
      byUser: {},
      setOrder: (userId, order) => set((s) => ({ byUser: { ...s.byUser, [userId]: order } })),
    }),
    { name: 'lq-nav-zones' },
  ),
);
