import { SoftPad } from './SoftPad';

export interface CheckButtonProps {
  checked: boolean;
  onToggle: () => void;
  /** Nombre del hábito: genera "Completar X" / "Desmarcar X". */
  name: string;
  disabled?: boolean;
  /** Marcado y sin vuelta atrás (p. ej. la API no permite desmarcar): no reacciona y lo anuncia. */
  locked?: boolean;
  className?: string;
}

/** Check de hábito 48 px: almohadilla de silicona en relieve (SoftPad). */
export function CheckButton({ checked, onToggle, name, disabled, locked, className }: CheckButtonProps) {
  return <SoftPad checked={checked} name={name} onToggle={onToggle} pending={disabled} locked={locked} className={className} />;
}
