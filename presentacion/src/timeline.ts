// El guion del deck: qué diapositiva va, con qué transición entra y dónde se
// detiene. Cada diapositiva declara sus «paradas» (fotogramas locales donde la
// animación de un paso termina y el Player se queda quieto hasta que el ponente
// avance). La última parada es el final de la diapositiva; justo después empieza
// la transición a la siguiente.
import type React from 'react';
import type { TransitionPresentation } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { zoomBlur } from './components/zoomBlur';
import { TRANSITION } from './lib';
import { PORTADA_STOPS, Slide1Portada } from './slides/Slide1Portada';
import { PROBLEMA_STOPS, Slide2Problema } from './slides/Slide2Problema';
import { NOUTLIFE_STOPS, Slide3NoutLife } from './slides/Slide3NoutLife';
import { ACTIVIDAD_STOPS, Slide4Actividad } from './slides/Slide4Actividad';
import { CONCLUSION_STOPS, Slide5Conclusion } from './slides/Slide5Conclusion';

interface SlideDef {
  title: string;
  component: React.FC;
  stops: number[];
  /** Cómo entra (la primera no tiene transición). */
  enter: TransitionPresentation<any> | null;
}

const DEFS: SlideDef[] = [
  { title: 'Portada y marco', component: Slide1Portada, stops: PORTADA_STOPS, enter: null },
  { title: 'El diagnóstico', component: Slide2Problema, stops: PROBLEMA_STOPS, enter: slide({ direction: 'from-right' }) },
  { title: 'Caso NoutLife', component: Slide3NoutLife, stops: NOUTLIFE_STOPS, enter: zoomBlur() },
  { title: 'Actividad', component: Slide4Actividad, stops: ACTIVIDAD_STOPS, enter: fade() },
  { title: 'Recomendaciones y cierre', component: Slide5Conclusion, stops: CONCLUSION_STOPS, enter: zoomBlur() },
];

export const SLIDES = DEFS.map((d, i) => ({
  ...d,
  // Hasta la última parada, y la transición de salida si hay siguiente
  duration: d.stops[d.stops.length - 1] + 1 + (i < DEFS.length - 1 ? TRANSITION : 0),
}));

/** Fotograma global donde empieza cada diapositiva (las transiciones se solapan). */
export const SLIDE_STARTS = SLIDES.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SLIDES[i - 1].duration - TRANSITION], []);

export const DURATION = SLIDE_STARTS[SLIDES.length - 1] + SLIDES[SLIDES.length - 1].duration;

/** Todas las paradas en fotogramas globales, en orden. */
export const STOPS = SLIDES.flatMap((s, i) => s.stops.map((f) => SLIDE_STARTS[i] + f));

/** Índice de la diapositiva que manda en `frame` (cambia al empezar la transición). */
export const slideAt = (frame: number) => SLIDE_STARTS.filter((s) => s <= frame).length - 1;
