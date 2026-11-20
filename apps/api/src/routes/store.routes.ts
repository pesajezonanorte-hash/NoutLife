import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { buildLimiter, clientIp } from '../middleware/rate-limit.middleware';
import * as store from '../services/store.service';
import { StoreError } from '../services/store.service';
import {
  createOrderSchema, findOrderSchema, orderPatchSchema, productCreateSchema, productUpdateSchema, proofSchema,
  providerProductSchema, providerSchema, providerUpdateSchema, sessionSchema, settingsSchema, transitionSchema, wompiConfirmSchema,
} from '../schemas/store.schemas';

// Tienda (módulo store). Lo público lo usa el sitio de la tienda a través de su propio
// dominio; el panel entra con un token propio que se pide desde una sesión de la app.
const router = Router();

const sendStoreError = (res: Response, next: NextFunction) => (err: unknown) => {
  if (err instanceof StoreError) { res.status(err.status).json({ error: err.message, code: err.code }); return; }
  next(err);
};

const handle = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  Promise.resolve()
    .then(() => fn(req, res))
    .then((data) => { if (!res.headersSent) res.json(data); }, sendStoreError(res, next));
};

const limit = (name: string, max: number, windowMs = 10 * 60_000) => buildLimiter({ windowMs, max, key: (r) => `store-${name}:${clientIp(r)}` });
const readLimit = limit('read', 240, 60_000);

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/** Fecha AAAA-MM-DD en hora de Colombia; `to` incluye todo ese día. */
function day(value: unknown, addDays = 0): Date | undefined {
  const s = str(value);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const date = new Date(`${s}T00:00:00-05:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + addDays);
  return date;
}
const range = (req: Request) => ({ from: day(req.query.from), to: day(req.query.to, 1) });
const param = (req: Request, name: string) => String(req.params[name]);

// ─── Tienda ─────────────────────────────────────────────────────────────────

router.get('/catalog', readLimit, handle(() => store.getCatalog()));
router.get('/products/:slug', readLimit, handle((req) => store.getPublicProduct(param(req, 'slug'))));
router.post('/orders', limit('order', 10), validate(createOrderSchema), handle((req) => store.createOrder(req.body, clientIp(req))));
router.post('/orders/find', limit('find', 20), validate(findOrderSchema), handle((req) => store.findOrder(req.body.code, req.body.whatsapp)));
router.get('/orders/:id', readLimit, handle((req) => store.getPublicOrder(param(req, 'id'))));
router.post('/orders/:id/proof', limit('proof', 10), validate(proofSchema), handle((req) => store.addProof(param(req, 'id'), req.body)));
router.post('/orders/:id/wompi', limit('wompi', 20), handle((req) => store.startWompi(param(req, 'id'))));
router.post('/orders/:id/wompi/confirm', limit('wompi', 20), validate(wompiConfirmSchema), handle((req) => store.confirmWompi(param(req, 'id'), req.body.transactionId)));

// ─── Entrada al panel ───────────────────────────────────────────────────────

router.post('/admin/handoff', requireAuth, limit('handoff', 20, 60_000), handle((req) => store.createHandoff((req as AuthRequest).userId!)));
router.post('/admin/session', limit('session', 20, 60_000), validate(sessionSchema), handle((req) => store.exchangeHandoff(req.body.token)));

// ─── Panel ──────────────────────────────────────────────────────────────────

interface PanelRequest extends Request { panelUserId?: string; panelEmail?: string }

function requirePanel(req: PanelRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  try {
    const claims = store.verifyPanelSession(header.startsWith('Bearer ') ? header.slice(7) : '');
    req.panelUserId = claims.userId;
    req.panelEmail = claims.email;
    next();
  } catch (err) {
    sendStoreError(res, next)(err);
  }
}

const admin = Router();
admin.use(requirePanel, buildLimiter({ windowMs: 60_000, max: 600, key: (r) => `store-admin:${(r as PanelRequest).panelUserId ?? clientIp(r)}` }));

admin.get('/me', handle((req) => ({ email: (req as PanelRequest).panelEmail })));
admin.get('/summary', handle((req) => store.summary(range(req))));
admin.get('/orders', handle((req) => store.listOrders({ status: str(req.query.status), q: str(req.query.q), ...range(req) })));
admin.get('/orders/:id', handle((req) => store.orderDetail(param(req, 'id'))));
admin.post('/orders/:id/status', validate(transitionSchema), handle((req) => store.adminTransition(param(req, 'id'), req.body)));
admin.patch('/orders/:id', validate(orderPatchSchema), handle((req) => store.updateOrder(param(req, 'id'), req.body)));
admin.post('/orders/:id/wompi/check', validate(wompiConfirmSchema), handle((req) => store.adminCheckWompi(param(req, 'id'), req.body.transactionId)));
admin.get('/files/:id', (req, res, next) => {
  store.getFile(param(req, 'id')).then((file) => {
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="comprobante-${file.id}"`);
    res.send(Buffer.from(file.bytes));
  }, sendStoreError(res, next));
});
admin.get('/customers', handle((req) => store.listCustomers(str(req.query.q))));
admin.get('/sales', handle((req) => store.sales(range(req))));
admin.get('/products', handle(() => store.listProducts()));
admin.post('/products', validate(productCreateSchema), handle((req) => store.createProduct(req.body)));
admin.get('/products/:id', handle((req) => store.getProduct(param(req, 'id'))));
admin.patch('/products/:id', validate(productUpdateSchema), handle((req) => store.updateProduct(param(req, 'id'), req.body)));
admin.get('/providers', handle(() => store.listProviders()));
admin.post('/providers', validate(providerSchema), handle((req) => store.createProvider(req.body)));
admin.patch('/providers/:id', validate(providerUpdateSchema), handle((req) => store.updateProvider(param(req, 'id'), req.body)));
admin.put('/providers/:id/products/:productId', validate(providerProductSchema), handle((req) => store.setProviderProduct(param(req, 'id'), param(req, 'productId'), req.body)));
admin.delete('/providers/:id/products/:productId', handle((req) => store.removeProviderProduct(param(req, 'id'), param(req, 'productId'))));
admin.get('/settings', handle(() => store.adminSettings()));
admin.put('/settings', validate(settingsSchema), handle((req) => store.updateSettings(req.body)));

router.use('/admin', admin);

export default router;
