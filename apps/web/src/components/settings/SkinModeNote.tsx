// Con un tema de la Tienda puesto, el esquema claro/oscuro lo fija el tema:
// en lugar del selector de modo se explica cómo recuperarlo.
import { Link } from 'react-router-dom';
import { SKINS } from '@/lib/shopThemes';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

export function SkinModeNote({ className }: { className?: string }) {
  const skin = useThemeStore((s) => s.skin);
  if (!skin) return null;
  return (
    <p className={cn('max-w-prose text-body-sm text-on-surface-light', className)}>
      Tu tema es {SKINS[skin]?.scheme === 'dark' ? 'siempre oscuro' : 'siempre claro'}. Para elegir claro, oscuro o automático, vuelve a Aurora en{' '}
      <Link to="/settings?tab=game" className="font-semibold text-primary-text underline underline-offset-2">Ajustes</Link>.
    </p>
  );
}
