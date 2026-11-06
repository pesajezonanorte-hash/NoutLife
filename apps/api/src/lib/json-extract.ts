/** Extract first balanced {...} JSON object from a string. Handles code fences and prefixes. */
export function extractJsonObject(raw: string): unknown | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const firstBrace = stripped.indexOf('{');
  if (firstBrace < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = firstBrace; i < stripped.length; i++) {
    const c = stripped[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const candidate = stripped.slice(firstBrace, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}
