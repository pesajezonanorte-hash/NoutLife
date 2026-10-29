// La rosa del Jardín en 3D: monta RoseScene y le pasa tema y «reducir movimiento».
// Se carga perezosa (three.js pesa) desde la página de Relaciones; si no hay WebGL 2
// o la rosa no llega a descargarse, avisa con `onUnavailable` y la tarjeta se oculta.
import { useEffect, useRef, useState } from 'react';
import { Flower2 } from 'lucide-react';
import { useMotionStore } from '@/store/motionStore';
import { useText, type Copy } from '@/lib/i18n';
import { RoseScene } from './RoseScene';

const COPY: Copy<{ open: string; close: string }> = {
  es: { open: 'Abrir la rosa', close: 'Cerrar la rosa' },
  en: { open: 'Open the rose', close: 'Close the rose' },
};

export interface Rose3DProps {
  /** Apertura inicial (0 capullo, 1 abierta). */
  bloom: number;
  onUnavailable: () => void;
}

export default function Rose3D({ bloom, onUnavailable }: Rose3DProps) {
  const t = useText(COPY);
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoseScene | null>(null);
  const reduce = useMotionStore((s) => s.reduce);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(bloom > 0.5);
  const latest = useRef({ onUnavailable, reduce, bloom });
  latest.current = { onUnavailable, reduce, bloom };

  useEffect(() => {
    let s: RoseScene;
    const dark = () => document.documentElement.classList.contains('dark');
    try {
      s = new RoseScene(host.current!, {
        bloom: latest.current.bloom,
        reduceMotion: latest.current.reduce,
        dark: dark(),
        onReady: (ok) => (ok ? setReady(true) : latest.current.onUnavailable()),
        onBloom: setOpen,
      });
    } catch {
      latest.current.onUnavailable();
      return undefined;
    }
    scene.current = s;
    const mo = new MutationObserver(() => s.setDark(dark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mo.disconnect();
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setReduceMotion(reduce); }, [reduce]);

  return (
    <div className="relative h-[300px] md:h-[360px]">
      {/* El lienzo no se usa con teclado: el botón de abajo abre y cierra la rosa. */}
      <div ref={host} aria-hidden className="absolute inset-0" />
      {!ready && <span aria-hidden className="lq-skeleton absolute inset-6 rounded-3xl opacity-60" />}
      <button
        type="button" aria-pressed={open} onClick={() => scene.current?.toggle()}
        className="absolute bottom-3 left-1/2 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-background/85 px-4 text-label-lg text-on-background shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
      >
        <Flower2 aria-hidden className="size-4 text-error-text" />
        {open ? t.close : t.open}
      </button>
    </div>
  );
}
