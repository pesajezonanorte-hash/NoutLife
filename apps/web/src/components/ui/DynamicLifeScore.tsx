import { motion } from 'framer-motion';
import { E } from '@/components/ui/glyphs';

interface ZoneScore {
  id: string;
  name: string;
  icon: string;
  color: string;
  score: number;
}

interface Props {
  totalScore: number;
  zones: ZoneScore[];
  size?: number;
  stroke?: number;
  gap?: number;
}

export function DynamicLifeScore({ totalScore, zones, size = 220, stroke = 13, gap = 3 }: Props) {
  const ringZones = zones.slice(0, 6);
  const barZones = zones.slice(6);
  const cx = size / 2;
  const cy = size / 2;

  // Compute radii for up to 6 rings, innermost first
  const radii = ringZones.map((_, i) =>
    cx - stroke / 2 - i * (stroke + gap)
  );

  return (
    <div className="space-y-4">
      {/* SVG Rings */}
      <div className="flex flex-col items-center">
        <div className="relative inline-block" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {ringZones.map((zone, i) => {
                const r = radii[i];
                const circumference = 2 * Math.PI * r;
                const clamped = Math.max(0, Math.min(100, zone.score));
                const offset = circumference - (clamped / 100) * circumference;
                return (
                  <g key={zone.id}>
                    {/* track */}
                    <circle
                      cx={cx} cy={cy} r={r}
                      fill="none"
                      stroke={`color-mix(in oklab, ${zone.color} 10%, transparent)`}
                      strokeWidth={stroke}
                    />
                    {/* fill */}
                    <motion.circle
                      cx={cx} cy={cy} r={r}
                      fill="none"
                      stroke={zone.color}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={`${circumference} ${circumference}`}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: offset }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
                      style={{ filter: `drop-shadow(0 0 5px ${zone.color}60)` }}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: size * 0.26, lineHeight: 1, letterSpacing: '-0.02em',
                fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totalScore}
            </motion.span>
            <span style={{
              fontSize: Math.max(12, size * 0.055), marginTop: size * 0.04, lineHeight: 1,
              color: 'var(--text-muted)',
            }}>
              Life Score
            </span>
          </div>
        </div>

        {/* Ring legend */}
        {ringZones.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
            {ringZones.map(z => (
              <div key={z.id} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}><E e={z.icon} /> {z.name} {z.score}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extra zones as bars */}
      {barZones.length > 0 && (
        <div className="space-y-2">
          {barZones.map(z => (
            <div key={z.id}>
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}><E e={z.icon} /> {z.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: z.color }}>{z.score}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: `${z.color}18` }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: z.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${z.score}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {zones.length === 0 && (
        <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Completa acciones en tus zonas para ver tu Life Score dinámico
        </p>
      )}
    </div>
  );
}
