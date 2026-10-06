// Paleta de comandos (Ctrl/⌘+K). Sin prototipo: usa el diálogo del sistema
// (scrim + panel rounded-3xl) y el patrón combobox/listbox con ↑/↓ y Enter.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CornerDownLeft, FileText, Plus, Scale, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dialog, scrim } from '@/lib/motion';
import { Spinner } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';
import { NAV_SECTIONS, PRIMARY_NAV, SOCIAL_SHORTCUTS, UTILITY_NAV } from '@/components/layout/nav';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../hooks/useToast';
import { fetchHabits, logHabit } from '../../services/habit.service';
import { globalSearch, type SearchResult } from '../../services/notification.service';
import { refreshUser } from '../../hooks/useAuth';
import { logBodyWeight } from '../../services/gym2.service';

interface Cmd {
  id: string;
  label: string;
  group: 'Ir a' | 'Acciones' | 'Hábitos de hoy' | 'Resultados';
  sublabel?: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void | Promise<void>;
}

const NAV_CMDS = [...PRIMARY_NAV, ...NAV_SECTIONS.flatMap((s) => s.items), ...SOCIAL_SHORTCUTS, ...UTILITY_NAV];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "peso 79.5" registra el peso corporal; "diario" abre el diario. */
async function runSmartCommand(input: string, navigate: (to: string) => void): Promise<boolean> {
  const q = norm(input.trim());
  const peso = q.match(/^peso\s+([\d.,]+)$/);
  if (peso) {
    const weight = parseFloat(peso[1].replace(',', '.'));
    await logBodyWeight(weight, new Date().toISOString().slice(0, 10));
    useToastStore.getState().success('Peso registrado', `${weight} kg`);
    return true;
  }
  if (q === 'diario') { navigate('/journal'); return true; }
  return false;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { addFloatingXP, openSage } = useUIStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [habits, setHabits] = useState<Array<{ id: string; title: string }>>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    previousFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (!o) previousFocus.current = document.activeElement as HTMLElement | null;
          return !o;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Al abrir: foco al input, bloqueo de scroll y hábitos pendientes de hoy.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());
    fetchHabits().then((h) => setHabits(h.filter((x) => !x.todayCompleted).slice(0, 6))).catch(() => setHabits([]));
    return () => { document.body.style.overflow = overflow; };
  }, [open]);

  // Búsqueda global (debounce 250 ms) a partir de 2 caracteres.
  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return; }
    let alive = true;
    setSearching(true);
    const t = window.setTimeout(() => {
      globalSearch(query.trim())
        .then((r) => alive && setResults(r.slice(0, 6)))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setSearching(false));
    }, 250);
    return () => { alive = false; window.clearTimeout(t); setSearching(false); };
  }, [query, open]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (to: string) => () => navigate(to);
    return [
      ...NAV_CMDS.map((n) => ({ id: `nav-${n.to}`, group: 'Ir a' as const, label: n.label, icon: n.icon, keywords: n.label, run: go(n.to) })),
      { id: 'new-habit', group: 'Acciones', label: 'Nuevo hábito', icon: Plus, keywords: 'crear habito nuevo', run: go('/habits?new=1') },
      { id: 'new-quest', group: 'Acciones', label: 'Nueva misión', icon: Plus, keywords: 'crear mision quest nueva', run: go('/quests?new=1') },
      { id: 'sage', group: 'Acciones', label: 'Preguntar al Sabio', icon: Sparkles, keywords: 'sabio ia consejo ayuda', run: () => openSage() },
      { id: 'weight', group: 'Acciones', label: 'Registrar peso', sublabel: 'Escribe "peso 79.5"', icon: Scale, keywords: 'peso kg gym', run: () => { setQuery('peso '); inputRef.current?.focus(); } },
      ...habits.map((h) => ({
        id: `habit-${h.id}`,
        group: 'Hábitos de hoy' as const,
        label: `Completar ${h.title}`,
        icon: CheckCircle2,
        keywords: `completar habito ${h.title}`,
        run: async () => {
          const r = await logHabit(h.id, 'completed');
          addFloatingXP(r.rewards?.xpEarned ?? 0, window.innerWidth / 2, 200);
          useToastStore.getState().success(`${h.title} completado`);
          void refreshUser();
        },
      })),
    ];
  }, [habits, navigate, openSage, addFloatingXP]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    const base = q
      ? commands.filter((c) => norm(c.label).includes(q) || norm(c.keywords).includes(q))
      : commands.filter((c) => c.group !== 'Ir a' || PRIMARY_NAV.some((p) => `nav-${p.to}` === c.id));
    const found: Cmd[] = results.map((r) => ({
      id: `res-${r.type}-${r.id}`, group: 'Resultados', label: r.title, sublabel: r.subtitle, icon: FileText, keywords: '', run: () => navigate(r.link),
    }));
    return [...found, ...base].slice(0, 12);
  }, [commands, query, results, navigate]);

  useEffect(() => setActive(0), [query, results.length]);

  // "Registrar peso" solo prellena el input: la paleta sigue abierta.
  const execute = async (cmd?: Cmd) => {
    if (!cmd) return;
    if (cmd.id === 'weight') { await cmd.run(); return; }
    close();
    try { await cmd.run(); } catch { useToastStore.getState().error('No se pudo completar la acción'); }
  };

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      try {
        if (await runSmartCommand(query, navigate)) { close(); return; }
      } catch {
        useToastStore.getState().error('No se pudo registrar');
        return;
      }
      await execute(filtered[active]);
    } else if (e.key === 'Tab') {
      e.preventDefault(); // el foco se queda en el combobox
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  let lastGroup = '';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          variants={scrim} initial="initial" animate="animate" exit="exit"
          className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[12vh]"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            variants={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar o ejecutar un comando"
            className="flex max-h-[70dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search aria-hidden className="size-6 shrink-0 text-on-surface-light" strokeWidth={1.75} />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => void onKeyDown(e)}
                placeholder="Busca una zona, hábito o comando…"
                className="min-h-14 flex-1 bg-transparent text-body-lg text-on-background outline-none placeholder:text-on-surface-light focus-visible:outline-none"
              />
              {searching && <Spinner size="sm" />}
              <kbd className="hidden rounded-md border border-border bg-surface px-2 py-0.5 text-label-md text-on-surface-light sm:block">Esc</kbd>
            </div>

            <ul id={listId} role="listbox" aria-label="Resultados" className="min-h-0 flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <li className="px-4 py-10 text-center text-body-md text-on-surface-light" role="presentation">
                  Sin resultados para “{query}”
                </li>
              ) : (
                filtered.map((cmd, i) => {
                  const header = cmd.group !== lastGroup ? cmd.group : null;
                  lastGroup = cmd.group;
                  const Icon = cmd.icon;
                  const selected = i === active;
                  return (
                    <li key={cmd.id} role="presentation">
                      {header && <div role="presentation" className="px-3 pb-1 pt-3 text-label-md uppercase text-on-surface-light first:pt-1">{header}</div>}
                      <div
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => setActive(i)}
                        onClick={() => void execute(cmd)}
                        className={cn(
                          'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors',
                          selected ? 'bg-primary/[var(--lq-soft-alpha)]' : 'hover:bg-surface-variant',
                        )}
                      >
                        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px]', selected ? 'bg-background text-primary-text' : softTone.muted)}>
                          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-label-lg', selected ? 'text-primary-text' : 'text-on-background')}>{cmd.label}</span>
                          {cmd.sublabel && <span className="block truncate text-body-sm text-on-surface-light">{cmd.sublabel}</span>}
                        </span>
                        {selected && <CornerDownLeft aria-hidden className="size-4 shrink-0 text-primary-text" strokeWidth={1.75} />}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-body-sm text-on-surface-light sm:flex">
              <span>↑↓ navegar</span>
              <span>↵ ejecutar</span>
              <span className="ml-auto">Prueba “peso 79.5”</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
