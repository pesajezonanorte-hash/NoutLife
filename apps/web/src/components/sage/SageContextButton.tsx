import { Sparkles } from 'lucide-react';
import { buttonClasses } from '@/components/ui/lq';
import { cn } from '@/lib/utils';
import { useUIStore } from '../../store/uiStore';
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{ ask: string }> = {
  es: { ask: 'Pregúntale al Sabio' },
  en: { ask: 'Ask the Sage' },
};

interface Props {
  message: string;
  label?: string;
  className?: string;
}

/** Abre El Sabio con un mensaje de contexto de la zona. Botón secundario lq. */
export function SageContextButton({ message, label, className = '' }: Props) {
  const t = useText(COPY);
  const openSage = useUIStore((s) => s.openSage);

  return (
    <button type="button" onClick={() => openSage(message)} className={cn(buttonClasses('secondary', 'md'), className)} title={message}>
      <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
      {label ?? t.ask}
    </button>
  );
}
