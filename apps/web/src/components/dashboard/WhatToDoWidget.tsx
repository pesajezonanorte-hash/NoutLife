import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronRight, ListTodo, Repeat2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface Priority {
  id: string;
  type: 'habit' | 'quest' | 'event';
  title: string;
  icon: string;
  xp: number;
  urgent: boolean;
  detail?: string;
}

interface TodayPriorities {
  quests: Priority[];
  habits: Priority[];
  events: Priority[];
}

const EMPTY_PRIORITIES: TodayPriorities = { quests: [], habits: [], events: [] };

const PRIORITY_SECTIONS = [
  {
    key: 'quests' as const,
    title: 'Misiones pendientes',
    description: 'Tareas, proyectos y metas con plazo o progreso.',
    route: '/quests',
    Icon: ListTodo,
    accent: 'var(--accent-gold)',
  },
  {
    key: 'habits' as const,
    title: 'Hábitos de hoy',
    description: 'Acciones recurrentes que construyen tu racha.',
    route: '/habits',
    Icon: Repeat2,
    accent: 'var(--accent-green)',
  },
  {
    key: 'events' as const,
    title: 'Agenda',
    description: 'Eventos puntuales de tu calendario.',
    route: '/agenda',
    Icon: CalendarDays,
    accent: 'var(--accent-blue)',
  },
] as const;

export function WhatToDoWidget() {
  const [priorities, setPriorities] = useState<TodayPriorities>(EMPTY_PRIORITIES);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<TodayPriorities>('/dashboard/priorities')
      .then((response) => setPriorities(response.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const total = priorities.quests.length + priorities.habits.length + priorities.events.length;
  if (loading || total === 0) return null;

  return (
    <section
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
      aria-labelledby="today-plan-title"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]">
              <ListTodo size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <h2 id="today-plan-title" className="text-sm font-bold text-[var(--text-primary)]">Plan de hoy</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Misiones, hábitos y agenda en espacios separados.
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-light)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {total} {total === 1 ? 'pendiente' : 'pendientes'}
        </span>
      </div>

      <div className="space-y-4">
        {PRIORITY_SECTIONS.map((section, sectionIndex) => {
          const items = priorities[section.key];
          if (items.length === 0) return null;
          const { Icon } = section;

          return (
            <div key={section.key} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)]/40 p-2.5">
              <button
                type="button"
                onClick={() => navigate(section.route)}
                className="mb-2 flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-[var(--bg-panel-light)]"
              >
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md" style={{ color: section.accent, background: `color-mix(in oklab, ${section.accent} 12%, transparent)` }}>
                  <Icon size={14} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[var(--text-primary)]">{section.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[var(--text-muted)]">{section.description}</span>
                </span>
                <ChevronRight size={15} className="mt-1 text-[var(--text-muted)]" aria-hidden="true" />
              </button>

              <div className="space-y-1.5">
                {items.map((priority, itemIndex) => (
                  <motion.button
                    key={`${priority.type}-${priority.id}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (sectionIndex * 0.08) + (itemIndex * 0.045) }}
                    whileTap={{ scale: 0.985 }}
                    type="button"
                    onClick={() => navigate(section.route)}
                    className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors"
                    style={{
                      background: priority.urgent
                        ? `color-mix(in oklab, ${section.accent} 10%, var(--bg-panel))`
                        : 'var(--bg-panel)',
                      borderColor: priority.urgent
                        ? `color-mix(in oklab, ${section.accent} 42%, var(--border))`
                        : 'var(--border)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: section.accent }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{priority.title}</span>
                      {priority.detail && (
                        <span className="mt-0.5 block text-xs" style={{ color: priority.urgent ? section.accent : 'var(--text-muted)' }}>
                          {priority.detail}
                        </span>
                      )}
                    </span>
                    {priority.xp > 0 && (
                      <span className="flex-shrink-0 text-xs font-bold text-[var(--accent-cyan)]">+{priority.xp} XP</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
