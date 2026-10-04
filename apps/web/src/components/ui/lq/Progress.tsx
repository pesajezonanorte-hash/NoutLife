import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease, expo } from '@/lib/motion';
import { solidBg, strokeTone, type Tone } from './tones';

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export interface ProgressBarProps {
  /** 0–100 */
  value: number;
  tone?: Exclude<Tone, 'muted'>;
  size?: 'md' | 'lg';
  /** Brillo que recorre la barra (desktop). */
  shine?: boolean;
  /** Nombre accesible. Sin label la barra es decorativa (aria-hidden). */
  label?: string;
  /** Texto para lectores ("2.340 de 3.000 XP"). */
  valueText?: string;
  className?: string;
}

/** Barra de progreso: anima scaleX (nunca width), 900 ms con 200 ms de retraso. */
export function ProgressBar({ value, tone = 'primary', size = 'md', shine, label, valueText, className }: ProgressBarProps) {
  const v = clamp(value);
  const a11y = label
    ? { role: 'progressbar', 'aria-label': label, 'aria-valuenow': Math.round(v), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuetext': valueText }
    : { 'aria-hidden': true };
  return (
    <div {...a11y} className={cn('overflow-hidden rounded-full bg-surface-variant', size === 'md' ? 'h-2' : 'h-3', className)}>
      <motion.span
        className={cn('relative block h-full overflow-hidden rounded-full', solidBg[tone], shine && 'lq-sheen')}
        style={{ originX: 0 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: v / 100 }}
        transition={{ duration: 1.1, ease: expo, delay: 0.2 }}
      />
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  tone?: Exclude<Tone, 'muted'>;
  /** Diámetro en px. */
  size?: number;
  stroke?: number;
  label?: string;
  valueText?: string;
  /** Contenido centrado (porcentaje, "3/5 hoy"…). */
  children?: ReactNode;
  className?: string;
}

/** Anillo que se dibuja con pathLength (1.3 s). */
export function ProgressRing({ value, tone = 'primary', size = 96, stroke = 8, label, valueText, children, className }: ProgressRingProps) {
  const v = clamp(value);
  const r = 50 - stroke / 2;
  const a11y = label
    ? { role: 'progressbar', 'aria-label': label, 'aria-valuenow': Math.round(v), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuetext': valueText }
    : {};
  return (
    <div {...a11y} className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth={stroke} className="stroke-surface-variant" />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={strokeTone[tone]}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v / 100 }}
          transition={{ duration: 1.6, ease: expo, delay: 0.2 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
