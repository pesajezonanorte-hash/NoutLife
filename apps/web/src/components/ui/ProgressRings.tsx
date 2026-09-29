import { motion } from 'framer-motion';

interface RingConfig {
  progress: number;
  color: string;
  label?: string;
}

interface Props {
  rings: [RingConfig, RingConfig, RingConfig];
  size?: number;
  stroke?: number;
  gap?: number;
  centerLabel?: string | number;
  centerSubLabel?: string;
}

export function ProgressRings({
  rings,
  size = 200,
  stroke = 14,
  gap = 4,
  centerLabel,
  centerSubLabel,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;

  // outer radius accounts for half stroke, then each inner ring steps in by stroke+gap
  const radii = [
    cx - stroke / 2,
    cx - stroke - gap - stroke / 2,
    cx - 2 * (stroke + gap) - stroke / 2,
  ];

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {rings.map((ring, i) => {
            const r = radii[i];
            const circumference = 2 * Math.PI * r;
            const clamped = Math.max(0, Math.min(100, ring.progress));
            const offset = circumference - (clamped / 100) * circumference;
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={`color-mix(in oklab, ${ring.color} 12%, transparent)`}
                  strokeWidth={stroke}
                />
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference} ${circumference}`}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
                  style={{ filter: `drop-shadow(0 0 6px ${ring.color}55)` }}
                />
              </g>
            );
          })}
        </g>
      </svg>
      {(centerLabel !== undefined || centerSubLabel) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"
          style={{ lineHeight: 1 }}
        >
          {centerLabel !== undefined && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="text-[var(--text-primary)] font-bold tabular-nums"
              style={{ fontSize: size * 0.26, lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              {centerLabel}
            </motion.span>
          )}
          {centerSubLabel && (
            <span
              className="text-[var(--text-muted)]"
              style={{ fontSize: Math.max(12, size * 0.058), marginTop: size * 0.04, lineHeight: 1 }}
            >
              {centerSubLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
