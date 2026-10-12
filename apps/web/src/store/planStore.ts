import { create } from 'zustand';
import type { ProFeature } from '@/lib/plan';

/**
 * Motivo por el que se abre el diálogo de Pro: un límite de Lite (402 de la
 * API o un bloqueo en la interfaz), el aviso de que la cuenta pasó a Lite o la
 * invitación a guardar la tarjeta durante la prueba.
 */
export type UpgradeReason = ProFeature | 'downgraded' | 'trial';

interface PlanState {
  reason: UpgradeReason | null;
  /** Texto de la API para el límite (si llegó con el 402). */
  message: string | null;
  openUpgrade: (reason: UpgradeReason, message?: string | null) => void;
  closeUpgrade: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  reason: null,
  message: null,
  openUpgrade: (reason, message = null) => set({ reason, message }),
  closeUpgrade: () => set({ reason: null, message: null }),
}));
