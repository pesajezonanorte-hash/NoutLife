// Zona de administración: solo estos correos ven /admin y /admin/users.
// La comprobación es del servidor (con el correo de la base, no del token); el
// menú del frontend solo la refleja.
export const ADMIN_EMAILS = new Set(['ztafakss@gmail.com', 'prizzypelo@gmail.com', 'eduard.c.t.07@gmail.com']);

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ADMIN_EMAILS.has(email!.trim().toLowerCase());
}
