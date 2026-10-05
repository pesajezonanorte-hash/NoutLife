// Sello del día del Diario: el ánimo y la fecha dentro de un anillo de tinta.
// Decorativo (aria-hidden); el diario de cuero vive en ./Diary.
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MoodFace, moodOf } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';

/** Sello del día: el ánimo y la fecha dentro de un anillo de tinta, un poco torcido. */
export function DayStamp({ mood, date, animate = false, className }: { mood: number; date: Date; animate?: boolean; className?: string }) {
  const m = moodOf(mood);
  return (
    <motion.span
      aria-hidden="true"
      className={cn('pointer-events-none relative flex size-[4.5rem] shrink-0 flex-col items-center justify-center rounded-full border-2 border-dashed md:size-20', softTone[m.tone], className)}
      initial={animate ? { scale: 2, rotate: -40, opacity: 0 } : false}
      animate={{ scale: 1, rotate: -12, opacity: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 20, mass: 1.1 }}
    >
      <MoodFace mood={m.n} className="size-6" />
      <span className="font-mono text-label-md tabular-nums">{date.getDate()}/{date.getMonth() + 1}</span>
    </motion.span>
  );
}
