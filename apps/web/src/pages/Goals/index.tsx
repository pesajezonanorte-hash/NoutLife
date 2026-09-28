import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, Sparkles, Trash2, CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2, Award } from 'lucide-react';
import { useToastStore } from '../../hooks/useToast';
import * as goalsService from '../../services/goals.service';
import type { MasterGoal } from '../../services/goals.service';
import { E } from '@/components/ui/glyphs';

const CATEGORIES = [
  { value: 'fitness',      label: 'Fitness',      emoji: '💪', color: 'var(--accent-pink)' },
  { value: 'finance',      label: 'Finanzas',     emoji: '💰', color: 'var(--accent-gold)' },
  { value: 'career',       label: 'Carrera',      emoji: '🚀', color: 'var(--accent-cyan)' },
  { value: 'personal',     label: 'Personal',     emoji: '🌱', color: 'var(--accent-green)' },
  { value: 'relationship', label: 'Relaciones',   emoji: '❤️', color: 'var(--accent-pink)' },
  { value: 'health',       label: 'Salud',        emoji: '🏥', color: 'var(--accent-green)' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'var(--accent-cyan)',
  ACHIEVED: 'var(--accent-gold)',
  PAUSED:   'var(--text-muted)',
};

function ProgressRing({ progress, size = 60, color }: { progress: number; size?: number; color: string }) {
  const radius = (size - 8) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
}

function GoalCard({ goal, onUpdate }: { goal: MasterGoal; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToastStore();
  const cat = CATEGORIES.find((c) => c.value === goal.category) ?? CATEGORIES[0];

  async function toggle(milestoneId: string) {
    setTogglingId(milestoneId);
    try {
      await goalsService.toggleMilestone(milestoneId);
      onUpdate();
    } catch {
      toast.error('Error al actualizar milestone');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la meta "${goal.title}"?`)) return;
    setDeleting(true);
    try {
      await goalsService.deleteGoal(goal.id);
      onUpdate();
    } catch {
      toast.error('Error al eliminar');
      setDeleting(false);
    }
  }

  const isAchieved = goal.status === 'ACHIEVED';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden"
      style={{ borderColor: isAchieved ? 'var(--accent-gold)' : undefined }}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <ProgressRing progress={goal.progress} color={cat.color} />
            <div className="absolute inset-0 flex items-center justify-center text-xl" style={{ transform: 'none' }}>
              <E e={goal.icon} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[var(--text-primary)] text-base leading-tight">{goal.title}</h3>
                  {isAchieved && <Award size={16} className="text-[var(--accent-gold)]" />}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: cat.color + '22', color: cat.color }}>
                    <E e={cat.emoji} /> {cat.label}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: STATUS_COLORS[goal.status] }}>
                    {goal.progress}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-light)] transition-colors"
                >
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>

            {goal.why && (
              <p className="mt-2 text-xs text-[var(--text-muted)] italic">
                "¿Por qué? {goal.why}"
              </p>
            )}

            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: cat.color }}
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-2">
                {goal.milestones.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-2">Sin milestones todavía</p>
                )}
                {goal.milestones.map((m) => (
                  <motion.button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    disabled={togglingId === m.id}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-panel-light)] transition-colors text-left"
                    whileTap={{ scale: 0.98 }}
                  >
                    {togglingId === m.id ? (
                      <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
                    ) : m.isCompleted ? (
                      <CheckCircle2 size={18} style={{ color: cat.color }} />
                    ) : (
                      <Circle size={18} className="text-[var(--text-muted)]" />
                    )}
                    <span className={`text-sm ${m.isCompleted ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                      {m.title}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function GoalWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const toast = useToastStore();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    icon: '🎯',
    targetDate: '',
    why: '',
  });
  const [createdGoalId, setCreatedGoalId] = useState<string | null>(null);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const goal = await goalsService.createGoal(form);
      setCreatedGoalId(goal.id);
      setStep(3);
    } catch {
      toast.error('Error al crear la meta');
    } finally {
      setLoading(false);
    }
  }

  async function handleAiBreakdown() {
    if (!createdGoalId) return;
    setAiLoading(true);
    try {
      const milestones = await goalsService.aiBreakdownGoal(createdGoalId);
      for (const m of milestones) {
        await goalsService.addMilestone(createdGoalId, m.title);
      }
      toast.success('¡El Sabio generó tus milestones!');
      onCreated();
      onClose();
    } catch {
      toast.warning('Error generando milestones — continúa sin ellos');
      onCreated();
      onClose();
    } finally {
      setAiLoading(false);
    }
  }

  const cat = CATEGORIES.find((c) => c.value === form.category) ?? CATEGORIES[0];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden shadow-2xl"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Target size={20} className="text-[var(--accent-gold)]" />
            <h2 className="text-lg font-bold">Nueva Meta Maestra</h2>
          </div>
          <div className="flex gap-1 mt-4">
            {[0, 1, 2].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-[var(--accent-gold)]' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block font-medium">¿Cuál es tu meta?</label>
                  <input
                    autoFocus
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                    placeholder="Ej: Correr una maratón completa"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && form.title && setStep(1)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block font-medium">Categoría</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                        className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 border transition-all ${form.category === c.value ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-gold)]/50'}`}
                      >
                        <span><E e={c.emoji} /></span> <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block font-medium">¿Por qué quieres esto? (El combustible)</label>
                  <textarea
                    autoFocus
                    rows={3}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors resize-none"
                    placeholder="El 'por qué' profundo que te moverá cuando no tengas ganas..."
                    value={form.why}
                    onChange={(e) => setForm((f) => ({ ...f, why: e.target.value }))}
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">Este campo es el más importante. Sé honesto.</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block font-medium">Fecha límite (opcional)</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                    value={form.targetDate}
                    onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block font-medium">Descripción (opcional)</label>
                  <textarea
                    autoFocus
                    rows={3}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors resize-none"
                    placeholder="Más detalles sobre lo que quieres lograr..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-4">
                  <h4 className="text-sm font-semibold mb-1 text-[var(--text-primary)]">Resumen de tu meta</h4>
                  <p className="text-base font-bold" style={{ color: cat.color }}><E e={cat.emoji} /> {form.title}</p>
                  {form.why && <p className="text-xs text-[var(--text-muted)] mt-1 italic">"{form.why}"</p>}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-4">
                <div className="text-5xl"><E e="🎯" /></div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">¡Meta creada!</h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  ¿Quieres que el Sabio genere los milestones para llegar a tu meta?
                </p>
                <button
                  onClick={handleAiBreakdown}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep)' }}
                >
                  {aiLoading ? (
                    <><Loader2 size={16} className="animate-spin" /> El Sabio está pensando...</>
                  ) : (
                    <><Sparkles size={16} /> Que el Sabio los genere</>
                  )}
                </button>
                <button
                  onClick={() => { onCreated(); onClose(); }}
                  className="w-full py-2 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Los agregaré yo mismo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step < 3 && (
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
              className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-panel-light)] transition-colors"
            >
              {step === 0 ? 'Cancelar' : 'Atrás'}
            </button>
            <button
              onClick={() => step < 2 ? setStep(s => s + 1) : handleCreate()}
              disabled={step === 0 && !form.title.trim() || loading}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep)' }}
            >
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : step === 2 ? 'Crear Meta' : 'Siguiente'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<MasterGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'ACHIEVED' | 'PAUSED'>('all');

  const load = useCallback(async () => {
    try {
      const data = await goalsService.listGoals();
      setGoals(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? goals : goals.filter((g) => g.status === filter);
  const stats = {
    active: goals.filter((g) => g.status === 'ACTIVE').length,
    achieved: goals.filter((g) => g.status === 'ACHIEVED').length,
    avgProgress: goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Target className="text-[var(--accent-gold)]" size={24} />
            Metas Maestras
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Los grandes objetivos que transforman tu vida</p>
        </div>
        <motion.button
          onClick={() => setShowWizard(true)}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep)' }}
        >
          <Plus size={16} /> Nueva Meta
        </motion.button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Activas', value: stats.active, color: 'var(--accent-cyan)' },
          { label: 'Logradas', value: stats.achieved, color: 'var(--accent-gold)' },
          { label: 'Progreso prom.', value: `${stats.avgProgress}%`, color: 'var(--accent-green)' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'ACTIVE', 'ACHIEVED', 'PAUSED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === f ? 'bg-[var(--accent-gold)] text-[var(--bg-deep)]' : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            {f === 'all' ? 'Todas' : f === 'ACTIVE' ? 'Activas' : f === 'ACHIEVED' ? 'Logradas' : 'En pausa'}
          </button>
        ))}
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 space-y-4"
        >
          <div className="text-6xl"><E e="🎯" /></div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Sin metas todavía</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
            Las Metas Maestras son los grandes objetivos de tu vida. No tareas — sueños con plan.
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{ background: 'var(--accent-gold)', color: 'var(--bg-deep)' }}
          >
            <Plus size={16} /> Crear mi primera meta
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onUpdate={load} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard */}
      <AnimatePresence>
        {showWizard && (
          <GoalWizard onClose={() => setShowWizard(false)} onCreated={load} />
        )}
      </AnimatePresence>
    </div>
  );
}
