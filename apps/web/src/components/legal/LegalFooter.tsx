// Pie legal global: enlaces públicos a privacidad, términos y copyright.
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const LINK = 'inline-flex min-h-11 items-center px-2 text-on-surface-light underline-offset-4 hover:text-on-background hover:underline';

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('flex flex-col items-center gap-1 px-4 py-4 text-center text-body-sm text-on-surface-light', className)}>
      <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center">
        <Link to="/privacy" className={LINK}>Privacidad</Link>
        <Link to="/terms" className={LINK}>Términos</Link>
        <Link to="/copyright" className={LINK}>Copyright</Link>
      </nav>
      <p>© 2026 NoutLife. Todos los derechos reservados.</p>
    </footer>
  );
}
