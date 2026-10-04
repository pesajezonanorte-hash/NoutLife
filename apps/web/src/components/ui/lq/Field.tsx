import {
  cloneElement, forwardRef, isValidElement, useId,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const control =
  'min-h-12 w-full rounded-lg border bg-background px-4 py-2.5 text-body-md text-on-background ' +
  'transition-[border-color,box-shadow,background-color] duration-200 ease-out placeholder:text-on-surface-light ' +
  'focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

const stateCls = (invalid?: boolean) =>
  invalid
    ? 'border-error ring-[3px] ring-error/[var(--lq-soft-alpha)]'
    : 'border-border-strong hover:border-on-surface-light focus:border-primary focus:ring-[3px] focus:ring-primary/25';

/** Clases de un campo de formulario, para controles propios (p. ej. DatePicker). */
export const fieldClasses = (invalid?: boolean) => cn(control, stateCls(invalid));

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** <Input> 16 px (evita zoom en iOS), borde gray-500 (≥3:1), anillo de foco 3 px. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, stateCls(invalid), className)} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, stateCls(invalid), 'min-h-28 resize-y', className)} {...rest} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(control, stateCls(invalid), 'appearance-none pr-10', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-3 size-6 text-on-surface-light" strokeWidth={1.75} />
    </div>
  );
});

export interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Un <Input> o <Select>: Field le inyecta id, aria-describedby e invalid. */
  children: ReactElement;
}

/** Label siempre visible + ayuda + error junto al campo. */
export function Field({ label, help, error, className, children }: FieldProps) {
  const id = useId();
  const childId = (isValidElement(children) && (children.props as { id?: string }).id) || id;
  const helpId = `${childId}-help`;
  const describedBy = error || help ? helpId : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: childId,
        invalid: Boolean(error) || undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label id={`${childId}-label`} htmlFor={childId} className="text-label-lg text-on-surface">{label}</label>
      {control}
      {error ? (
        <span id={helpId} className="flex items-center gap-1.5 text-body-sm text-error-text">
          <AlertCircle aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          {error}
        </span>
      ) : help ? (
        <span id={helpId} className="text-body-sm text-on-surface-light">{help}</span>
      ) : null}
    </div>
  );
}
