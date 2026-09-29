import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { MiguelSprite } from '../character/MiguelSprite';
import { E } from '@/components/ui/glyphs';

const PARTICLE_COLORS = ['#d9b44a', '#f0e6c8', '#c0c0c8', '#8a8a92', '#ffffff', '#a8871e', '#5c5c64'];

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

function generateParticles(cx: number, cy: number, count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: cx,
    y: cy,
    tx: (Math.random() - 0.5) * 480,
    ty: -(Math.random() * 320 + 60),
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    size: Math.random() * 8 + 3,
  }));
}

function StatLine({ label, amount, delay }: { label: string; amount: number; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-3 font-pixel"
      style={{ fontSize: '12px' }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
    >
      <motion.span
        className="text-accent-gold text-base"
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ delay: delay + 0.1, duration: 0.3 }}
      >
        ▲
      </motion.span>
      <span className="text-accent-gold">+{amount}</span>
      <span className="text-text-primary">{label}</span>
    </motion.div>
  );
}

// Shockwave ring
function Shockwave({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <>
          {[0, 0.15, 0.3].map((delay) => (
            <motion.div
              key={delay}
              className="fixed rounded-full border-2 border-accent-gold pointer-events-none"
              style={{
                zIndex: 103,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 0,
                height: 0,
              }}
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ width: '150vw', height: '150vw', opacity: 0 }}
              transition={{ delay, duration: 0.9, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
}

// Volumetric light beam from top
function VolumetricLight({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed pointer-events-none"
          style={{
            zIndex: 101,
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '300px',
            height: '80vh',
            background:
              'linear-gradient(180deg, color-mix(in oklab, var(--accent-gold) 18%, transparent) 0%, color-mix(in oklab, var(--accent-gold) 6%, transparent) 60%, transparent 100%)',
            filter: 'blur(8px)',
          }}
          initial={{ opacity: 0, scaleX: 0.3 }}
          animate={{ opacity: [0, 1, 0.7, 0] }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      )}
    </AnimatePresence>
  );
}

// CRT scanlines flash
function ScanlineFlash({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: 104,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 4px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

export function LevelUpOverlay() {
  const { levelUpData, clearLevelUp } = useUIStore();
  const [phase, setPhase] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shockwave, setShockwave] = useState(false);
  const [volumetricLight, setVolumetricLight] = useState(false);
  const [scanlines, setScanlines] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!levelUpData) { setPhase(0); return; }

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    setPhase(1);
    setShockwave(true);
    setScanlines(true);

    const t1 = setTimeout(() => {
      setVolumetricLight(true);
      setPhase(2);
    }, 250);
    const t2 = setTimeout(() => {
      setParticles(generateParticles(cx, cy, 70));
      setPhase(3);
    }, 1000);
    const t3 = setTimeout(() => setPhase(4), 1350);
    const t4 = setTimeout(() => {
      setShockwave(false);
      setScanlines(false);
    }, 1200);
    const t5 = setTimeout(() => setVolumetricLight(false), 2500);

    timerRefs.current = [t1, t2, t3, t4, t5];
    return () => timerRefs.current.forEach(clearTimeout);
  }, [levelUpData]);

  const handleContinue = () => {
    timerRefs.current.forEach(clearTimeout);
    setPhase(0);
    setParticles([]);
    setShockwave(false);
    setVolumetricLight(false);
    setScanlines(false);
    clearLevelUp();
  };

  const statLines: Array<{ label: string; amount: number }> = [];
  if (levelUpData?.statIncreases) {
    const si = levelUpData.statIncreases;
    if (si.hp)           statLines.push({ label: 'HP MÁXIMO', amount: si.hp });
    if (si.mp)           statLines.push({ label: 'MP MÁXIMO', amount: si.mp });
    if (si.strength)     statLines.push({ label: 'FUERZA', amount: si.strength });
    if (si.intelligence) statLines.push({ label: 'INTELIGENCIA', amount: si.intelligence });
    if (si.charisma)     statLines.push({ label: 'CARISMA', amount: si.charisma });
  }

  return (
    <AnimatePresence>
      {levelUpData && phase >= 1 && (
        <>
          {/* Shockwave rings */}
          <Shockwave active={shockwave} />

          {/* Volumetric light */}
          <VolumetricLight active={volumetricLight} />

          {/* CRT scanlines */}
          <ScanlineFlash active={scanlines} />

          {/* Flash blanco */}
          <motion.div
            className="fixed inset-0 pointer-events-none bg-white"
            style={{ zIndex: 98 }}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Screen shake */}
          <motion.div
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 99 }}
            animate={phase >= 2 ? { x: [0, -10, 10, -5, 5, -2, 0] } : {}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />

          {/* Overlay oscuro */}
          <motion.div
            className="fixed inset-0 bg-black/82 backdrop-blur-sm"
            style={{ zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Partículas */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="fixed pointer-events-none rounded-sm"
              style={{ left: p.x, top: p.y, background: p.color, width: p.size, height: p.size, zIndex: 105 }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: p.tx, y: p.ty, opacity: 0, scale: 0 }}
              transition={{ duration: 0.9 + Math.random() * 0.7, ease: 'easeOut' }}
            />
          ))}

          {/* Panel central */}
          {phase >= 2 && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 106 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-bg-panel border-4 border-accent-gold shadow-pixel-gold px-6 py-6 flex flex-col items-center gap-4 max-w-xs w-full mx-4 pointer-events-auto relative overflow-hidden"
                initial={{ scale: 0.25, y: -80 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.25, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.04 }}
              >
                {/* Inner glow */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--accent-gold) 12%, transparent) 0%, transparent 70%)',
                  }}
                />

                {/* ¡LEVEL UP! */}
                <motion.div
                  className="font-pixel text-center z-10"
                  initial={{ y: -50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.18, type: 'spring', stiffness: 300 }}
                >
                  <div
                    className="text-accent-gold mb-1"
                    style={{
                      fontSize: '12px',
                      textShadow: '3px 3px 0 rgba(0,0,0,0.55), -1px -1px 0 rgba(217,180,74,0.8), 0 0 20px color-mix(in oklab, var(--accent-gold) 50%, transparent)',
                    }}
                  >
                    ¡LEVEL UP!
                  </div>
                  <motion.div
                    className="text-white"
                    style={{ fontSize: '28px', textShadow: '3px 3px 0 rgba(0,0,0,0.55)' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.4, 1] }}
                    transition={{ delay: 0.42, duration: 0.5 }}
                  >
                    NIVEL {levelUpData.newLevel}
                  </motion.div>
                </motion.div>

                {/* Sprite celebrando */}
                <motion.div
                  className="z-10"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.28, type: 'spring' }}
                >
                  <MiguelSprite size={100} animate="celebrate" />
                </motion.div>

                {/* Stats */}
                {phase >= 3 && statLines.length > 0 && (
                  <motion.div
                    className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 space-y-1.5 z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {statLines.map((s, i) => (
                      <StatLine key={s.label} label={s.label} amount={s.amount} delay={0.12 * i} />
                    ))}
                  </motion.div>
                )}

                {/* Estrellas */}
                <div className="flex gap-3 z-10">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="text-accent-gold"
                      style={{ fontSize: '22px', textShadow: '0 0 10px color-mix(in oklab, var(--accent-gold) 60%, transparent)' }}
                      initial={{ opacity: 0, scale: 0, rotate: -45 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ delay: 0.55 + i * 0.14, type: 'spring' }}
                    >
                      <E e="★" s={12} className="inline-block" />
                    </motion.span>
                  ))}
                </div>

                {/* Botón continuar */}
                {phase >= 4 && (
                  <motion.button
                    className="font-pixel text-border-pixel bg-accent-gold border-2 border-border-pixel px-6 py-2 shadow-pixel hover:bg-yellow-300 active:translate-y-0.5 active:shadow-none transition-colors z-10"
                    style={{ fontSize: '12px' }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={handleContinue}
                  >
                    CONTINUAR →
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
