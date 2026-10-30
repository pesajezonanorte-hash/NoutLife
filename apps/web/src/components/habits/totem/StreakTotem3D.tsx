// Lienzo del tótem de racha: monta TotemScene y le pasa la racha y la semana del hábito
// elegido. Se carga perezoso desde StreakTotemCard (three.js pesa); decorativo para lectores de
// pantalla (la tarjeta dice lo mismo en texto).
import { useEffect } from 'react';
import { useStage } from '@/components/three3d/useStage';
import { TotemScene, type TotemData } from './TotemScene';

export interface StreakTotem3DProps {
  data: TotemData;
  onUnavailable: () => void;
}

export default function StreakTotem3D({ data, onUnavailable }: StreakTotem3DProps) {
  const { host, stage, ready } = useStage((el, init) => new TotemScene(el, { ...init, data }), onUnavailable);
  const week = data.week.join();
  useEffect(() => { stage?.setData(data); }, [stage, data.streak, week]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-x-[30%] inset-y-8 rounded-[40%] opacity-40" />}
    </div>
  );
}
