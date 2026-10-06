// Fondo de una carta: la foto elegida, impresa sobre el papel. Se encuadra por
// su punto de interés (x, y de 0 a 1) y un zoom, así que se ve igual en
// pantallas con proporciones distintas; encima van el lavado de papel (su
// intensidad la elige quien lo puso), el grano, los renglones y los bordes
// gastados. Sin foto, la carta es papel de carta con renglones.
import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { BackgroundFit } from '@/services/network.service';

/** Caja de la foto dentro del contenedor: cubre, centra el foco y aplica el zoom. */
export function frameFor(fit: BackgroundFit, box: { w: number; h: number }, img: { w: number; h: number }) {
  if (!box.w || !box.h || !img.w || !img.h) return null;
  const k = Math.max(box.w / img.w, box.h / img.h) * fit.zoom;
  const w = img.w * k;
  const h = img.h * k;
  const left = Math.min(0, Math.max(box.w - w, box.w / 2 - fit.x * w));
  const top = Math.min(0, Math.max(box.h - h, box.h / 2 - fit.y * h));
  return { w, h, left, top };
}

/** Tamaño de un contenedor (se actualiza al cambiar; vale para elementos que aparecen después). */
export function useBoxSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, box };
}

/** Tamaño natural de una imagen. */
export function useImageSize(src: string | null) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!src) { setSize({ w: 0, h: 0 }); return; }
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setSize({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return size;
}

export function LetterBackdrop({ src, fit, className, style }: { src: string | null; fit: BackgroundFit; className?: string; style?: CSSProperties }) {
  const { ref, box } = useBoxSize<HTMLDivElement>();
  const img = useImageSize(src);
  const frame = src ? frameFor(fit, box, img) : null;
  return (
    <div ref={ref} aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', src ? 'lq-backdrop' : 'lq-stationery', className)} style={style}>
      {src && frame && (
        <>
          <img
            src={src} alt="" draggable={false}
            className="lq-backdrop-photo absolute select-none"
            style={{ width: frame.w, height: frame.h, left: frame.left, top: frame.top }}
          />
          <span className="lq-backdrop-wash absolute inset-0" style={{ opacity: fit.paper }} />
          <span className="lq-backdrop-grain absolute inset-0" />
          <span className="lq-backdrop-edge absolute inset-0" />
        </>
      )}
    </div>
  );
}
