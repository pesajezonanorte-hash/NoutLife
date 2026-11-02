// Contador y aro de progreso de la zona de enfoque. El aro de vidrio se descarga al abrirse; hasta
// entonces, o sin WebGL, se ve el anillo plano de siempre en el mismo sitio.
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { hasWebGL2 } from '@/components/three3d/near';
import type { FocusRingState } from './FocusRingScene';

const FocusRing3D = lazy(() => import('./FocusRing3D'));

export interface FocusRingProps {
  /** 0–1 */
  progress: number;
  state: FocusRingState;
  /** Descanso del Pomodoro: la luz toma el color de éxito. */
  rest?: boolean;
  /** Nombre accesible del progreso; sin él, el aro es decorativo. */
  label?: string;
  valueText?: string;
  /** El tiempo, centrado dentro del aro. */
  children?: ReactNode;
  className?: string;
}

export function FocusRing({ progress, state, rest, label, valueText, children, className }: FocusRingProps) {
  const [failed, setFailed] = useState(() => !hasWebGL2());
  const [ready, setReady] = useState(false);
  const a11y = label
    ? { role: 'progressbar', 'aria-label': label, 'aria-valuenow': Math.round(progress * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuetext': valueText }
    : {};
  const glass = ready && !failed;
  return (
    <div {...a11y} className={cn('relative', className)}>
      <svg viewBox="0 0 100 100" aria-hidden className={cn('absolute inset-0 size-full -rotate-90 transition-opacity duration-500', glass && 'opacity-0')}>
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="6" className="stroke-surface-variant" />
        <circle
          cx="50" cy="50" r="45" fill="none" strokeWidth="6" strokeLinecap="round"
          pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - progress}
          strokeOpacity={progress > 0 ? 1 : 0}
          className={cn(state === 'done' || rest ? 'stroke-success' : 'stroke-primary', 'transition-[stroke-dashoffset,stroke] duration-300 ease-linear')}
        />
      </svg>
      {!failed && (
        <Suspense fallback={null}>
          <div className={cn('absolute inset-0 transition-opacity duration-500', glass ? 'opacity-100' : 'opacity-0')}>
            <FocusRing3D progress={progress} state={state} rest={rest} onReady={() => setReady(true)} onUnavailable={() => setFailed(true)} />
          </div>
        </Suspense>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">{children}</div>
    </div>
  );
}
