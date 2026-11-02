// Ícono con volumen del navbar: toma el mismo <svg> de lucide que se ve plano y recorre cada trazo
// con un tubo de puntas redondas. Así vale para cualquier zona, también las que crea cada persona.
// Cada vértice guarda el centro del tubo (aC): con uInflate = 0 el tubo se aplasta sobre el canto
// rodado y coincide con el trazo plano; con 1 tiene todo su volumen. Sin three.js aquí: lo pone la
// escena, así también lo prueban los tests con puntos calculados.

export interface TubeMesh {
  position: Float32Array;
  normal: Float32Array;
  center: Float32Array;
  index: Uint32Array;
}

export type Point = readonly [number, number];

/** Paso de muestreo y radio del tubo en unidades del icono (24 × 24). */
const STEP = 0.75;
const RADIUS = 1.12;
const RING = 8;
const CAP = 2;

/** Puntos de cada trazo. Un salto largo entre muestras es otro subtrazo del mismo <path>. */
export function sampleStrokes(svg: SVGSVGElement): Point[][] {
  const out: Point[][] = [];
  svg.querySelectorAll<SVGGeometryElement>('path, circle, line, rect, polyline, polygon, ellipse').forEach((el) => {
    const total = el.getTotalLength();
    if (!(total > 0)) return;
    const count = Math.max(2, Math.ceil(total / STEP));
    let stroke: Point[] = [];
    let last: Point | null = null;
    for (let i = 0; i <= count; i++) {
      const p = el.getPointAtLength((total * i) / count);
      const here: Point = [p.x, p.y];
      if (last && Math.hypot(here[0] - last[0], here[1] - last[1]) > STEP * 2.5) {
        if (stroke.length > 1) out.push(stroke);
        stroke = [];
      }
      stroke.push(here);
      last = here;
    }
    if (stroke.length > 1) out.push(stroke);
  });
  return out;
}

/** Une los trazos en una malla: coordenadas del icono centradas, x a la derecha, y arriba, z hacia fuera. */
export function buildTube(strokes: Point[][], radius = RADIUS): TubeMesh {
  const pos: number[] = [];
  const nor: number[] = [];
  const cen: number[] = [];
  const idx: number[] = [];
  for (const stroke of strokes) {
    const pts = stroke.map(([x, y]): Point => [x - 12, 12 - y]);
    const closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01;
    const rows: number[] = [];
    const ringAt = (cx: number, cy: number, dx: number, dy: number, r: number, along: number) => {
      const start = pos.length / 3;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const sx = uy;
      const sy = -ux;
      const axial = Math.sqrt(Math.max(0, 1 - along * along));
      for (let k = 0; k < RING; k++) {
        const a = (k / RING) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        pos.push(cx + sx * c * r, cy + sy * c * r, s * r);
        nor.push(sx * c * axial + ux * along, sy * c * axial + uy * along, s * axial);
        cen.push(cx, cy, 0);
      }
      rows.push(start);
    };
    const n = pts.length;
    const dir = (i: number): Point => {
      const a = pts[closed ? (i - 1 + n - 1) % (n - 1) : Math.max(0, i - 1)];
      const b = pts[closed ? (i + 1) % (n - 1) : Math.min(n - 1, i + 1)];
      return [b[0] - a[0], b[1] - a[1]];
    };
    if (!closed) {
      const [dx, dy] = dir(0);
      const len = Math.hypot(dx, dy) || 1;
      for (let c = CAP; c >= 1; c--) {
        const t = (c / (CAP + 1)) * (Math.PI / 2);
        ringAt(pts[0][0] - (dx / len) * radius * Math.sin(t), pts[0][1] - (dy / len) * radius * Math.sin(t), dx, dy, radius * Math.cos(t), -Math.sin(t));
      }
    }
    const end = closed ? n - 1 : n;
    for (let i = 0; i < end; i++) {
      const [dx, dy] = dir(i);
      ringAt(pts[i][0], pts[i][1], dx, dy, radius, 0);
    }
    if (!closed) {
      const [dx, dy] = dir(n - 1);
      const len = Math.hypot(dx, dy) || 1;
      for (let c = 1; c <= CAP; c++) {
        const t = (c / (CAP + 1)) * (Math.PI / 2);
        ringAt(pts[n - 1][0] + (dx / len) * radius * Math.sin(t), pts[n - 1][1] + (dy / len) * radius * Math.sin(t), dx, dy, radius * Math.cos(t), Math.sin(t));
      }
    }
    const count = rows.length;
    for (let r = 0; r < (closed ? count : count - 1); r++) {
      const a = rows[r];
      const b = rows[(r + 1) % count];
      for (let k = 0; k < RING; k++) {
        const k2 = (k + 1) % RING;
        idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2);
      }
    }
    if (!closed) {
      for (const [first, flip] of [[rows[0], true], [rows[count - 1], false]] as const) {
        const apex = pos.length / 3;
        const row = pts[first === rows[0] ? 0 : n - 1];
        const [dx, dy] = dir(first === rows[0] ? 0 : n - 1);
        const len = Math.hypot(dx, dy) || 1;
        const sign = first === rows[0] ? -1 : 1;
        pos.push(row[0] + sign * (dx / len) * radius, row[1] + sign * (dy / len) * radius, 0);
        nor.push(sign * (dx / len), sign * (dy / len), 0);
        cen.push(row[0], row[1], 0);
        for (let k = 0; k < RING; k++) {
          const k2 = (k + 1) % RING;
          if (flip) idx.push(apex, first + k, first + k2);
          else idx.push(first + k2, first + k, apex);
        }
      }
    }
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nor), center: new Float32Array(cen), index: new Uint32Array(idx) };
}
