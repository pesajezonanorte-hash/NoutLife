import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { logHabit } from '../../services/habit.service';
import { refreshUser } from '../../hooks/useAuth';
import { logBodyWeight } from '../../services/gym2.service';
import { E } from '@/components/ui/glyphs';

interface Cmd {
  id: string;
  label: string;
  sublabel?: string;
  icon: string;
  action: () => void;
  keywords: string[];
}

function useCommands(navigate: ReturnType<typeof useNavigate>) {
  const { addFloatingXP, flashScreen } = useUIStore();
  const [habits, setHabits] = useState<Array<{ id: string; title: string; todayCompleted?: boolean }>>([]);

  useEffect(() => {
    api.get('/habits').then((r: any) => {
      setHabits(r.data?.habits ?? r.data ?? []);
    }).catch(() => null);
  }, []);

  const STATIC: Cmd[] = [
    { id: 'nav-quests',   icon: '📜', label: 'Quests',        sublabel: 'Ir a mis misiones',   action: () => navigate('/quests'),   keywords: ['quest', 'mision', 'misión'] },
    { id: 'nav-gym',      icon: '🏋️', label: 'Coliseo',       sublabel: 'Ir al gym',            action: () => navigate('/gym'),      keywords: ['gym', 'coliseo', 'entrena'] },
    { id: 'nav-finances', icon: '💰', label: 'Bóveda',        sublabel: 'Ir a finanzas',        action: () => navigate('/finances'), keywords: ['finanzas', 'boveda', 'plata', 'dinero'] },
    { id: 'nav-food',     icon: '🍲', label: 'Posada',        sublabel: 'Ir a nutrición',       action: () => navigate('/food'),     keywords: ['comida', 'posada', 'nutricion', 'comer'] },
    { id: 'nav-sleep',    icon: '🌙', label: 'Torre del Sueño', sublabel: 'Ir a sueño',         action: () => navigate('/sleep'),    keywords: ['sueño', 'dormir', 'torre'] },
    { id: 'nav-love',     icon: '💖', label: 'Jardín',        sublabel: 'Ir a relaciones',      action: () => navigate('/love'),     keywords: ['amor', 'jardin', 'relacion'] },
    { id: 'nav-journal',  icon: '📔', label: 'Diario',        sublabel: 'Ir al diario',         action: () => navigate('/journal'),  keywords: ['diario', 'journal'] },
    { id: 'nav-agenda',   icon: '📅', label: 'Agenda',        sublabel: 'Ir a agenda',          action: () => navigate('/agenda'),   keywords: ['agenda', 'evento'] },
    { id: 'nav-learning', icon: '📚', label: 'Biblioteca',    sublabel: 'Ir a aprendizaje',     action: () => navigate('/learning'), keywords: ['aprendizaje', 'libro', 'biblioteca'] },
    { id: 'nav-sage',     icon: '🧙', label: 'El Sabio',      sublabel: 'Consultar al Sabio',   action: () => navigate('/'),         keywords: ['sabio', 'ia', 'consejo'] },
    { id: 'nav-stats',    icon: '📊', label: 'Stats',         sublabel: 'Ver estadísticas',     action: () => navigate('/stats'),    keywords: ['estadisticas', 'stats'] },
    { id: 'new-quest',    icon: '✨', label: 'Nueva Quest',   sublabel: 'Crear nueva misión',   action: () => navigate('/quests?new=1'), keywords: ['nueva', 'crear quest', 'agregar quest'] },
    { id: 'life-score',   icon: '⭐', label: 'Life Score',   sublabel: 'Ver puntuación global', action: () => navigate('/life'),     keywords: ['life score', 'puntuacion', 'global'] },
    // Fase 9
    { id: 'nav-goals',    icon: '🎯', label: 'Metas Maestras', sublabel: 'Grandes objetivos',   action: () => navigate('/goals'),    keywords: ['metas', 'goals', 'objetivo'] },
    { id: 'nav-rituals',  icon: '☀️', label: 'Rituales',     sublabel: 'Rutinas de vida',       action: () => navigate('/rituals'),  keywords: ['ritual', 'rutina', 'manana'] },
    { id: 'nav-glowup',   icon: '✨', label: 'El Espejo',    sublabel: 'Tu transformación',     action: () => navigate('/glow-up'),  keywords: ['espejo', 'transformacion', 'glow up'] },
    { id: 'nav-wisdom',   icon: '📖', label: 'Sabiduría',    sublabel: 'Biblioteca de cartas',  action: () => navigate('/wisdom'),   keywords: ['sabiduria', 'wisdom', 'frases', 'libro'] },
  ];

  const habitCmds: Cmd[] = habits
    .filter((h) => !(h as any).todayCompleted)
    .slice(0, 6)
    .map((h) => ({
      id: `habit-${h.id}`,
      icon: '✓',
      label: `Completar "${h.title}"`,
      sublabel: 'Marcar hábito como hecho',
      action: async () => {
        try {
          const r = await logHabit(h.id, 'completed');
          addFloatingXP(r.rewards?.xpEarned ?? 0, window.innerWidth / 2, 200);
          flashScreen('#4a825f');
          void refreshUser();
        } catch { /* */ }
      },
      keywords: ['completar', 'habito', h.title.toLowerCase()],
    }));

  return [...STATIC, ...habitCmds];
}

// Parse smart commands like "peso 79.5" or "gasto 50000 comida"
async function parseSmartCommand(input: string, navigate: ReturnType<typeof useNavigate>): Promise<boolean> {
  const trimmed = input.trim().toLowerCase();

  // "peso 79.5"
  const pesoMatch = trimmed.match(/^peso\s+([\d.]+)$/);
  if (pesoMatch) {
    const weight = parseFloat(pesoMatch[1]);
    await logBodyWeight(weight, new Date().toISOString().slice(0, 10));
    return true;
  }

  // "diario" → navigate to journal
  if (trimmed === 'diario') {
    navigate('/journal');
    return true;
  }

  return false;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [executing, setExecuting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands(navigate);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = query.length === 0
    ? commands.slice(0, 8)
    : commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.some((k) => k.includes(query.toLowerCase()))
      ).slice(0, 8);

  async function run(cmd: Cmd) {
    setExecuting(cmd.id);
    close();
    try { await cmd.action(); } catch { /* */ }
    setExecuting(null);
  }

  async function handleEnter() {
    if (filtered.length === 1) { await run(filtered[0]); return; }
    const smart = await parseSmartCommand(query, navigate);
    if (smart) { close(); return; }
    if (filtered.length > 0) await run(filtered[0]);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <motion.div
            className="relative z-10 w-full max-w-xl"
            initial={{ y: -20, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -10, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <div className="pixel-panel overflow-hidden" style={{ background: 'var(--bg-panel)' }}>
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                <span className="text-[var(--text-secondary)] text-lg">⌕</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
                  placeholder="Buscar o escribir un comando..."
                  className="flex-1 bg-transparent outline-none text-[var(--text-primary)] font-mono text-sm placeholder:text-[var(--text-muted)]"
                />
                <kbd className="text-xs text-[var(--text-muted)] bg-[var(--bg-deep)] px-2 py-0.5 rounded border border-[var(--border)]">ESC</kbd>
              </div>

              {/* Commands */}
              <div className="py-2 max-h-80 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-center text-[var(--text-muted)] text-sm py-8 font-mono">Sin resultados</p>
                ) : (
                  filtered.map((cmd, i) => (
                    <motion.button
                      key={cmd.id}
                      onClick={() => run(cmd)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-panel-light)] transition-colors text-left"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <span className="text-xl w-7 flex-shrink-0"><E e={cmd.icon} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] font-mono">{cmd.label}</p>
                        {cmd.sublabel && <p className="text-xs text-[var(--text-secondary)]">{cmd.sublabel}</p>}
                      </div>
                      {executing === cmd.id && (
                        <motion.div className="w-4 h-4 border-2 border-[var(--accent-gold)] border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity }} />
                      )}
                    </motion.button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span><kbd className="bg-[var(--bg-deep)] px-1.5 py-0.5 rounded border border-[var(--border)] mr-1">↵</kbd>Ejecutar</span>
                <span><kbd className="bg-[var(--bg-deep)] px-1.5 py-0.5 rounded border border-[var(--border)] mr-1">Ctrl+K</kbd>Abrir/cerrar</span>
                <span className="ml-auto">También: "peso 79.5" · "diario"</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
