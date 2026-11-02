// Lienzo del aro de enfoque (FocusRingScene). Se carga perezoso desde FocusRing; decorativo para
// lectores de pantalla (el tiempo y el progreso van en el DOM).
import { useEffect } from 'react';
import { useStage } from '@/components/three3d/useStage';
import { FocusRingScene, type FocusRingState } from './FocusRingScene';

export interface FocusRing3DProps {
  progress: number;
  state: FocusRingState;
  rest?: boolean;
  onReady: () => void;
  onUnavailable: () => void;
}

export default function FocusRing3D({ progress, state, rest, onReady, onUnavailable }: FocusRing3DProps) {
  const { host, stage, ready } = useStage((el, init) => new FocusRingScene(el, { ...init, progress, state, rest }), onUnavailable);
  useEffect(() => { stage?.setProgress(progress); }, [stage, progress]);
  useEffect(() => { stage?.setState(state); }, [stage, state]);
  useEffect(() => { stage?.setRest(Boolean(rest)); }, [stage, rest]);
  useEffect(() => { if (ready) onReady(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} aria-hidden className="absolute inset-0" />;
}
