import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// "Reducir movimiento" de la app (Perfil y Ajustes). Activado = sin animaciones.
// De base está desactivado: todas las animaciones activas, aunque el sistema
// operativo pida reducir movimiento. main.tsx pasa el valor a <MotionConfig> y
// la clase .reduce-motion en <html> lo aplica en CSS (tokens.css).

function applyClass(reduce: boolean) {
  document.documentElement.classList.toggle('reduce-motion', reduce);
}

interface MotionState {
  reduce: boolean;
  setReduce: (reduce: boolean) => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      reduce: false,
      setReduce: (reduce) => {
        applyClass(reduce);
        set({ reduce });
      },
    }),
    {
      name: 'lq-motion',
      partialize: (s) => ({ reduce: s.reduce }),
      // v1: todas las animaciones activas de base; se reinicia lo guardado antes.
      version: 1,
      migrate: () => ({ reduce: false }),
    },
  ),
);

applyClass(useMotionStore.getState().reduce);
