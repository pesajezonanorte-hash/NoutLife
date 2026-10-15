// Cuentas que ven la zona de administración. El servidor decide (requireAdmin);
// esto solo oculta la ruta a las demás cuentas.
const ADMIN_EMAILS = ['ztafakss@gmail.com', 'prizzypelo@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ADMIN_EMAILS.includes(email!.trim().toLowerCase());
}
