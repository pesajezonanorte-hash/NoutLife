import { create } from 'zustand';
import api from '@/lib/api';

// Zonas personalizadas del usuario para la navegación y el router: cada una
// tiene su propia página (/zonas/:id) y puede fijarse en la barra como las demás.
export interface CustomZoneNav { id: string; name: string; icon: string; accentColor: string }

interface CustomZoneState {
  zones: CustomZoneNav[];
  loaded: boolean;
  loading: boolean;
  /** Usuario para el que se cargaron (al cambiar de cuenta se vuelven a pedir). */
  forUser: string | null;
  ensure: (userId: string) => void;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useCustomZoneStore = create<CustomZoneState>((set, get) => ({
  zones: [],
  loaded: false,
  loading: false,
  forUser: null,
  ensure: (userId) => {
    if (get().forUser === userId && (get().loaded || get().loading)) return;
    set({ forUser: userId, zones: [], loaded: false });
    void get().refresh();
  },
  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const { data } = await api.get<CustomZoneNav[]>('/custom-zones');
      set({ zones: data.map(({ id, name, icon, accentColor }) => ({ id, name, icon, accentColor })), loaded: true });
    } catch {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  reset: () => set({ zones: [], loaded: false, forUser: null }),
}));
