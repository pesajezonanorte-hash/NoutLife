// Utilidades puras de la oficina: el texto que devuelve el copiloto convertido en HTML del documento y
// las líneas de una diapositiva. Se prueban en tests/unit/office.unit.ts.

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Texto plano a HTML del documento: párrafos separados por una línea en blanco; las líneas que empiezan con
 * «- », «• » o «* » forman una lista; una línea corta terminada en «:» sola es un título.
 */
export function textToHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => /^[-•*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${escape(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
    if (lines.length === 1 && lines[0].length <= 80 && /:$/.test(lines[0])) return `<h3>${escape(lines[0].slice(0, -1))}</h3>`;
    return `<p>${lines.map(escape).join('<br>')}</p>`;
  }).join('');
}

/** Las líneas de una diapositiva de viñetas, sin el guion o la viñeta del principio. */
export const bulletLines = (body: string) => body.split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);

/** Id corto para una diapositiva nueva. */
export const newId = () => Math.random().toString(36).slice(2, 10);
