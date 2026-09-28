import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';

type Animation = 'idle' | 'celebrate' | 'none';
type FaceName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

type TextureFace = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CubeTexture = Record<FaceName, TextureFace>;

interface CubeProps {
  skinUrl: string;
  texture: CubeTexture;
  dimensions: [width: number, height: number, depth: number];
  position: [x: number, y: number, z: number];
  unit: number;
  inflate?: number;
}

interface Props {
  skinUrl: string;
  size?: number;
  animate?: Animation;
  className?: string;
}

/**
 * Maps one of Mojang's unfolded cuboids to its six faces. Coordinates are in
 * native texture pixels, so a standard 64×64 skin can be rendered without a
 * server-side transform or an external skin-viewer dependency.
 */
function cuboidTexture(x: number, y: number, width: number, height: number, depth: number): CubeTexture {
  return {
    top: { x: x + depth, y, width, height: depth },
    bottom: { x: x + depth + width, y, width, height: depth },
    left: { x, y: y + depth, width: depth, height },
    front: { x: x + depth, y: y + depth, width, height },
    right: { x: x + depth + width, y: y + depth, width: depth, height },
    back: { x: x + depth + width + depth, y: y + depth, width, height },
  };
}

const TEXTURES = {
  head: cuboidTexture(0, 0, 8, 8, 8),
  headOverlay: cuboidTexture(32, 0, 8, 8, 8),
  torso: cuboidTexture(16, 16, 8, 12, 4),
  torsoOverlay: cuboidTexture(16, 32, 8, 12, 4),
  rightArm: cuboidTexture(40, 16, 4, 12, 4),
  rightArmOverlay: cuboidTexture(40, 32, 4, 12, 4),
  leftArm: cuboidTexture(32, 48, 4, 12, 4),
  leftArmOverlay: cuboidTexture(48, 48, 4, 12, 4),
  rightLeg: cuboidTexture(0, 16, 4, 12, 4),
  rightLegOverlay: cuboidTexture(0, 32, 4, 12, 4),
  leftLeg: cuboidTexture(16, 48, 4, 12, 4),
  leftLegOverlay: cuboidTexture(0, 48, 4, 12, 4),
};

function TextureFace({
  name,
  texture,
  skinUrl,
  width,
  height,
  depth,
  unit,
}: {
  name: FaceName;
  texture: TextureFace;
  skinUrl: string;
  width: number;
  height: number;
  depth: number;
  unit: number;
}) {
  const faceWidth = (name === 'left' || name === 'right') ? depth : width;
  const faceHeight = (name === 'top' || name === 'bottom') ? depth : height;
  const transformByFace: Record<FaceName, string> = {
    front: `translateZ(${depth / 2}px)`,
    back: `rotateY(180deg) translateZ(${depth / 2}px)`,
    right: `rotateY(90deg) translateZ(${width / 2}px)`,
    left: `rotateY(-90deg) translateZ(${width / 2}px)`,
    top: `rotateX(90deg) translateZ(${height / 2}px)`,
    bottom: `rotateX(-90deg) translateZ(${height / 2}px)`,
  };

  const style: CSSProperties = {
    position: 'absolute',
    left: -faceWidth / 2,
    top: -faceHeight / 2,
    width: faceWidth,
    height: faceHeight,
    transform: transformByFace[name],
    transformStyle: 'preserve-3d',
    backfaceVisibility: 'hidden',
    backgroundImage: `url("${skinUrl}")`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${64 * unit}px ${64 * unit}px`,
    backgroundPosition: `${-texture.x * unit}px ${-texture.y * unit}px`,
    imageRendering: 'pixelated',
    pointerEvents: 'none',
  };

  return <div style={style} />;
}

function SkinCube({ skinUrl, texture, dimensions, position, unit, inflate = 0 }: CubeProps) {
  const [baseWidth, baseHeight, baseDepth] = dimensions;
  const width = (baseWidth + inflate) * unit;
  const height = (baseHeight + inflate) * unit;
  const depth = (baseDepth + inflate) * unit;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        transform: `translate3d(${position[0] * unit}px, ${position[1] * unit}px, ${position[2] * unit}px)`,
        transformStyle: 'preserve-3d',
      }}
      aria-hidden="true"
    >
      {(Object.keys(texture) as FaceName[]).map((name) => (
        <TextureFace
          key={name}
          name={name}
          texture={texture[name]}
          skinUrl={skinUrl}
          width={width}
          height={height}
          depth={depth}
          unit={unit}
        />
      ))}
    </div>
  );
}

/**
 * Compact CSS-3D Minecraft skin renderer for standard 64×64 PNG textures.
 * It intentionally uses no external viewer or remote service: a selected skin
 * stays private in the user's saved avatar configuration and remains usable
 * offline after it has been loaded.
 */
export function MinecraftSkinAvatar({ skinUrl, size = 64, animate = 'idle', className = '' }: Props) {
  const resolvedSize = Math.max(28, size);
  const unit = resolvedSize / 30;
  const motionProps = animate === 'celebrate'
    ? {
        animate: { y: [0, -4, 0, -2, 0], rotate: [0, -2, 2, -1, 0] },
        transition: { duration: 0.72, ease: 'easeOut', repeat: 1 },
      }
    : animate === 'idle'
      ? {
          animate: { y: [0, -1.4, 0], rotate: [0, -0.65, 0.65, 0] },
          transition: { duration: 3.2, ease: 'easeInOut', repeat: Infinity },
        }
      : { animate: {}, transition: { duration: 0 } };

  const parts: Array<{
    key: string;
    texture: CubeTexture;
    overlay?: CubeTexture;
    dimensions: [number, number, number];
    position: [number, number, number];
  }> = [
    { key: 'head', texture: TEXTURES.head, overlay: TEXTURES.headOverlay, dimensions: [8, 8, 8], position: [0, -12, 0] },
    { key: 'torso', texture: TEXTURES.torso, overlay: TEXTURES.torsoOverlay, dimensions: [8, 12, 4], position: [0, -2, 0] },
    { key: 'right-arm', texture: TEXTURES.rightArm, overlay: TEXTURES.rightArmOverlay, dimensions: [4, 12, 4], position: [-6, -2, 0] },
    { key: 'left-arm', texture: TEXTURES.leftArm, overlay: TEXTURES.leftArmOverlay, dimensions: [4, 12, 4], position: [6, -2, 0] },
    { key: 'right-leg', texture: TEXTURES.rightLeg, overlay: TEXTURES.rightLegOverlay, dimensions: [4, 12, 4], position: [-2.25, 10, 0] },
    { key: 'left-leg', texture: TEXTURES.leftLeg, overlay: TEXTURES.leftLegOverlay, dimensions: [4, 12, 4], position: [2.25, 10, 0] },
  ];

  return (
    <div
      role="img"
      aria-label="Skin de Minecraft del personaje"
      className={`relative inline-block select-none ${className}`}
      style={{
        width: resolvedSize,
        height: resolvedSize * 1.25,
        perspective: `${resolvedSize * 9}px`,
        imageRendering: 'pixelated',
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d', transformOrigin: '50% 52%' }}
        {...motionProps}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: 'rotateX(-8deg) rotateY(-34deg)',
            transformStyle: 'preserve-3d',
          }}
        >
          {parts.map((part) => (
            <div key={part.key} style={{ transformStyle: 'preserve-3d' }}>
              <SkinCube
                skinUrl={skinUrl}
                texture={part.texture}
                dimensions={part.dimensions}
                position={part.position}
                unit={unit}
              />
              {part.overlay && (
                <SkinCube
                  skinUrl={skinUrl}
                  texture={part.overlay}
                  dimensions={part.dimensions}
                  position={part.position}
                  unit={unit}
                  inflate={0.4}
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
