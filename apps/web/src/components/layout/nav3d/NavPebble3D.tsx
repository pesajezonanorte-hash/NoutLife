// Lienzo del canto rodado (NavPebbleScene). Se carga perezoso desde NavPebble; decorativo para
// lectores de pantalla (la pestaña activa ya se anuncia con aria-current).
import { useEffect, useRef } from 'react';
import { useStage } from '@/components/three3d/useStage';
import { NavPebbleScene } from './NavPebbleScene';

export interface NavPebble3DProps {
  axis: 'x' | 'y';
  width: number;
  height: number;
  /** El <svg> plano de la pestaña activa y su posición en la barra, para saber hacia dónde viaja. */
  icon: SVGSVGElement | null;
  position: number;
  onReady: () => void;
  onUnavailable: () => void;
}

export default function NavPebble3D({ axis, width, height, icon, position, onReady, onUnavailable }: NavPebble3DProps) {
  const { host, stage, ready } = useStage((el, init) => new NavPebbleScene(el, { ...init, axis, width, height }), onUnavailable);
  const prev = useRef<{ icon: SVGSVGElement; position: number } | null>(null);

  useEffect(() => {
    if (!stage || !icon) return;
    const last = prev.current;
    // Otra pestaña es otro <svg>; dentro de la misma zona (/habits/123) el canto no se mueve.
    if (last?.icon === icon) {
      last.position = position;
      return;
    }
    prev.current = { icon, position };
    stage.setIcon(icon, Boolean(last));
    if (last) stage.move(position - last.position);
  }, [stage, icon, position]);

  useEffect(() => { if (ready) onReady(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} aria-hidden className="pointer-events-none absolute inset-0" />;
}
