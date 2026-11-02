// Splash inicial. Vive fuera de React para que empiece en el primer pintado y no se corte al montar
// la app: el nombre en index.html (#lq-boot) y la secuencia 3D en src/splash. Este componente monta la
// app debajo y le avisa al splash de que ya puede salir (corre hasta el logo y se retira solo).
import { useEffect, useRef, useState } from 'react';
import { BrandLockup } from '@/components/layout/Brand';

interface Props {
  /** La app terminó su carga mínima / autenticación. */
  ready: boolean;
  onDone: () => void;
}

export function SplashScreen({ ready, onDone }: Props) {
  const [boot] = useState(() => document.getElementById('lq-boot'));
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!ready) return;
    done.current();
    if (!boot) return;
    if (window.lqSplash) { window.lqSplash.leave(); return; }
    // El chunk del splash no llegó (sin red): un fundido y fuera.
    boot.classList.add('out');
    window.setTimeout(() => boot.remove(), 520);
  }, [boot, ready]);

  if (boot) return null;
  // Sin splash estático (p. ej. recarga en caliente): marca centrada.
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background">
      <BrandLockup markSize={44} wordClassName="text-[1.75rem]" />
    </div>
  );
}
