import { motion } from 'framer-motion';
import { MiguelSprite } from '../character/MiguelSprite';
import { PixelButton } from '../ui/PixelButton';
import { getWelcomeLabel, getHeroLabelCapitalized } from '../../utils/gender';
import type { AvatarConfig } from '@lifequest/shared';

interface Props {
  gender: 'male' | 'female';
  avatarConfig?: Partial<AvatarConfig>;
  onNext: () => void;
}

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  delay: Math.random() * 3,
}));

export function WelcomeStep({ gender, avatarConfig, onNext }: Props) {
  const previewConfig: AvatarConfig = {
    bodyType: avatarConfig?.bodyType ?? gender,
    hairStyle: avatarConfig?.hairStyle ?? (gender === 'female' ? 'long' : 'short'),
    hairColor: avatarConfig?.hairColor ?? '#2c1810',
    skinColor: avatarConfig?.skinColor ?? '#c68642',
    shirtColor: avatarConfig?.shirtColor ?? '#4d96ff',
    pants: avatarConfig?.pants ?? '#37474f',
    accessory: avatarConfig?.accessory ?? 'none',
    expression: avatarConfig?.expression ?? 'normal',
    pet: avatarConfig?.pet ?? null,
  };

  return (
    <div className="relative min-h-screen bg-bg-deep flex flex-col items-center justify-center overflow-hidden px-4">
      {STARS.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: star.delay }}
        />
      ))}

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1
            className="font-pixel leading-relaxed text-accent-gold"
            style={{ fontSize: '14px', textShadow: '3px 3px 0 rgba(0,0,0,0.55)' }}
          >
            {getWelcomeLabel(gender).toUpperCase()},
            <br />
            <span className="text-white">{getHeroLabelCapitalized(gender).toUpperCase()}</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        >
          <MiguelSprite
            size={100}
            bodyType={previewConfig.bodyType}
            hairStyle={previewConfig.hairStyle}
            hairColor={previewConfig.hairColor}
            skinColor={previewConfig.skinColor}
            shirtColor={previewConfig.shirtColor}
            pantsColor={previewConfig.pants}
            accessory={previewConfig.accessory}
            expression={previewConfig.expression}
            animate="idle"
          />
        </motion.div>

        <motion.div
          className="relative w-full border-4 border-accent-gold bg-bg-panel p-4 shadow-pixel-gold"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
        >
          <span className="absolute -top-3 left-6 bg-accent-gold px-2 py-0.5 font-pixel text-border-pixel" style={{ fontSize: '12px' }}>
            SABIO DEL CASTILLO
          </span>
          <p className="font-vt text-lg leading-relaxed text-text-primary">
            ¡Hola! Soy el Sabio del Castillo.
            <br />
            Tu vida es una aventura. Hora de empezarla.
            <br />
            Cuéntame sobre ti antes de comenzar...
          </p>
        </motion.div>

        <motion.p
          className="text-center font-vt text-xl text-text-secondary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          El destino del reino depende de ti, {getHeroLabelCapitalized(gender).toLowerCase()}.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <PixelButton variant="primary" onClick={onNext} className="px-8 py-3 text-sm">
            ¡COMENZAR! →
          </PixelButton>
        </motion.div>
      </div>
    </div>
  );
}
