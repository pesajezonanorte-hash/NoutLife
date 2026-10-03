import { Sparkles } from 'lucide-react';
import { buttonClasses } from '@/components/ui/lq';
import { cn } from '@/lib/utils';
import { useUIStore } from '../../store/uiStore';

interface Props {
  message: string;
  label?: string;
  className?: string;
}

/** Abre El Sabio con un mensaje de contexto de la zona. Botón secundario lq. */
export function SageContextButton({ message, label = 'Pregúntale al Sabio', className = '' }: Props) {
  const openSage = useUIStore((s) => s.openSage);

  return (
    <button type="button" onClick={() => openSage(message)} className={cn(buttonClasses('secondary', 'md'), className)} title={message}>
      <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}
