'use client';

import {
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
} from 'framer-motion';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

const DOCK_HEIGHT = 128;
const DEFAULT_MAGNIFICATION = 80;
const DEFAULT_DISTANCE = 150;
const DEFAULT_PANEL_HEIGHT = 64;

type DockProps = {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  distance?: number;
  panelHeight?: number;
  magnification?: number;
  maxHeight?: number;
  reserveHeight?: boolean;
  spring?: SpringOptions;
  ariaLabel?: string;
};

type DockItemProps = {
  className?: string;
  children: ReactNode;
};

type DockLabelProps = {
  className?: string;
  children: ReactNode;
  placement?: 'top' | 'bottom';
  isHovered?: MotionValue<number>;
};

type DockIconProps = {
  className?: string;
  children: ReactNode;
  width?: MotionValue<number>;
};

type DockContextType = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

type DockProviderProps = {
  children: ReactNode;
  value: DockContextType;
};

const DockContext = createContext<DockContextType | undefined>(undefined);

function DockProvider({ children, value }: DockProviderProps) {
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

function useDock() {
  const context = useContext(DockContext);
  if (!context) {
    throw new Error('useDock must be used within a DockProvider');
  }
  return context;
}

/**
 * Barra de acciones con magnificación tipo macOS. `maxHeight` permite usarla
 * también dentro de barras compactas sin que el layout salte al pasar el cursor.
 */
function Dock({
  children,
  className,
  containerClassName,
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
  maxHeight,
  reserveHeight = false,
  ariaLabel = 'Acciones rápidas',
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const resolvedMaxHeight = useMemo(() => {
    return maxHeight ?? Math.max(DOCK_HEIGHT, magnification + magnification / 2 + 4);
  }, [magnification, maxHeight]);

  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, resolvedMaxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{ height: reserveHeight ? resolvedMaxHeight : height, scrollbarWidth: 'none' }}
      className={cn('relative flex max-w-full items-end overflow-visible', containerClassName)}
    >
      <motion.div
        onMouseMove={({ clientX }) => {
          isHovered.set(1);
          mouseX.set(clientX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={cn(
          'mx-auto flex w-fit items-end gap-4 rounded-2xl bg-gray-50 px-4 dark:bg-neutral-900',
          className,
        )}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label={ariaLabel}
      >
        <DockProvider value={{ mouseX, spring, distance, magnification }}>
          {children}
        </DockProvider>
      </motion.div>
    </motion.div>
  );
}

function DockItem({ children, className }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseX, spring } = useDock();
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (value) => {
    const domRect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return value - domRect.x - domRect.width / 2;
  });

  const widthTransform = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [40, magnification, 40],
  );
  const width = useSpring(widthTransform, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocusCapture={() => isHovered.set(1)}
      onBlurCapture={() => isHovered.set(0)}
      className={cn('relative inline-flex aspect-square shrink-0 items-center justify-center', className)}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return cloneElement(child as ReactElement<DockLabelProps & DockIconProps>, { width, isHovered });
      })}
    </motion.div>
  );
}

function DockLabel({ children, className, placement = 'top', isHovered }: DockLabelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const opensDown = placement === 'bottom';

  useEffect(() => {
    if (!isHovered) return undefined;
    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: opensDown ? -3 : 3, scale: 0.96 }}
          animate={{ opacity: 1, y: opensDown ? 6 : -10, scale: 1 }}
          exit={{ opacity: 0, y: opensDown ? -2 : 2, scale: 0.96 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'pointer-events-none absolute left-1/2 z-30 w-fit whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold shadow-md',
            opensDown ? 'top-[calc(100%+2px)]' : '-top-7',
            'border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-primary)]',
            className,
          )}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className, width }: DockIconProps) {
  const fallbackWidth = useMotionValue(40);
  const widthTransform = useTransform(width ?? fallbackWidth, (value) => value / 2);

  return (
    <motion.div
      style={{ width: widthTransform }}
      className={cn('flex aspect-square items-center justify-center', className)}
    >
      {children}
    </motion.div>
  );
}

export { Dock, DockIcon, DockItem, DockLabel };
