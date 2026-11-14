import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { handle } from '../lib/http';
import { getPulse } from '../services/pulse.service';

// Pronóstico de carga de los próximos 7 días (lib/pulse). Abierto a todos los planes.
const router = Router();
router.use(requireAuth);
router.get('/', handle((req) => getPulse(req.userId!)));

export default router;
