import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { buildLimiter } from '../middleware/rate-limit.middleware';
import { paymentMethodSchema } from '../schemas/billing.schemas';
import * as billing from '../controllers/billing.controller';

const router = Router();

// Frena las pruebas de tarjetas robadas («carding») y los dobles toques.
const cardLimiter = buildLimiter({
  windowMs: 60 * 60_000,
  max: 6,
  message: 'Demasiados intentos con métodos de pago. Inténtalo de nuevo en una hora.',
});
const chargeLimiter = buildLimiter({
  windowMs: 10 * 60_000,
  max: 5,
  message: 'Demasiados intentos de pago. Espera unos minutos.',
});

router.get('/config', billing.config);
// Wompi no envía token: la autenticidad se comprueba con el checksum del evento.
router.post('/webhook', billing.webhook);

router.get('/status', requireAuth, billing.status);
router.post('/payment-method', requireAuth, cardLimiter, validate(paymentMethodSchema), billing.paymentMethod);
router.post('/subscribe', requireAuth, chargeLimiter, billing.subscribe);
router.post('/cancel', requireAuth, billing.cancel);
router.post('/resume', requireAuth, billing.resume);
// Aviso de Nequi: el estado se lee sin consultar a Wompi; «Ya lo aprobé» sí consulta, con su propio límite.
router.get('/subscription', requireAuth, billing.subscription);
const pendingLimiter = buildLimiter({ windowMs: 60_000, max: 12, message: 'Espera un momento antes de volver a revisar tu pago.' });
router.post('/pending/refresh', requireAuth, pendingLimiter, billing.refreshPending);

export default router;
