import { motion } from 'framer-motion';
import type { AvatarConfig, AvatarMode } from '@lifequest/shared';
import { MiguelSprite } from './MiguelSprite';
import { MinecraftSkinAvatar } from './MinecraftSkinAvatar';

const AURA_STYLES: Record<string, { gradient: string; shadow: string }> = {
  aura_fire:    { gradient: 'radial-gradient(ellipse at center, #ff6b0044 0%, #ff000022 60%, transparent 100%)', shadow: '0 0 20px 6px #ff6b0066' },
  aura_ice:     { gradient: 'radial-gradient(ellipse at center, #7dd3fc44 0%, #38bdf822 60%, transparent 100%)', shadow: '0 0 20px 6px #7dd3fc66' },
  aura_gold:    { gradient: 'radial-gradient(ellipse at center, #ffd23f44 0%, #f59e0b22 60%, transparent 100%)', shadow: '0 0 20px 6px #ffd23f88' },
  aura_storm:   { gradient: 'radial-gradient(ellipse at center, #a78bfa44 0%, #7c3aed22 60%, transparent 100%)', shadow: '0 0 20px 6px #a78bfa66' },
  aura_rainbow: { gradient: 'conic-gradient(from 0deg, #ff000022, #ff7f0022, #ffff0022, #00ff0022, #0000ff22, #8b00ff22, #ff000022)', shadow: '0 0 20px 6px rgba(255,200,50,0.4)' },
};

interface Props {
  avatarConfig?: unknown;
  avatarUrl?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
  size?: number;
  animate?: 'idle' | 'celebrate' | 'hurt' | 'none';
  mood?: number;
  className?: string;
}

function resolveAvatarMode(config: Partial<AvatarConfig>, avatarUrl?: string | null): AvatarMode {
  if (config.avatarMode === 'minecraft' && config.minecraftSkinUrl) return 'minecraft';
  if (config.avatarMode === 'photo' && avatarUrl) return 'photo';
  // Profiles saved before avatarMode was added keep showing their existing photo.
  if (!config.avatarMode && avatarUrl) return 'photo';
  return 'pixel';
}

export function AvatarDisplay({
  avatarConfig,
  avatarUrl,
  equippedAura,
  equippedFrame,
  size = 48,
  animate = 'idle',
  mood,
  className = '',
}: Props) {
  const cfg = (avatarConfig && typeof avatarConfig === 'object' ? avatarConfig : {}) as Partial<AvatarConfig>;
  const avatarMode = resolveAvatarMode(cfg, avatarUrl);
  const minecraftSkinUrl = typeof cfg.minecraftSkinUrl === 'string' ? cfg.minecraftSkinUrl : null;
  const isMinecraft = avatarMode === 'minecraft' && !!minecraftSkinUrl;
  const aura = equippedAura && AURA_STYLES[equippedAura] ? AURA_STYLES[equippedAura] : null;
  const frameStyle = equippedFrame
    ? {
        border: '2px solid var(--accent-gold, #d4a017)',
        boxShadow: '0 0 8px #d4a01744',
        borderRadius: isMinecraft ? '12px' : '50%',
        overflow: isMinecraft ? 'visible' : 'hidden',
      }
    : {
        borderRadius: isMinecraft ? '12px' : '50%',
        overflow: isMinecraft ? 'visible' : 'hidden',
      };

  return (
    <div className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}>
      {aura && (
        <motion.div
          className={`absolute inset-0 pointer-events-none ${isMinecraft ? 'rounded-2xl' : 'rounded-full'}`}
          style={{ background: aura.gradient, boxShadow: aura.shadow }}
          animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div style={frameStyle}>
        {isMinecraft && minecraftSkinUrl ? (
          <MinecraftSkinAvatar
            skinUrl={minecraftSkinUrl}
            size={size}
            animate={animate === 'hurt' ? 'none' : animate}
          />
        ) : avatarMode === 'photo' && avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="object-cover rounded-full"
            style={{ width: size, height: size }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <MiguelSprite
            size={size}
            bodyType={cfg.bodyType}
            hairStyle={cfg.hairStyle}
            hairColor={cfg.hairColor}
            skinColor={cfg.skinColor}
            shirtColor={cfg.shirtColor}
            pantsColor={cfg.pants}
            accessory={cfg.accessory}
            expression={cfg.expression}
            animate={animate}
            mood={mood}
          />
        )}
      </div>
    </div>
  );
}
