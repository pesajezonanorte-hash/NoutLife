// Lienzo del ícono activo (NavPebbleScene). Se carga perezoso desde NavPebble; decorativo para
// lectores de pantalla (la pestaña activa ya se anuncia con aria-current).
import { useEffect, useRef, type MutableRefObject } from 'react';
import { useStage } from '@/components/three3d/useStage';
import { NavPebbleScene } from './NavPebbleScene';

export type NavLight = (x: number, y: number, press: boolean) => void;

export interface NavPebble3DProps {
  axis: 'x' | 'y';
  /** El <svg> plano de la pestaña activa y su posición en la barra, para saber hacia dónde viaja. */
  icon: SVGSVGElement | null;
  position: number;
  /** Por aquí NavPebble le pasa el dedo o el cursor. */
  light: MutableRefObject<NavLight | null>;
  onReady: () => void;
  onUnavailable: () => void;
}

export default function NavPebble3D({ axis, icon, position, light, onReady, onUnavailable }: NavPebble3DProps) {
  const { host, stage, ready } = useStage((el, init) => new NavPebbleScene(el, { ...init, axis }), onUnavailable);
  const prev = useRef<{ icon: SVGSVGElement; position: number } | null>(null);

  useEffect(() => {
    if (!stage || !icon) return;
    const last = prev.current;
    // Otra pestaña es otro <svg>; dentro de la misma zona (/habits/123) la pastilla no se mueve.
    if (last?.icon === icon) {
      last.position = position;
      return;
    }
    prev.current = { icon, position };
    stage.setIcon(icon, Boolean(last));
    if (last) stage.move(position - last.position);
  }, [stage, icon, position]);

  useEffect(() => {
    if (!stage) return undefined;
    light.current = (x, y, press) => stage.touch(x, y, press);
    return () => { light.current = null; };
  }, [stage, light]);

  useEffect(() => { if (ready) onReady(); }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} aria-hidden className="pointer-events-none absolute inset-0" />;
}
