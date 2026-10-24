// Correos de la lista de /admin listos para pegar: sin espacios sobrantes,
// sin duplicados (sin importar mayúsculas) y en el orden en que aparecen.
export function uniqueEmails(emails: Iterable<string>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of emails) {
    const email = raw.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    unique.push(email);
  }
  return unique;
}

/** Separados por comas: así se pegan directo en «Para» o «CCO» de un correo. */
export function emailsToClipboardText(emails: Iterable<string>): string {
  return uniqueEmails(emails).join(', ');
}
