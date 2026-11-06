// Aplica una propuesta de meta financiera que la persona confirmó en la app. Vuelve a
// validar el cambio (nunca confía en lo que llegó del cliente) y usa los mismos servicios
// que la zona de Finanzas: el dueño de la meta se comprueba ahí (where: { id, userId }).
import { sageFinanceActionSchema, type SageFinanceAction } from '../lib/sage-actions';
import { contributeToGoal, createFinancialGoal, updateFinancialGoal } from './finance.service';

export function parseSageFinanceAction(input: unknown): { ok: true; action: SageFinanceAction } | { ok: false; message: string } {
  const parsed = sageFinanceActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Propuesta no válida.' };
  return { ok: true, action: parsed.data };
}

export async function applySageFinanceAction(userId: string, action: SageFinanceAction) {
  switch (action.action) {
    case 'create_goal':
      return createFinancialGoal(userId, { title: action.title, targetAmount: action.targetAmount, deadline: action.deadline });
    case 'update_goal': {
      const { action: _kind, goalId, ...changes } = action;
      return updateFinancialGoal(userId, goalId, changes);
    }
    case 'contribute_goal':
      return contributeToGoal(userId, action.goalId, action.amount);
  }
}
