// Layout de Login / Registro. Móvil: una columna (marca, título, formulario).
// lg+: panel de marca a la izquierda y formulario de 440 px a la derecha.
// Entrada: fade + y 20→0 en 300 ms (sin transform con reduced motion).
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Trophy, type LucideIcon } from 'lucide-react';
import { ease } from '@/lib/motion';
import { BrandMark } from '@/components/layout/Brand';
import { IconChip, type Tone } from '@/components/ui/lq';

const FEATURES: Array<{ icon: LucideIcon; tone: Tone; title: string; body: string }> = [
  { icon: Flame, tone: 'warning', title: 'Hábitos con racha', body: 'Cada día cumplido suma XP y mantiene viva tu racha.' },
  { icon: Trophy, tone: 'primary', title: 'Misiones y logros', body: 'Convierte tus metas en misiones con recompensas reales.' },
  { icon: Sparkles, tone: 'secondary', title: 'El Sabio', body: 'Consejos con IA a partir de tus propios datos.' },
];

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Enlace secundario bajo el formulario ("¿No tienes cuenta?…"). */
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-dvh bg-background text-on-background">
      <div className="mx-auto grid min-h-dvh max-w-[1200px] lg:grid-cols-[1fr_440px] lg:gap-16 lg:p-8">
        <aside className="relative hidden flex-col justify-between overflow-hidden rounded-3xl border border-border bg-surface p-12 lg:flex">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-heading-sm">Noutlife</span>
          </div>
          <div className="flex max-w-[480px] flex-col gap-4">
            <p className="text-label-lg text-primary-text">Tu vida, como un juego</p>
            <p className="text-display-md">Sube de nivel en lo que de verdad importa.</p>
          </div>
          <ul className="flex flex-col gap-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <IconChip icon={f.icon} tone={f.tone} size="sm" />
                <span>
                  <span className="block text-label-lg">{f.title}</span>
                  <span className="block text-body-sm text-on-surface-light">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <main id="main" className="flex flex-col justify-center px-4 pb-10 pt-8 sm:px-8 lg:px-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease } }}
            className="mx-auto flex w-full max-w-[440px] flex-col gap-8"
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 lg:hidden">
                <BrandMark />
                <span className="text-heading-sm">Noutlife</span>
              </div>
              <div className="flex flex-col gap-2">
                <h1 className="text-display-sm sm:text-display-md">{title}</h1>
                <p className="text-body-lg text-on-surface-light">{subtitle}</p>
              </div>
            </div>
            {children}
            {footer && <div className="border-t border-border pt-6 text-center text-body-md text-on-surface">{footer}</div>}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
