// El guion del deck: qué diapositiva va, con qué transición entra, dónde se
// detiene y qué notas tiene el expositor en cada paso. Cada diapositiva declara
// sus «paradas» (fotogramas locales donde la animación de un paso termina y el
// Player se queda quieto hasta que el ponente avance) y una lista de notas por
// parada. La última parada es el final de la diapositiva; justo después empieza
// la transición a la siguiente.
import type React from 'react';
import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { zoomBlur } from './components/zoomBlur';
import { TRANSITION } from './lib';
import { PORTADA_NOTES, PORTADA_STOPS, Slide1Portada } from './slides/Slide1Portada';
import { PROBLEMA_NOTES, PROBLEMA_STOPS, Slide2Problema } from './slides/Slide2Problema';
import { BRECHA_NOTES, BRECHA_STOPS, Slide3Brecha } from './slides/Slide3Brecha';
import { NOUTLIFE_NOTES, NOUTLIFE_STOPS, Slide4NoutLife } from './slides/Slide4NoutLife';
import { CONEXION_NOTES, CONEXION_STOPS, Slide5Conexion } from './slides/Slide5Conexion';
import { ACTIVIDAD_NOTES, ACTIVIDAD_STOPS, Slide6Actividad } from './slides/Slide6Actividad';
import { CONCLUSION_NOTES, CONCLUSION_STOPS, Slide7Cierre } from './slides/Slide7Cierre';

interface SlideDef {
  title: string;
  component: React.FC;
  stops: number[];
  /** Notas del expositor: una lista de puntos por parada. */
  notes: string[][];
  /**
   * Cómo entra. `null`: corte seco, sin solaparse con la anterior (la primera, y la 5,
   * que arranca en el mismo fotograma en que termina la 4 para guardar el teléfono).
   */
  enter: TransitionPresentation<any> | null;
}

const DEFS: SlideDef[] = [
  { title: 'Portada', component: Slide1Portada, stops: PORTADA_STOPS, notes: PORTADA_NOTES, enter: null },
  { title: 'El problema', component: Slide2Problema, stops: PROBLEMA_STOPS, notes: PROBLEMA_NOTES, enter: slide({ direction: 'from-right' }) },
  { title: 'La brecha', component: Slide3Brecha, stops: BRECHA_STOPS, notes: BRECHA_NOTES, enter: slide({ direction: 'from-right' }) },
  { title: 'El caso NoutLife', component: Slide4NoutLife, stops: NOUTLIFE_STOPS, notes: NOUTLIFE_NOTES, enter: zoomBlur() },
  { title: 'Tu entorno', component: Slide5Conexion, stops: CONEXION_STOPS, notes: CONEXION_NOTES, enter: null },
  { title: 'Actividad', component: Slide6Actividad, stops: ACTIVIDAD_STOPS, notes: ACTIVIDAD_NOTES, enter: fade() },
  { title: 'Recomendaciones y cierre', component: Slide7Cierre, stops: CONCLUSION_STOPS, notes: CONCLUSION_NOTES, enter: zoomBlur() },
];

for (const d of DEFS) {
  if (d.notes.length !== d.stops.length) throw new Error(`«${d.title}»: hay ${d.stops.length} paradas y ${d.notes.length} grupos de notas`);
}

/** Fotogramas que se solapa una diapositiva con la siguiente (0 en un corte seco). */
const overlap = (i: number) => (DEFS[i + 1]?.enter ? TRANSITION : 0);

export const SLIDES = DEFS.map((d, i) => ({
  ...d,
  // Hasta la última parada, y la transición de salida si la siguiente entra con una
  duration: d.stops[d.stops.length - 1] + 1 + overlap(i),
}));

/** Fotograma global donde empieza cada diapositiva. */
export const SLIDE_STARTS = SLIDES.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SLIDES[i - 1].duration - overlap(i - 1)], []);

export const DURATION = SLIDE_STARTS[SLIDES.length - 1] + SLIDES[SLIDES.length - 1].duration;

/** Cada paso del deck, en orden: dónde se detiene (fotograma global) y sus notas. */
export const STEPS = SLIDES.flatMap((s, i) =>
  s.stops.map((f, k) => ({ slide: i, title: s.title, step: k, steps: s.stops.length, frame: SLIDE_STARTS[i] + f, notes: s.notes[k] })),
);

/** Todas las paradas en fotogramas globales, en orden. */
export const STOPS = STEPS.map((s) => s.frame);

/** Paso que se está mostrando (o animando hacia su parada) en `frame`. */
export const stepAt = (frame: number) => {
  const i = STOPS.findIndex((s) => s >= frame);
  return i === -1 ? STOPS.length - 1 : i;
};

/** Índice de la diapositiva que manda en `frame` (cambia al empezar la transición). */
export const slideAt = (frame: number) => SLIDE_STARTS.filter((s) => s <= frame).length - 1;
