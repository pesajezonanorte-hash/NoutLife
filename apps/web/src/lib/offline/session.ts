// La sesión para abrir sin conexión (o sin esperar a la red): el último usuario conocido. No es una
// credencial: la autoridad sigue siendo la cookie HttpOnly, y sin ella la API no responde nada. Solo deja
// pintar la app con lo guardado en este dispositivo mientras se confirma la sesión.
import type { User } from '@noutlife/shared';

const KEY = 'lq-session-user';

export function rememberSessionUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  } catch { /* sin storage: al abrir se espera a la red */ }
}

export function lastSessionUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
