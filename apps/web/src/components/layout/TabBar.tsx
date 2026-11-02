import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { matchesRoute, useNav } from './nav';
import { NavLock } from './NavLock';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { NavPebble } from './nav3d/NavPebble';
import { useRef } from 'react';

/** Barra inferior móvil (<768): 5 destinos, 56 px de alto táctil, fondo translúcido. */
export function TabBar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const { primary } = useNav();
  const keyboard = useKeyboardOpen();
  const ref = useRef<HTMLElement>(null);
  const mobile = useMediaQuery('(max-width: 767px)');
  return (
    // Siempre pegada abajo: con el teclado abierto se esconde (si no, subiría
    // hasta la mitad de la pantalla) y vuelve al cerrarlo.
    <motion.nav
      ref={ref}
      aria-label="Principal"
      data-tour="nav"
      initial={false}
      animate={{ y: keyboard ? '110%' : '0%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      aria-hidden={keyboard || undefined}
      className={cn(
        'lq-bar-glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border px-1 pt-1 [transform:translateZ(0)]',
        'pb-[max(1rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {primary.map(({ to, label, icon: Icon, locked }) => {
        const active = matchesRoute(pathname, to);
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group/tab relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-label-md transition-colors',
              active ? 'text-primary-text' : 'text-on-surface-light hover:text-on-surface',
            )}
          >
            <span data-nav-slot className="relative flex h-8 w-14 items-center justify-center">
              <Icon data-nav-icon aria-hidden className={cn('relative z-[1] size-6 transition-[transform,opacity] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-active/tab:scale-[.82]', !active && 'opacity-70')} strokeWidth={1.75} />
              {locked && <NavLock className="right-2 top-0" />}
            </span>
            {label}
          </NavLink>
        );
      })}
      {/* Encima de los íconos: el canto rodado lleva el ícono activo con volumen (nav3d/NavPebble). */}
      <NavPebble root={ref} active={pathname} axis="x" enabled={mobile} />
    </motion.nav>
  );
}
