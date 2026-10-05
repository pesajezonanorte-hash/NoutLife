import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Search, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/lq';
import { NotificationBell } from '@/components/ui/NotificationPanel';
import { useShellStore } from '@/store/shellStore';
import { OptionsMenu } from './OptionsMenu';
import { buildCrumbs } from './nav';
import { openCommandPalette, sageHasNew, useShellActions } from './actions';

export function todayLabel() {
  const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const detail = useShellStore((s) => s.crumb);
  const crumbs = buildCrumbs(pathname, detail);
  return (
    <nav aria-label="Ruta" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-body-sm text-on-surface-light">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={cn('flex min-w-0 items-center gap-2', last ? 'truncate' : 'shrink-0')}>
              {i > 0 && <ChevronRight aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />}
              {last || !c.to ? (
                <span aria-current={last ? 'page' : undefined} className={cn('truncate', last && 'text-on-background')}>{c.label}</span>
              ) : (
                <Link to={c.to} className="inline-flex min-h-11 items-center rounded transition-colors hover:text-on-background">{c.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Barra superior (md+): h-16 translúcida y sticky. En desktop (lg) muestra el
 * breadcrumb; en tablet la fecha, como DashboardTablet. Acciones: buscar,
 * Sabio, notificaciones, acciones rápidas, más opciones y "Nuevo hábito".
 */
export function Topbar({ className }: { className?: string }) {
  const navigate = useNavigate();
  const setQuickOpen = useShellStore((s) => s.setQuickOpen);
  const { openSage } = useShellActions();
  const hasNew = sageHasNew();

  return (
    <header
      className={cn(
        'sticky top-0 z-20 min-h-16 flex-wrap items-center justify-between gap-4 border-b border-border',
        'bg-background/[0.86] px-8 py-3 backdrop-blur-xl backdrop-saturate-[1.8]',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="block truncate text-body-sm text-on-surface-light lg:hidden">{todayLabel()}</span>
        <div className="hidden lg:block"><Breadcrumb /></div>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="icon" data-tour="search" aria-label="Buscar (Ctrl+K)" aria-keyshortcuts="Control+K" onClick={openCommandPalette}>
          <Search aria-hidden className="size-6" strokeWidth={1.75} />
        </Button>
        <Button variant="icon" aria-label={hasNew ? 'El Sabio, consejo nuevo' : 'El Sabio'} onClick={() => openSage()} data-tour="sage" className="relative">
          <Sparkles aria-hidden className="size-6" strokeWidth={1.75} />
          {hasNew && <span aria-hidden className="absolute right-[11px] top-2.5 size-2 rounded-full bg-primary ring-2 ring-background" />}
        </Button>
        <NotificationBell />
        <Button variant="icon" aria-label="Acciones rápidas" aria-haspopup="dialog" onClick={() => setQuickOpen(true)}>
          <Zap aria-hidden className="size-6" strokeWidth={1.75} />
        </Button>
        <OptionsMenu />
        <Button size="md" className="ml-2" data-tour="create" onClick={() => navigate('/habits?new=1')}>
          <Plus aria-hidden className="size-4" strokeWidth={2} />
          Nuevo hábito
        </Button>
      </div>
    </header>
  );
}
