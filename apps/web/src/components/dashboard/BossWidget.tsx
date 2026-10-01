import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { Skull, Swords } from 'lucide-react';

interface SeasonData {
  season: {
    bossName: string;
    bossHp: number;
    currentHp: number;
    endDate: string;
  };
  userDamage: number;
}

export function BossWidget() {
  const [data, setData] = useState<SeasonData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<SeasonData>('/seasons/active')
      .then((r: { data: SeasonData }) => setData(r.data))
      .catch(() => setData(null));
  }, []);

  if (!data?.season) return null;

  const { season, userDamage } = data;
  const pct = Math.max(0, (season.currentHp / season.bossHp) * 100);
  const color = pct > 60 ? 'var(--accent-green)' : pct > 30 ? 'var(--accent-gold)' : 'var(--accent-red)';
  const daysLeft = Math.max(0, Math.ceil((new Date(season.endDate).getTime() - Date.now()) / 86400000));

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => navigate('/season')}
      className="bg-bg-panel border-2 border-accent-red shadow-pixel p-3 cursor-pointer relative overflow-hidden"
    >
      {/* Corner decorations */}
      <span className="absolute top-0 left-0 w-2 h-2 bg-accent-red" />
      <span className="absolute top-0 right-0 w-2 h-2 bg-accent-red" />

      <div className="flex items-center gap-3">
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Skull size={32} className="text-accent-red" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="font-pixel text-accent-red truncate" style={{ fontSize: '12px' }}>
              {season.bossName}
            </p>
            <p className="font-pixel text-text-secondary ml-2 flex-shrink-0" style={{ fontSize: '12px' }}>
              {daysLeft}d
            </p>
          </div>

          <div className="border-2 border-border-pixel relative overflow-hidden" style={{ height: '10px', background: 'rgba(0,0,0,0.4)' }}>
            <motion.div
              className="h-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{ backgroundColor: color }}
            />
          </div>

          <div className="flex items-center justify-between mt-1">
            <p className="font-vt text-text-secondary text-xs">{pct.toFixed(0)}% HP</p>
            <div className="flex items-center gap-1">
              <Swords size={10} className="text-[var(--accent-red)]" />
              <p className="font-vt text-accent-red text-xs">{userDamage.toLocaleString('es-CO')}</p>
            </div>
          </div>
        </div>
      </div>

      {pct <= 15 && (
        <motion.div
          className="absolute inset-0 border-2 border-accent-red pointer-events-none"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
