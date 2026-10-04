import api from '../lib/api';
import type { AuthResponse, LoginPayload, RegisterPayload } from '@lifequest/shared';
import {
  clearRefreshSessionExpected,
  markRefreshSessionExpected,
} from '../lib/session-hint';

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  markRefreshSessionExpected();
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  markRefreshSessionExpected();
  return data;
}

/** Comprueba email y usuario sin crear la cuenta (se crea al terminar el onboarding). */
export async function checkAvailability(payload: Pick<RegisterPayload, 'email' | 'username'>) {
  const { data } = await api.post<{ emailTaken: boolean; usernameTaken: boolean }>('/auth/availability', payload);
  return data;
}

export async function fetchMe(): Promise<AuthResponse['user']> {
  const { data } = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
  return data.user;
}

export async function refreshToken(): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>('/auth/refresh');
    markRefreshSessionExpected();
    return data;
  } catch (error) {
    clearRefreshSessionExpected();
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    clearRefreshSessionExpected();
  }
}
