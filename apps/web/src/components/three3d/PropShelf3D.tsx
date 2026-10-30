// Lienzo de una repisa de objetos 3D (PropsScene): hobbies, pesas, trofeos. Se carga perezoso
// desde su tarjeta; decorativo para lectores de pantalla (cada tarjeta ofrece botones con lo
// mismo que hace tocar un objeto).
import { useEffect, useRef } from 'react';
import { useStage } from './useStage';
import { PropsScene, type PropItem } from './PropsScene';

export interface PropShelf3DProps {
  url: string;
  hdUrl?: string;
  items: PropItem[];
  columns?: (aspect: number) => number;
  onTap?: (id: string) => void;
  onUnavailable: () => void;
  /** Copias pegadas a un objeto que cambian con los datos (discos de la barra). */
  attach?: { id: string; at: Array<[number, number, number]> };
}

export default function PropShelf3D({ url, hdUrl, items, columns, onTap, onUnavailable, attach }: PropShelf3DProps) {
  const label = useRef<HTMLDivElement>(null);
  const latest = useRef(onTap);
  latest.current = onTap;
  const { host, stage, ready } = useStage(
    (el, init) => new PropsScene(el, { ...init, url, hdUrl, items, columns, label: label.current, onTap: (id) => latest.current?.(id) }),
    onUnavailable,
  );
  // Las copias iniciales ya vienen en `items`: solo se avisa cuando cambian.
  const attachKey = attach ? `${attach.id}:${attach.at.length}` : '';
  const applied = useRef(attachKey);
  useEffect(() => {
    if (!stage || !attach || applied.current === attachKey) return;
    applied.current = attachKey;
    stage.setAttach(attach.id, attach.at);
  }, [stage, attachKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-x-[12%] inset-y-10 rounded-3xl opacity-30" />}
      <div ref={label} aria-hidden className="lq-zone3d-tag" />
    </div>
  );
}
