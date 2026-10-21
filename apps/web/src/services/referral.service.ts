// Invitaciones (T9): la portada /i/:username y el usuario de quien invitó hasta el registro.
import api from '../lib/api';

/** Clave de este dispositivo: el invitador se guarda al entrar a /i/:username y se envía al crear la cuenta. */
export const REF_KEY = 'lq_ref';

export interface Inviter { username: string; displayName: string }

export async function getInviter(username: string): Promise<Inviter> {
  const { data } = await api.get<{ inviter: Inviter }>(`/referrals/inviter/${encodeURIComponent(username)}`);
  return data.inviter;
}

export function storeReferral(username: string): void {
  try { localStorage.setItem(REF_KEY, username); } catch { /* sin storage: la invitación no se registra */ }
}

export function readReferral(): string | undefined {
  try { return localStorage.getItem(REF_KEY) ?? undefined; } catch { return undefined; }
}

export function clearReferral(): void {
  try { localStorage.removeItem(REF_KEY); } catch { /* nada que limpiar */ }
}
