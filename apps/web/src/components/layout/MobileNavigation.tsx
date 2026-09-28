import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

export interface MobileNavItem {
  to: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  group: string;
  accent?: boolean;
}

export interface MobileNavGroup {
  id: string;
  label: string;
}

interface Props {
  items: MobileNavItem[];
  groups: MobileNavGroup[];
  onNavigate?: () => void;
  utilityContent?: ReactNode;
}

const PRIMARY_ROUTES = ['/', '/quests', '/habits', '/finances'] as const;

function matchesRoute(pathname: string, route: string) {
  return route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`);
}

function MoreSheet({
  open,
  onClose,
  items,
  groups,
  onNavigate,
  utilityContent,
}: {
  open: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  groups: MobileNavGroup[];
  onNavigate?: () => void;
  utilityContent?: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] md:hidden"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.18 }}
        >
          <button
            type="button"
            aria-label="Cerrar menú Más"
            className="absolute inset-0 w-full bg-[var(--scrim)]"
            onClick={onClose}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Más secciones"
            drag={shouldReduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 220 }}
            dragElastic={{ top: 0, bottom: 0.16 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 96 || info.velocity.y > 520) onClose();
            }}
            initial={shouldReduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="absolute inset-x-0 bottom-0 flex max-h-[min(84dvh,46rem)] flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-lg"
          >
            <div className="shrink-0 px-4 pt-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
              <div className="mt-3 flex items-center justify-between gap-3 pb-3">
                <div>
                  <p className="text-base font-semibold text-[var(--text-primary)]">Más</p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Todas las zonas de tu aventura</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-xl px-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <div className="space-y-5 pb-3">
                {groups.map((group) => {
                  const groupItems = items.filter((item) => item.group === group.id);
                  if (!groupItems.length) return null;

                  return (
                    <section key={group.id} aria-label={group.label}>
                      <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {group.label}
                      </h2>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {groupItems.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={() => {
                              onNavigate?.();
                              onClose();
                            }}
                            className="min-w-0"
                          >
                            {({ isActive }) => (
                              <motion.span
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                                className="flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors"
                                style={{
                                  borderColor: isActive ? 'color-mix(in oklab, var(--accent-gold) 45%, var(--border))' : 'var(--border)',
                                  background: isActive ? 'color-mix(in oklab, var(--accent-gold) 10%, var(--bg-panel-light))' : 'var(--bg-panel-light)',
                                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                }}
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--accent-gold)]">
                                  {item.icon}
                                </span>
                                <span className="min-w-0 truncate text-sm font-medium">{item.label}</span>
                              </motion.span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    </section>
                  );
                })}

                {utilityContent && (
                  <section aria-label="Accesos rápidos">
                    <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Accesos rápidos</h2>
                    <div className="mt-2">{utilityContent}</div>
                  </section>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MobileNavigation({ items, groups, onNavigate, utilityContent }: Props) {
  const { pathname } = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = useMemo(
    () => PRIMARY_ROUTES
      .map((route) => items.find((item) => item.to === route))
      .filter((item): item is MobileNavItem => Boolean(item)),
    [items],
  );
  const moreItems = useMemo(
    () => items.filter((item) => !PRIMARY_ROUTES.includes(item.to as (typeof PRIMARY_ROUTES)[number])),
    [items],
  );
  const moreActive = !primaryItems.some((item) => matchesRoute(pathname, item.to));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="z-[110] shrink-0 border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_90%,transparent)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5">
          {primaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className="min-w-0"
            >
              {({ isActive }) => (
                <motion.span
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  className="relative flex min-h-12 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-1 py-1.5 focus-visible:outline-none"
                  style={{ color: isActive ? 'var(--accent-gold)' : 'var(--text-muted)' }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="mobile-tab-active"
                      className="absolute inset-0 rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_12%,transparent)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="relative flex h-5 items-center justify-center">{item.icon}</span>
                  <span className="relative max-w-full truncate text-[10px] font-medium">{item.label}</span>
                </motion.span>
              )}
            </NavLink>
          ))}

          <motion.button
            type="button"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            aria-label="Abrir Más"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className="relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
            style={{ color: moreActive || moreOpen ? 'var(--accent-gold)' : 'var(--text-muted)' }}
          >
            {moreActive ? (
              <motion.span
                layoutId="mobile-tab-active"
                className="absolute inset-0 rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_12%,transparent)]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            ) : moreOpen ? (
              <span className="absolute inset-0 rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_12%,transparent)]" />
            ) : null}
            <MoreHorizontal className="relative h-5 w-5" aria-hidden="true" />
            <span className="relative max-w-full truncate text-[10px] font-medium">Más</span>
          </motion.button>
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={moreItems}
        groups={groups}
        onNavigate={onNavigate}
        utilityContent={utilityContent}
      />
    </>
  );
}
