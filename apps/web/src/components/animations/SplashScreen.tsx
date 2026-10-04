// Splash inicial. La animación (hojas que vuelan y forman la N + «Noutlife»
// letra a letra) vive en index.html (#lq-boot) como CSS puro, para que empiece
// en el primer pintado y no se corte al montar React. Este componente solo la
// desvanece cuando la app está lista y la retira del DOM.
import { useEffect, useRef, useState } from 'react';
import { useReducedMotionConfig } from 'framer-motion';
import { BrandLockup } from '@/components/layout/Brand';

interface Props {
  /** La app terminó su carga mínima / autenticación. */
  ready: boolean;
  onDone: () => void;
}

export function SplashScreen({ ready, onDone }: Props) {
  const reduce = useReducedMotionConfig() ?? false;
  const [boot] = useState(() => document.getElementById('lq-boot'));
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!ready) return;
    if (!boot) { done.current(); return; }
    boot.classList.add('out');
    // La retirada no depende del ciclo de vida del componente: se desmonta al llamar a onDone.
    const remove = () => boot.remove();
    boot.addEventListener('transitionend', remove, { once: true });
    window.setTimeout(remove, 900);
    // La app se monta debajo mientras el splash se desvanece encima.
    const t = window.setTimeout(() => done.current(), reduce ? 0 : 120);
    return () => window.clearTimeout(t);
  }, [boot, ready, reduce]);

  if (boot) return null;
  // Sin splash estático (p. ej. recarga en caliente): marca centrada.
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background">
      <BrandLockup markSize={44} wordClassName="text-[1.75rem]" />
    </div>
  );
}
