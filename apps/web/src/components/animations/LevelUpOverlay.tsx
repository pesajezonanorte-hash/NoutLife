// Subida de nivel — diálogo modal centrado sobre scrim. Número grande con halo,
// recompensas en badges, confeti (no con reduced motion) y cierre automático a
// los 5 s que se pausa mientras el puntero está encima. Escape, clic en el
// fondo o "Continuar" lo cierran; el foco vuelve a donde estaba.
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Coins, Dumbbell, Heart, Sparkles, Star, type LucideIcon } from 'lucide-react';
import { dialog, scrim, spring } from '@/lib/motion';
import { getLevelTitle } from '@/lib/gameProgress';
import { useUIStore, type StatIncreases } from '@/store/uiStore';
import { Badge, Button, Confetti, useDialogBehavior, type BadgeVariant } from '@/components/ui/lq';

const AUTO_CLOSE_MS = 5000;

const STATS: Array<{ key: keyof StatIncreases; label: string; icon: LucideIcon; variant: BadgeVariant }> = [
  { key: 'hp', label: 'HP', icon: Heart, variant: 'error' },
  { key: 'strength', label: 'Fuerza', icon: Dumbbell, variant: 'success' },
  { key: 'intelligence', label: 'Inteligencia', icon: Brain, variant: 'forest' },
  { key: 'charisma', label: 'Carisma', icon: Sparkles, variant: 'warning' },
];

export function LevelUpOverlay() {
  const data = useUIStore((s) => s.levelUpData);
  const clear = useUIStore((s) => s.clearLevelUp);
  const open = Boolean(data);
  const titleId = useId();
  const descId = useId();
  const panelRef = useDialogBehavior(open, clear);
  const [hover, setHover] = useState(false);

  // Cierre automático; se reinicia al salir el puntero.
  useEffect(() => {
    if (!open || hover) return;
    const t = window.setTimeout(clear, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, hover, clear]);

  const level = data?.newLevel ?? 0;
  const stats = STATS.filter((s) => (data?.statIncreases?.[s.key] ?? 0) > 0);

  return createPortal(
    <AnimatePresence>
      {data && (
        <motion.div
          key="levelup"
          variants={scrim} initial="initial" animate="animate" exit="exit"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--scrim)] p-4"
          onMouseDown={(e) => e.target === e.currentTarget && clear()}
        >
          <motion.div
            ref={panelRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} tabIndex={-1}
            variants={dialog}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            className="relative flex w-full max-w-[400px] flex-col items-center gap-6 overflow-hidden rounded-3xl bg-background px-6 pb-6 pt-10 text-center text-on-background shadow-lg outline-none md:px-8 md:pb-8"
          >
            <Confetti pieces={28} position="absolute" />
            <motion.span
              aria-hidden
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { ...spring, delay: 0.1 } }}
              className="lq-halo flex size-32 items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)] text-display-lg text-primary-text font-mono tabular-nums shadow-[0_0_0_6px_rgb(var(--lq-background)),0_0_0_8px_rgb(var(--lq-primary)/0.35)]"
            >
              {level}
            </motion.span>

            <div className="flex flex-col gap-1">
              <span className="text-label-lg text-primary-text">¡Subiste de nivel!</span>
              <h2 id={titleId} className="text-display-sm md:text-display-md">¡Nivel {level}!</h2>
              <p id={descId} className="text-body-md text-on-surface-light">
                Ahora eres <b className="text-on-background">{getLevelTitle(level)}</b>. Sigue así.
              </p>
            </div>

            {(data.xpEarned > 0 || data.goldEarned > 0 || stats.length > 0) && (
              <ul aria-label="Recompensas" className="flex flex-wrap justify-center gap-2">
                {data.xpEarned > 0 && <li><Badge variant="primary" size="lg" icon={Star}>+{data.xpEarned} XP</Badge></li>}
                {data.goldEarned > 0 && <li><Badge variant="warning" size="lg" icon={Coins}>+{data.goldEarned} oro</Badge></li>}
                {stats.map((s) => (
                  <li key={s.key}><Badge variant={s.variant} size="lg" icon={s.icon}>+{data.statIncreases[s.key]} {s.label}</Badge></li>
                ))}
              </ul>
            )}

            <Button size="lg" block data-autofocus onClick={clear}>Continuar</Button>

            {/* Cuenta atrás del cierre automático (decorativa). */}
            <motion.span
              key={String(hover)}
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1 origin-left bg-primary"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: hover ? 1 : 0 }}
              transition={{ duration: hover ? 0 : AUTO_CLOSE_MS / 1000, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
