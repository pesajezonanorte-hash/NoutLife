import { memo, useMemo, type CSSProperties } from 'react';
import type { AvatarConfig, AvatarMode } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { PixelAvatar } from './pixel/PixelAvatar';
import { lookFrom } from './pixel/look';
import { MinecraftSkinAvatar } from './MinecraftSkinAvatar';

// Auras y marcos de la Tienda (styles/avatar.css): la clase según el artículo.
const AURAS = new Set(['aura_fire', 'aura_ice', 'aura_gold', 'aura_storm', 'aura_rainbow', 'aura_comet']);
const FRAMES: Record<string, string> = {
  frame_gold: 'lq-frame-gold', frame_diamond: 'lq-frame-diamond', frame_fire: 'lq-frame-fire', frame_cosmic: 'lq-frame-cosmic',
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

export const AvatarDisplay = memo(function AvatarDisplay({
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
  // Mismo personaje = mismo objeto: el dibujo del PixelAvatar no se recalcula en cada repintado de la lista.
  const look = useMemo(() => lookFrom(avatarConfig), [avatarConfig]);
  const avatarMode = resolveAvatarMode(cfg, avatarUrl);
  const minecraftSkinUrl = typeof cfg.minecraftSkinUrl === 'string' ? cfg.minecraftSkinUrl : null;
  const isMinecraft = avatarMode === 'minecraft' && !!minecraftSkinUrl;
  const aura = equippedAura && AURAS.has(equippedAura) ? equippedAura.slice('aura_'.length) : null;
  // Un marco que ya no está en el catálogo se ve como el aro sencillo de antes.
  const frame = equippedFrame ? FRAMES[equippedFrame] ?? 'lq-frame-plain' : null;
  const radius = isMinecraft ? '12px' : '50%';
  const clip: CSSProperties = { borderRadius: radius, overflow: isMinecraft ? 'visible' : 'hidden' };

  const face = (
    <div style={clip}>
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
        // Personaje pixel: en el círculo se ve la cabeza (busto) sobre el fondo de superficie.
        <span className="flex items-end justify-center bg-surface-variant" style={{ width: size, height: size }}>
          <PixelAvatar look={look} size={size} crop="head" animate={animate} mood={mood} />
        </span>
      )}
    </div>
  );

  return (
    <div className={`relative isolate inline-flex items-center justify-center flex-shrink-0 ${className}`}>
      {aura && <span aria-hidden="true" className={cn('lq-aura', `lq-aura-${aura}`, isMinecraft && 'lq-aura-square')} />}
      {frame ? (
        <div className={cn('lq-frame', frame)} style={{ borderRadius: radius, '--frame-w': `${Math.max(2, Math.round(size * 0.05))}px` } as CSSProperties}>{face}</div>
      ) : face}
    </div>
  );
});
