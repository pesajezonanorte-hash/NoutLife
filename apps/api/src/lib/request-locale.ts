/** Idioma de la persona: la web manda su idioma en `Accept-Language`; sin cabecera, español. */
export function localeOf(req: { headers: { 'accept-language'?: string } }): 'es' | 'en' {
  const first = (req.headers['accept-language'] ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'es';
}
