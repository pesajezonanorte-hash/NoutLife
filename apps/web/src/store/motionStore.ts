import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// "Reducir movimiento" de la app (Perfil y Ajustes). Desactivado = sigue la
// preferencia del sistema (prefers-reduced-motion); activado = siempre reduce.
// main.tsx pasa el valor a <MotionConfig> y la clase .reduce-motion en <html>
// aplica en CSS la misma regla que la media query (tokens.css).

/** Valor previo: localStorage['animations'] = 'false' cuando se apagaban en Ajustes. */
function legacyReduce(): boolean {
  try { return localStorage.getItem('animations') === 'false'; } catch { return false; }
}

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
      reduce: legacyReduce(),
      setReduce: (reduce) => {
        applyClass(reduce);
        set({ reduce });
      },
    }),
    { name: 'lq-motion', partialize: (s) => ({ reduce: s.reduce }) },
  ),
);

applyClass(useMotionStore.getState().reduce);
