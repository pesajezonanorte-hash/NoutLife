import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Coins,
  FolderKanban,
  ListChecks,
  ListTodo,
  Plus,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getOpenOrigin } from '@/lib/origin';
import { FlowButton } from '../ui/flow-button';
import { PixelInput } from '../ui/PixelInput';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './CategoryIcon';

const QUEST_TYPES: ReadonlyArray<{ key: string; icon: LucideIcon; label: string; desc: string; multiplier: number }> = [
  { key: 'MAIN', icon: FolderKanban, label: 'Proyecto', desc: 'Un objetivo importante con plazo y etapas.', multiplier: 10 },
  { key: 'SIDE', icon: ListTodo, label: 'Tarea', desc: 'Un pendiente concreto que puedes completar.', multiplier: 4 },
  { key: 'META', icon: Target, label: 'Meta', desc: 'Un objetivo a largo plazo que progresa por pasos.', multiplier: 8 },
];

const DIFFICULTIES = [
  { key: 'EASY', label: 'Fácil', color: 'var(--text-muted)', baseXp: 25 },
  { key: 'NORMAL', label: 'Normal', color: 'var(--text-secondary)', baseXp: 50 },
  { key: 'HARD', label: 'Difícil', color: 'var(--text-primary)', baseXp: 100 },
  { key: 'EPIC', label: 'Épica', color: 'var(--accent-gold)', baseXp: 250 },
] as const;

const CATEGORIES = ['HEALTH', 'FITNESS', 'FINANCE', 'LEARNING', 'LOVE', 'SOCIAL', 'PERSONAL', 'CREATIVE'] as const;

interface FormData {
  type: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  deadline: string;
  subObjectives: string[];
}

interface Props {
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
  initialData?: Partial<FormData>;
}

const modalSpring = { type: 'spring', stiffness: 380, damping: 31, mass: 0.72 } as const;

export function QuestWizard({ onSubmit, onClose, initialData }: Props) {
  const [step, setStep] = useState(0);
  const [origin] = useState(() => getOpenOrigin());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>({
    type: QUEST_TYPES.some((questType) => questType.key === initialData?.type) ? (initialData?.type ?? 'SIDE') : 'SIDE',
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    category: initialData?.category ?? 'PERSONAL',
    difficulty: initialData?.difficulty ?? 'NORMAL',
    deadline: initialData?.deadline ?? '',
    subObjectives: initialData?.subObjectives ?? [''],
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose]);

  function calcXp() {
    const typeInfo = QUEST_TYPES.find((questType) => questType.key === form.type);
    const difficulty = DIFFICULTIES.find((item) => item.key === form.difficulty);
    if (!typeInfo || !difficulty) return 0;
    return Math.floor(difficulty.baseXp * typeInfo.multiplier);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await onSubmit({ ...form, subObjectives: form.subObjectives.filter((objective) => objective.trim()) });
    } finally {
      setLoading(false);
    }
  }

  const xp = calcXp();
  const gold = Math.floor(xp * 0.2);
  const selectedType = QUEST_TYPES.find((questType) => questType.key === form.type) ?? QUEST_TYPES[1];
  const SelectedTypeIcon = selectedType.icon;
  const PreviewCategoryIcon = CATEGORY_ICONS[form.category] ?? ListChecks;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/65"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => { if (!loading) onClose(); }}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-wizard-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-2xl"
        initial={{ opacity: 0, y: 12, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 7, scale: 0.985 }}
        transition={modalSpring}
        style={{ transformOrigin: origin }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--accent-gold)]">
              {initialData?.title ? 'Edición' : 'Planificación'}
            </p>
            <h2 id="quest-wizard-title" className="text-base font-semibold text-[var(--text-primary)]">
              {initialData?.title ? 'Editar misión' : 'Nueva misión'}
            </h2>
            <ol className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
              {['Tipo', 'Detalles', 'Objetivos'].map((label, index) => (
                <li key={label} className={`inline-flex items-center gap-1 ${index === step ? 'font-semibold text-[var(--accent-gold)]' : index < step ? 'text-[var(--accent-green)]' : ''}`}>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">
                    {index < step ? <Check size={10} strokeWidth={2.2} aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </li>
              ))}
            </ol>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            <div className="min-w-0 flex-1 p-5">
              <AnimatePresence mode="wait" initial={false}>
                {step === 0 && (
                  <motion.div
                    key="type"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={modalSpring}
                    className="space-y-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-3">
                      {QUEST_TYPES.map((questType) => {
                        const Icon = questType.icon;
                        const selected = form.type === questType.key;
                        return (
                          <button
                            key={questType.key}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, type: questType.key }))}
                            className={`rounded-xl border p-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${
                              selected
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10'
                                : 'border-[var(--border)] hover:bg-[var(--bg-panel-light)]'
                            }`}
                          >
                            <span className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]' : 'bg-[var(--bg-panel-light)] text-[var(--text-secondary)]'}`}>
                              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                            </span>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{questType.label}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{questType.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5 text-xs leading-5 text-[var(--text-secondary)]">
                      Para acciones recurrentes usa Hábitos; las misiones están pensadas para pendientes, proyectos y metas con plazo.
                    </p>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={modalSpring}
                    className="space-y-4"
                  >
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Título</label>
                      <PixelInput
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="El nombre de tu misión"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Descripción <span className="font-normal text-[var(--text-muted)]">opcional</span></label>
                      <textarea
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Añade el contexto que necesitas recordar"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)]"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Categoría</label>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {CATEGORIES.map((category) => {
                          const Icon = CATEGORY_ICONS[category];
                          const selected = form.category === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, category }))}
                              className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${
                                selected ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-panel-light)]'
                              }`}
                            >
                              <Icon size={14} strokeWidth={1.8} aria-hidden="true" className={selected ? 'text-[var(--accent-gold)]' : ''} />
                              <span className="truncate">{CATEGORY_LABELS[category]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">Dificultad</label>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {DIFFICULTIES.map((difficulty) => {
                          const selected = form.difficulty === difficulty.key;
                          return (
                            <button
                              key={difficulty.key}
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, difficulty: difficulty.key }))}
                              className="rounded-lg border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
                              style={{
                                borderColor: selected ? difficulty.color : 'var(--border)',
                                color: selected ? difficulty.color : 'var(--text-secondary)',
                                backgroundColor: selected ? `color-mix(in oklab, ${difficulty.color} 10%, transparent)` : undefined,
                              }}
                            >
                              {difficulty.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Fecha límite <span className="font-normal text-[var(--text-muted)]">opcional</span></label>
                      <input
                        type="date"
                        value={form.deadline}
                        onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)]"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="objectives"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={modalSpring}
                    className="space-y-3"
                  >
                    <p className="text-sm leading-6 text-[var(--text-secondary)]">
                      Divide la misión en pasos pequeños. Cada objetivo marcado actualiza su progreso.
                    </p>
                    <div className="space-y-2">
                      {form.subObjectives.map((objective, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <PixelInput
                            value={objective}
                            onChange={(event) => {
                              const next = [...form.subObjectives];
                              next[index] = event.target.value;
                              setForm((current) => ({ ...current, subObjectives: next }));
                            }}
                            placeholder={`Objetivo ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, subObjectives: current.subObjectives.filter((_, itemIndex) => itemIndex !== index) }))}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
                            aria-label={`Eliminar objetivo ${index + 1}`}
                          >
                            <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {form.subObjectives.length < 10 && (
                      <FlowButton
                        tone="ghost"
                        size="sm"
                        fullWidth
                        withArrows={false}
                        onClick={() => setForm((current) => ({ ...current, subObjectives: [...current.subObjectives, ''] }))}
                        className="border-dashed"
                      >
                        <Plus size={14} strokeWidth={2} aria-hidden="true" />
                        Agregar objetivo
                      </FlowButton>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <aside className="border-t border-[var(--border)] bg-[var(--bg-panel-light)] p-5 md:w-52 md:border-l md:border-t-0">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Vista previa</p>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3">
                <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--accent-gold)]">
                  <PreviewCategoryIcon size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--text-primary)]">{form.title || 'Tu misión'}</p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className="font-medium text-[var(--accent-gold)]">+{xp} XP</span>
                  <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><Coins size={12} strokeWidth={1.8} aria-hidden="true" />{gold}</span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                  <SelectedTypeIcon size={12} strokeWidth={1.8} aria-hidden="true" />
                  {selectedType.label}
                </span>
              </div>
            </aside>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
          <FlowButton
            tone="ghost"
            size="sm"
            withArrows={false}
            onClick={step === 0 ? onClose : () => setStep((current) => current - 1)}
            disabled={loading}
          >
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </FlowButton>
          {step < 2 ? (
            <FlowButton
              tone="primary"
              size="sm"
              withArrows={false}
              onClick={() => setStep((current) => current + 1)}
              disabled={step === 1 && !form.title.trim()}
            >
              Continuar
            </FlowButton>
          ) : (
            <FlowButton
              tone="primary"
              size="sm"
              withArrows={false}
              onClick={() => { void handleSubmit(); }}
              disabled={loading || !form.title.trim()}
              className="gap-1.5"
            >
              <Check size={14} strokeWidth={2} aria-hidden="true" />
              {loading ? 'Guardando…' : initialData?.title ? 'Guardar cambios' : 'Crear misión'}
            </FlowButton>
          )}
        </footer>
      </motion.section>
    </motion.div>,
    document.body,
  );
}
