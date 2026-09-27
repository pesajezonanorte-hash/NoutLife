import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as ctrl from '../controllers/finance.controller';
import {
  contributeToGoalSchema,
  createBudgetSchema,
  createFinancialGoalSchema,
  createTransactionSchema,
  updateBudgetSchema,
  updateFinancialGoalSchema,
  updateTransactionSchema,
} from '../schemas/finance.schemas';

const router = Router();
router.use(requireAuth);

router.get('/dashboard',                    ctrl.getFinanceDashboard);
router.get('/report/:year/:month',          ctrl.getFinanceReport);

router.get('/transactions',                 ctrl.listTransactions);
router.post('/transactions', validate(createTransactionSchema), ctrl.createTransaction);
router.patch('/transactions/:id', validate(updateTransactionSchema), ctrl.updateTransaction);
router.delete('/transactions/:id',          ctrl.deleteTransaction);
router.get('/transactions/summary',         ctrl.getTransactionSummary);

router.get('/budgets',                      ctrl.listBudgets);
router.post('/budgets', validate(createBudgetSchema), ctrl.createBudget);
router.patch('/budgets/:id', validate(updateBudgetSchema), ctrl.updateBudget);
router.delete('/budgets/:id',               ctrl.deleteBudget);
router.get('/budgets/alert',                ctrl.getBudgetAlerts);

router.get('/goals',                        ctrl.listFinancialGoals);
router.post('/goals', validate(createFinancialGoalSchema), ctrl.createFinancialGoal);
router.patch('/goals/:id', validate(updateFinancialGoalSchema), ctrl.updateFinancialGoal);
router.delete('/goals/:id',                 ctrl.deleteFinancialGoal);
router.post('/goals/:id/contribute', validate(contributeToGoalSchema), ctrl.contributeToGoal);

export default router;
