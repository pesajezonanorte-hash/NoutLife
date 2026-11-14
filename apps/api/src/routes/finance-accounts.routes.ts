import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { handle } from '../lib/http';
import { createAccountSchema, createTransferSchema, updateAccountSchema } from '../schemas/finance.schemas';
import * as svc from '../services/finance-accounts.service';

// Carteras y traslados: se montan bajo /finances, con el mismo candado de la zona.
const router = Router();
router.use(requireAuth);
router.use(requireProZone('finances'));

router.get('/accounts', handle((req) => svc.listAccounts(req.userId!)));
router.post('/accounts', validate(createAccountSchema), handle((req) => svc.createAccount(req.userId!, req.body), 201));
router.patch('/accounts/:id', validate(updateAccountSchema), handle((req) => svc.updateAccount(req.userId!, req.params.id, req.body)));
router.delete('/accounts/:id', handle((req) => svc.deleteAccount(req.userId!, req.params.id)));

router.get('/transfers', handle((req) => svc.listTransfers(req.userId!)));
router.post('/transfers', validate(createTransferSchema), handle((req) => svc.createTransfer(req.userId!, req.body), 201));
router.delete('/transfers/:id', handle((req) => svc.deleteTransfer(req.userId!, req.params.id)));

export default router;
