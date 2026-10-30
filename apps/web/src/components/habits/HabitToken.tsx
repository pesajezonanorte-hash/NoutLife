// Ficha de check-in de Hábitos: una ficha cilíndrica en 3D de verdad (CSS preserve-3d: dos caras
// y un canto de 18 segmentos a franjas, como una ficha de juego). Pendiente muestra la cara
// clara con su hueco; al completar, salta, da vuelta y medio y encaja en su alojamiento con un
// golpe: onda que se expande (el «clic» visible), sonido si los efectos están activos y
// vibración en Android; donde no hay vibración, la ficha da un pequeño tirón al encajar.
// La ficha gira en cuanto se toca (sin esperar a la API) y vuelve si el registro falla.
// Mismo contrato accesible que InkCheckButton: aria-pressed, «Completar X» / «Desmarcar X».
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { audio } from '@/lib/audio';
import { useMotionStore } from '@/store/motionStore';
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{ done: (n: string) => string; undo: (n: string) => string; complete: (n: string) => string }> = {
  es: { done: (n) => `${n}: completado hoy`, undo: (n) => `Desmarcar ${n}`, complete: (n) => `Completar ${n}` },
  en: { done: (n) => `${n}: completed today`, undo: (n) => `Undo ${n}`, complete: (n) => `Complete ${n}` },
};

const RIM = Array.from({ length: 18 }, (_, i) => i);

export interface HabitTokenProps {
  checked: boolean;
  /** Nombre del hábito: genera «Completar X». */
  name: string;
  onToggle: () => void;
  /** Hay un registro en curso para este hábito. */
  pending?: boolean;
  /** Marcado y sin vuelta atrás. */
  locked?: boolean;
  className?: string;
}

export function HabitToken({ checked, name, onToggle, pending, locked, className }: HabitTokenProps) {
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  /** Giro optimista: la ficha ya está encajada mientras la API responde. */
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [anim, setAnim] = useState<'snap' | 'unsnap' | null>(null);
  const wasPending = useRef(false);
  const on = optimistic ?? checked;
  const isLocked = checked && locked;

  // Al terminar el registro manda el servidor; si falló, la ficha vuelve (con su animación).
  useEffect(() => {
    if (pending) { wasPending.current = true; return; }
    if (!wasPending.current) return;
    wasPending.current = false;
    if (optimistic !== null && optimistic !== checked && !reduce) setAnim(checked ? 'snap' : 'unsnap');
    setOptimistic(null);
  }, [pending, checked]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const next = !on;
    setOptimistic(next);
    if (!reduce) setAnim(next ? 'snap' : 'unsnap');
    if (next) {
      audio.play('snap');
      navigator.vibrate?.([12, 46, 22]);
    } else {
      navigator.vibrate?.(8);
    }
    onToggle();
  };
  const waiting = optimistic !== null && optimistic !== checked;

  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={isLocked ? t.done(name) : checked ? t.undo(name) : t.complete(name)}
      aria-disabled={isLocked || undefined}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={isLocked || waiting ? undefined : toggle}
      data-on={on || undefined}
      data-anim={anim ?? undefined}
      onAnimationEnd={(e) => { if (e.animationName === 'lq-token-snap' || e.animationName === 'lq-token-unsnap') setAnim(null); }}
      className={cn('lq-token', isLocked && 'cursor-default', className)}
    >
      <span aria-hidden className="lq-token-socket" />
      <span aria-hidden className="lq-token-coin">
        {RIM.map((i) => <span key={i} className="lq-token-rim" style={{ '--i': i } as CSSProperties} />)}
        <span className="lq-token-face lq-token-front"><span className="lq-token-slot" /></span>
        <span className="lq-token-face lq-token-back"><Check className="size-[1.15rem]" strokeWidth={3} /></span>
      </span>
      <span aria-hidden className="lq-token-wave" />
    </button>
  );
}
