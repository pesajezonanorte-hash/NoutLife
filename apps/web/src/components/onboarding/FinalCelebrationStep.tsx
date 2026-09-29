import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MiguelSprite } from '../character/MiguelSprite';
import { PixelButton } from '../ui/PixelButton';
import { getForgedLabel } from '../../utils/gender';
import type { AvatarConfig } from '@lifequest/shared';

const STATS = [
  { label: 'HP', value: '100/100', color: 'text-accent-pink' },
  { label: 'MP', value: '100/100', color: 'text-accent-cyan' },
  { label: 'STR', value: '1', color: 'text-accent-red' },
  { label: 'INT', value: '1', color: 'text-accent-blue' },
  { label: 'CHA', value: '1', color: 'text-accent-pink' },
];

interface Props {
  displayName: string;
  gender: 'male' | 'female';
  avatarConfig: Partial<AvatarConfig>;
  onEnter: () => void;
}

export function FinalCelebrationStep({ displayName, avatarConfig, gender, onEnter }: Props) {
  const [visibleStats, setVisibleStats] = useState(0);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    STATS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleStats(i + 1), 1200 + i * 250));
    });
    timers.push(setTimeout(() => setShowButton(true), 2800));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {/* Flash dorado */}
      <motion.div
        className="fixed inset-0 bg-accent-gold pointer-events-none z-10"
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />

      {/* Partículas */}
      {Array.from({ length: 30 }, (_, i) => (
        <motion.div
          key={i}
          className="fixed w-2 h-2 rounded-sm"
          style={{
            background: ['#d9b44a', '#c0c0c8', '#8a8a92', '#f0e6c8'][i % 4],
            left: `${20 + Math.random() * 60}%`,
            top: `${10 + Math.random() * 40}%`,
          }}
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{ y: -(Math.random() * 200 + 100), opacity: 0, scale: 0 }}
          transition={{ duration: 1.2 + Math.random() * 0.8, delay: 0.1 + Math.random() * 0.5 }}
        />
      ))}

      {/* Sprite celebrando */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }}
      >
        <MiguelSprite
          size={120}
          bodyType={avatarConfig.bodyType}
          hairStyle={avatarConfig.hairStyle}
          hairColor={avatarConfig.hairColor}
          skinColor={avatarConfig.skinColor}
          shirtColor={avatarConfig.shirtColor}
          pantsColor={avatarConfig.pants}
          accessory={avatarConfig.accessory}
          expression={avatarConfig.expression}
          animate="celebrate"
        />
      </motion.div>

      {/* Texto typewriter */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: 'spring' }}
      >
        <h2
          className="font-pixel text-accent-gold leading-relaxed"
          style={{ fontSize: '12px', textShadow: '3px 3px 0 rgba(0,0,0,0.55)' }}
        >
          ¡{displayName}
          <br />
          <span className="text-white">{getForgedLabel(gender)}!</span>
        </h2>
      </motion.div>

      {/* Stats apareciendo uno por uno */}
      <div className="bg-bg-panel border-4 border-accent-gold shadow-pixel-gold px-6 py-4 w-full max-w-xs">
        <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '12px' }}>STATS INICIALES</p>
        <div className="flex justify-center gap-4 flex-wrap">
          {STATS.slice(0, visibleStats).map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <p className={`font-pixel ${stat.color}`} style={{ fontSize: '12px' }}>{stat.label}</p>
              <p className="font-vt text-text-primary text-xl">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {showButton && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring' }}
        >
          <PixelButton variant="primary" onClick={onEnter} className="text-sm px-8 py-3">
            ENTRAR AL CASTILLO →
          </PixelButton>
        </motion.div>
      )}
    </div>
  );
}
