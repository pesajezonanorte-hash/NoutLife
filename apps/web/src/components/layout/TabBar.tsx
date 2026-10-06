import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { matchesRoute, useNav } from './nav';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';

/** Barra inferior móvil (<768): 5 destinos, 56 px de alto táctil, fondo translúcido. */
export function TabBar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const { primary } = useNav();
  const keyboard = useKeyboardOpen();
  return (
    // Siempre pegada abajo: con el teclado abierto se esconde (si no, subiría
    // hasta la mitad de la pantalla) y vuelve al cerrarlo.
    <motion.nav
      aria-label="Principal"
      data-tour="nav"
      initial={false}
      animate={{ y: keyboard ? '110%' : '0%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      aria-hidden={keyboard || undefined}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/[0.86] px-1 pt-1 [transform:translateZ(0)]',
        'pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl backdrop-saturate-[1.8]',
        className,
      )}
    >
      {primary.map(({ to, label, icon: Icon }) => {
        const active = matchesRoute(pathname, to);
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group/tab flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-label-md transition-colors',
              active ? 'text-primary-text' : 'text-on-surface-light hover:text-on-surface',
            )}
          >
            <span className="relative flex h-8 w-14 items-center justify-center">
              {active && (
                <motion.span
                  layoutId="tabbar-pill"
                  transition={spring}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/[var(--lq-soft-alpha)]"
                />
              )}
              <Icon aria-hidden className="relative size-6 transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-active/tab:scale-[.82]" strokeWidth={1.75} />
            </span>
            {label}
          </NavLink>
        );
      })}
    </motion.nav>
  );
}
