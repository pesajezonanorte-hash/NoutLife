import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as billing from '../services/billing.service';
import type { PaymentMethodBody } from '../schemas/billing.schemas';
import type { WompiEvent } from '../lib/wompi';

function sendError(res: Response, error: unknown, operation: string): void {
  if (error instanceof billing.BillingError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error(`[BILLING_${operation}_ERROR]`, error);
  res.status(500).json({ error: 'No pudimos completar la operación de pago. Inténtalo de nuevo.', code: 'BILLING_ERROR' });
}

/** Público: llave pública de Wompi, precio, prueba, límites de Lite y contratos a aceptar. */
export async function config(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await billing.getBillingConfig());
  } catch (error) {
    sendError(res, error, 'CONFIG');
  }
}

export async function status(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await billing.getBillingStatus(req.userId!));
  } catch (error) {
    sendError(res, error, 'STATUS');
  }
}

export async function paymentMethod(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { token, brand, lastFour, bin, expMonth, expYear, holder } = req.body as PaymentMethodBody;
    res.json({ subscription: await billing.savePaymentMethod(req.userId!, { token, brand, lastFour, bin, expMonth, expYear, holder }) });
  } catch (error) {
    sendError(res, error, 'PAYMENT_METHOD');
  }
}

export async function subscribe(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.subscribeNow(req.userId!) });
  } catch (error) {
    sendError(res, error, 'SUBSCRIBE');
  }
}

export async function cancel(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.cancelSubscription(req.userId!) });
  } catch (error) {
    sendError(res, error, 'CANCEL');
  }
}

export async function resume(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.resumeSubscription(req.userId!) });
  } catch (error) {
    sendError(res, error, 'RESUME');
  }
}

/** Eventos de Wompi. Responde 200 solo si el evento se procesó o no nos concierne; Wompi reintenta lo demás. */
export async function webhook(req: Request, res: Response): Promise<void> {
  try {
    const checksum = req.header('x-event-checksum');
    const result = await billing.handleWompiEvent(req.body as WompiEvent, checksum);
    res.json({ ok: true, ...result });
  } catch (error) {
    sendError(res, error, 'WEBHOOK');
  }
}
