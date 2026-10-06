// Piezas de la red social: avatar con su punto de presencia y la llama de una
// racha. Una racha entre amigos (o de un gremio) solo se enciende, y por tanto
// solo se muestra, al tercer día seguido hablando; mientras sigue viva, la llama
// tiembla, y si se apagó hace poco queda una brasa que todavía se puede revivir.
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { STREAK_MIN, type StreakView } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';

/** Avatar redondo con su punto verde de "en línea". */
export function PresenceAvatar({ user, online, size = 44, className }: {
  user: { avatarConfig?: unknown; avatarUrl?: string | null; equippedAura?: string | null; equippedFrame?: string | null };
  online?: boolean; size?: number; className?: string;
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <AvatarDisplay avatarConfig={user.avatarConfig} avatarUrl={user.avatarUrl} size={size} animate="none" className="overflow-hidden rounded-full" />
      <AnimatePresence>
        {online && (
          <motion.span
            aria-hidden
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.snappy}
            className="absolute bottom-0 right-0 block size-3 rounded-full bg-success ring-2 ring-surface"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60 [.reduce-motion_&]:hidden" style={{ animationDuration: '2.4s' }} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

type FlameStreak = Pick<StreakView, 'count' | 'alive' | 'doneToday' | 'revivable'> & { active?: boolean };

/** ¿La racha está encendida? (las vistas antiguas no traen `active`). */
export const isLit = (s: FlameStreak) => s.active ?? (s.alive && s.count >= STREAK_MIN);

/**
 * Llama de una racha. Encendida y completada hoy: arde. Encendida pero hoy
 * todavía no hablaron: tiembla más baja. Apagada y revivible: brasa gris.
 * Antes del tercer día no se dibuja nada.
 */
export function StreakFlame({ streak, size = 'md', className, label }: { streak: FlameStreak; size?: 'sm' | 'md' | 'lg'; className?: string; label?: string }) {
  const reduce = useReducedMotionConfig();
  const lit = isLit(streak);
  if (!lit && !streak.revivable) return null;
  const icon = { sm: 'size-3.5', md: 'size-4', lg: 'size-6' }[size];
  const text = { sm: 'text-body-sm', md: 'text-label-lg', lg: 'text-heading-sm' }[size];
  const state = !lit ? 'ember' : streak.doneToday ? 'burning' : 'waiting';
  const title = label ?? (state === 'burning' ? `Racha de ${streak.count} días: hoy ya cuenta` : state === 'waiting' ? `Racha de ${streak.count} días: escríbanse hoy para mantenerla` : 'Racha apagada: todavía pueden revivirla');
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-mono tabular-nums', text,
        state === 'burning' && 'text-warning-text', state === 'waiting' && 'text-warning-text/80', state === 'ember' && 'text-on-surface-light', className)}
      title={title}
    >
      <motion.span
        aria-hidden
        className="inline-flex origin-bottom"
        animate={reduce || !lit ? { scale: 1, opacity: lit ? 1 : 0.55 } : { scaleY: state === 'burning' ? [1, 1.12, 0.95, 1.06, 1] : [0.86, 0.94, 0.84, 0.9, 0.86], opacity: 1 }}
        transition={reduce || !lit ? springs.natural : { duration: state === 'burning' ? 1.4 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flame className={cn(icon, lit && 'fill-warning/30')} strokeWidth={1.75} />
      </motion.span>
      {lit && <span aria-hidden>{streak.count}</span>}
      <span className="sr-only">{title}</span>
    </span>
  );
}
