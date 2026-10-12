// Texto que se graba frente al usuario: cada palabra aparece como tallada,
// de la niebla a nítida, una tras otra. El texto completo va para lectores de
// pantalla; las palabras animadas son decorativas. Con «Reducir movimiento»
// solo hay un fundido (sin blur): la interfaz queda nítida.
import { motion } from 'framer-motion';
import { springs, useMotionReduced } from '@/lib/motion';

export function EngravedText({ text, delay = 0.2, step = 0.06, className }: { text: string; delay?: number; step?: number; className?: string }) {
  const reduce = useMotionReduced();
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <motion.span
            key={`${i}-${w}`}
            className="inline-block whitespace-pre"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: 'blur(6px)' }}
            animate={reduce
              ? { opacity: 1, transition: { duration: 0.25, delay: delay + i * step } }
              : { opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...springs.gentle, delay: delay + i * step }, transitionEnd: { filter: 'none' } }}
          >
            {w}{i < words.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
