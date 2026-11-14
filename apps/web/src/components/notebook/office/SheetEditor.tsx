// Hoja de cálculo: cuadrícula con barra de fórmulas, fórmulas que se recalculan al instante (lib/sheet), un
// gráfico de barras, línea o torta sobre un rango y el copiloto que lee la hoja y la analiza.
// Teclado: flechas para moverse, Enter o F2 para editar, escribir directamente reemplaza la celda, Supr la borra.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Button, Field, Input, LineChart, SegmentedControl, type Tone } from '@/components/ui/lq';
import { strokeTone, solidBg } from '@/components/ui/lq/tones';
import { INTL_LOCALE, useLocale, useText } from '@/lib/i18n';
import { COL_LETTERS, cellId, chartData, evaluateSheet, formatValue, isError, toCsv } from '@/lib/sheet';
import type { ChartType, SheetContent } from '@/services/office.service';
import { OFFICE_COPY } from './copy';
import { Copilot } from './Copilot';

const MAX_ROWS = 300;
const MAX_COLS = 26;
const PIE_TONES: Exclude<Tone, 'muted'>[] = ['primary', 'warning', 'info', 'forest', 'success', 'error', 'secondary'];
const RANGE_RE = /^[A-Z][1-9]\d{0,2}:[A-Z][1-9]\d{0,2}$/;

export function SheetEditor({ title, content, onChange, copilotOpen, onCloseCopilot }: {
  title: string;
  content: SheetContent;
  onChange: (content: SheetContent) => void;
  copilotOpen: boolean;
  onCloseCopilot: () => void;
}) {
  const t = useText(OFFICE_COPY);
  const locale = useLocale();
  const [sheet, setSheet] = useState<SheetContent>(content);
  const [sel, setSel] = useState({ col: 0, row: 0 });
  const [draft, setDraft] = useState(content.cells.A1 ?? '');
  const [rangeText, setRangeText] = useState(content.chart?.range ?? 'A1:B6');
  const grid = useRef<HTMLTableElement>(null);
  const bar = useRef<HTMLInputElement>(null);
  const id = cellId(sel.col, sel.row);
  const values = useMemo(() => evaluateSheet(sheet.cells), [sheet.cells]);
  const words = { true: t.true, false: t.false };

  const update = (next: SheetContent) => { setSheet(next); onChange(next); };
  // Al cambiar de celda, la barra muestra lo que tiene escrito.
  useEffect(() => { setDraft(sheet.cells[id] ?? ''); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(text = draft) {
    if ((sheet.cells[id] ?? '') === text) return;
    const cells = { ...sheet.cells };
    if (text.trim()) cells[id] = text; else delete cells[id];
    update({ ...sheet, cells });
  }

  function move(dc: number, dr: number) {
    setSel((s) => ({ col: Math.max(0, Math.min(sheet.cols - 1, s.col + dc)), row: Math.max(0, Math.min(sheet.rows - 1, s.row + dr)) }));
  }

  // La celda elegida se ve y tiene el foco del teclado (tabindex móvil).
  useEffect(() => {
    const cell = grid.current?.querySelector<HTMLElement>(`[data-cell="${id}"]`);
    if (cell && grid.current?.contains(document.activeElement)) cell.focus({ preventScroll: false });
    cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [id]);

  const focusGrid = () => requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-cell="${cellId(sel.col, sel.row)}"]`)?.focus());

  function onGridKey(e: KeyboardEvent) {
    const arrows: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[e.key]) { e.preventDefault(); move(...arrows[e.key]); return; }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); bar.current?.focus(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setDraft(''); commit(''); return; }
    if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); return; }
    // Escribir sobre una celda la reemplaza, como en cualquier hoja de cálculo.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setDraft(e.key);
      bar.current?.focus();
    }
  }

  function onBarKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); move(0, 1); focusGrid(); }
    else if (e.key === 'Tab') { e.preventDefault(); commit(); move(e.shiftKey ? -1 : 1, 0); focusGrid(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(sheet.cells[id] ?? ''); focusGrid(); }
  }

  const chart = sheet.chart ?? null;
  const setChart = (type: ChartType | 'none') => update({ ...sheet, chart: type === 'none' ? null : { type, range: RANGE_RE.test(rangeText) ? rangeText : 'A1:B6' } });
  const series = chart ? chartData(chart.range, values) : [];
  const fmt = (n: number) => n.toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 2 });
  const total = series.reduce((sum, d) => sum + Math.max(0, d.value), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      {/* En el móvil la columna se desplaza: la cuadrícula guarda su altura y el gráfico queda debajo. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
        {/* Barra de fórmulas */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2">
          <span className="w-10 shrink-0 text-center font-mono text-label-lg text-primary-text" aria-hidden>{id}</span>
          <Input
            ref={bar} aria-label={t.cellOf(id)} title={t.formulaHelp} value={draft}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={onBarKey} onBlur={() => commit()}
            className="min-h-11 flex-1 py-1.5 font-mono text-body-md" autoComplete="off" spellCheck={false}
          />
        </div>

        <div className="min-h-[45dvh] flex-1 overflow-auto bg-surface md:min-h-0">
          <table ref={grid} role="grid" aria-label={t.gridLabel(title)} onKeyDown={onGridKey} className="border-separate border-spacing-0 text-body-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 h-8 w-12 min-w-12 border-b border-r border-border bg-surface-variant" />
                {Array.from({ length: sheet.cols }, (_, c) => (
                  <th key={c} scope="col" className={cn('sticky top-0 z-10 h-8 w-28 min-w-28 border-b border-r border-border bg-surface-variant font-mono text-label-md text-on-surface-light', c === sel.col && 'text-primary-text')}>{COL_LETTERS[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sheet.rows }, (_, r) => (
                <tr key={r}>
                  <th scope="row" className={cn('sticky left-0 z-10 h-9 border-b border-r border-border bg-surface-variant px-2 text-right font-mono text-label-md text-on-surface-light', r === sel.row && 'text-primary-text')}>{r + 1}</th>
                  {Array.from({ length: sheet.cols }, (_, c) => {
                    const cid = cellId(c, r);
                    const v = values[cid];
                    const on = c === sel.col && r === sel.row;
                    return (
                      <td
                        key={c} role="gridcell" data-cell={cid} tabIndex={on ? 0 : -1} aria-selected={on}
                        onClick={() => setSel({ col: c, row: r })} onDoubleClick={() => bar.current?.focus()}
                        className={cn(
                          'h-9 max-w-28 cursor-cell truncate border-b border-r border-border px-2 outline-none',
                          typeof v === 'number' && 'text-right font-mono tabular-nums',
                          v !== undefined && isError(v) && 'text-error-text',
                          on && 'relative bg-primary/[var(--lq-soft-alpha)] shadow-[inset_0_0_0_2px_rgb(var(--lq-primary))]',
                        )}
                      >
                        {formatValue(v, INTL_LOCALE[locale], words)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Filas, columnas y gráfico */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background p-3">
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="secondary" size="sm" disabled={sheet.rows >= MAX_ROWS} onClick={() => update({ ...sheet, rows: Math.min(MAX_ROWS, sheet.rows + 10) })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addRow}</Button>
            <Button variant="secondary" size="sm" disabled={sheet.cols >= MAX_COLS} onClick={() => update({ ...sheet, cols: Math.min(MAX_COLS, sheet.cols + 1) })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.addCol}</Button>
            <SegmentedControl
              label={t.chart} className="ml-auto"
              value={chart?.type ?? 'none'} onChange={setChart}
              options={[{ value: 'none', label: t.noChart }, ...(['bar', 'line', 'pie'] as ChartType[]).map((value) => ({ value, label: t.chartTypes[value] }))]}
            />
          </div>
          {chart && (
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
              <Field label={t.chartRange} help={t.chartRangeHelp} error={rangeText && !RANGE_RE.test(rangeText) ? t.chartRangeHelp : undefined}>
                <Input
                  value={rangeText} className="font-mono uppercase"
                  onChange={(e) => { const next = e.target.value.toUpperCase().replace(/\s/g, ''); setRangeText(next); if (RANGE_RE.test(next)) update({ ...sheet, chart: { ...chart, range: next } }); }}
                />
              </Field>
              <div className="min-w-0">
                {series.length === 0 ? (
                  <p className="text-body-sm text-on-surface-light">{t.chartEmpty}</p>
                ) : chart.type === 'bar' ? (
                  <BarChart tone="success" label={t.chartLabel(chart.range)} data={series.map((d) => ({ label: d.label, value: d.value, tip: `${d.label}: ${fmt(d.value)}` }))} formatValue={fmt} height={160} grid />
                ) : chart.type === 'line' ? (
                  <LineChart tone="success" label={t.chartLabel(chart.range)} data={series.map((d) => ({ label: d.label, value: d.value, tip: `${d.label}: ${fmt(d.value)}` }))} min={Math.min(0, ...series.map((d) => d.value))} max={Math.max(1, ...series.map((d) => d.value))} height={160} dots />
                ) : (
                  <div className="flex flex-wrap items-center gap-6">
                    {/* Torta: cada tramo es el trazo de un círculo de perímetro 100. */}
                    <svg viewBox="0 0 42 42" className="size-40 -rotate-90" role="img" aria-label={`${t.chartLabel(chart.range)}: ${series.map((d) => `${d.label} ${fmt(d.value)}`).join(', ')}`}>
                      {(() => {
                        let acc = 0;
                        return series.filter((d) => d.value > 0).map((d, i) => {
                          const pct = total ? (d.value / total) * 100 : 0;
                          const el = <circle key={d.label + i} cx="21" cy="21" r="15.9155" fill="none" strokeWidth="7" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-acc} className={strokeTone[PIE_TONES[i % PIE_TONES.length]]} />;
                          acc += pct;
                          return el;
                        });
                      })()}
                    </svg>
                    <ul className="flex flex-col gap-1">
                      {series.filter((d) => d.value > 0).map((d, i) => (
                        <li key={d.label + i} className="flex items-center gap-2 text-body-sm">
                          <span aria-hidden className={cn('size-2.5 rounded-full', solidBg[PIE_TONES[i % PIE_TONES.length]])} />
                          {d.label}<span className="font-mono tabular-nums text-on-surface-light">{total ? Math.round((d.value / total) * 100) : 0} %</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
          <p className="text-body-sm text-on-surface-light">{t.functions}</p>
        </div>
      </div>
      {copilotOpen && (
        <Copilot actions={['analyze']} context={() => toCsv(sheet.cells, values)} onApply={() => undefined} onClose={onCloseCopilot} />
      )}
    </div>
  );
}
