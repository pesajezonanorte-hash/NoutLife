// Indicador que se desliza entre opciones (píldora o subrayado) solo con transform.
// Mide la opción activa dentro de su contenedor (offsetLeft/Top), así no depende del
// scroll de la página. Con layoutId de Framer, un diálogo que fija el body (lockScroll)
// o un cambio de alto por encima movía la caja medida y la píldora «volaba» por la
// pantalla al abrir o cerrar diálogos en el móvil.
//
//   const { ref, box } = useIndicator<HTMLDivElement>(activeIndex);
//   <div ref={ref} className="relative">           ← contenedor posicionado
//     {box && <span className="lq-indicator absolute left-0 top-0" style={indicatorStyle(box)} />}
//     <button data-indicator>…</button>             ← cada opción, en orden
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface IndicatorBox { x: number; y: number; w: number; h: number }

export function useIndicator<T extends HTMLElement>(active: number) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<IndicatorBox | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const measure = () => {
      const el = active >= 0 ? root.querySelectorAll<HTMLElement>('[data-indicator]')[active] : undefined;
      setBox((prev) => {
        if (!el) return null;
        const next = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
        return prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [active]);
  return { ref, box };
}

/** Estilo de la píldora: tamaño de la opción y posición por transform. */
export const indicatorStyle = ({ x, y, w, h }: IndicatorBox): CSSProperties => ({ width: w, height: h, transform: `translate3d(${x}px, ${y}px, 0)` });
