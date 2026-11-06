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

/** Tiempo máximo, desde que la app está lista, para que el splash se retire aunque su secuencia 3D se atasque. */
const FORCE_REMOVE_MS = 3000;

export function SplashScreen({ ready, onDone }: Props) {
  const [boot] = useState(() => document.getElementById('lq-boot'));
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!ready) return;
    done.current();
    if (!boot) return;

    // Red de seguridad: la secuencia de src/splash puede tardar más de lo esperado (GPU lenta, pestaña
    // oculta). Pasado el límite, se quita el splash y su canvas 3D para no tapar la app.
    // Sin cleanup a propósito: este componente se desmonta enseguida (done() quita el splash de React),
    // y el watchdog debe sobrevivir a eso. Si #lq-boot ya no existe, no hace nada.
    window.setTimeout(() => {
      if (!boot.isConnected) return;
      boot.classList.add('out');
      document.getElementById('lq-boot-3d')?.remove();
      window.setTimeout(() => boot.remove(), 520);
    }, FORCE_REMOVE_MS);

    if (window.lqSplash) {
      window.lqSplash.leave();
    } else {
      // El chunk del splash no llegó (sin red): un fundido y fuera.
      boot.classList.add('out');
      window.setTimeout(() => boot.remove(), 520);
    }
  }, [boot, ready]);

  if (boot) return null;
  // Sin splash estático (p. ej. recarga en caliente): marca centrada.
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background">
      <BrandLockup markSize={44} wordClassName="text-[1.75rem]" />
    </div>
  );
}
