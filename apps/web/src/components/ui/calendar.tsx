// Calendario base (react-day-picker v9) con los tokens de Noutlife. Lo usa
// DatePicker (ui/lq) en todos los campos de fecha. Movimiento solo con
// transform/opacity: el mes entra deslizándose en la dirección de navegación,
// los días aparecen en cascada y la selección es una pastilla que viaja de un
// día a otro (layoutId).
import {
  createContext, useContext, useEffect, useId, useRef,
  type ButtonHTMLAttributes, type ComponentProps, type HTMLAttributes,
} from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { LayoutGroup, motion, PresenceContext } from 'framer-motion';
import { DayPicker, type CalendarDay, type CalendarMonth, type Modifiers } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import { differenceInCalendarDays, startOfMonth, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

export type CalendarProps = ComponentProps<typeof DayPicker> & {
  /** Si se pasa, el título del mes es un botón (abre la vista de meses y años). */
  onCaptionClick?: () => void;
  /** Estado de esa vista, para aria-expanded y la flecha del título. */
  captionExpanded?: boolean;
};

interface CalendarCtx { onCaptionClick?: () => void; captionExpanded?: boolean }
const Ctx = createContext<CalendarCtx>({});

const navButton =
  'relative inline-flex size-11 items-center justify-center rounded-xl text-on-surface-light transition-[transform,color] duration-200 ' +
  'before:absolute before:inset-0 before:-z-10 before:rounded-xl before:bg-primary/10 before:opacity-0 before:scale-75 before:transition-[opacity,transform] before:duration-200 ' +
  'hover:text-primary-text hover:before:opacity-100 hover:before:scale-100 active:scale-90 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-disabled:pointer-events-none aria-disabled:opacity-30';

const CLASSES = {
  root: 'relative isolate w-fit select-none',
  months: 'relative flex flex-col gap-4',
  month: 'w-full',
  month_caption: 'relative z-20 mb-1 me-24 ms-1 flex h-11 items-center justify-start',
  caption_label: 'text-label-lg text-on-background',
  nav: 'absolute end-0 top-0 z-10 flex items-center gap-1',
  button_previous: navButton,
  button_next: navButton,
  month_grid: 'border-collapse',
  weekdays: '',
  weekday: 'size-11 p-0 text-label-md uppercase text-on-surface-light',
  week: '',
  day: 'group size-11 p-0 text-center',
  day_button:
    'lq-day-in relative z-0 inline-flex size-11 items-center justify-center rounded-xl text-body-md font-mono tabular-nums text-on-background ' +
    'transition-[transform,color] duration-200 ease-out ' +
    'before:absolute before:inset-1 before:-z-10 before:rounded-xl before:bg-primary/10 before:opacity-0 before:scale-50 before:transition-[opacity,transform] before:duration-200 ' +
    'hover:scale-[1.08] hover:before:opacity-100 hover:before:scale-100 active:scale-90 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'group-data-[selected]:font-semibold group-data-[selected]:text-on-primary group-data-[selected]:before:opacity-0 ' +
    'group-data-[outside]:text-on-surface-light/60 ' +
    'group-data-[disabled]:pointer-events-none group-data-[disabled]:text-on-surface-light/40 group-data-[disabled]:line-through',
  selected: '',
  today: '',
  outside: '',
  disabled: '',
  hidden: 'invisible',
};

const spring = { type: 'spring', stiffness: 420, damping: 34 } as const;

function Chevron({ orientation, className }: { orientation?: 'left' | 'right' | 'up' | 'down'; className?: string }) {
  const Icon = orientation === 'left' ? ChevronLeft : orientation === 'down' ? ChevronDown : ChevronRight;
  return <Icon aria-hidden className={cn('size-5', className)} strokeWidth={2} />;
}

/** Título del mes; con vista de años es un botón con flecha que gira. */
function CaptionLabel({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  const { onCaptionClick, captionExpanded } = useContext(Ctx);
  if (!onCaptionClick) return <span className={className} {...rest}>{children}</span>;
  return (
    <button
      type="button"
      onClick={onCaptionClick}
      aria-expanded={captionExpanded}
      className={cn(
        'group/cap -ms-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-label-lg capitalize text-on-background transition-transform duration-200 hover:text-primary-text active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      <span aria-live="polite">{children}</span>
      <ChevronDown aria-hidden strokeWidth={2} className={cn('size-4 text-on-surface-light transition-transform duration-300', captionExpanded && 'rotate-180 text-primary-text')} />
    </button>
  );
}

/** El mes entra deslizándose desde el lado hacia el que se navega. */
function Month({ calendarMonth, displayIndex: _i, className, children, ...rest }: { calendarMonth: CalendarMonth; displayIndex: number } & HTMLAttributes<HTMLDivElement>) {
  const prev = useRef(calendarMonth.date.getTime());
  const now = calendarMonth.date.getTime();
  const dir = now > prev.current ? 1 : now < prev.current ? -1 : 0;
  useEffect(() => { prev.current = now; }, [now]);
  return (
    <div className={className} {...rest}>
      <motion.div
        key={now}
        initial={dir ? { opacity: 0, x: dir * 28 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={spring}
      >
        {children}
      </motion.div>
    </div>
  );
}

/** Día: cascada de entrada, pastilla de selección que viaja y punto de «hoy». */
function DayButton({ day, modifiers, className, children, style, ...rest }: { day: CalendarDay; modifiers: Modifiers } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);
  const group = useContext(GroupCtx);
  // Igual que el DayButton original: la navegación con teclado mueve el foco.
  useEffect(() => { if (modifiers.focused) ref.current?.focus(); }, [modifiers.focused]);
  const index = differenceInCalendarDays(day.date, startOfWeek(startOfMonth(day.displayMonth), { weekStartsOn: 1 }));
  return (
    <button ref={ref} className={className} style={{ ...style, animationDelay: `${Math.min(index, 41) * 7}ms` }} {...rest}>
      {modifiers.selected && (
        <motion.span
          aria-hidden
          layoutId={`${group}-sel`}
          className="absolute inset-0.5 -z-10 rounded-xl bg-primary-strong shadow-[0_6px_16px_-6px_rgb(var(--lq-primary)/0.7)]"
          transition={spring}
        />
      )}
      {children}
      {modifiers.today && (
        <span aria-hidden className={cn('absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full', modifiers.selected ? 'bg-on-primary' : 'bg-primary')} />
      )}
    </button>
  );
}

const GroupCtx = createContext('cal');

const COMPONENTS = { Chevron, CaptionLabel, Month, DayButton } as const;

export function Calendar({ className, classNames, components, showOutsideDays = true, onCaptionClick, captionExpanded, ...props }: CalendarProps) {
  const group = useId();
  const merged = Object.fromEntries(
    Object.entries(CLASSES).map(([k, v]) => [k, cn(v, classNames?.[k as keyof typeof classNames])]),
  );
  return (
    // La pastilla con layoutId no debe colgar la salida de un AnimatePresence padre.
    <PresenceContext.Provider value={null}>
      <LayoutGroup id={group}>
        <GroupCtx.Provider value={group}>
          <Ctx.Provider value={{ onCaptionClick, captionExpanded }}>
            <DayPicker
              locale={es}
              showOutsideDays={showOutsideDays}
              className={cn(CLASSES.root, className)}
              classNames={merged}
              components={{ ...COMPONENTS, ...components }}
              {...props}
            />
          </Ctx.Provider>
        </GroupCtx.Provider>
      </LayoutGroup>
    </PresenceContext.Provider>
  );
}
Calendar.displayName = 'Calendar';
