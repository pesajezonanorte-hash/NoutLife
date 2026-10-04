// Selector de fecha de Noutlife: sustituye a <input type="date">. Mismo valor
// 'YYYY-MM-DD' (cadena vacía = sin fecha), así que encaja con los formularios y
// la API tal como estaban. El calendario se despliega en un popover animado; el
// título del mes abre la vista de años y meses para saltar lejos (cumpleaños).
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { format, isAfter, isBefore, isSameMonth, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { pressSpring, spring } from '@/lib/motion';
import { Calendar } from '@/components/ui/calendar';
import { fieldClasses } from './Field';

/** 'YYYY-MM-DD' → fecha local (sin desfase de zona horaria). */
function parse(v?: string) {
  if (!v) return undefined;
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}
const toValue = (d: Date) => format(d, 'yyyy-MM-dd');

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Límites en 'YYYY-MM-DD', como en el input nativo. */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Muestra «Borrar» para dejar el campo vacío (campos opcionales). */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  { value, onChange, min, max, placeholder = 'Elige una fecha', clearable, disabled, invalid, id, className, 'aria-describedby': describedBy },
  ref,
) {
  const selected = parse(value);
  const minDate = parse(min);
  const maxDate = parse(max);
  const today = new Date();
  const start = minDate ?? new Date(1920, 0, 1);
  const end = maxDate ?? new Date(today.getFullYear() + 15, 11, 31);
  const clamp = (d: Date) => (isBefore(d, start) ? start : isAfter(d, end) ? end : d);
  const todayAllowed = !isBefore(today, start) && !isAfter(today, end);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'years'>('days');
  const [month, setMonth] = useState(() => startOfMonth(clamp(selected ?? today)));

  // Al abrir, el calendario muestra el mes de la fecha elegida.
  useEffect(() => {
    if (open) { setMonth(startOfMonth(clamp(selected ?? today))); setView('days'); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const disabledDays = [minDate && { before: minDate }, maxDate && { after: maxDate }].filter(Boolean) as Array<{ before: Date } | { after: Date }>;

  function pick(d?: Date) {
    if (!d) return;
    onChange(toValue(d));
    // Deja ver cómo la pastilla llega al día antes de cerrar.
    window.setTimeout(() => setOpen(false), 220);
  }

  const label = selected ? format(selected, "d 'de' MMMM 'de' yyyy", { locale: es }) : placeholder;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          ref={ref}
          id={id}
          type="button"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          // Nombre = etiqueta del campo + fecha elegida (la etiqueta sola taparía la fecha).
          aria-labelledby={id ? `${id}-label ${id}-value` : undefined}
          className={cn(
            fieldClasses(invalid), 'group flex items-center gap-3 text-left active:scale-[.99]',
            open && !invalid && 'border-primary ring-[3px] ring-primary/25',
            className,
          )}
        >
          <motion.span
            aria-hidden
            className={cn('shrink-0 transition-colors duration-200', open || selected ? 'text-primary-text' : 'text-on-surface-light')}
            animate={open ? { rotate: -10, scale: 1.12 } : { rotate: 0, scale: 1 }}
            transition={pressSpring}
          >
            <CalendarDays className="size-5" strokeWidth={1.75} />
          </motion.span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={label}
              id={id ? `${id}-value` : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring}
              className={cn('min-w-0 flex-1 truncate', !selected && 'text-on-surface-light')}
            >
              {label}
            </motion.span>
          </AnimatePresence>
          <ChevronDown aria-hidden strokeWidth={1.75} className={cn('size-5 shrink-0 text-on-surface-light transition-transform duration-300', open && 'rotate-180')} />
        </button>
      </Popover.Trigger>

      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              forceMount
              asChild
              align="start"
              sideOffset={8}
              collisionPadding={16}
              aria-label="Calendario"
              onEscapeKeyDown={(e) => {
                // Escape cierra solo el calendario, no el diálogo que lo contiene.
                e.stopPropagation();
                if (view === 'years') { e.preventDefault(); setView('days'); }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } }}
                exit={{ opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.14 } }}
                style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
                className="z-[60] overflow-hidden rounded-2xl border border-border bg-surface p-3 text-on-background shadow-lg"
              >
                <div className="relative">
                  <Calendar
                    mode="single"
                    autoFocus
                    selected={selected}
                    onSelect={pick}
                    month={month}
                    onMonthChange={setMonth}
                    startMonth={start}
                    endMonth={end}
                    disabled={disabledDays}
                    onCaptionClick={() => setView((v) => (v === 'days' ? 'years' : 'days'))}
                    captionExpanded={view === 'years'}
                  />
                  <AnimatePresence>
                    {view === 'years' && (
                      <YearView
                        start={start} end={end} month={month} selected={selected}
                        onPick={(m) => { setMonth(m); setView('days'); }}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {(todayAllowed || (clearable && selected)) && (
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                    {clearable && selected ? (
                      <FooterButton onClick={() => { onChange(''); setOpen(false); }}>
                        <X aria-hidden className="size-4" strokeWidth={2} />Borrar
                      </FooterButton>
                    ) : <span />}
                    {todayAllowed && (
                      <FooterButton primary onClick={() => { setMonth(startOfMonth(today)); pick(today); }}>Hoy</FooterButton>
                    )}
                  </div>
                )}
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
});

function FooterButton({ primary, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.94 }}
      transition={pressSpring}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-label-lg transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        primary ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text hover:bg-primary/20' : 'text-on-surface-light hover:text-error-text',
        className,
      )}
      {...(rest as object)}
    />
  );
}

/** Vista de años y meses: lista desplazable; el año actual abierto y a la vista. */
function YearView({ start, end, month, selected, onPick }: { start: Date; end: Date; month: Date; selected?: Date; onPick: (m: Date) => void }) {
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) list.push(y);
    return list;
  }, [start, end]);
  const [openYears, setOpenYears] = useState(() => new Set([month.getFullYear()]));
  const scroller = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLDivElement>(null);
  const currentMonth = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (scroller.current && current.current) scroller.current.scrollTop = current.current.offsetTop - 4;
    const t = window.setTimeout(() => currentMonth.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, []);

  const toggle = (y: number) => setOpenYears((s) => { const n = new Set(s); if (n.has(y)) n.delete(y); else n.add(y); return n; });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
      className="absolute inset-x-0 bottom-0 top-12 z-30 bg-surface"
    >
      <div ref={scroller} className="h-full overflow-y-auto overscroll-contain pe-1">
        {years.map((y) => {
          const isOpen = openYears.has(y);
          return (
            <div key={y} ref={y === month.getFullYear() ? current : undefined} className="border-t border-border first:border-t-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(y)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-label-lg transition-colors hover:text-primary-text',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  y === month.getFullYear() ? 'text-primary-text' : 'text-on-background',
                )}
              >
                <ChevronDown aria-hidden strokeWidth={2} className={cn('size-4 text-on-surface-light transition-transform duration-300', !isOpen && '-rotate-90')} />
                {y}
              </button>
              {isOpen && (
                <motion.div
                  initial="hidden" animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.018 } } }}
                  className="grid grid-cols-3 gap-1.5 px-1 pb-3 pt-1"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = new Date(y, i, 1);
                    const off = isBefore(m, startOfMonth(start)) || isAfter(m, end);
                    const isCurrent = isSameMonth(m, month);
                    const isSelected = selected && isSameMonth(m, selected);
                    return (
                      <motion.button
                        key={i}
                        ref={isCurrent ? currentMonth : undefined}
                        type="button"
                        disabled={off}
                        onClick={() => onPick(m)}
                        variants={{ hidden: { opacity: 0, y: 6, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1, transition: spring } }}
                        whileHover={off ? undefined : { y: -1 }}
                        whileTap={off ? undefined : { scale: 0.92 }}
                        className={cn(
                          'min-h-11 rounded-xl text-label-lg capitalize transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          'disabled:pointer-events-none disabled:text-on-surface-light/40 disabled:line-through',
                          isCurrent ? 'bg-primary-strong text-on-primary' : isSelected ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'text-on-background hover:bg-primary/10',
                        )}
                      >
                        {format(m, 'MMM', { locale: es }).replace('.', '')}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
