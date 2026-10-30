// Lienzo del monumento de Misiones: monta MonumentScene y le pasa las misiones activas, las
// cumplidas y la elegida. Se carga perezoso desde GoalMonumentCard; decorativo para lectores de
// pantalla (la tarjeta tiene el mismo contenido en texto y botones).
import { useEffect, useRef, type ReactNode } from 'react';
import { useStage } from '@/components/three3d/useStage';
import { MonumentScene, type MonumentData } from './MonumentScene';

export interface Monument3DProps {
  data: MonumentData;
  onSelect: (id: string) => void;
  onUnavailable: () => void;
  /** Contenido de la etiqueta que flota sobre el núcleo elegido. */
  tag?: ReactNode;
}

export default function Monument3D({ data, onSelect, onUnavailable, tag }: Monument3DProps) {
  const label = useRef<HTMLDivElement>(null);
  const latest = useRef(onSelect);
  latest.current = onSelect;
  const { host, stage, ready } = useStage(
    (el, init) => new MonumentScene(el, { ...init, data, label: label.current, onSelect: (id) => latest.current(id) }),
    onUnavailable,
  );
  useEffect(() => { stage?.setData(data); }, [stage, data]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-x-[22%] inset-y-10 rounded-3xl opacity-40" />}
      <div ref={label} aria-hidden className="lq-zone3d-tag">{tag}</div>
    </div>
  );
}
