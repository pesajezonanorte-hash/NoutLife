// Mapa 3D de zonas: monta ZoneScene y le pasa columnas, Life Score, tema y «reducir
// movimiento». Se carga perezosa desde Estadísticas (three.js pesa); si no hay WebGL avisa
// con `onUnavailable` y la tarjeta se oculta. El lienzo es decorativo para lectores de
// pantalla: la tarjeta tiene botones y un resumen accesibles que eligen la misma columna.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMotionStore } from '@/store/motionStore';
import type { ZoneColumn } from '../statsMath';
import { ZoneScene, tokenColor, type ZonePalette } from './ZoneScene';

export interface ZoneMap3DProps {
  columns: ZoneColumn[];
  score: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onUnavailable: () => void;
  /** Contenido de la etiqueta que flota sobre la columna elegida. */
  tag?: ReactNode;
}

/** Colores del tema actual (tokens --lq-*): acento, luz, tinta y placa del suelo. */
function readPalette(): ZonePalette {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const dark = root.classList.contains('dark');
  const v = (name: string) => css.getPropertyValue(`--lq-${name}`);
  return {
    accent: tokenColor(v('jade-400')),
    glow: tokenColor(v(dark ? 'jade-300' : 'jade-500')),
    body: tokenColor(v(dark ? 'surface-variant' : 'surface')),
    base: tokenColor(v(dark ? 'surface-variant' : 'surface')),
    dark,
  };
}

export default function ZoneMap3D({ columns, score, selected, onSelect, onUnavailable, tag }: ZoneMap3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const scene = useRef<ZoneScene | null>(null);
  const reduce = useMotionStore((s) => s.reduce);
  const [ready, setReady] = useState(false);
  const latest = useRef({ columns, score, onSelect, onUnavailable, reduce });
  latest.current = { columns, score, onSelect, onUnavailable, reduce };

  useEffect(() => {
    let s: ZoneScene;
    try {
      s = new ZoneScene(host.current!, {
        columns: latest.current.columns,
        score: latest.current.score,
        palette: readPalette(),
        reduceMotion: latest.current.reduce,
        label: label.current,
        onSelect: (id) => latest.current.onSelect(id),
        onReady: () => setReady(true),
      });
    } catch {
      latest.current.onUnavailable();
      return undefined;
    }
    scene.current = s;
    // Tema claro/oscuro, tema de la Tienda o temporada: la escena relee el acento.
    const mo = new MutationObserver(() => s.setPalette(readPalette()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-season'] });
    return () => {
      mo.disconnect();
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setData(columns, score); }, [columns, score]);
  useEffect(() => { scene.current?.select(selected); }, [selected]);
  useEffect(() => { scene.current?.setReduceMotion(reduce); }, [reduce]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-8 rounded-3xl opacity-40" />}
      <div ref={label} aria-hidden className="lq-zone3d-tag">{tag}</div>
    </div>
  );
}
