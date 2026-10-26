// Pie legal global: enlaces públicos a privacidad, términos y copyright. En inglés suma la política de
// datos de salud (Washington My Health My Data Act: enlace propio desde la portada).
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLocale, type Copy } from '@/lib/i18n';

const LINK = 'inline-flex min-h-11 items-center px-2 text-on-surface-light underline-offset-4 hover:text-on-background hover:underline';

const COPY: Copy<{ nav: string; privacy: string; terms: string; copyright: string; health: string | null; rights: string }> = {
  es: { nav: 'Información legal', privacy: 'Privacidad', terms: 'Términos', copyright: 'Copyright', health: null, rights: 'Todos los derechos reservados.' },
  en: { nav: 'Legal', privacy: 'Privacy', terms: 'Terms', copyright: 'Copyright', health: 'Consumer Health Data', rights: 'All rights reserved.' },
};

export function LegalFooter({ className }: { className?: string }) {
  const locale = useLocale();
  const t = COPY[locale];
  return (
    <footer lang={locale} className={cn('flex flex-col items-center gap-1 px-4 py-4 text-center text-body-sm text-on-surface-light', className)}>
      <nav aria-label={t.nav} className="flex flex-wrap items-center justify-center">
        <Link to="/privacy" className={LINK}>{t.privacy}</Link>
        <Link to="/terms" className={LINK}>{t.terms}</Link>
        <Link to="/copyright" className={LINK}>{t.copyright}</Link>
        {t.health && <Link to="/health-data" className={LINK}>{t.health}</Link>}
      </nav>
      <p>© {new Date().getFullYear()} NoutLife. {t.rights}</p>
    </footer>
  );
}
