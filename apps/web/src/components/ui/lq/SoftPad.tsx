// Almohadilla de silicona en relieve: el check de los hábitos y rutinas. El modelo sale de Blender
// (scripts/blender/calm.py) y lo dibuja un único contexto WebGL (three3d/softPadEngine): en reposo
// es una imagen del propio modelo y solo la que se toca se dibuja en vivo. Al presionar se comprime
// y abulta; al soltar rebota apenas; al marcar, la luz llena el volumen desde dentro y sale la
// palomita. Sin WebGL, o mientras carga, una versión en CSS con el mismo aspecto.
// La almohadilla responde en cuanto se toca (sin esperar a la API) y vuelve si el registro falla.
// Contrato accesible: aria-pressed, «Completar X» / «Desmarcar X».
import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { audio } from '@/lib/audio';
import { useText, type Copy } from '@/lib/i18n';
import { hasWebGL2 } from '@/components/three3d/near';
import { afterSplash } from '@/splash/after';
import type { SoftPadEngine } from '@/components/three3d/softPadEngine';

const COPY: Copy<{ done: (n: string) => string; undo: (n: string) => string; complete: (n: string) => string }> = {
  es: { done: (n) => `${n}: completado hoy`, undo: (n) => `Desmarcar ${n}`, complete: (n) => `Completar ${n}` },
  en: { done: (n) => `${n}: completed today`, undo: (n) => `Undo ${n}`, complete: (n) => `Complete ${n}` },
};

let engineLoad: Promise<SoftPadEngine | null> | null = null;

/** Carga el motor una vez, cuando el navegador está libre; la lista ya se ve sin él. */
function loadEngine(): Promise<SoftPadEngine | null> {
  if (!engineLoad) {
    engineLoad = !hasWebGL2()
      ? Promise.resolve(null)
      : new Promise<void>((resolve) => {
        const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
        if (idle) idle(() => resolve(), { timeout: 1200 });
        else window.setTimeout(resolve, 200);
      })
        .then(afterSplash)
        .then(() => import('@/components/three3d/softPadEngine'))
        .then((m) => m.softPadEngine())
        .catch(() => null);
  }
  return engineLoad;
}

/** Solo la cara de la almohadilla, sin botón: para filas que ya son botones (pasos de un ritual). */
export function SoftPadFace({ on, className }: { on: boolean; className?: string }) {
  useEffect(() => { void loadEngine(); }, []);
  return (
    <span aria-hidden data-on={on || undefined} className={cn('lq-pad lq-pad-face-only', className)}>
      <PadSkin />
    </span>
  );
}

function PadSkin() {
  return (
    <>
      <span aria-hidden className="lq-pad-seat" />
      <span aria-hidden className="lq-pad-css"><Check strokeWidth={3} /></span>
      <span aria-hidden className="lq-pad-img lq-pad-img-off" />
      <span aria-hidden className="lq-pad-img lq-pad-img-on" />
    </>
  );
}

export interface SoftPadProps {
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

export function SoftPad({ checked, name, onToggle, pending, locked, className }: SoftPadProps) {
  const t = useText(COPY);
  const ref = useRef<HTMLButtonElement>(null);
  const engine = useRef<SoftPadEngine | null>(null);
  /** Estado optimista: ya está encendida mientras la API responde. */
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const wasPending = useRef(false);
  const on = optimistic ?? checked;
  const isLocked = checked && locked;
  const waiting = optimistic !== null && optimistic !== checked;

  useEffect(() => {
    let alive = true;
    void loadEngine().then((e) => { if (alive) engine.current = e; });
    return () => { alive = false; };
  }, []);

  // Al terminar el registro manda el servidor; si falló, la luz se apaga.
  useEffect(() => {
    if (pending) { wasPending.current = true; return; }
    if (!wasPending.current) return;
    wasPending.current = false;
    if (optimistic !== null && optimistic !== checked && ref.current) engine.current?.setOn(ref.current, checked);
    setOptimistic(null);
  }, [pending, checked]); // eslint-disable-line react-hooks/exhaustive-deps

  const inert = isLocked || waiting || pending;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (inert || e.button !== 0) return;
    engine.current?.press(e.currentTarget, on);
    navigator.vibrate?.(6);
  };
  const lift = (e: PointerEvent<HTMLButtonElement>) => engine.current?.release(e.currentTarget);

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) return;
    const next = !on;
    setOptimistic(next);
    // detail 0: teclado o lector de pantalla, sin presión previa.
    engine.current?.setOn(e.currentTarget, next, e.detail === 0);
    if (next) {
      audio.play('press');
      navigator.vibrate?.([8, 40, 14]);
    }
    onToggle();
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={checked}
      aria-label={isLocked ? t.done(name) : checked ? t.undo(name) : t.complete(name)}
      aria-disabled={isLocked || pending || undefined}
      aria-busy={pending || undefined}
      data-on={on || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={lift}
      onPointerCancel={lift}
      onPointerLeave={lift}
      onClick={onClick}
      className={cn('lq-pad', isLocked && 'cursor-default', className)}
    >
      <PadSkin />
    </button>
  );
}
