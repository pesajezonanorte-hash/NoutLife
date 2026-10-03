import { cn } from '@/lib/utils';

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export interface TimerProps {
  seconds: number;
  /** hero = número protagonista (cronómetro de sesión) · md = inline. */
  size?: 'hero' | 'lg' | 'md';
  /** Texto para lectores de pantalla ("Tiempo de entrenamiento"). */
  label: string;
  className?: string;
}

const sizes = { hero: 'text-display-lg', lg: 'text-display-sm', md: 'text-heading-md' } as const;

/** mm:ss (h:mm:ss) en JetBrains Mono. role="timer" sin aria-live: no se anuncia cada segundo. */
export function Timer({ seconds, size = 'md', label, className }: TimerProps) {
  return (
    <span role="timer" aria-live="off" aria-label={`${label}: ${formatClock(seconds)}`} className={cn('font-mono font-bold tabular-nums', sizes[size], className)}>
      <span aria-hidden>{formatClock(seconds)}</span>
    </span>
  );
}
