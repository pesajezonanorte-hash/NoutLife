import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItemProps {
  title: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Ícono o chip a la izquierda del título. */
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Acordeón (.acc): grid-template-rows 0fr → 1fr 450 ms expo (excepción documentada)
 *  + chevron 180° con muelle. El botón expone aria-expanded / aria-controls. */
export function AccordionItem({ title, open, onToggle, leading, children, className }: AccordionItemProps) {
  const id = useId();
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;
  return (
    <div
      className={cn(
        'rounded-2xl border transition-[border-color,box-shadow,background-color] duration-300',
        open ? 'border-primary/25 bg-background shadow-md' : 'border-border bg-surface',
        className,
      )}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-16 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-on-background md:px-5"
        >
          {leading}
          <span className="flex-1 text-label-lg md:text-body-md md:font-semibold">{title}</span>
          <ChevronDown
            aria-hidden
            strokeWidth={1.75}
            className={cn('size-6 shrink-0 text-on-surface-light transition-transform duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]', open && 'rotate-180')}
          />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} className="lq-acc-panel" data-open={open}>
        <div>
          {/* inert: el contenido plegado no recibe foco (React 18 no tipa el atributo). */}
          <div className="lq-acc-body" {...({ inert: open ? undefined : '' } as object)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
