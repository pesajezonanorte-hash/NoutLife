// Medidor de energía del check-in: un pozo con bisel y una fila de barras de pulso que
// suben como una señal. Las encendidas toman el degradado del acento del tema (ámbar →
// calabaza en Halloween, jade en Aurora, la escala de cada tema de la Tienda); las apagadas
// son un velo del color de tinta. Sustituye al <input type="range"> nativo, cuya pista sin
// rellenar el navegador pintaba como una línea blanca partida en el tema oscuro.
// Es un slider ARIA: flechas, RePág/AvPág e Inicio/Fin con teclado. Con ratón se toca o se
// arrastra; con el dedo, un toque elige la barra y un arrastre horizontal recorre la escala
// (en vertical la hoja sigue desplazándose: touch-action pan-y).
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { energyAt, energyBarHeight, energyKey } from './energy';

export interface EnergyMeterProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** id de la etiqueta visible que nombra el control. */
  labelledBy?: string;
  /** Texto para lectores de pantalla («7 de 10 · Alta»). */
  valueText?: string;
  className?: string;
}

/** Píxeles que separan un toque de un arrastre con el dedo. */
const TAP_PX = 8;

interface Press { id: number; x: number; y: number; touch: boolean; dragging: boolean }

export function EnergyMeter({ value, onChange, min = 1, max = 10, labelledBy, valueText, className }: EnergyMeterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  // Último valor emitido: un arrastre rápido no repite onChange ni la vibración por barra.
  const shown = useRef(value);
  shown.current = value;
  const count = max - min + 1;

  const pick = (clientX: number, haptic: boolean) => {
    const bars = ref.current?.children;
    if (!bars?.length) return;
    const first = bars[0].getBoundingClientRect();
    const last = bars[bars.length - 1].getBoundingClientRect();
    const next = energyAt(clientX - first.left, last.right - first.left, min, max);
    if (next === shown.current) return;
    shown.current = next;
    if (haptic) navigator.vibrate?.(6);
    onChange(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const touch = e.pointerType === 'touch';
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, touch, dragging: !touch };
    // Ratón y lápiz eligen al bajar; el dedo espera a saber si es toque, arrastre o desplazamiento.
    if (!touch) {
      e.currentTarget.setPointerCapture(e.pointerId);
      pick(e.clientX, false);
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.dragging) {
      const dx = Math.abs(e.clientX - p.x);
      if (dx < TAP_PX || dx < Math.abs(e.clientY - p.y)) return;
      p.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    pick(e.clientX, p.touch);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId) return;
    if (p.touch && !p.dragging) pick(e.clientX, true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = energyKey(e.key, value, min, max);
    if (next === null) return;
    e.preventDefault();
    if (next !== value) onChange(next);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-labelledby={labelledBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { press.current = null; }}
      className={cn('lq-energy', className)}
      style={{ '--n': count } as CSSProperties}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="lq-energy-bar"
          data-on={min + i <= value || undefined}
          data-top={min + i === value || undefined}
          style={{ '--i': i, '--p': count > 1 ? i / (count - 1) : 1, height: `${Math.round(energyBarHeight(i, count) * 100)}%` } as CSSProperties}
        >
          <span className="lq-energy-fill" />
        </span>
      ))}
    </div>
  );
}
