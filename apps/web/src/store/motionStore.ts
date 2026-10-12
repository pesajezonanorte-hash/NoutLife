import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// "Reducir movimiento" de la app (Perfil y Ajustes). Activado = sin animaciones.
// De base está desactivado: todas las animaciones activas, aunque el sistema
// operativo pida reducir movimiento. main.tsx pasa el valor a <MotionConfig> y
// la clase .reduce-motion en <html> lo aplica en CSS (tokens.css).

function detectSystemReduce(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function applyClass(reduce: boolean) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('reduce-motion', reduce);
  }
}

interface MotionState {
  reduce: boolean;
  setReduce: (reduce: boolean) => void;
}

export const useMotionStore = create<MotionState>()(
  persist(
    (set) => ({
      reduce: detectSystemReduce(),
      setReduce: (reduce) => {
        applyClass(reduce);
        set({ reduce });
      },
    }),
    {
      name: 'lq-motion',
      partialize: (s) => ({ reduce: s.reduce }),
      version: 2,
      migrate: () => ({ reduce: detectSystemReduce() }),
    },
  ),
);

if (typeof window !== 'undefined') {
  applyClass(useMotionStore.getState().reduce || detectSystemReduce());
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.addEventListener('change', (e) => {
    if (!localStorage.getItem('lq-motion')) {
      useMotionStore.getState().setReduce(e.matches);
    } else {
      applyClass(useMotionStore.getState().reduce || e.matches);
    }
  });
}
