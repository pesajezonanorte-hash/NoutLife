// Sidebar de md+ (≥768): recogido muestra solo íconos (72 px); al pasar el
// cursor o enfocar con teclado se despliega hacia la derecha hasta 256 px.
// El contenido interno tiene siempre 256 px de ancho y el panel solo lo recorta,
// así que nada se reacomoda: los íconos no se mueven y el texto aparece
// revelado por el borde + un fundido. El panel EMPUJA la página: su contenedor
// anima el ancho 72→256 px y el contenido se comprime.
import { useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { getLevelTitle } from '@/lib/gameProgress';
import { BrandMark } from './Brand';
import { NAV_SECTIONS, PRIMARY_NAV, UTILITY_NAV, matchesRoute, type NavEntry, type NavSection } from './nav';

const OPEN_KEY = 'lq-nav-sections';
const ENTER_DELAY = 90;
const LEAVE_DELAY = 180;

function readOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}'); } catch { return {}; }
}

/** Texto que aparece al desplegar: solo opacidad, sin mover nada. */
const reveal =
  'whitespace-nowrap opacity-0 transition-opacity duration-150 group-data-[open=true]/side:opacity-100 group-data-[open=true]/side:delay-75 group-data-[open=true]/side:duration-200';

/**
 * Ítem: ícono fijo a 24 px del borde (centrado en 72 px). El fondo de hover/activo
 * es una capa absoluta de 48 px que se estira al desplegar, sin afectar al layout.
 */
function SideLink({ to, label, icon: Icon }: NavEntry) {
  const { pathname } = useLocation();
  const active = matchesRoute(pathname, to);
  return (
    <NavLink
      to={to}
      end={to === '/'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group/link relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-label-lg transition-colors',
        active ? 'text-primary-text' : 'text-on-surface',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-12 rounded-[10px] transition-[width,background-color] duration-300 ease-out group-data-[open=true]/side:w-full',
          active ? 'bg-primary/[var(--lq-soft-alpha)]' : 'group-hover/link:bg-surface-variant',
        )}
      />
      {active && (
        <span aria-hidden className="absolute -left-3 bottom-2.5 top-2.5 w-[3px] origin-center animate-grow-y rounded-r-[3px] bg-primary" />
      )}
      <Icon aria-hidden className="relative size-6 shrink-0" strokeWidth={1.75} />
      <span className={cn('relative truncate', reveal)}>{label}</span>
    </NavLink>
  );
}

/** Rótulo de sección: recogido se ve como una rayita bajo los íconos. */
function SectionLabel({ children }: { children: string }) {
  return (
    <>
      <span aria-hidden className="absolute left-3 top-1/2 h-px w-6 bg-border transition-opacity duration-150 group-data-[open=true]/side:opacity-0" />
      <span className={reveal}>{children}</span>
    </>
  );
}

function Section({ section, open, onToggle }: { section: NavSection; open: boolean; onToggle: () => void }) {
  const listId = useId();
  if (!section.collapsible) {
    return (
      <div className="flex flex-col gap-1">
        <span className="relative flex min-h-8 items-center px-3 text-label-md uppercase text-on-surface-light">
          <SectionLabel>{section.label}</SectionLabel>
        </span>
        {section.items.map((it) => <SideLink key={it.to} {...it} />)}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className="relative flex min-h-11 items-center justify-between rounded-[10px] px-3 text-label-md uppercase text-on-surface-light transition-colors hover:bg-surface-variant hover:text-on-surface"
      >
        <SectionLabel>{section.label}</SectionLabel>
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200', reveal, open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={listId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="flex flex-col gap-1"
          >
            {section.items.map((it) => <SideLink key={it.to} {...it} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Perfil: recogido solo se ven las iniciales; el borde y el texto aparecen al desplegar. */
function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const initials = user.displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Link
      to="/profile"
      className="flex rounded-2xl border border-transparent p-[3px] transition-colors duration-300 group-data-[open=true]/side:border-border group-data-[open=true]/side:bg-background"
      aria-label={`Ver perfil de ${user.displayName}, nivel ${user.level}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="lq-ichip flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[var(--lq-soft-alpha)] text-label-lg text-primary-text">
          {initials}
        </span>
        <span className={cn('min-w-0', reveal)}>
          <span className="block truncate text-label-lg text-on-background">{user.displayName}</span>
          <span className="block truncate text-body-sm text-on-surface-light">Nivel {user.level} · {getLevelTitle(user.level)}</span>
        </span>
      </span>
    </Link>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [openMap, setOpenMap] = useState(readOpen);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number>();
  const panelRef = useRef<HTMLElement>(null);
  const open = hovered || focused || pinned;

  const isOpen = (s: NavSection) => openMap[s.id] ?? s.items.some((it) => matchesRoute(pathname, it.to));
  const toggle = (s: NavSection) => {
    const next = { ...openMap, [s.id]: !isOpen(s) };
    setOpenMap(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* sin storage */ }
  };

  // Intención de hover: un pequeño retraso evita que se abra al cruzarlo de paso.
  const schedule = (value: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovered(value), delay);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Solo ratón/lápiz: en táctil el "hover" emulado lo abriría al navegar.
  const onPointerEnter = (e: PointerEvent) => { if (e.pointerType !== 'touch') schedule(true, ENTER_DELAY); };
  const onPointerLeave = (e: PointerEvent) => { if (e.pointerType !== 'touch') schedule(false, LEAVE_DELAY); };

  // Teclado: se despliega mientras el foco (visible) esté dentro.
  const onFocus = (e: FocusEvent) => { if ((e.target as HTMLElement).matches(':focus-visible')) setFocused(true); };
  const onBlur = (e: FocusEvent) => { if (!panelRef.current?.contains(e.relatedTarget as Node)) setFocused(false); };

  // Al navegar se suelta el anclado manual (táctil).
  useEffect(() => { setPinned(false); }, [pathname]);

  // Anclado manual: Escape o tocar fuera lo cierra.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPinned(false);
      setFocused(false);
      setHovered(false);
    };
    const onDown = (e: globalThis.PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div
      className={cn(
        'relative w-[72px] shrink-0 transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] has-[[data-open=true]]:w-64 motion-reduce:transition-none',
        className,
      )}
    >
      <aside
        ref={panelRef}
        data-open={open}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          'group/side sticky top-0 h-dvh w-full overflow-hidden border-r border-border bg-surface',
        )}
      >
        <div className="flex h-full w-64 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:none]">
          <Link to="/" className="flex min-h-11 items-center gap-3 rounded-xl px-1" aria-label="LifeQuest, ir al inicio">
            <BrandMark />
            <span className={cn('text-heading-sm text-on-background', reveal)}>LifeQuest</span>
          </Link>

          <nav aria-label="Principal" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {PRIMARY_NAV.map((it) => <SideLink key={it.to} {...it} />)}
            </div>
            {NAV_SECTIONS.map((s) => (
              <Section key={s.id} section={s} open={isOpen(s)} onToggle={() => toggle(s)} />
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {UTILITY_NAV.map((it) => <SideLink key={it.to} {...it} />)}
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  if (open) { setPinned(false); setFocused(false); setHovered(false); } else setPinned(true);
                }}
                className="group/link relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-label-lg text-on-surface-light transition-colors hover:text-on-surface"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-12 rounded-[10px] transition-[width,background-color] duration-300 ease-out group-hover/link:bg-surface-variant group-data-[open=true]/side:w-full" />
                {open
                  ? <PanelLeftClose aria-hidden className="relative size-6 shrink-0" strokeWidth={1.75} />
                  : <PanelLeftOpen aria-hidden className="relative size-6 shrink-0" strokeWidth={1.75} />}
                <span className={cn('relative', reveal)}>{open ? 'Contraer menú' : 'Expandir menú'}</span>
              </button>
            </div>
            <ProfileCard />
          </div>
        </div>
      </aside>
    </div>
  );
}
