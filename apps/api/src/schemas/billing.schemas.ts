import { z } from 'zod';

/** Plan del cobro: mensual o anual. */
const interval = z.enum(['month', 'year']);

/** Lo que Wompi exige aceptar antes de guardar cualquier medio de pago. */
const acceptances = {
  /** La persona aceptó la política de privacidad y la autorización de datos de Wompi. */
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Acepta los términos de Wompi para continuar.' }) }),
  acceptPersonalData: z.literal(true, { errorMap: () => ({ message: 'Acepta la autorización de datos personales para continuar.' }) }),
  /** Plan elegido en el checkout para el próximo cobro. Los clientes anteriores no lo mandan (mensual). */
  interval: interval.optional(),
};

/**
 * Medio de pago ya tokenizado en el navegador. Aquí nunca llega el número de
 * tarjeta ni el de Nequi: solo tokens. La huella anti-abuso (BIN, últimos 4,
 * vencimiento o celular) la lee el servidor en Wompi; lo que mande el cliente sobre eso se descarta.
 */
const cardMethod = z.object({
  method: z.literal('CARD'),
  token: z.string().regex(/^tok_[A-Za-z0-9_]+$/, 'El token del método de pago no es válido.').max(120),
  /** Solo para mostrar («VISA •••• 4242»). */
  brand: z.string().regex(/^[A-Za-z ]{2,20}$/).optional(),
  ...acceptances,
});

const nequiMethod = z.object({
  method: z.literal('NEQUI'),
  /** Token de Nequi (nequi_…) que la persona aprobó en su app. */
  nequiToken: z.string().regex(/^nequi_[A-Za-z0-9_]+$/, 'La vinculación con Nequi no es válida.').max(120),
  /** Cédula, solo dígitos. Forma parte de la huella anti-abuso: nunca se guarda en texto plano. */
  documentNumber: z.string().regex(/^\d{6,10}$/, 'La cédula debe tener entre 6 y 10 dígitos.'),
  ...acceptances,
});

export const paymentMethodSchema = z.preprocess(
  // Clientes anteriores solo mandaban la tarjeta, sin el campo `method`.
  (body) => (body && typeof body === 'object' && !('method' in body) ? { ...body, method: 'CARD' } : body),
  z.discriminatedUnion('method', [cardMethod, nequiMethod]),
);

export type PaymentMethodBody = z.infer<typeof paymentMethodSchema>;

/** «Activar Pro»: el plan es opcional porque los clientes anteriores llaman sin cuerpo (mensual). */
export const subscribeSchema = z.preprocess((body) => body ?? {}, z.object({ interval: interval.optional() }));
export type SubscribeBody = z.infer<typeof subscribeSchema>;

export const intervalSchema = z.object({ interval });
export type IntervalBody = z.infer<typeof intervalSchema>;

/** El formato fino (mayúsculas, caracteres) lo decide lib/creator-codes; aquí solo se acota el tamaño. */
export const creatorCodeSchema = z.object({ code: z.string().trim().min(1, 'Escribe el código.').max(40) });
export type CreatorCodeBody = z.infer<typeof creatorCodeSchema>;
