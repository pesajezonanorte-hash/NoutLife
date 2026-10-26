// Panel de creadores (/admin/creadores): reglas puras para probarlas sin navegador. Rangos de
// fechas en hora local (los pagos a creadores se liquidan por mes calendario), el CSV del
// historial para la liquidación y el enlace con ?ref= que se le entrega a cada creador.
import type { CreatorPaymentLine } from '@/services/admin.service';

export type RangePreset = 'month' | 'last-month' | '90d' | 'all';

export const RANGE_LABEL: Record<RangePreset, string> = {
  month: 'Este mes',
  'last-month': 'Mes anterior',
  '90d': 'Últimos 90 días',
  all: 'Todo',
};

/** Desde (incluido) y hasta (excluido) del rango, en hora local. null = sin límite. */
export function rangeFor(preset: RangePreset, now = new Date()): { from: Date | null; to: Date | null } {
  const monthStart = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
  switch (preset) {
    case 'month': return { from: monthStart(0), to: monthStart(1) };
    case 'last-month': return { from: monthStart(-1), to: monthStart(0) };
    case '90d': return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89), to: null };
    case 'all': return { from: null, to: null };
  }
}

/** «30 % · 6 meses» o «30 % · sin límite». */
export function shareLabel(sharePercent: number, shareMonths: number | null): string {
  if (shareMonths === null) return `${sharePercent} % · sin límite`;
  return `${sharePercent} % · ${shareMonths === 1 ? '1 mes' : `${shareMonths} meses`}`;
}

/** Enlace del creador: la primera visita guarda el ?ref= y el checkout sugiere su código. */
export function creatorLink(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/?ref=${encodeURIComponent(code)}`;
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Historial en CSV para liquidar comisiones. Punto y coma y BOM: así lo abre bien Excel en
 * español (coma decimal) y también Google Sheets. Montos en pesos, sin separador de miles.
 */
export function creatorCsv(lines: readonly CreatorPaymentLine[]): string {
  const header = ['fecha', 'codigo', 'creador', 'correo', 'plan', 'tipo', 'estado', 'monto_cop', 'descuento_cop', 'comision_cop', 'dentro_de_ventana'];
  const rows = lines.map((line) => [
    line.paidAt.slice(0, 10),
    line.code,
    line.creatorName,
    line.email ?? 'cuenta borrada',
    line.interval === 'year' ? 'anual' : 'mensual',
    line.kind === 'first' ? 'alta' : 'renovacion',
    line.status === 'APPROVED' ? 'aprobado' : 'anulado',
    Math.round(line.amountCop),
    Math.round(line.discountCop),
    Math.round(line.commissionCop),
    line.inWindow ? 'si' : 'no',
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}
