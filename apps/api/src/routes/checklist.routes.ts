import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import * as checklists from '../services/checklist.service';

const router = Router();
router.use(requireAuth);
const userIdOf = (req: AuthRequest) => req.userId!;
const fail = (res: Response, err: unknown) => {
  const code = err instanceof Error ? err.message : '';
  if (code === 'CHECKLIST_NOT_FOUND' || code === 'CHECKLIST_ITEM_NOT_FOUND') {
    res.status(404).json({ error: 'La lista o el paso ya no existe.' });
    return;
  }
  res.status(500).json({ error: 'No se pudo completar la acción.' });
};
const cleanText = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

router.get('/', async (req, res, next) => {
  try { res.json(await checklists.listChecklists(userIdOf(req as AuthRequest))); }
  catch (err) { next(err); }
});

router.post('/', async (req, res) => {
  const { title, description, category = 'personal', isTemplate = false, items } = req.body ?? {};
  if (!cleanText(title, 100) || (description != null && typeof description !== 'string') ||
    (typeof description === 'string' && description.length > 500) ||
    !cleanText(category, 40) || typeof isTemplate !== 'boolean' ||
    (items !== undefined && (!Array.isArray(items) || items.length > 100 || items.some((item) => !cleanText(item?.title, 160))))) {
    res.status(400).json({ error: 'Revisa el título, la categoría y los pasos de la lista.' });
    return;
  }
  try {
    const data = await checklists.createChecklist(userIdOf(req as AuthRequest), { title, description, category, isTemplate, items });
    res.status(201).json(data);
  } catch { res.status(500).json({ error: 'No se pudo crear la lista.' }); }
});

router.post('/:id/duplicate', async (req, res) => {
  try { res.status(201).json(await checklists.duplicateChecklist(userIdOf(req as AuthRequest), req.params.id)); }
  catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try { res.json(await checklists.getChecklist(userIdOf(req as AuthRequest), req.params.id)); }
  catch (err) { fail(res, err); }
});

router.patch('/:id', async (req, res) => {
  const { title, description, category, isTemplate } = req.body ?? {};
  if ((title !== undefined && !cleanText(title, 100)) ||
    (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 500)) ||
    (category !== undefined && !cleanText(category, 40)) ||
    (isTemplate !== undefined && typeof isTemplate !== 'boolean')) {
    res.status(400).json({ error: 'Los datos de la lista no son válidos.' });
    return;
  }
  try { res.json(await checklists.updateChecklist(userIdOf(req as AuthRequest), req.params.id, { title, description, category, isTemplate })); }
  catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try { await checklists.deleteChecklist(userIdOf(req as AuthRequest), req.params.id); res.json({ success: true }); }
  catch (err) { fail(res, err); }
});

router.post('/:id/items', async (req, res) => {
  const { title } = req.body ?? {};
  if (!cleanText(title, 160)) { res.status(400).json({ error: 'Escribe un paso de hasta 160 caracteres.' }); return; }
  try { res.status(201).json(await checklists.addChecklistItem(userIdOf(req as AuthRequest), req.params.id, title)); }
  catch (err) { fail(res, err); }
});

router.patch('/items/:itemId', async (req, res) => {
  const { title, isDone, order } = req.body ?? {};
  if ((title !== undefined && !cleanText(title, 160)) ||
    (isDone !== undefined && typeof isDone !== 'boolean') ||
    (order !== undefined && (!Number.isInteger(order) || order < 0 || order > 1000))) {
    res.status(400).json({ error: 'El paso de la lista no es válido.' });
    return;
  }
  try { res.json(await checklists.updateChecklistItem(userIdOf(req as AuthRequest), req.params.itemId, { title, isDone, order })); }
  catch (err) { fail(res, err); }
});

router.delete('/items/:itemId', async (req, res) => {
  try { await checklists.deleteChecklistItem(userIdOf(req as AuthRequest), req.params.itemId); res.json({ success: true }); }
  catch (err) { fail(res, err); }
});

export default router;
