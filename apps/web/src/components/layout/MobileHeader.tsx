import { Link } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { BrandMark } from './Brand';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/lq';
import { NotificationBell } from '@/components/ui/NotificationPanel';
import { SocialButton } from '@/components/social/SocialEntry';
import { useShellStore } from '@/store/shellStore';
import { openCommandPalette } from './actions';
import { todayLabel } from './Topbar';
import { TrialPill, useTrialDay } from '@/components/billing/TrialPill';

/** Cabecera móvil (<768): h-14 con fecha + buscar, notificaciones y menú (Dashboard.dc.html `.hdr`). */
export function MobileHeader({ className }: { className?: string }) {
  const menuOpen = useShellStore((s) => s.menuOpen);
  const setMenuOpen = useShellStore((s) => s.setMenuOpen);
  // Durante la prueba, el indicador ocupa el lugar de la fecha.
  const trial = useTrialDay();
  return (
    <header
      className={cn(
        'lq-bar-glass sticky top-0 z-20 flex h-14 items-center justify-between pl-4 pr-2',
        'pt-[env(safe-area-inset-top)] box-content',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-md">
          <BrandMark size={28} alt="Noutlife, inicio ·" />
          {!trial && <span className="truncate text-body-sm text-on-surface-light">{todayLabel()}</span>}
        </Link>
        <TrialPill />
      </div>
      <div className="flex items-center">
        <Button variant="icon" data-tour="search" aria-label="Buscar" onClick={openCommandPalette}>
          <Search aria-hidden className="size-6" strokeWidth={1.75} />
        </Button>
        <SocialButton />
        <NotificationBell />
        <Button variant="icon" aria-label="Menú" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Menu aria-hidden className="size-6" strokeWidth={1.75} />
        </Button>
      </div>
    </header>
  );
}
