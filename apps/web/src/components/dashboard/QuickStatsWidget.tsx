import { motion } from 'framer-motion';
import { Dumbbell, Moon, Wallet } from 'lucide-react';

interface Props {
  sleepAvg7d: number;
  monthBalance: number;
  lastWorkoutDaysAgo: number | null;
}

export function QuickStatsWidget({ sleepAvg7d, monthBalance, lastWorkoutDaysAgo }: Props) {
  const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(value);

  const stats = [
    {
      Icon: Dumbbell,
      label: 'Entrenamiento',
      value: lastWorkoutDaysAgo === null
        ? 'Sin registro'
        : lastWorkoutDaysAgo === 0 ? 'Hoy'
          : lastWorkoutDaysAgo === 1 ? 'Ayer'
            : `Hace ${lastWorkoutDaysAgo} días`,
      tone: lastWorkoutDaysAgo !== null && lastWorkoutDaysAgo <= 2 ? 'var(--accent-green)' : 'var(--accent-red)',
    },
    {
      Icon: Moon,
      label: 'Sueño · 7 días',
      value: sleepAvg7d > 0 ? `${sleepAvg7d} h` : 'Sin datos',
      tone: sleepAvg7d >= 7 ? 'var(--accent-green)' : sleepAvg7d >= 6 ? 'var(--accent-gold)' : 'var(--accent-red)',
    },
    {
      Icon: Wallet,
      label: 'Balance del mes',
      value: monthBalance !== 0 ? formatCOP(monthBalance) : '$0',
      tone: monthBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2">
      {stats.map(({ Icon, label, value, tone }, index) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: index * 0.05 }}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-3 transition-colors hover:border-[var(--text-muted)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-panel)]" style={{ color: tone }}><Icon size={14} strokeWidth={1.9} /></span>
            <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--text-muted)]">{label}</span>
          </div>
          <p className="mt-3 truncate text-sm font-semibold tabular-nums" style={{ color: tone }}>{value}</p>
        </motion.div>
      ))}
    </div>
  );
}
