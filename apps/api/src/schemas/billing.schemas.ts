import { z } from 'zod';

/**
 * Tarjeta ya tokenizada por Wompi en el navegador. Aquí nunca llega el número:
 * solo el token y, para mostrar, la marca y los últimos 4 dígitos.
 */
export const paymentMethodSchema = z.object({
  token: z.string().regex(/^tok_[A-Za-z0-9_]+$/, 'El token de la tarjeta no es válido.').max(120),
  brand: z.string().regex(/^[A-Za-z ]{2,20}$/).optional(),
  // Datos públicos del token de Wompi: con ellos se calcula la huella anti-abuso de pruebas.
  lastFour: z.string().regex(/^\d{4}$/),
  bin: z.string().regex(/^\d{6,8}$/),
  expMonth: z.string().regex(/^\d{1,2}$/),
  expYear: z.string().regex(/^\d{2,4}$/),
  holder: z.string().min(2).max(80),
  /** La persona aceptó la política de privacidad y la autorización de datos de Wompi. */
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Acepta los términos de Wompi para continuar.' }) }),
  acceptPersonalData: z.literal(true, { errorMap: () => ({ message: 'Acepta la autorización de datos personales para continuar.' }) }),
}).strict();

export type PaymentMethodBody = z.infer<typeof paymentMethodSchema>;
