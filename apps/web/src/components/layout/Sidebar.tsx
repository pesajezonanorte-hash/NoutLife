import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { getLevelTitle } from '@/lib/gameProgress';
import { ProgressBar } from '@/components/ui/lq';
import { BrandMark } from './Brand';
import { NAV_SECTIONS, PRIMARY_NAV, UTILITY_NAV, matchesRoute, type NavEntry, type NavSection } from './nav';

const OPEN_KEY = 'lq-nav-sections';

function readOpen(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}'); } catch { return {}; }
}

/** Ítem del sidebar: hover surface-variant, activo con tinte primary y barra lateral que crece. */
function SideLink({ to, label, icon: Icon }: NavEntry) {
  const { pathname } = useLocation();
  const active = matchesRoute(pathname, to);
  return (
    <NavLink
      to={to}
      end={to === '/'}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-label-lg transition-colors',
        active ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'text-on-surface hover:bg-surface-variant',
      )}
    >
      {active && (
        <span aria-hidden className="absolute -left-4 bottom-2.5 top-2.5 w-[3px] origin-center animate-grow-y rounded-r-[3px] bg-primary" />
      )}
      <Icon
        aria-hidden
        className="size-6 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transform-none"
        strokeWidth={1.75}
      />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function Section({ section, open, onToggle }: { section: NavSection; open: boolean; onToggle: () => void }) {
  const listId = useId();
  if (!section.collapsible) {
    return (
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <span className="px-3 pb-1 text-label-md uppercase text-on-surface-light">{section.label}</span>
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
        className="flex min-h-11 items-center justify-between rounded-[10px] px-3 text-label-md uppercase text-on-surface-light transition-colors hover:bg-surface-variant hover:text-on-surface"
      >
        {section.label}
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
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

function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const initials = user.displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const pct = user.xpToNextLevel > 0 ? Math.round((user.xp / user.xpToNextLevel) * 100) : 0;
  return (
    <Link
      to="/profile"
      className="lq-lift flex flex-col gap-3 rounded-2xl border border-border bg-background p-3"
      aria-label={`Ver perfil de ${user.displayName}, nivel ${user.level}`}
    >
      <span className="flex items-center gap-3">
        <span className="lq-ichip flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[var(--lq-soft-alpha)] text-label-lg text-primary-text">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-label-lg text-on-background">{user.displayName}</span>
          <span className="block truncate text-body-sm text-on-surface-light">Nivel {user.level} · {getLevelTitle(user.level)}</span>
        </span>
      </span>
      <ProgressBar value={pct} />
    </Link>
  );
}

/** Sidebar de escritorio (≥1024): w-64, secciones y tarjeta de perfil. */
export function Sidebar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const [openMap, setOpenMap] = useState(readOpen);

  const isOpen = (s: NavSection) => openMap[s.id] ?? s.items.some((it) => matchesRoute(pathname, it.to));
  const toggle = (s: NavSection) => {
    const next = { ...openMap, [s.id]: !isOpen(s) };
    setOpenMap(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* sin storage */ }
  };

  return (
    <aside className={cn('sticky top-0 h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface px-4 py-6', className)}>
      <Link to="/" className="flex items-center gap-3 rounded-xl px-2" aria-label="LifeQuest, ir al inicio">
        <BrandMark />
        <span className="text-heading-sm text-on-background">LifeQuest</span>
      </Link>

      <nav aria-label="Principal" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.map((it) => <SideLink key={it.to} {...it} />)}
        </div>
        {NAV_SECTIONS.map((s) => (
          <Section key={s.id} section={s} open={isOpen(s)} onToggle={() => toggle(s)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          {UTILITY_NAV.map((it) => <SideLink key={it.to} {...it} />)}
        </div>
        <ProfileCard />
      </div>
    </aside>
  );
}
