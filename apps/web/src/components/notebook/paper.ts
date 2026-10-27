// Piezas sin interfaz de la Libreta: medidas de la página, saneado del texto
// enriquecido y dibujo de trazos en un canvas. Todo en unidades de página
// (1000 de ancho × 1414 de alto, proporción A5): la página se ve igual en
// cualquier pantalla y solo cambia la escala.
import type { Locale } from '@/lib/locale';
import type { NotebookCategory, NotebookColor, NotebookPaper, PageContent, StickyColor, Stroke } from '@/services/notebook.service';

export const PAGE_W = 1000;
export const PAGE_H = 1414;
/** Renglón del papel rayado y del texto (u): unos 20 renglones por hoja, letra legible en un móvil. */
export const LINE = 60;
/** Letra del texto de la página (u): 14 px en un móvil, 20 px en una hoja de escritorio. */
export const FONT = 40;
/** Donde empieza el texto: debajo del encabezado de la hoja y a la derecha del margen (u). */
export const TEXT_TOP = 120;
export const TEXT_LEFT = 140;

export const EMPTY_PAGE: PageContent = { html: '', strokes: [], stickies: [], images: [] };

const CATEGORY_VALUES: NotebookCategory[] = ['personal', 'trabajo', 'ideas', 'proyectos', 'estudio'];
const PAPER_VALUES: NotebookPaper[] = ['ruled', 'grid', 'dots', 'plain'];

/** Textos del cuaderno por idioma (los valores que se guardan no cambian). */
const LABELS: Record<Locale, {
  categories: Record<NotebookCategory, string>;
  covers: Record<NotebookColor, string>;
  papers: Record<NotebookPaper, string>;
  sizes: [string, string, string];
}> = {
  es: {
    categories: { personal: 'Personal', trabajo: 'Trabajo', ideas: 'Ideas', proyectos: 'Proyectos', estudio: 'Estudio' },
    covers: { jade: 'Jade', bosque: 'Bosque', oceano: 'Océano', ambar: 'Ámbar', coral: 'Coral', oro: 'Oro' },
    papers: { ruled: 'Rayado', grid: 'Cuadriculado', dots: 'Punteado', plain: 'Liso' },
    sizes: ['Fino', 'Medio', 'Grueso'],
  },
  en: {
    categories: { personal: 'Personal', trabajo: 'Work', ideas: 'Ideas', proyectos: 'Projects', estudio: 'Study' },
    covers: { jade: 'Jade', bosque: 'Forest', oceano: 'Ocean', ambar: 'Amber', coral: 'Coral', oro: 'Gold' },
    papers: { ruled: 'Lined', grid: 'Grid', dots: 'Dotted', plain: 'Plain' },
    sizes: ['Fine', 'Medium', 'Thick'],
  },
};

export const categoriesFor = (locale: Locale = 'es'): Array<{ value: NotebookCategory; label: string }> =>
  CATEGORY_VALUES.map((value) => ({ value, label: LABELS[locale].categories[value] }));
export const categoryLabelFor = (c: NotebookCategory, locale: Locale = 'es'): string => LABELS[locale].categories[c] ?? LABELS[locale].categories.personal;

/** Tapas: tonos del tema (cada tema de la Tienda los cambia); el texto invierte con claro/oscuro. */
const COVER_CLASS: Record<NotebookColor, string> = {
  jade: 'bg-primary-strong',
  bosque: 'bg-success-text',
  oceano: 'bg-info-text',
  ambar: 'bg-warning-text',
  coral: 'bg-error-text',
  oro: 'bg-secondary-text',
};
export const coversFor = (locale: Locale = 'es'): Record<NotebookColor, { label: string; className: string }> =>
  Object.fromEntries((Object.keys(COVER_CLASS) as NotebookColor[]).map((c) => [c, { label: LABELS[locale].covers[c], className: COVER_CLASS[c] }])) as Record<NotebookColor, { label: string; className: string }>;

export const papersFor = (locale: Locale = 'es'): Array<{ value: NotebookPaper; label: string }> =>
  PAPER_VALUES.map((value) => ({ value, label: LABELS[locale].papers[value] }));

/** Notas adhesivas: colores de papel de verdad (el texto va siempre oscuro encima). */
export const STICKY_COLORS: Record<StickyColor, string> = {
  yellow: '#fde68a', pink: '#fbcfe8', blue: '#bfdbfe', green: '#bbf7d0', orange: '#fed7aa',
};

/** Tintas del dibujo. */
export const INKS = ['#1f2937', '#1d4ed8', '#b91c1c', '#15803d', '#7c3aed', '#ea580c'] as const;
/** Grosores del trazo (unidades de página). */
export const SIZE_WIDTHS = [3, 6, 12] as const;
export const sizesFor = (locale: Locale = 'es') => SIZE_WIDTHS.map((w, i) => ({ label: LABELS[locale].sizes[i], w }));

// ─── Texto enriquecido ─────────────────────────────────────────────────────────
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI', 'H3', 'SPAN', 'MARK']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT']);
/** El resaltador escribe <span style="background-color: …">: es el único estilo que se conserva. */
const HIGHLIGHT = /^background-color:\s*(rgba?\([\d\s.,%]+\)|#[0-9a-f]{3,8})\s*;?$/i;

/** Deja solo el formato del editor (negrita, cursiva, listas, título, resaltado), sin atributos ni nada ejecutable. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (DROP.has(child.tagName)) { child.remove(); continue; }
      walk(child);
      if (!ALLOWED.has(child.tagName)) { child.replaceWith(...child.childNodes); continue; }
      const style = (child.getAttribute('style') ?? '').trim();
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (child.tagName === 'SPAN' && HIGHLIGHT.test(style)) child.setAttribute('style', style);
    }
  };
  walk(root);
  return root.innerHTML;
}

// ─── Dibujo ────────────────────────────────────────────────────────────────────

/**
 * Quita los puntos que casi no se mueven (menos de `min` unidades del último que se
 * queda) y redondea a una décima: el trazo pesa poco y se ve igual.
 */
export function simplifyPoints(points: number[], min = 1.5): number[] {
  if (points.length < 4) return points.map((n) => Math.round(n * 10) / 10);
  const out = [points[0], points[1]];
  for (let i = 2; i < points.length; i += 2) {
    const last = i === points.length - 2;
    const dx = points[i] - out[out.length - 2];
    const dy = points[i + 1] - out[out.length - 1];
    if (last || dx * dx + dy * dy >= min * min) out.push(points[i], points[i + 1]);
  }
  return out.map((n) => Math.round(n * 10) / 10);
}

/** Pinta un trazo suavizado (curvas entre puntos medios). `scale`: píxeles por unidad de página. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const p = s.p;
  if (p.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = s.t === 'eraser' ? 'destination-out' : 'source-over';
  ctx.globalAlpha = s.t === 'marker' ? 0.35 : 1;
  ctx.strokeStyle = s.t === 'eraser' ? '#000' : s.c;
  ctx.lineWidth = s.w * scale;
  ctx.lineCap = s.t === 'marker' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p[0] * scale, p[1] * scale);
  if (p.length === 2) ctx.lineTo(p[0] * scale + 0.1, p[1] * scale);
  for (let i = 2; i < p.length - 2; i += 2) {
    ctx.quadraticCurveTo(p[i] * scale, p[i + 1] * scale, ((p[i] + p[i + 2]) / 2) * scale, ((p[i + 1] + p[i + 3]) / 2) * scale);
  }
  if (p.length > 2) ctx.lineTo(p[p.length - 2] * scale, p[p.length - 1] * scale);
  ctx.stroke();
  ctx.restore();
}

/** ¿La página tiene algo? (las vacías no se guardan). */
export function hasContent(page: PageContent): boolean {
  const text = page.html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
  return Boolean(text) || page.strokes.length > 0 || page.stickies.length > 0 || page.images.length > 0;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

// Límites de una hoja (los mismos que la API): por encima, la hoja no se puede guardar, así que se evita antes.
export const MAX_PAGE_HTML = 200_000;
export const MAX_PAGE_STROKES = 6000;
export const MAX_PAGE_STICKIES = 100;
export const MAX_PAGE_IMAGES = 60;
export const MAX_STROKE_NUMBERS = 200_000;

/** ¿La hoja se pasa de los límites del servidor? */
export function exceedsPageLimits(page: PageContent): boolean {
  if (page.html.length > MAX_PAGE_HTML || page.strokes.length > MAX_PAGE_STROKES) return true;
  if (page.stickies.length > MAX_PAGE_STICKIES || page.images.length > MAX_PAGE_IMAGES) return true;
  let numbers = 0;
  for (const s of page.strokes) numbers += s.p.length;
  return numbers > MAX_STROKE_NUMBERS;
}
