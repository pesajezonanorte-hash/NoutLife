import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import * as authService from '../services/auth.service';
import { shouldBootstrapSession } from '../lib/session-hint';
import { lifeGeneration } from '../lib/lifeSync';
import { AUTH_TIMEOUT_MS, withTimeout } from '../lib/timeout';

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
        const { user, accessToken } = await withTimeout(authService.refreshToken(), AUTH_TIMEOUT_MS);
        if (!cancelled) setAuth(user, accessToken);
      } catch (error) {
        // Sin respuesta a tiempo (red caída, servidor frío) o sesión vencida: a iniciar sesión, no a una carga infinita.
        console.warn('[AUTH_BOOTSTRAP] sesión no confirmada, se muestra el inicio de sesión:', error instanceof Error ? error.message : error);
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
 * ganado durante la sesión (hábitos, misiones, Coliseo, focus…) no se reflejaba en
 * el HUD ni en "Ficha del héroe" aunque el leaderboard (que lee la BD) sí lo
 * mostraba. Llamar a esto después de cualquier acción que otorgue recompensas.
 *
 * Falla en silencio: un error de red no debe romper la UI.
 */
let inFlight: Promise<void> | null = null;
let inFlightGeneration = -1;

export function refreshUser(): Promise<void> {
  // Varias pantallas piden lo mismo tras una acción (la propia zona y el aviso de
  // lib/lifeSync): si ya hay una lectura en curso desde el último cambio, se comparte.
  const generation = lifeGeneration();
  if (inFlight && inFlightGeneration === generation) return inFlight;
  const run = async () => {
    try {
      const user = await authService.fetchMe();
      useAuthStore.getState().updateUser(user);
    } catch {
      // no-op: conservamos los datos actuales del store
    }
  };
  // Si la lectura en curso es anterior al último cambio, se encadena otra detrás.
  const current: Promise<void> = (inFlight ? inFlight.then(run) : run()).finally(() => {
    if (inFlight === current) inFlight = null;
  });
  inFlight = current;
  inFlightGeneration = generation;
  return current;
}
