import { create } from 'zustand';
import type { User } from '@noutlife/shared';
import { identify, resetIdentity } from '@/lib/analytics';
import { rememberSessionUser } from '@/lib/offline/session';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: User, accessToken: string) => void;
  /** Abre con el último usuario conocido mientras se confirma la sesión (o sin conexión). */
  restoreOffline: (user: User) => void;
  setAccessToken: (token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken) => {
    identify(String(user.id), { plan: user.subscription?.plan });
    rememberSessionUser(user);
    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  restoreOffline: (user) => set({ user, accessToken: null, isAuthenticated: true, isLoading: false }),

  setAccessToken: (accessToken) => set({ accessToken }),

  updateUser: (partial) =>
    set((state) => {
      const user = state.user ? { ...state.user, ...partial } : null;
      rememberSessionUser(user);
      return { user };
    }),

  logout: () => {
    resetIdentity();
    rememberSessionUser(null);
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    // Lo guardado en este dispositivo no se queda para la siguiente persona.
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('lq:signed-out'));
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
