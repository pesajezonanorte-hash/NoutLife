// Ayudas para montar el 3D tarde y sin three.js: las tarjetas las usan antes de descargar la
// escena (este archivo no importa three, así no entra en el paquete principal).
import type { RefObject } from 'react';
import { useInView } from 'framer-motion';

/** WebGL 2 disponible (three.js lo necesita). */
export const hasWebGL2 = () => typeof window !== 'undefined' && 'WebGL2RenderingContext' in window;

/** Cerca de la pantalla (una vez): el 3D se descarga y se monta solo entonces. */
export function useNear(ref: RefObject<Element>, margin = '320px 0px') {
  return useInView(ref, { once: true, margin: margin as `${number}px ${number}px` });
}
