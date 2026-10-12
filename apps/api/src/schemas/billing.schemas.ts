import { z } from 'zod';

/**
 * Medio de pago ya tokenizado por Wompi en el navegador. Aquí nunca llega el
 * número: solo el token. Los datos de la huella anti-abuso (BIN, últimos 4,
 * vencimiento) los lee el servidor en Wompi; lo demás que mande el cliente se descarta.
 */
export const paymentMethodSchema = z.object({
  token: z.string().regex(/^tok_[A-Za-z0-9_]+$/, 'El token del método de pago no es válido.').max(120),
  /** Solo para mostrar («VISA •••• 4242»). */
  brand: z.string().regex(/^[A-Za-z ]{2,20}$/).optional(),
  /** La persona aceptó la política de privacidad y la autorización de datos de Wompi. */
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Acepta los términos de Wompi para continuar.' }) }),
  acceptPersonalData: z.literal(true, { errorMap: () => ({ message: 'Acepta la autorización de datos personales para continuar.' }) }),
});

export type PaymentMethodBody = z.infer<typeof paymentMethodSchema>;
