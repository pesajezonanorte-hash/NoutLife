// Piezas de la red social: punto de presencia, llama de racha, polaroid de la
// foto del día y el diálogo para enviarla. Las fotos caen como polaroids
// pegadas con cinta; la llama tiembla mientras la racha sigue viva.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { Camera, Check, Flame, ImagePlus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { fetchHabits, type Habit } from '@/services/habit.service';
import { compressPhoto, type StreakView } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { Button, Field, Input, ResponsiveDialog } from '@/components/ui/lq';

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

/**
 * Llama de una racha. Viva y completada hoy: arde. Viva pero pendiente: tiembla
 * más baja. Perdida y revivible: brasa gris. Sin racha: no se muestra el número.
 */
export function StreakFlame({ streak, size = 'md', className, label }: { streak: Pick<StreakView, 'count' | 'alive' | 'doneToday' | 'revivable'>; size?: 'sm' | 'md' | 'lg'; className?: string; label?: string }) {
  const reduce = useReducedMotionConfig();
  const lit = streak.alive;
  const icon = { sm: 'size-3.5', md: 'size-4', lg: 'size-6' }[size];
  const text = { sm: 'text-body-sm', md: 'text-label-lg', lg: 'text-heading-sm' }[size];
  const state = !lit ? (streak.revivable ? 'ember' : 'out') : streak.doneToday ? 'burning' : 'waiting';
  return (
    <span
      className={cn('inline-flex items-center gap-1 font-mono tabular-nums', text,
        state === 'burning' && 'text-warning-text', state === 'waiting' && 'text-warning-text/80', (state === 'ember' || state === 'out') && 'text-on-surface-light', className)}
      title={label ?? (state === 'burning' ? 'Racha completada hoy' : state === 'waiting' ? 'Falta la foto de hoy' : state === 'ember' ? 'Racha apagada: todavía puedes revivirla' : 'Sin racha')}
    >
      <motion.span
        aria-hidden
        className="inline-flex origin-bottom"
        animate={reduce || !lit ? { scale: 1, opacity: lit ? 1 : 0.55 } : { scaleY: state === 'burning' ? [1, 1.12, 0.95, 1.06, 1] : [0.86, 0.94, 0.84, 0.9, 0.86], opacity: 1 }}
        transition={reduce || !lit ? springs.natural : { duration: state === 'burning' ? 1.4 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flame className={cn(icon, lit && 'fill-warning/30')} strokeWidth={1.75} />
      </motion.span>
      {(lit || streak.revivable) && <span>{streak.revivable && !lit ? '' : streak.count}</span>}
      <span className="sr-only">{label ?? (lit ? `Racha de ${streak.count} días` : 'Racha apagada')}</span>
    </span>
  );
}

/** Foto del día como polaroid con cinta. Cae desde arriba y se queda un poco ladeada. */
export function Polaroid({ src, caption, tilt = 0, className, children, delay = 0 }: {
  src: string; caption?: ReactNode; tilt?: number; className?: string; children?: ReactNode; delay?: number;
}) {
  const reduce = useReducedMotionConfig();
  return (
    <motion.figure
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -28, rotate: tilt * 4 }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={reduce ? undefined : { rotate: 0, y: -3, transition: springs.natural }}
      transition={{ ...springs.heavy, delay }}
      className={cn('relative rounded-[6px] bg-surface p-2 pb-2.5 shadow-md ring-1 ring-border', className)}
    >
      <span aria-hidden className="absolute -top-2 left-1/2 block h-4 w-12 -translate-x-1/2 -rotate-3 rounded-[2px] bg-warning/25 backdrop-blur-[1px]" />
      <img src={src} alt="" loading="lazy" className="block aspect-[4/5] w-full rounded-[3px] bg-background object-cover" />
      {(caption || children) && (
        <figcaption className="mt-2 px-0.5 text-body-sm leading-snug text-on-surface">{caption}{children}</figcaption>
      )}
    </motion.figure>
  );
}

/**
 * Elegir y enviar la foto del día: foto (cámara o galería), el hábito que
 * muestra (los cumplidos hoy salen primero) y una nota opcional.
 */
export function SnapDialog({ open, onClose, title = 'Tu foto del día', hint, onSend }: {
  open: boolean; onClose: () => void; title?: string; hint?: string;
  onSend: (photoUrl: string, habitTitle: string | null, caption: string) => Promise<void>;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habit, setHabit] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhoto(null); setHabit(null); setCaption(''); setError(null);
    fetchHabits()
      .then((list) => setHabits(list.filter((h) => h.isActive).sort((a, b) => Number(Boolean(b.todayCompleted)) - Number(Boolean(a.todayCompleted)))))
      .catch(() => setHabits([]));
  }, [open]);

  async function pick(file?: File | null) {
    if (!file) return;
    setError(null);
    try { setPhoto(await compressPhoto(file)); }
    catch { setError('No se pudo leer esa foto. Prueba con otra.'); }
  }

  async function send() {
    if (!photo) return;
    setBusy(true); setError(null);
    try { await onSend(photo, habit, caption.trim()); onClose(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : 'No se pudo enviar'); }
    finally { setBusy(false); }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {hint && <p className="-mt-2 text-body-sm text-on-surface-light">{hint}</p>}
        <input
          ref={fileRef} id={inputId} type="file" accept="image/*" className="sr-only"
          onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }}
        />
        <AnimatePresence mode="wait" initial={false}>
          {photo ? (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
              <Polaroid src={photo} tilt={-2} className="w-[min(240px,70vw)]" caption={habit ?? caption ?? undefined} />
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><RotateCcw aria-hidden className="size-4" />Cambiar foto</Button>
            </motion.div>
          ) : (
            <motion.label
              key="pick" htmlFor={inputId}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.natural}
              className="lq-lift flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong text-on-surface focus-within:border-primary"
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-warning/[var(--lq-soft-alpha)] text-warning-text"><Camera aria-hidden className="size-7" strokeWidth={1.75} /></span>
              <span className="text-label-lg">Tomar o elegir una foto</span>
              <span className="text-body-sm text-on-surface-light">Haciendo un hábito, una comida, tu entreno…</span>
            </motion.label>
          )}
        </AnimatePresence>

        {habits.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-lg text-on-surface">¿Qué hábito muestra?</legend>
            <div className="-mx-1 flex flex-wrap gap-2 px-1">
              {habits.slice(0, 8).map((h) => {
                const on = habit === h.title;
                return (
                  <motion.button
                    key={h.id} type="button" aria-pressed={on} onClick={() => setHabit(on ? null : h.title)}
                    whileTap={{ scale: 0.95 }} transition={springs.snappy}
                    className={cn('inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-body-sm transition-colors',
                      on ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:border-primary/40')}
                  >
                    {h.todayCompleted ? <Check aria-hidden className="size-3.5 text-success-text" strokeWidth={2.25} /> : null}
                    <span className="max-w-[160px] truncate">{h.title}</span>
                  </motion.button>
                );
              })}
            </div>
          </fieldset>
        )}

        <Field label="Nota (opcional)">
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} placeholder="Hoy tocó pierna 💪" />
        </Field>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="button" className="flex-1" disabled={!photo} loading={busy} onClick={() => void send()}>
            <ImagePlus aria-hidden className="size-4" />Enviar foto
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
