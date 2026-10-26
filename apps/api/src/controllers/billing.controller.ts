import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as billing from '../services/billing.service';
import type { CreatorCodeBody, IntervalBody, PaymentMethodBody, SubscribeBody } from '../schemas/billing.schemas';
import type { WompiEvent } from '../lib/wompi';
import { deviceIdOf } from '../lib/device';

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

export async function preview(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await billing.getPlanPreview(req.userId!));
  } catch {
    res.status(500).json({ error: 'No se pudo calcular tu plan.' });
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
    const body = req.body as PaymentMethodBody;
    res.json({ subscription: await billing.savePaymentMethod(req.userId!, { ...body, deviceId: deviceIdOf(req, res) }) });
  } catch (error) {
    sendError(res, error, 'PAYMENT_METHOD');
  }
}

export async function subscribe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { interval } = req.body as SubscribeBody;
    res.json({ subscription: await billing.subscribeNow(req.userId!, interval) });
  } catch (error) {
    sendError(res, error, 'SUBSCRIBE');
  }
}

/** Mensual o anual para el próximo cobro (fin de la prueba o renovación). */
export async function interval(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.setBillingInterval(req.userId!, (req.body as IntervalBody).interval) });
  } catch (error) {
    sendError(res, error, 'INTERVAL');
  }
}

/** Datos públicos de un código (creador y descuento) para mostrarlos antes de aplicarlo. */
export async function lookupCreatorCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ creatorCode: await billing.lookupCreatorCode(req.params.code) });
  } catch (error) {
    sendError(res, error, 'CREATOR_CODE_LOOKUP');
  }
}

export async function applyCreatorCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.applyCreatorCode(req.userId!, (req.body as CreatorCodeBody).code) });
  } catch (error) {
    sendError(res, error, 'CREATOR_CODE');
  }
}

export async function removeCreatorCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.removeCreatorCode(req.userId!) });
  } catch (error) {
    sendError(res, error, 'CREATOR_CODE');
  }
}

/** Paywall de entrada: «Continuar con el Plan Lite». Sin tarjeta ni cobros. */
export async function chooseLite(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json({ subscription: await billing.chooseLite(req.userId!) });
  } catch (error) {
    sendError(res, error, 'LITE');
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

/** Estado para el aviso de Nequi: lectura pura, sin consultar a Wompi. */
export async function subscription(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await billing.getSubscription(req.userId!));
  } catch (error) {
    sendError(res, error, 'SUBSCRIPTION');
  }
}

/** «Ya lo aprobé»: revisa en Wompi el cobro en espera de Nequi. */
export async function refreshPending(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await billing.refreshPendingApproval(req.userId!));
  } catch (error) {
    sendError(res, error, 'REFRESH_PENDING');
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
