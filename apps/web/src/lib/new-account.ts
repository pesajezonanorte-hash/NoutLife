// «Cuenta nueva»: menos de 24 h desde el alta. Solo a ellas les sale el tutorial de
// bienvenida (AppShell), así que solo ellas tienen que esperarlo antes de otros avisos.
export const NEW_ACCOUNT_MS = 24 * 60 * 60_000;

export function isNewAccount(createdAt: string | null | undefined, now = Date.now()): boolean {
  return Boolean(createdAt) && now - new Date(createdAt!).getTime() < NEW_ACCOUNT_MS;
}
