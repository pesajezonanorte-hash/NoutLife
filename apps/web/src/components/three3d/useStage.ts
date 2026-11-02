// Monta una escena 3D (Stage) en un div: le pasa el tema y «Reducir movimiento», la avisa de
// los cambios de tema y la libera al desmontarse. Si no hay WebGL, `onUnavailable`.
import { useEffect, useRef, useState } from 'react';
import { useMotionStore } from '@/store/motionStore';
import { afterSplash } from '@/splash/after';
import { readPalette, watchPalette, type PropPalette } from './palette';
import type { Stage } from './stage';

export interface StageInit {
  palette: PropPalette;
  reduceMotion: boolean;
  onReady: () => void;
  onError: () => void;
}

export function useStage<S extends Stage>(create: (host: HTMLDivElement, init: StageInit) => S, onUnavailable?: () => void) {
  const host = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<S | null>(null);
  const [ready, setReady] = useState(false);
  const reduce = useMotionStore((s) => s.reduce);
  const latest = useRef({ create, onUnavailable });
  latest.current = { create, onUnavailable };

  useEffect(() => {
    let s: S | null = null;
    let unwatch = () => {};
    let unmounted = false;
    // Con el splash aún en pantalla no se compila nada: trabaría su vuelo.
    void afterSplash().then(() => {
      if (unmounted) return;
      try {
        const created = latest.current.create(host.current!, {
          palette: readPalette(),
          reduceMotion: useMotionStore.getState().reduce,
          onReady: () => setReady(true),
          onError: () => latest.current.onUnavailable?.(),
        });
        s = created;
        setStage(created);
        unwatch = watchPalette(() => created.setPalette(readPalette()));
      } catch {
        latest.current.onUnavailable?.();
      }
    });
    return () => {
      unmounted = true;
      unwatch();
      s?.dispose();
      setStage(null);
      setReady(false);
    };
  }, []);

  useEffect(() => { stage?.setReduceMotion(reduce); }, [stage, reduce]);
  return { host, stage, ready };
}
