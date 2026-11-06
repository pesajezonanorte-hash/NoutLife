// Pro de cortesía concedido desde el panel de administración: días concretos o indefinido.
// Reglas puras, sin base de datos. La base vive en services/comp-grant.service.ts.

/** Días máximos que se pueden conceder de una vez (10 años). Indefinido es otra opción. */
export const COMP_MAX_DAYS = 3650;

/** Lo que quedó registrado en el historial: días sumados o Pro indefinido. */
export type CompOutcome = 'activated' | 'extended' | 'permanent';

export type CompTarget = { kind: 'email'; value: string } | { kind: 'username'; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Interpreta lo que escribió el admin: un correo ("ana@ejemplo.com") o un @usuario ("@ana" o "ana").
 * null si no es ninguno de los dos. El correo se compara en minúsculas (así se guarda); el usuario,
 * sin distinguir mayúsculas al buscarlo.
 */
export function normalizeCompTarget(raw: string): CompTarget | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.includes('@') && !text.startsWith('@')) {
    const email = text.toLowerCase();
    return EMAIL.test(email) ? { kind: 'email', value: email } : null;
  }
  const username = text.replace(/^@/, '');
  return USERNAME.test(username) ? { kind: 'username', value: username } : null;
}
