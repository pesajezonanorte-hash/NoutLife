import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { IconChip } from './IconChip';
import { ModernLoader } from './ModernLoader';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { useText, type Copy } from '@/lib/i18n';
import type { Tone } from './tones';

const COPY: Copy<{
  loadingPage: string; couldNotLoad: string; checkConnection: string; retryingIn: (s: number) => string; retry: string;
}> = {
  es: {
    loadingPage: 'Cargando tu aventura…', couldNotLoad: 'No pudimos cargar', checkConnection: 'Revisa tu conexión.',
    retryingIn: (s) => `Reintentando en ${s} s…`, retry: 'Reintentar',
  },
  en: {
    loadingPage: 'Loading your adventure…', couldNotLoad: "We couldn't load this", checkConnection: 'Check your connection.',
    retryingIn: (s) => `Retrying in ${s} s…`, retry: 'Try again',
  },
};

export interface EmptyStateProps {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  description?: ReactNode;
  /** CTA, normalmente un <Button> o enlace con buttonClasses(). */
  action?: ReactNode;
  className?: string;
}

/** Estado vacío: ícono grande + título + texto + CTA. */
export function EmptyState({ icon, tone = 'primary', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-12 text-center', className)}>
      <IconChip icon={icon} tone={tone} size="lg" />
      <h2 className="text-heading-lg">{title}</h2>
      {description && <p className="max-w-sm text-body-md text-on-surface-light">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  onRetry: () => void;
  /** Segundos para el reintento automático (0 lo desactiva). Por defecto 5. */
  autoRetrySeconds?: number;
  className?: string;
}

/** Error con "Reintentar" y reintento automático a los 5 s (cuenta atrás visible). */
export function ErrorState({
  title,
  description,
  onRetry,
  autoRetrySeconds = 5,
  className,
}: ErrorStateProps) {
  const t = useText(COPY);
  const [left, setLeft] = useState(autoRetrySeconds);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    if (autoRetrySeconds <= 0) return;
    setLeft(autoRetrySeconds);
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [autoRetrySeconds]);

  useEffect(() => {
    if (autoRetrySeconds > 0 && left === 0) retryRef.current();
  }, [left, autoRetrySeconds]);

  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <IconChip icon={AlertTriangle} tone="error" size="lg" />
      <h2 className="text-heading-lg">{title ?? t.couldNotLoad}</h2>
      <p className="max-w-sm text-body-md text-on-surface-light">
        {description ?? t.checkConnection}{' '}
        {autoRetrySeconds > 0 && left > 0 && <span>{t.retryingIn(left)}</span>}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />
        {t.retry}
      </Button>
    </div>
  );
}

/** Bloque de skeleton con shimmer (estático con reduced motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('lq-skeleton rounded-md', className)} />;
}

export interface PageLoaderProps {
  /** Texto principal (lectores de pantalla y primera frase bajo el remolino). */
  label?: string;
  /** Frases extra que se alternan después de `label`. */
  words?: readonly string[];
  /** lg: página completa · sm: sección, tarjeta o tabla. El remolino se ajusta al espacio. */
  size?: 'lg' | 'sm';
  className?: string;
}

/** Cargando página o sección: remolino de hojas (ModernLoader) centrado y a la medida del hueco. */
export function PageLoader({ label, words, size = 'lg', className }: PageLoaderProps) {
  const t = useText(COPY);
  const loading = useLoadingCopy();
  const main = label ?? t.loadingPage;
  const rest = words ?? loading.page;
  return (
    <div className={cn('flex w-full items-center justify-center', size === 'lg' ? 'py-4' : 'py-1', className)}>
      <ModernLoader label={main} words={[main, ...rest.filter((w) => w !== main)]} size={size} />
    </div>
  );
}
