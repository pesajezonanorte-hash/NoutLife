// Monedas que salen del saldo al comprar: unas pocas monedas doradas vuelan en
// arco desde el saldo hacia el centro de la pantalla (donde está el diálogo de
// compra) y se desvanecen. Portal al body para no quedar recortadas por la
// página. Decorativo; con «Reducir movimiento» no se muestra.
import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useMotionStore } from '@/store/motionStore';

export function CoinFlight({ from, count = 8 }: { from: RefObject<HTMLElement>; count?: number }) {
  const reduce = useMotionStore((s) => s.reduce);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const r = from.current?.getBoundingClientRect();
    // Si el saldo quedó fuera de pantalla, las monedas salen del borde superior.
    if (r) setOrigin({ x: Math.min(Math.max(r.left + 20, 24), window.innerWidth - 24), y: Math.max(r.top + r.height / 2, 28) });
  }, [from]);
  if (reduce || !origin || typeof document === 'undefined') return null;
  const tx = window.innerWidth / 2 - origin.x;
  const ty = window.innerHeight / 2 - origin.y;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[400]">
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={i}
          className="lq-coin absolute block size-5 rounded-full"
          style={{ left: origin.x - 10, top: origin.y - 10 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.6, rotateY: 0 }}
          animate={{
            x: [0, tx * 0.45 + (i - count / 2) * 14, tx + (i - count / 2) * 6],
            y: [0, ty * 0.15 - 70 - i * 6, ty],
            opacity: [0, 1, 0],
            scale: [0.6, 1.1, 0.7],
            rotateY: [0, 300, 620],
            transition: { duration: 0.95, delay: i * 0.055, ease: [0.3, 0.1, 0.4, 1], times: [0, 0.45, 1] },
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
