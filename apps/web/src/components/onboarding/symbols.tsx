// Símbolos del onboarding en el trazo de lucide (24 px, línea redonda, currentColor):
// géneros y redes que lucide no trae. Decorativos: el texto de la opción los nombra.
import type { ReactNode } from 'react';

type GlyphProps = { className?: string; strokeWidth?: number | string };

function glyph(paths: ReactNode) {
  return function Glyph({ className, strokeWidth = 1.75 }: GlyphProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
        {paths}
      </svg>
    );
  };
}

/** ♀ */
export const Venus = glyph(<><circle cx="12" cy="9" r="5" /><path d="M12 14v8M9 19h6" /></>);
/** ♂ */
export const Mars = glyph(<><circle cx="10" cy="14" r="5" /><path d="M13.5 10.5 20 4M15 4h5v5" /></>);
/** ⚧ */
export const GenderOther = glyph(<><circle cx="12" cy="12" r="4" /><path d="M14.8 9.2 20 4M16.5 4H20v3.5M9.2 9.2 4 4M4 7.5V4h3.5M12 16v6M9.5 19.5h5" /></>);
/** La nota de TikTok, en línea. */
export const TikTok = glyph(<path d="M14.5 3v11a3.5 3.5 0 1 1-3.5-3.5M14.5 3c.4 2.6 2.3 4.5 5.5 4.7" />);
