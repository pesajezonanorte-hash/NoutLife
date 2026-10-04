import { useId } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Field, Textarea } from './Field';
import { chipClasses } from './Chip';

export interface SabioComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Ideas rápidas (chips); al elegir una se rellena el texto. */
  ideas?: Array<{ label: string; text: string }>;
  busy?: boolean;
  /** Texto de progreso mientras el Sabio trabaja («Diseñando hábitos…»). */
  progressText?: string;
  submitLabel?: string;
  onSubmit: () => void;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  className?: string;
}

/** Composer de «El Sabio»: textarea + chips de ideas + botón con loading y texto de progreso con cursor. */
export function SabioComposer({
  value, onChange, ideas = [], busy, progressText, submitLabel = 'Crear', onSubmit,
  title = 'El Sabio', subtitle, placeholder, className,
}: SabioComposerProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-center gap-4">
        <span className="lq-halo flex size-12 items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)] text-primary-text">
          <Sparkles aria-hidden className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-heading-sm">{title}</h2>
          {subtitle && <p className="text-body-sm text-on-surface-light">{subtitle}</p>}
        </div>
      </div>
      <Field label="Describe tu zona">
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={busy} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {ideas.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Ideas rápidas">
            {ideas.map((i) => {
              const on = value === i.text;
              return (
                <button key={i.label} type="button" aria-pressed={on} onClick={() => onChange(i.text)} className={chipClasses(on)}>
                  {i.label}
                </button>
              );
            })}
          </div>
        )}
        <Button onClick={onSubmit} loading={busy} disabled={!value.trim()}>
          <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />{busy ? 'Creando…' : submitLabel}
        </Button>
      </div>
      {busy && progressText && (
        <p aria-live="polite" className="text-body-md text-on-surface after:ml-0.5 after:animate-[lq-blink_1s_steps(1)_infinite] after:text-primary after:content-['▍']">
          {progressText}
        </p>
      )}
    </div>
  );
}
