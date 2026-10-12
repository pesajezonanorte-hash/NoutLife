import api from '../lib/api';

export async function sageChat(message: string): Promise<{ reply: string }> {
  const { data } = await api.post<{ reply: string }>('/sage/chat', { message });
  return data;
}

// raw: texto del Sabio cuando la respuesta no fue JSON parseable (p. ej. la
// respuesta fija de cuota agotada). El panel la puede mostrar tal cual.
export async function sageSuggestQuests(): Promise<{ quests: unknown[]; raw?: string }> {
  const { data } = await api.post<{ quests: unknown[]; raw?: string }>('/sage/suggest-quests');
  return data;
}

export async function sageAnalyzeHabits(): Promise<{ reply: string }> {
  const { data } = await api.post<{ reply: string }>('/sage/analyze-habits');
  return data;
}

export async function sageAnalyzeFinances(): Promise<{ reply: string }> {
  const { data } = await api.post<{ reply: string }>('/sage/analyze-finances');
  return data;
}

export async function sagePlanWorkout(): Promise<{ reply: string }> {
  const { data } = await api.post<{ reply: string }>('/sage/plan-workout');
  return data;
}

export async function sageDailySummary(): Promise<{ reply: string }> {
  const { data } = await api.get<{ reply: string }>('/sage/daily-summary');
  return data;
}

export async function sageDailyTip(): Promise<{ tip: string }> {
  const { data } = await api.get<{ tip: string }>('/sage/daily-tip');
  return data;
}

export interface SageRateInfo {
  callsToday: number;
  limit: number;
  remaining: number;
  resetAt: string;
  /** Personas activas hoy: el límite se reparte entre ellas. */
  activeUsers?: number;
}

export async function sageRateInfo(): Promise<SageRateInfo> {
  const { data } = await api.get<SageRateInfo>('/sage/rate-info');
  return data;
}
