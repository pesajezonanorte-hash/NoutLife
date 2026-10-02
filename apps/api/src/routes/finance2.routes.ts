import { publicErrorMessage } from '../middleware/error.middleware';
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import {
  getRecurringTransactions, createRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction,
  getDebts, createDebt, updateDebt, addDebtPayment, deleteDebt,
  getFinancialProjection,
} from '../services/finance2.service';

const router = Router();
router.use(requireAuth);

// Recurring Transactions
router.get('/recurring', async (req, res) => {
  try { res.json(await getRecurringTransactions((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.post('/recurring', async (req, res) => {
  try {
    const { type, amount, category, description, dayOfMonth } = req.body;
    res.status(201).json(await createRecurringTransaction((req as AuthRequest).userId!, { type, amount: Number(amount), category, description, dayOfMonth: Number(dayOfMonth) }));
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.patch('/recurring/:id', async (req, res) => {
  try {
    await updateRecurringTransaction((req as AuthRequest).userId!, req.params.id, req.body);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.delete('/recurring/:id', async (req, res) => {
  try {
    await deleteRecurringTransaction((req as AuthRequest).userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

// Debts
router.get('/debts', async (req, res) => {
  try { res.json(await getDebts((req as AuthRequest).userId!)); }
  catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.post('/debts', async (req, res) => {
  try {
    const { title, type, originalAmount, interestRate, personName, dueDate } = req.body;
    res.status(201).json(await createDebt((req as AuthRequest).userId!, { title, type, originalAmount: Number(originalAmount), interestRate, personName, dueDate: dueDate ? new Date(dueDate) : undefined }));
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.patch('/debts/:id', async (req, res) => {
  try {
    await updateDebt((req as AuthRequest).userId!, req.params.id, req.body);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.post('/debts/:id/payment', async (req, res) => {
  try {
    const { amount, date, notes } = req.body;
    res.status(201).json(await addDebtPayment((req as AuthRequest).userId!, req.params.id, Number(amount), new Date(date), notes));
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

router.delete('/debts/:id', async (req, res) => {
  try {
    await deleteDebt((req as AuthRequest).userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

// Projection
router.get('/projection', async (req, res) => {
  try {
    const months = Number(req.query.months ?? 3);
    res.json(await getFinancialProjection((req as AuthRequest).userId!, months));
  } catch (err: any) { res.status(400).json({ message: publicErrorMessage(err) }); }
});

export default router;
