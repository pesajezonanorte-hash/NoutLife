// Hoja de cálculo de la oficina (Libreta): referencias de celda, rangos y un motor de fórmulas pequeño.
// Lógica pura (sin DOM): se prueba en tests/unit/sheet.unit.ts.
//
// Fórmulas: empiezan con «=». Números con punto decimal; los argumentos se separan con «;» o «,».
// Operadores: + - * / ^ % & = <> < > <= >=. Funciones (en inglés o en español): SUM/SUMA,
// AVERAGE/PROMEDIO, MIN, MAX, COUNT/CONTAR, IF/SI, ROUND/REDONDEAR, ABS.
// ponytail: insertar filas o columnas en medio no corre las referencias; se añaden al final.

export const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export type CellError = '#REF!' | '#DIV/0!' | '#VALOR!' | '#NOMBRE?' | '#CICLO!' | '#ERROR!';
export type CellValue = number | string | boolean | { error: CellError };

export const cellId = (col: number, row: number) => `${COL_LETTERS[col]}${row + 1}`;

export function parseCell(id: string): { col: number; row: number } | null {
  const m = /^([A-Z])([1-9]\d{0,2})$/.exec(id);
  return m ? { col: COL_LETTERS.indexOf(m[1]), row: Number(m[2]) - 1 } : null;
}

/** Las celdas de un rango «A1:C3», fila por fila. null si no es un rango válido. */
export function expandRange(range: string): string[] | null {
  const [from, to] = range.split(':');
  const a = parseCell(from ?? '');
  const b = parseCell(to ?? '');
  if (!a || !b) return null;
  const ids: string[] = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row += 1) {
    for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col += 1) ids.push(cellId(col, row));
  }
  return ids;
}

class SheetError extends Error {
  constructor(readonly code: CellError) { super(code); }
}
const fail = (code: CellError): never => { throw new SheetError(code); };
export const isError = (v: CellValue): v is { error: CellError } => typeof v === 'object' && v !== null;

/** Lo que se escribió en una celda sin «=»: número (con coma o punto, o con %) o texto. */
export function literal(raw: string): CellValue {
  const text = raw.trim();
  const m = /^(-?\d+(?:[.,]\d+)?)(%?)$/.exec(text);
  if (!m) return raw;
  const n = Number(m[1].replace(',', '.'));
  return m[2] ? n / 100 : n;
}

// ─── Análisis ─────────────────────────────────────────────────────────────────

type Tok = { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 'ref'; v: string } | { k: 'name'; v: string } | { k: 'op'; v: string };
type Node =
  | { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'bool'; v: boolean }
  | { t: 'ref'; id: string } | { t: 'range'; ids: string[] }
  | { t: 'un'; op: string; a: Node } | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'fn'; name: string; args: Node[] };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    if (/\s/.test(c)) { i += 1; continue; }
    // Referencia con o sin «$» (B$8, $A$1): el «$» fija la celda al copiar la fórmula; aquí no se copian, así que se ignora.
    const ref = /^\$?([A-Za-z])\$?([1-9]\d{0,2})(?![A-Za-z0-9_.(])/.exec(rest);
    if (ref && (ref[0].includes('$') || /^[A-Za-z]\d/.test(rest))) { out.push({ k: 'ref', v: `${ref[1].toUpperCase()}${ref[2]}` }); i += ref[0].length; continue; }
    const num = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(rest);
    if (num) { out.push({ k: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      for (; j < src.length; j += 1) {
        if (src[j] !== '"') { s += src[j]; continue; }
        if (src[j + 1] !== '"') break;
        s += '"';
        j += 1;
      }
      if (j >= src.length) fail('#ERROR!');
      out.push({ k: 'str', v: s });
      i = j + 1;
      continue;
    }
    const word = /^[A-Za-zÁÉÍÓÚáéíóúÑñ_][A-Za-z0-9ÁÉÍÓÚáéíóúÑñ_.]*/.exec(rest);
    if (word) {
      const upper = word[0].toUpperCase();
      out.push(/^[A-Z][1-9]\d{0,2}$/.test(upper) ? { k: 'ref', v: upper } : { k: 'name', v: upper });
      i += word[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') { out.push({ k: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&=<>%(),;:'.includes(c)) { out.push({ k: 'op', v: c }); i += 1; continue; }
    fail('#ERROR!');
  }
  return out;
}

const COMPARE = ['=', '<>', '<', '>', '<=', '>='];

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  /** El operador en la posición actual (null si es otra cosa). */
  const opAt = (): string | null => { const tok = toks[p]; return tok?.k === 'op' ? tok.v : null; };
  const isOp = (v: string) => opAt() === v;
  const expect = (v: string) => { if (!isOp(v)) fail('#ERROR!'); p += 1; };
  const binary = (next: () => Node, ops: string[]) => () => {
    let a = next();
    for (let op = opAt(); op !== null && ops.includes(op); op = opAt()) {
      p += 1;
      a = { t: 'bin', op, a, b: next() };
    }
    return a;
  };

  function primary(): Node {
    const tok = toks[p];
    p += 1;
    if (!tok) return fail('#ERROR!');
    if (tok.k === 'num') return { t: 'num', v: tok.v };
    if (tok.k === 'str') return { t: 'str', v: tok.v };
    if (tok.k === 'ref') {
      if (!isOp(':')) return { t: 'ref', id: tok.v };
      p += 1;
      const end = toks[p];
      p += 1;
      const ids = end?.k === 'ref' ? expandRange(`${tok.v}:${end.v}`) : null;
      return ids ? { t: 'range', ids } : fail('#REF!');
    }
    if (tok.k === 'name') {
      if (isOp('(')) {
        p += 1;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(';') || isOp(',')) { p += 1; args.push(comparison()); }
        }
        expect(')');
        return { t: 'fn', name: tok.v, args };
      }
      if (tok.v === 'TRUE' || tok.v === 'VERDADERO') return { t: 'bool', v: true };
      if (tok.v === 'FALSE' || tok.v === 'FALSO') return { t: 'bool', v: false };
      return fail('#NOMBRE?');
    }
    if (tok.v === '(') { const inner = comparison(); expect(')'); return inner; }
    return fail('#ERROR!');
  }
  function percent(): Node {
    let a = primary();
    while (isOp('%')) { p += 1; a = { t: 'un', op: '%', a }; }
    return a;
  }
  // Como en las hojas de cálculo, el signo va antes que la potencia: -2^2 = 4.
  function unary(): Node {
    const op = opAt();
    if (op === '-' || op === '+') { p += 1; return { t: 'un', op, a: unary() }; }
    return percent();
  }
  const power = binary(unary, ['^']);
  const term = binary(power, ['*', '/']);
  const additive = binary(term, ['+', '-']);
  const concat = binary(additive, ['&']);
  const comparison = binary(concat, COMPARE);

  const node = comparison();
  if (p < toks.length) fail('#ERROR!');
  return node;
}

// ─── Evaluación ───────────────────────────────────────────────────────────────

type Scalar = number | string | boolean;
type Result = Scalar | CellValue[];
type Get = (id: string) => CellValue;

function scalar(v: CellValue): Scalar {
  return isError(v) ? fail(v.error) : v;
}

function toNumber(r: Result): number {
  if (Array.isArray(r)) return fail('#VALOR!');
  if (typeof r === 'number') return r;
  if (typeof r === 'boolean') return r ? 1 : 0;
  if (r.trim() === '') return 0;
  const n = literal(r);
  return typeof n === 'number' ? n : fail('#VALOR!');
}

const tidy = (n: number) => Number(n.toPrecision(15));

function toText(r: Result): string {
  if (Array.isArray(r)) return fail('#VALOR!');
  if (typeof r === 'boolean') return r ? 'TRUE' : 'FALSE';
  return typeof r === 'number' ? String(tidy(r)) : r;
}

function compare(a: Result, b: Result, op: string): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return fail('#VALOR!');
  // Una celda vacía frente a un número vale 0.
  const x = a === '' && typeof b === 'number' ? 0 : a;
  const y = b === '' && typeof a === 'number' ? 0 : b;
  const diff = typeof x === 'number' && typeof y === 'number'
    ? x - y
    : toText(x).toLocaleLowerCase().localeCompare(toText(y).toLocaleLowerCase());
  return op === '=' ? diff === 0 : op === '<>' ? diff !== 0 : op === '<' ? diff < 0 : op === '>' ? diff > 0 : op === '<=' ? diff <= 0 : diff >= 0;
}

const ALIASES: Record<string, string> = { SUMA: 'SUM', PROMEDIO: 'AVERAGE', CONTAR: 'COUNT', SI: 'IF', REDONDEAR: 'ROUND' };

/** Los números de los argumentos: en rangos y referencias se saltan textos y vacíos (como en las hojas de cálculo). */
function numbersOf(args: Node[], get: Get): number[] {
  const out: number[] = [];
  for (const arg of args) {
    if (arg.t === 'range' || arg.t === 'ref') {
      for (const v of arg.t === 'range' ? arg.ids.map(get) : [get(arg.id)]) {
        if (isError(v)) fail(v.error);
        if (typeof v === 'number') out.push(v);
      }
    } else {
      out.push(toNumber(evaluate(arg, get)));
    }
  }
  return out;
}

function truthy(r: Result): boolean {
  if (typeof r === 'boolean') return r;
  if (typeof r === 'number') return r !== 0;
  if (r === '') return false;
  return fail('#VALOR!');
}

function call(name: string, args: Node[], get: Get): Result {
  const fn = ALIASES[name] ?? name;
  const arity = (min: number, max: number) => { if (args.length < min || args.length > max) fail('#VALOR!'); };
  switch (fn) {
    case 'SUM': return numbersOf(args, get).reduce((a, b) => a + b, 0);
    case 'AVERAGE': {
      const list = numbersOf(args, get);
      return list.length ? list.reduce((a, b) => a + b, 0) / list.length : fail('#DIV/0!');
    }
    case 'MIN': { const list = numbersOf(args, get); return list.length ? Math.min(...list) : 0; }
    case 'MAX': { const list = numbersOf(args, get); return list.length ? Math.max(...list) : 0; }
    case 'COUNT': return numbersOf(args, get).length;
    case 'IF': {
      arity(2, 3);
      // Solo se evalúa la rama elegida: la otra puede tener un error sin que importe.
      if (truthy(evaluate(args[0], get))) return evaluate(args[1], get);
      return args[2] ? evaluate(args[2], get) : false;
    }
    case 'ROUND': {
      arity(1, 2);
      const x = toNumber(evaluate(args[0], get));
      const digits = args[1] ? Math.trunc(toNumber(evaluate(args[1], get))) : 0;
      const f = 10 ** digits;
      // El margen corrige 1,005 × 100 = 100,4999…: se redondea lejos del cero, como en las hojas de cálculo.
      return (Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9)) / f;
    }
    case 'ABS': arity(1, 1); return Math.abs(toNumber(evaluate(args[0], get)));
    default: return fail('#NOMBRE?');
  }
}

function evaluate(node: Node, get: Get): Result {
  switch (node.t) {
    case 'num': case 'str': case 'bool': return node.v;
    case 'ref': return scalar(get(node.id));
    case 'range': return node.ids.map(get);
    case 'fn': return call(node.name, node.args, get);
    case 'un': {
      const a = toNumber(evaluate(node.a, get));
      return node.op === '-' ? -a : node.op === '%' ? a / 100 : a;
    }
    case 'bin': {
      const a = evaluate(node.a, get);
      const b = evaluate(node.b, get);
      if (node.op === '&') return toText(a) + toText(b);
      if (COMPARE.includes(node.op)) return compare(a, b, node.op);
      const x = toNumber(a);
      const y = toNumber(b);
      if (node.op === '+') return x + y;
      if (node.op === '-') return x - y;
      if (node.op === '*') return x * y;
      if (node.op === '/') return y === 0 ? fail('#DIV/0!') : x / y;
      return x ** y;
    }
  }
}

/** El valor de cada celda escrita. Las fórmulas que se refieren a sí mismas (directa o indirectamente) dan #CICLO!. */
export function evaluateSheet(cells: Record<string, string>): Record<string, CellValue> {
  const out: Record<string, CellValue> = {};
  const visiting = new Set<string>();
  const get: Get = (id) => {
    if (id in out) return out[id];
    const raw = cells[id] ?? '';
    if (!raw.startsWith('=')) return (out[id] = literal(raw));
    if (visiting.has(id)) return { error: '#CICLO!' };
    visiting.add(id);
    let value: CellValue;
    try {
      const r = evaluate(parse(raw.slice(1)), get);
      value = Array.isArray(r) ? { error: '#VALOR!' } : typeof r === 'number' ? (Number.isFinite(r) ? tidy(r) : { error: '#VALOR!' }) : r;
    } catch (err) {
      value = { error: err instanceof SheetError ? err.code : '#ERROR!' };
    }
    visiting.delete(id);
    return (out[id] = value);
  };
  for (const id of Object.keys(cells)) get(id);
  return out;
}

// ─── Para mostrar, exportar y graficar ────────────────────────────────────────

export function formatValue(v: CellValue | undefined, locale: string, words: { true: string; false: string }): string {
  if (v === undefined || v === '') return '';
  if (isError(v)) return v.error;
  if (typeof v === 'boolean') return v ? words.true : words.false;
  if (typeof v === 'number') return v.toLocaleString(locale, { maximumFractionDigits: 10 });
  return v;
}

/** Filas y columnas usadas (hasta la última celda con algo). */
export function usedRange(cells: Record<string, string>): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [id, raw] of Object.entries(cells)) {
    const at = parseCell(id);
    if (!at || !raw.trim()) continue;
    rows = Math.max(rows, at.row + 1);
    cols = Math.max(cols, at.col + 1);
  }
  return { rows, cols };
}

/** La parte usada de la hoja como CSV (con los valores ya calculados), para el copiloto o para copiar. */
export function toCsv(cells: Record<string, string>, values: Record<string, CellValue>): string {
  const { rows, cols } = usedRange(cells);
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const line: string[] = [];
    for (let col = 0; col < cols; col += 1) {
      const v = values[cellId(col, row)];
      line.push(quote(v === undefined ? '' : isError(v) ? v.error : typeof v === 'number' ? String(v) : String(v)));
    }
    lines.push(line.join(','));
  }
  return lines.join('\n');
}

/**
 * Datos de un gráfico: con dos columnas o más, la primera son las etiquetas y la segunda los valores; con una,
 * los valores y el número de fila como etiqueta. Las filas sin número (un encabezado) se saltan.
 */
export function chartData(range: string, values: Record<string, CellValue>): Array<{ label: string; value: number }> {
  const [from, to] = range.split(':');
  const a = parseCell(from ?? '');
  const b = parseCell(to ?? '');
  if (!a || !b) return [];
  const left = Math.min(a.col, b.col);
  const wide = Math.max(a.col, b.col) > left;
  const out: Array<{ label: string; value: number }> = [];
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row += 1) {
    const value = values[cellId(wide ? left + 1 : left, row)];
    if (typeof value !== 'number') continue;
    const label = wide ? values[cellId(left, row)] : row + 1;
    out.push({ label: label === undefined || isError(label as CellValue) ? `${row + 1}` : String(label), value });
  }
  return out;
}
