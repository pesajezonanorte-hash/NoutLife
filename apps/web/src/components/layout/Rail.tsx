import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShellStore } from '@/store/shellStore';
import { BrandMark } from './Brand';
import { PRIMARY_NAV, matchesRoute } from './nav';

const itemCls = 'flex min-h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl text-label-md transition-colors';

/** Rail de tablet (768–1023): w-20, ícono + label, "Más" abre el menú completo. */
export function Rail({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const menuOpen = useShellStore((s) => s.menuOpen);
  const setMenuOpen = useShellStore((s) => s.setMenuOpen);
  return (
    <aside className={cn('sticky top-0 h-dvh w-20 shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-6', className)}>
      <BrandMark className="mb-4 size-11" />
      <nav aria-label="Principal" className="flex flex-col items-center gap-2">
        {PRIMARY_NAV.map(({ to, label, icon: Icon }) => {
          const active = matchesRoute(pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-current={active ? 'page' : undefined}
              className={cn(
                itemCls,
                active
                  ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text'
                  : 'text-on-surface-light hover:bg-surface-variant hover:text-on-surface',
              )}
            >
              <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              {label}
            </NavLink>
          );
        })}
      </nav>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
        className={cn(itemCls, 'mt-auto text-on-surface-light hover:bg-surface-variant hover:text-on-surface')}
      >
        <LayoutGrid aria-hidden className="size-6" strokeWidth={1.75} />
        Más
      </button>
    </aside>
  );
}
