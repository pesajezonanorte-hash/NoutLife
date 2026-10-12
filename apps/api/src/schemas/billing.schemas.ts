import { z } from 'zod';

/** Lo que Wompi exige aceptar antes de guardar cualquier medio de pago. */
const acceptances = {
  /** La persona aceptó la política de privacidad y la autorización de datos de Wompi. */
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Acepta los términos de Wompi para continuar.' }) }),
  acceptPersonalData: z.literal(true, { errorMap: () => ({ message: 'Acepta la autorización de datos personales para continuar.' }) }),
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
