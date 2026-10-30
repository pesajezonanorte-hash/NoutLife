// Lienzo del flujo de caja 3D: monta CashflowScene con los días del periodo. Se carga perezoso
// desde CashflowCard; decorativo para lectores de pantalla (la tarjeta dice el día elegido).
import { useEffect, useRef, type ReactNode } from 'react';
import { useStage } from '@/components/three3d/useStage';
import type { CashDay } from '../cashflowMath';
import { CashflowScene } from './CashflowScene';

export interface Cashflow3DProps {
  days: CashDay[];
  onPick: (index: number | null) => void;
  onUnavailable: () => void;
  tag?: ReactNode;
}

export default function Cashflow3D({ days, onPick, onUnavailable, tag }: Cashflow3DProps) {
  const label = useRef<HTMLDivElement>(null);
  const latest = useRef(onPick);
  latest.current = onPick;
  const { host, stage, ready } = useStage(
    (el, init) => new CashflowScene(el, { ...init, days, label: label.current, onPick: (i) => latest.current(i) }),
    onUnavailable,
  );
  useEffect(() => { stage?.setDays(days); }, [stage, days]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-x-[10%] inset-y-12 rounded-3xl opacity-30" />}
      <div ref={label} aria-hidden className="lq-zone3d-tag">{tag}</div>
    </div>
  );
}
