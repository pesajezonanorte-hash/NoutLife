// Logros del Perfil como «publicaciones»: una cuadrícula de 3 columnas al
// estilo de un perfil social. Primero los desbloqueados más recientes; después
// los siguientes por conseguir, apagados y con su progreso. El título va
// siempre visible (no depende del hover). Entran en cascada al verse.
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs, staggerVariants, enter } from '@/lib/motion/presets';
import { softTone } from '@/components/ui/lq/tones';
import type { Achievement } from '@/services/achievement.service';
import { achievementCategory, achievementIcon, achievementProgress } from '@/components/achievements/achievementMeta';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') : '');

export function AchievementPosts({ achievements, max = 12 }: { achievements: Achievement[]; max?: number }) {
  const unlocked = achievements.filter((a) => a.unlocked).sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''));
  const locked = achievements.filter((a) => !a.unlocked);
  const posts = [...unlocked, ...locked].slice(0, max);
  if (!posts.length) return <p className="text-body-md text-on-surface-light">Completa hábitos y misiones para publicar tus primeros logros.</p>;

  return (
    <motion.ul
      variants={staggerVariants(0.05, 0.1)}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.2 }}
      className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:gap-3 lg:grid-cols-6"
    >
      {posts.map((a) => {
        const Icon = achievementIcon(a);
        const tone = achievementCategory(a.category).tone;
        const p = achievementProgress(a);
        return (
          <motion.li
            key={a.id}
            variants={enter.serve}
            whileHover={{ y: -3, transition: springs.natural }}
            className={cn('group relative flex aspect-square flex-col overflow-hidden rounded-xl md:rounded-2xl', a.unlocked ? softTone[tone] : 'bg-surface-variant text-on-surface-light')}
          >
            <span className="flex flex-1 items-center justify-center">
              {a.unlocked ? (
                <Icon aria-hidden className="size-[38%] transition-transform duration-[560ms] ease-[var(--lq-ease-heavy)] group-hover:-rotate-6 group-hover:scale-110" strokeWidth={1.4} />
              ) : (
                <span className="relative flex size-[38%] items-center justify-center">
                  <Icon aria-hidden className="size-full opacity-25 blur-[1.5px]" strokeWidth={1.4} />
                  <Lock aria-hidden className="absolute size-[42%]" strokeWidth={1.75} />
                </span>
              )}
            </span>
            {/* Pie de la publicación: título siempre visible */}
            <span className="relative flex min-w-0 flex-col gap-0.5 bg-surface/80 px-2 py-1.5 backdrop-blur-[2px] md:px-3 md:py-2">
              <span className="truncate text-label-md text-on-background md:text-label-lg">{a.title}</span>
              {a.unlocked ? (
                <span className="hidden truncate text-label-md text-on-surface-light md:block">{fmtDate(a.unlockedAt)}</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="sr-only">Bloqueado. </span>
                  <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                    <span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${p.pct / 100})` }} />
                  </span>
                  <span className="hidden font-mono text-label-md tabular-nums text-on-surface-light md:inline">{p.pct}%</span>
                </span>
              )}
            </span>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
