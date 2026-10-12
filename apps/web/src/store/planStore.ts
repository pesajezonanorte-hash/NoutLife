import { create } from 'zustand';
import type { ProFeature, ProLock } from '@/lib/plan';

/**
 * Motivo por el que se abre el diálogo de Pro: un límite o una zona de Lite
 * (402 de la API o un candado en la interfaz), el aviso de que la cuenta pasó a
 * Lite o la invitación a empezar la prueba vinculando un método de pago.
 */
export type UpgradeReason = ProFeature | ProLock | 'downgraded' | 'trial';

interface PlanState {
  reason: UpgradeReason | null;
  /** Texto de la API para el límite (si llegó con el 402). */
  message: string | null;
  openUpgrade: (reason: UpgradeReason, message?: string | null) => void;
  closeUpgrade: () => void;
  /**
   * El paywall de entrada sigue en pantalla aunque el medio de pago ya quedó
   * vinculado, hasta que la persona pulsa «Entrar» (ve la confirmación).
   */
  paywallHeld: boolean;
  holdPaywall: () => void;
  releasePaywall: () => void;
  /** Sube cuando la API negó una lectura por el plan: el plan del cliente estaba viejo. */
  syncTick: number;
  requestSync: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  reason: null,
  message: null,
  openUpgrade: (reason, message = null) => set({ reason, message }),
  closeUpgrade: () => set({ reason: null, message: null }),
  paywallHeld: false,
  holdPaywall: () => set({ paywallHeld: true }),
  releasePaywall: () => set({ paywallHeld: false }),
  syncTick: 0,
  requestSync: () => set((s) => ({ syncTick: s.syncTick + 1 })),
}));
