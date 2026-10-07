// Política de privacidad (/privacy), Términos de uso (/terms) y Propiedad
// intelectual (/copyright). Públicas: las enlazan el login, Ajustes, el pie y las
// fichas de las tiendas. El texto vive en ./content.ts.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandLockup } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { COPYRIGHT, LEGAL_UPDATED, PRIVACY, TERMS } from './content';

export default function LegalPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const kind = pathname.startsWith('/privacy') ? 'privacy' : pathname.startsWith('/copyright') ? 'copyright' : 'terms';
  const sections = { privacy: PRIVACY, terms: TERMS, copyright: COPYRIGHT }[kind];
  const title = { privacy: 'Política de privacidad', terms: 'Términos de uso', copyright: 'Propiedad intelectual y DMCA' }[kind];

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-on-background md:py-12">
      <article className="mx-auto flex max-w-[720px] flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup />
          <Button variant="ghost" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />Volver
          </Button>
        </div>
        <header className="flex flex-col gap-1">
          <h1 className="text-display-sm">{title}</h1>
          <p className="text-body-sm text-on-surface-light">Última actualización: {LEGAL_UPDATED}</p>
        </header>
        {sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-2">
            <h2 className="text-heading-md">{s.h}</h2>
            {s.p.map((t) => <p key={t} className="text-body-lg text-on-surface">{t}</p>)}
          </section>
        ))}
        <p className="text-body-sm text-on-surface-light">
          Lee también: {[
            kind !== 'privacy' && <Link key="p" to="/privacy" className="text-primary-text underline">Política de privacidad</Link>,
            kind !== 'terms' && <Link key="t" to="/terms" className="text-primary-text underline">Términos de uso</Link>,
            kind !== 'copyright' && <Link key="c" to="/copyright" className="text-primary-text underline">Propiedad intelectual</Link>,
          ].filter(Boolean).flatMap((el, i) => (i ? [' · ', el] : [el]))}.
        </p>
        <LegalFooter className="-mx-4" />
      </article>
    </main>
  );
}
