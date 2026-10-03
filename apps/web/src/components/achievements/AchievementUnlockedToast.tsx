// Logro desbloqueado — toast propio (más presencia que el Toaster general).
// Arriba al centro en móvil (abajo están la tab bar, el FAB y el Toaster) y
// arriba a la derecha en md+. Vive 4 s; se pausa con hover o foco y se puede
// cerrar antes. Región aria-live para lectores de pantalla.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { ease } from '@/lib/motion';
import { useUIStore, type AchievementToast } from '@/store/uiStore';
import { resolveGlyph } from '@/components/ui/glyphs';
import { Badge, Button, IconChip } from '@/components/ui/lq';

const LIFE_MS = 4000;

function AchievementCard({ t, onClose }: { t: AchievementToast; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = resolveGlyph(t.icon);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => closeRef.current(), LIFE_MS);
    return () => window.clearTimeout(id);
  }, [paused]);

  return (
    <motion.div
      layout
      role="status"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setPaused(false)}
      className="pointer-events-auto relative w-full max-w-[380px] overflow-hidden rounded-2xl border border-success/40 bg-background text-on-background shadow-lg"
    >
      <div className="flex items-start gap-3 py-3 pl-3 pr-1">
        <IconChip icon={Icon} tone="success" size="md" />
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-label-md uppercase tracking-wide text-success-text">Logro desbloqueado</p>
          <p className="text-heading-sm">{t.title}</p>
          {t.description && <p className="text-body-sm text-on-surface-light">{t.description}</p>}
          {t.xpReward > 0 && <Badge variant="primary" icon={Star} className="mt-2">+{t.xpReward} XP</Badge>}
        </div>
        <Button variant="icon" aria-label={`Cerrar aviso: ${t.title}`} onClick={onClose}>
          <X aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      </div>
      <motion.span
        key={String(paused)}
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1 origin-left bg-success"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: paused ? 1 : 0 }}
        transition={{ duration: paused ? 0 : LIFE_MS / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

export function AchievementUnlockedToast() {
  const toasts = useUIStore((s) => s.achievementToasts);
  const remove = useUIStore((s) => s.removeAchievementToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-[65] flex flex-col items-center gap-2 md:inset-x-auto md:right-8 md:top-20 md:w-[380px]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => <AchievementCard key={t.id} t={t} onClose={() => remove(t.id)} />)}
      </AnimatePresence>
    </div>
  );
}
