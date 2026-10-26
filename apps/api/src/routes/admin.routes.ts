import { Router, type NextFunction, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import * as admin from '../services/admin.service';
import * as creators from '../services/creator-code.service';
import { createCreatorCodeSchema, updateCreatorCodeSchema } from '../schemas/creator-code.schemas';

const router = Router();
router.use(requireAuth, requireAdmin);

const creatorError = (res: Response, next: NextFunction) => (err: unknown) => {
  if (err instanceof creators.CreatorCodeError) { res.status(err.status).json({ error: err.message }); return; }
  next(err);
};

// Códigos de creadores: rendimiento (?from=&to= en ISO), alta y edición. Nunca se borran.
router.get('/creator-codes', async (req, res, next) => {
  try { res.json(await creators.creatorCodesReport(creators.rangeOf(req.query))); } catch (err) { next(err); }
});

router.post('/creator-codes', validate(createCreatorCodeSchema), (req, res, next) => {
  creators.createCreatorCode(req.body).then((code) => res.status(201).json({ code }), creatorError(res, next));
});

router.patch('/creator-codes/:id', validate(updateCreatorCodeSchema), (req, res, next) => {
  creators.updateCreatorCode(String(req.params.id), req.body).then((code) => res.json({ code }), creatorError(res, next));
});

router.delete('/users/:id', async (req: AuthRequest, res, next) => {
  try { res.json(await admin.deleteUser(req.userId!, String(req.params.id))); }
  catch (err) {
    if (err instanceof admin.AdminError) { res.status(err.status).json({ error: err.message }); return; }
    next(err);
  }
});

router.get('/users', async (_req, res, next) => {
  try { res.json({ users: await admin.listUsers() }); } catch (err) { next(err); }
});

router.get('/push-stats', async (_req, res, next) => {
  try { res.json(await admin.pushStats()); } catch (err) { next(err); }
});

router.post('/users/:id/billing-recheck', async (req, res, next) => {
  try { res.json(await admin.recheckBilling(String(req.params.id))); } catch (err) { next(err); }
});

router.get('/metrics', async (_req, res, next) => {
  try { res.json(await admin.metrics()); } catch (err) { next(err); }
});

export default router;
