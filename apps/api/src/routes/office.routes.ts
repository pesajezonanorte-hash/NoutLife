import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePro } from '../middleware/plan.middleware';
import { sageDailyLimiter, sageLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import { handle } from '../lib/http';
import { createOfficeSchema, officeAiSchema, updateOfficeSchema } from '../schemas/office.schemas';
import * as svc from '../services/office.service';

// Oficina de la Libreta: abierta en todos los planes, como la Libreta. El copiloto es IA: solo Pro.
const router = Router();
router.use(requireAuth);

router.post('/ai', requirePro('ai'), sageLimiter, sageDailyLimiter, validate(officeAiSchema), handle((req) => svc.copilot(req.body)));

router.get('/', handle((req) => svc.listFiles(req.userId!)));
router.post('/', validate(createOfficeSchema), handle((req) => svc.createFile(req.userId!, req.body), 201));
router.get('/:id', handle((req) => svc.getFile(req.userId!, req.params.id)));
router.put('/:id', validate(updateOfficeSchema), handle((req) => svc.updateFile(req.userId!, req.params.id, req.body)));
router.delete('/:id', handle((req) => svc.deleteFile(req.userId!, req.params.id)));

export default router;
