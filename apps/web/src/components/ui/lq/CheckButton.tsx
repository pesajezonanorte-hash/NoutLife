import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckButtonProps {
  checked: boolean;
  onToggle: () => void;
  /** Nombre del hábito: genera "Completar X" / "Desmarcar X". */
  name: string;
  disabled?: boolean;
  className?: string;
}

/** Check de hábito 48 px: aria-pressed, gira 360° y se rellena de success. */
export function CheckButton({ checked, onToggle, name, disabled, className }: CheckButtonProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={checked}
      aria-label={`${checked ? 'Desmarcar' : 'Completar'} ${name}`}
      disabled={disabled}
      onClick={onToggle}
      animate={{ rotate: checked ? 360 : 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 disabled:opacity-40',
        checked
          ? 'border-success bg-success text-on-primary'
          : 'border-border-strong bg-transparent text-transparent hover:border-success',
        className,
      )}
    >
      <Check aria-hidden className="size-6" strokeWidth={2.25} />
    </motion.button>
  );
}
