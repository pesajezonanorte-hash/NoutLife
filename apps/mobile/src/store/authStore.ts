import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import type { User } from '@noutlife/shared';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  isAuthenticated: false,
  isLoading:       true,

  bootstrap: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) { set({ isLoading: false }); return; }

      const res = await api.get<{ user: User }>('/users/me');
      set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('accessToken');
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    const res = await api.post<{ user: User; accessToken: string }>('/auth/login', { email, password });
    await SecureStore.setItemAsync('accessToken', res.data.accessToken);
    set({ user: res.data.user, isAuthenticated: true });
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    await SecureStore.deleteItemAsync('accessToken');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (user) => set({ user }),
}));
