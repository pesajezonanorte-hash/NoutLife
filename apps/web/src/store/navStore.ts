import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Zonas principales de la navegación: Inicio y Perfil son fijos; entre ellos van
// PINNED_COUNT zonas que el usuario elige y ordena (Ajustes → Zonas). El resto
// se agrupa en las secciones de "Más zonas". Se guarda por usuario en este
// dispositivo.
// Las zonas ocultas (Ajustes → Zonas) desaparecen de Sidebar, Rail y menú «Más».
// TODO(api): persistir orden y zonas ocultas en la cuenta para que viajen entre dispositivos.

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
  /** Zonas ocultas por id de usuario (nunca las principales). */
  hiddenByUser: Record<string, string[]>;
  setHidden: (userId: string, to: string, hidden: boolean) => void;
}

export const useNavStore = create<NavState>()(
  persist(
    (set) => ({
      byUser: {},
      setOrder: (userId, order) => set((s) => ({ byUser: { ...s.byUser, [userId]: order } })),
      hiddenByUser: {},
      setHidden: (userId, to, hidden) => set((s) => {
        const cur = new Set(s.hiddenByUser[userId] ?? []);
        if (hidden) cur.add(to); else cur.delete(to);
        return { hiddenByUser: { ...s.hiddenByUser, [userId]: [...cur] } };
      }),
    }),
    { name: 'lq-nav-zones' },
  ),
);
