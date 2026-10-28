import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { usePlanStore } from '../store/planStore';
import { getDeviceId, rememberDeviceId } from './deviceId';
import type { ProFeature, ProLock } from './plan';
import { clearRefreshSessionExpected, markRefreshSessionExpected } from './session-hint';
import { announceLifeChange, lifeZoneOf } from './lifeSync';
import { getLocale } from './i18n';
import { AUTH_TIMEOUT_MS } from './timeout';

/**
 * En producción la API se pide en el mismo dominio de la web (/api/v1), que
 * Vercel reenvía a la API (vercel.json). Así la cookie de sesión es de primera
 * parte: Safari en iPhone bloquea las cookies de otro dominio y obligaba a
 * iniciar sesión en cada visita. VITE_API_URL solo se usa si se pide a propósito
 * con VITE_API_CROSS_ORIGIN=true (p. ej. una API sin proxy).
 */
export const API_BASE = import.meta.env.VITE_API_CROSS_ORIGIN === 'true' && import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // necesario para cookies de refresh token
});

// Inyectar access token en cada request
api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const deviceId = await getDeviceId().catch(() => '');
  if (deviceId) config.headers['X-Device-Id'] = deviceId;
  // Idioma de la persona: la API responde en él (p. ej. el Sabio).
  config.headers['Accept-Language'] = getLocale();
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

// Auto-refresh del access token cuando expira
api.interceptors.response.use(
  (response) => {
    // La API manda el id de su cookie HttpOnly: las capas locales se alinean con él.
    const deviceId = response.headers['x-device-id'];
    if (typeof deviceId === 'string' && deviceId) {
      void getDeviceId().then((mine) => { if (mine !== deviceId) rememberDeviceId(deviceId); });
    }
    // Una escritura en una zona de vida se anuncia a toda la app (lib/lifeSync).
    if (String(response.config.method ?? 'get').toLowerCase() !== 'get') {
      const zone = lifeZoneOf(String(response.config.url ?? ''));
      if (zone) announceLifeChange(zone);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url ?? '');
    // Credential and refresh endpoints must surface their own 401 responses.
    // Retrying /refresh from its response used to issue a second identical
    // refresh request. Logout intentionally remains refreshable so an expired
    // access token can still revoke a valid refresh-cookie session.
    const bypassRefresh = /\/auth\/(?:login|register|refresh)(?:\?|$)/.test(requestUrl);

    // Límite o zona de NoutLife Lite (402). Una acción de la persona abre el
    // diálogo de Pro con el motivo; una lectura en segundo plano no abre nada:
    // solo resincroniza el plan y la pantalla muestra su candado. La petición
    // sigue fallando para que la pantalla que llamó lo sepa.
    const data = error.response?.data as { code?: string; feature?: ProFeature; lock?: ProLock; error?: string } | undefined;
    if (error.response?.status === 402 && data?.code === 'PRO_REQUIRED') {
      const reason = data.feature ?? data.lock;
      const read = String(originalRequest?.method ?? 'get').toLowerCase() === 'get';
      if (reason && !read) usePlanStore.getState().openUpgrade(reason, data.error ?? null);
      else usePlanStore.getState().requestSync();
    }

    if (error.response?.status === 401 && !bypassRefresh && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true, timeout: AUTH_TIMEOUT_MS }
        );

        useAuthStore.getState().setAccessToken(data.accessToken);
        markRefreshSessionExpected();
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearRefreshSessionExpected();
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
