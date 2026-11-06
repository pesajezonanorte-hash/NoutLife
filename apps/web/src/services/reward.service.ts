// Enlaces de recompensa de un solo uso (/claim?token=…): portada pública, canje con sesión y el
// token pendiente mientras la persona inicia sesión o termina el onboarding.
import type { Subscription } from '@noutlife/shared';
import api from '../lib/api';

export type RewardStatus = 'available' | 'claimed' | 'expired' | 'invalid';
export type RewardOutcome = 'activated' | 'extended' | 'complimentary';

export interface RewardPreview { status: RewardStatus; proDays?: number; theme?: string }

export interface RewardClaim {
  outcome: RewardOutcome;
  proDays: number;
  accessEndsAt: string | null;
  theme: string;
  themeUnlocked: boolean;
}

export async function getReward(token: string): Promise<RewardPreview> {
  const { data } = await api.get<RewardPreview>(`/rewards/${encodeURIComponent(token)}`);
  return data;
}

export async function claimReward(token: string): Promise<{ claim: RewardClaim; subscription: Subscription; equippedTheme: string }> {
  const { data } = await api.post<{ claim: RewardClaim; subscription: Subscription; equippedTheme: string }>('/rewards/claim', { token });
  return data;
}

/** Estado del enlace en un error de canje (410 ya usado o vencido, 404 no válido). */
export function rewardErrorStatus(error: unknown): RewardStatus | null {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return code === 'claimed' || code === 'expired' || code === 'invalid' ? code : null;
}

/** Token guardado en este dispositivo mientras la persona inicia sesión (o termina el onboarding). */
const PENDING_KEY = 'lq_reward';

export function storePendingReward(token: string): void {
  try { localStorage.setItem(PENDING_KEY, token); } catch { /* sin storage: vuelve a abrir el enlace */ }
}

export function readPendingReward(): string | null {
  try { return localStorage.getItem(PENDING_KEY); } catch { return null; }
}

export function clearPendingReward(): void {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* nada que limpiar */ }
}
