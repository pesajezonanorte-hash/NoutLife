// Título con la voz de la marca: siempre en minúsculas, como el logo. Es texto de verdad (lo leen los
// lectores de pantalla y se puede buscar) en la tipografía del tema, y al montarse se revela de
// izquierda a derecha, como si se escribiera; con «Reducir movimiento» aparece ya escrito.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface LetteringProps {
  text: string;
  className?: string;
  /** Revelarse al montarse (por defecto sí). */
  draw?: boolean;
  /** Espera antes de empezar (s). */
  delay?: number;
}

export function Lettering({ text, className, draw = true, delay = 0 }: LetteringProps) {
  return (
    <span className={cn('lq-letters', className)} data-draw={draw || undefined} style={delay ? ({ '--d': `${delay}s` } as CSSProperties) : undefined}>
      {text}
    </span>
  );
}

/** Título de zona: con la voz de la marca si el texto es una cadena. */
export function TitleText({ children, draw, delay }: { children: ReactNode; draw?: boolean; delay?: number }) {
  return typeof children === 'string' ? <Lettering text={children} draw={draw} delay={delay} /> : <>{children}</>;
}
