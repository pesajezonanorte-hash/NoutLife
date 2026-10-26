// Con un tema de la Tienda puesto, el esquema claro/oscuro lo fija el tema:
// en lugar del selector de modo se explica cómo recuperarlo.
import { Link } from 'react-router-dom';
import { SKINS } from '@/lib/shopThemes';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{ always: (dark: boolean) => string; hint: string; settings: string }> = {
  es: {
    always: (dark) => `Tu tema es ${dark ? 'siempre oscuro' : 'siempre claro'}.`,
    hint: 'Para elegir claro, oscuro o automático, vuelve a Aurora en',
    settings: 'Ajustes',
  },
  en: {
    always: (dark) => `Your theme is always ${dark ? 'dark' : 'light'}.`,
    hint: 'To choose light, dark or automatic, switch back to Aurora in',
    settings: 'Settings',
  },
};

export function SkinModeNote({ className }: { className?: string }) {
  const t = useText(COPY);
  const skin = useThemeStore((s) => s.skin);
  if (!skin) return null;
  return (
    <p className={cn('max-w-prose text-body-sm text-on-surface-light', className)}>
      {t.always(SKINS[skin]?.scheme === 'dark')} {t.hint}{' '}
      <Link to="/settings?tab=game" className="font-semibold text-primary-text underline underline-offset-2">{t.settings}</Link>.
    </p>
  );
}
