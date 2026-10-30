// Lienzo del cofre de metas cumplidas: cerrado y con candado mientras se confirma; cuando
// `opened` pasa a true (la misión se completó en el servidor), corre la escena de apertura.
// Se carga perezoso desde CompleteQuestDialog; decorativo (el diálogo anuncia el resultado).
import { useEffect } from 'react';
import { useStage } from '@/components/three3d/useStage';
import { ChestScene } from './ChestScene';

export interface RewardChest3DProps {
  opened: boolean;
  onUnavailable: () => void;
}

export default function RewardChest3D({ opened, onUnavailable }: RewardChest3DProps) {
  const { host, stage, ready } = useStage((el, init) => new ChestScene(el, { ...init, open: opened }), onUnavailable);
  useEffect(() => { if (opened) stage?.open(); }, [stage, opened]);

  return (
    <div className="absolute inset-0">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-x-[28%] inset-y-6 rounded-2xl opacity-40" />}
    </div>
  );
}
