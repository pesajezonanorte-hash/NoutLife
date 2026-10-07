import api from '../lib/api';
import type { AuthResponse, OAuthPayload } from '@lifequest/shared';
import {
  clearRefreshSessionExpected,
  markRefreshSessionExpected,
} from '../lib/session-hint';

/** Ids públicos de Google y Apple (vienen de la API, no del build). */
export async function getProviders() {
  const { data } = await api.get<{ googleClientId: string | null; appleClientId: string | null; appleRedirectUri: string | null }>('/auth/providers');
  return data;
}

export async function oauthSignIn(payload: OAuthPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/oauth', payload);
  markRefreshSessionExpected();
  return data;
}

export async function deleteAccount(): Promise<void> {
  await api.post('/auth/delete-account', { confirmation: 'DELETE_MY_ACCOUNT' });
  clearRefreshSessionExpected();
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
