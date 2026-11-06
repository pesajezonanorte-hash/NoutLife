import api from '../lib/api';

/** Cambio en metas que propone el Sabio. Solo se aplica si la persona lo confirma. */
export type SageFinanceAction =
  | { action: 'create_goal'; title: string; targetAmount: number; deadline?: string }
  | { action: 'update_goal'; goalId: string; title?: string; targetAmount?: number; deadline?: string | null }
  | { action: 'contribute_goal'; goalId: string; amount: number };

export interface SageChatReply {
  reply: string;
  action?: SageFinanceAction | null;
  goalTitle?: string | null;
}

export async function sageChat(message: string): Promise<SageChatReply> {
  const { data } = await api.post<SageChatReply>('/sage/chat', { message });
  return data;
}

/** Confirmación de una propuesta: el servidor la vuelve a validar y la aplica a tus metas. */
export async function applySageAction(action: SageFinanceAction): Promise<void> {
  await api.post('/sage/actions/apply', { action });
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
