// Id del dispositivo: el mismo que usan las pruebas gratis (cookie nl_did, cabecera
// X-Device-Id). Sirve para auditar y para detectar auto-referidos (plan v3, T9). No es una
// huella del navegador: es un id aleatorio que el cliente guarda y el servidor restaura.
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { REFRESH_COOKIE_OPTIONS } from './jwt';

export const DEVICE_COOKIE = 'nl_did';
export const isDeviceId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{16,64}$/.test(v);

/**
 * Id del dispositivo en tres capas: cookie HttpOnly/Secure (la fija el servidor; el JS no la
 * ve ni la borra), y localStorage + IndexedDB en el cliente (cabecera X-Device-Id). Cada capa
 * restaura a las otras: la cookie se renueva y el id vuelve al cliente en la respuesta.
 */
export function deviceIdOf(req: Request, res: Response): string {
  const cookie = req.cookies?.[DEVICE_COOKIE];
  const header = req.header('x-device-id');
  const id = isDeviceId(cookie) ? cookie : isDeviceId(header) ? header : randomUUID();
  res.cookie(DEVICE_COOKIE, id, { ...REFRESH_COOKIE_OPTIONS, maxAge: 400 * 24 * 60 * 60 * 1000 }); // 400 d: tope de Chrome
  res.setHeader('X-Device-Id', id);
  return id;
}
