import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import * as authService from '../services/auth.service';
import { shouldBootstrapSession } from '../lib/session-hint';

/**
 * At mount, recover a session with the httpOnly refresh cookie only when it is
 * relevant. A fresh /login or /register page has no session signal, so it does
 * not intentionally emit a 401 before the user has tried to authenticate.
 */
export function useBootstrapAuth() {
  const { setAuth, logout, setLoading } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!shouldBootstrapSession(window.location.pathname)) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const { user, accessToken } = await authService.refreshToken();
        if (!cancelled) setAuth(user, accessToken);
      } catch {
        if (!cancelled) logout();
      }
    }

    void bootstrap();
    return () => { cancelled = true; };
  }, [setAuth, logout, setLoading]);
}

/**
 * Re-sincroniza el usuario desde el servidor (XP, gold, nivel, rachas, stats…).
 *
 * El store solo se poblaba al hacer boot de la app, así que cualquier XP/gold
 * ganado durante la sesión (hábitos, misiones, gym, focus…) no se reflejaba en
 * el HUD ni en "Ficha del héroe" aunque el leaderboard (que lee la BD) sí lo
 * mostraba. Llamar a esto después de cualquier acción que otorgue recompensas.
 *
 * Falla en silencio: un error de red no debe romper la UI.
 */
export async function refreshUser(): Promise<void> {
  try {
    const user = await authService.fetchMe();
    useAuthStore.getState().updateUser(user);
  } catch {
    // no-op: conservamos los datos actuales del store
  }
}
