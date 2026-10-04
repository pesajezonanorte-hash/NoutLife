import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface OtpInputProps {
  /** Valor actual (se normaliza a mayúsculas, sin espacios). */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Nombre del grupo para lectores de pantalla. */
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Código de N casillas: pegar reparte el código, cada carácter avanza solo y
 *  Backspace en una casilla vacía vuelve a la anterior. Flechas para moverse. */
export function OtpInput({ value, onChange, length = 6, label, invalid, disabled, className }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const setAt = (i: number, text: string) => {
    const next = chars.slice();
    const add = clean(text).split('');
    add.forEach((c, k) => { if (i + k < length) next[i + k] = c; });
    onChange(next.join('').slice(0, length));
    return Math.min(length - 1, i + add.length);
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (chars[i]) { const n = chars.slice(); n[i] = ''; onChange(n.join('')); }
      else if (i > 0) { const n = chars.slice(); n[i - 1] = ''; onChange(n.join('')); focus(i - 1); }
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1); }
  };

  const onPaste = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    focus(setAt(i, e.clipboardData.getData('text')));
  };

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={c}
          disabled={disabled}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          aria-label={`Carácter ${i + 1} de ${length}`}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
          onChange={(e) => {
            const raw = clean(e.target.value);
            if (!raw) return;
            // Si ya había carácter, el tecleado es el que se añadió.
            const text = c && raw.length > 1 && raw.startsWith(c) ? raw.slice(1) : raw;
            focus(setAt(i, text));
          }}
          className={cn(
            'size-12 rounded-md border bg-background text-center font-mono text-heading-sm uppercase text-on-background',
            'transition-[border-color,box-shadow,transform] duration-200 focus:outline-none focus:ring-[3px] focus:ring-primary/25 sm:h-[60px] sm:w-[52px]',
            invalid ? 'border-error' : c ? 'border-primary' : 'border-border-strong focus:border-primary',
            c && 'scale-[1.02]',
          )}
        />
      ))}
    </div>
  );
}
