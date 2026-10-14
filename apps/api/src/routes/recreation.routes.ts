import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { publicErrorMessage } from '../middleware/error.middleware';
import { createRecreationSchema, updateRecreationSchema } from '../schemas/activity.schemas';
import { createRecreation, deleteRecreation, listRecreation, updateRecreation } from '../services/recreation.service';

const router = Router();
router.use(requireAuth);
// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('recreation'));

router.get('/', async (req, res) => {
  try { res.json({ entries: await listRecreation((req as AuthRequest).userId!) }); }
  catch (err) { res.status(500).json({ error: publicErrorMessage(err) }); }
});

router.post('/', validate(createRecreationSchema), async (req, res) => {
  try { res.status(201).json(await createRecreation((req as AuthRequest).userId!, req.body)); }
  catch (err) { res.status(500).json({ error: publicErrorMessage(err) }); }
});

router.patch('/:id', validate(updateRecreationSchema), async (req, res) => {
  try {
    const result = await updateRecreation((req as AuthRequest).userId!, req.params.id, req.body);
    if (!result) { res.status(404).json({ error: 'Esa función ya no existe.' }); return; }
    res.json(result);
  } catch (err) { res.status(500).json({ error: publicErrorMessage(err) }); }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!(await deleteRecreation((req as AuthRequest).userId!, req.params.id))) { res.status(404).json({ error: 'Esa función ya no existe.' }); return; }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: publicErrorMessage(err) }); }
});

export default router;
