import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { buttonClasses } from '@/components/ui/lq/Button';
import { IconChip } from '@/components/ui/lq/IconChip';
import { getLocale, type Copy } from '@/lib/i18n';

const COPY: Copy<{ title: string; body: string; details: string; reload: string }> = {
  es: { title: 'Algo se torció', body: 'Ocurrió un error inesperado. No se perdió ningún progreso.', details: 'Detalles del error', reload: 'Recargar' },
  en: { title: 'Something went wrong', body: 'An unexpected error occurred. No progress was lost.', details: 'Error details', reload: 'Reload' },
};

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center bg-background p-8 text-on-background">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <IconChip icon={AlertTriangle} tone="error" size="lg" />
          <div className="flex flex-col gap-2">
            <h1 className="text-heading-lg">{COPY[getLocale()].title}</h1>
            <p className="text-body-md text-on-surface-light">{COPY[getLocale()].body}</p>
          </div>
          {this.state.error && (
            <details className="w-full rounded-md border border-border bg-surface p-3 text-left text-body-sm text-on-surface-light">
              <summary className="cursor-pointer text-label-lg text-on-surface">{COPY[getLocale()].details}</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-caption">{this.state.error.message}</pre>
            </details>
          )}
          <button type="button" onClick={() => window.location.reload()} className={buttonClasses('primary', 'md')}>
            <RefreshCw aria-hidden className="size-4" strokeWidth={2} />{COPY[getLocale()].reload}
          </button>
        </div>
      </div>
    );
  }
}
