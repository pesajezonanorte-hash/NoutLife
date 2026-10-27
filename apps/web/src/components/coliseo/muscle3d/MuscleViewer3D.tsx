// Visor 3D del mapa muscular: monta MuscleScene en un div y le pasa estados,
// selección, tema y «reducir movimiento». Se carga perezoso (three.js pesa):
// MuscleMap lo importa con React.lazy y, si no hay WebGL 2, vuelve al mapa plano.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import type { Muscle, MuscleState } from '@/lib/coliseo';
import { Button, SegmentedControl } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';
import { MuscleScene, type Side } from './MuscleScene';
import { readPalette } from './heat';

const es = {
  front: 'Frente',
  back: 'Espalda',
  sideLabel: 'Lado del cuerpo',
  zoomOut: 'Alejar',
  zoomIn: 'Acercar',
};

const en: typeof es = {
  front: 'Front',
  back: 'Back',
  sideLabel: 'Body side',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
};

const COPY: Copy<typeof es> = { es, en };

export interface MuscleViewer3DProps {
  states: Record<Muscle, MuscleState>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  /** El navegador no pudo crear el contexto WebGL 2. */
  onUnavailable: () => void;
  /** Contenido flotante sobre el lienzo (la tarjeta del músculo en móvil). */
  overlay?: ReactNode;
  /** Alto en px que tapa ese contenido arriba: la figura se encuadra debajo. */
  topInset?: number;
}

export default function MuscleViewer3D({ states, selected, onSelect, onUnavailable, overlay, topInset = 0 }: MuscleViewer3DProps) {
  const t = useText(COPY);
  const sides = [{ value: 'front' as const, label: t.front }, { value: 'back' as const, label: t.back }];
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MuscleScene | null>(null);
  const [side, setSide] = useState<Side>('front');
  const reduce = useReducedMotionConfig() ?? false;
  // Los callbacks cambian en cada render; la escena se crea una vez y lee siempre los últimos.
  const latest = useRef({ onSelect, onUnavailable, reduce, topInset });
  latest.current = { onSelect, onUnavailable, reduce, topInset };

  useEffect(() => {
    let s: MuscleScene;
    try {
      s = new MuscleScene(host.current!, {
        onPick: (m) => latest.current.onSelect(m),
        onSide: setSide,
        reduceMotion: latest.current.reduce,
        topInset: latest.current.topInset,
      });
    } catch {
      latest.current.onUnavailable();
      return undefined;
    }
    scene.current = s;
    // Tema claro/oscuro y skins cambian la clase o data-theme de <html>: se releen los tokens. La
    // clase también cambia por otras cosas (teclado abierto, reducir movimiento): solo se repinta
    // si la paleta cambió de verdad.
    let last = '';
    const applyTheme = () => {
      const palette = readPalette();
      const key = JSON.stringify(palette);
      if (key === last) return;
      last = key;
      s.setPalette(palette);
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => {
      themeObserver.disconnect();
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setStates(states); }, [states]);
  useEffect(() => { scene.current?.setSelected(selected); }, [selected]);
  useEffect(() => { scene.current?.setReduceMotion(reduce); }, [reduce]);
  useEffect(() => { scene.current?.setTopInset(topInset); }, [topInset]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[460px] overflow-hidden rounded-2xl sm:h-[480px] md:h-[500px]">
        {/* El lienzo no es accesible por teclado: las listas de músculos de la tarjeta son la alternativa. */}
        <div ref={host} aria-hidden className="absolute inset-0" />
        {overlay}
      </div>
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          options={sides} value={side} label={t.sideLabel} role="radiogroup" className="w-48"
          onChange={(next) => { setSide(next); scene.current?.goTo(next); }}
        />
        <div className="flex gap-1">
          <Button variant="icon" aria-label={t.zoomOut} onClick={() => scene.current?.zoom(-1)}><Minus aria-hidden className="size-5" /></Button>
          <Button variant="icon" aria-label={t.zoomIn} onClick={() => scene.current?.zoom(1)}><Plus aria-hidden className="size-5" /></Button>
        </div>
      </div>
    </div>
  );
}
