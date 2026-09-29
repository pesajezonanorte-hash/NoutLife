import { AlertCircle, CalendarClock } from 'lucide-react';

interface Props {
  deadline?: string | null;
}

export function DeadlineBadge({ deadline }: Props) {
  if (!deadline) return null;

  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const isToday = daysLeft === 0;
  const color = isOverdue || isToday
    ? 'var(--accent-red)'
    : daysLeft <= 3
      ? 'var(--accent-gold)'
      : 'var(--accent-green)';
  const label = isOverdue
    ? 'Vencida'
    : isToday
      ? 'Vence hoy'
      : `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;
  const Icon = isOverdue || isToday ? AlertCircle : CalendarClock;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color }}
      title={label}
    >
      <Icon size={12} strokeWidth={1.9} aria-hidden="true" />
      {label}
    </span>
  );
}
