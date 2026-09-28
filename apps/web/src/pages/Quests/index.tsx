import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ClipboardList,
  Filter,
  FolderKanban,
  ListChecks,
  ListTodo,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Quest } from '@lifequest/shared';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { QuestCard } from '../../components/quests/QuestCard';
import { QuestModal } from '../../components/quests/QuestModal';
import { QuestWizard } from '../../components/quests/QuestWizard';
import { SkeletonList } from '../../components/ui/Skeleton';
import { FlowButton } from '../../components/ui/flow-button';
import { useToastStore } from '../../hooks/useToast';
import { useDebounce } from '../../hooks/useDebounce';
import * as questService from '../../services/quest.service';
import { SageContextButton } from '../../components/sage/SageContextButton';

const TABS: ReadonlyArray<{ key: string; label: string; icon: LucideIcon }> = [
  { key: '', label: 'Todas', icon: ListTodo },
  { key: 'MAIN', label: 'Proyectos', icon: FolderKanban },
  { key: 'SIDE', label: 'Tareas', icon: ListChecks },
  { key: 'META', label: 'Metas', icon: Target },
  { key: 'COMPLETED', label: 'Completadas', icon: Check },
];

const CATEGORY_LABELS: Record<string, string> = {
  HEALTH: 'Salud', FITNESS: 'Fitness', FINANCE: 'Finanzas', LEARNING: 'Aprendizaje',
  LOVE: 'Amor', SOCIAL: 'Social', PERSONAL: 'Personal', CREATIVE: 'Creativo',
};

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: 'Fácil' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HARD', label: 'Difícil' },
  { value: 'EPIC', label: 'Épica' },
];

const SORT_OPTIONS = [
  { value: 'xp', label: 'Mayor XP' },
  { value: 'deadline', label: 'Fecha límite' },
  { value: 'difficulty', label: 'Dificultad' },
];

interface FilterOption {
  value: string;
  label: string;
}

interface FilterMenuProps {
  label: string;
  value: string;
  icon: LucideIcon;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** A dark, keyboard-friendly listbox that avoids the browser's native popup. */
function FilterMenu({ label, value, icon: Icon, options, onChange, className = '' }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border bg-[var(--bg-deep)] px-3 text-left text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${
          open ? 'border-[var(--accent-gold)]' : 'border-[var(--border)] hover:border-[var(--text-secondary)]'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <Icon size={15} strokeWidth={1.8} className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
          {value ? selected?.label ?? label : label}
        </span>
        <ChevronDown
          size={15}
          strokeWidth={1.8}
          className={`shrink-0 text-[var(--text-secondary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -3, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.6 }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-full overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-panel)] p-1 shadow-xl"
            style={{ transformOrigin: 'top right' }}
            role="listbox"
            aria-label={label}
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-panel-light)] ${
                !value ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'
              }`}
              onClick={() => { onChange(''); setOpen(false); }}
            >
              <span className="h-3.5 w-3.5">{!value && <Check size={14} strokeWidth={2} aria-hidden="true" />}</span>
              Todas
            </button>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[var(--bg-panel-light)] ${
                    active ? 'text-[var(--accent-gold)]' : 'text-[var(--text-primary)]'
                  }`}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                >
                  <span className="h-3.5 w-3.5">{active && <Check size={14} strokeWidth={2} aria-hidden="true" />}</span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function QuestsPage() {
  const { addFloatingXP, flashScreen, showAchievementToast, triggerLevelUp } = useUIStore();
  const toastError = useToastStore((state) => state.error);
  const [searchParams] = useSearchParams();

  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const filter = searchParams.get('filter');
    if (filter === 'meta') return 'META';
    return '';
  });
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [sortBy, setSortBy] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const loadQuests = useCallback(async () => {
    setLoading(true);
    try {
      const filters: questService.QuestFilters = {};
      if (activeTab && activeTab !== 'COMPLETED') filters.type = activeTab;
      if (activeTab === 'COMPLETED') filters.status = 'COMPLETED';
      if (filterCategory) filters.category = filterCategory;
      if (filterDifficulty) filters.difficulty = filterDifficulty;
      if (debouncedSearch) filters.search = debouncedSearch;
      if (sortBy) filters.sortBy = sortBy;

      const data = await questService.fetchQuests(filters);
      setQuests(data);
    } catch {
      toastError('Error cargando misiones');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterCategory, filterDifficulty, debouncedSearch, sortBy, toastError]);

  useEffect(() => {
    void loadQuests();
  }, [loadQuests]);

  async function handleComplete(quest: Quest, event?: ReactMouseEvent) {
    if (event) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      addFloatingXP(quest.xpReward, rect.left + rect.width / 2, rect.top);
    }

    setQuests((previous) => previous.map((item) => item.id === quest.id ? { ...item, status: 'COMPLETED' as const } : item));
    flashScreen('#a8871e');

    try {
      const result = await questService.completeQuest(quest.id);
      useAuthStore.getState().updateUser(result.user);

      if (result.rewards.leveledUp && result.rewards.newLevel) {
        triggerLevelUp({
          oldLevel: result.rewards.newLevel - 1,
          newLevel: result.rewards.newLevel,
          xpEarned: result.rewards.xpEarned,
          goldEarned: result.rewards.goldEarned,
          statIncreases: result.rewards.statIncreases ?? {},
        });
      }

      for (const achievement of result.achievementsUnlocked) showAchievementToast(achievement);
      await loadQuests();
    } catch {
      setQuests((previous) => previous.map((item) => item.id === quest.id ? { ...item, status: 'ACTIVE' as const } : item));
    }
  }

  async function handleWizardSubmit(formData: {
    type: string; title: string; description: string; category: string;
    difficulty: string; deadline: string; subObjectives: string[];
  }) {
    const payload = {
      type: formData.type as Quest['type'],
      title: formData.title,
      description: formData.description || undefined,
      category: formData.category as Quest['category'],
      difficulty: formData.difficulty as Quest['difficulty'],
      deadline: formData.deadline || undefined,
      subObjectives: formData.subObjectives.filter(Boolean).map((title, index) => ({ id: String(index + 1), title, completed: false })),
    };

    if (editingQuest) {
      setQuests((previous) => previous.map((item) => item.id === editingQuest.id ? { ...item, ...payload } : item));
      setShowWizard(false);
      setEditingQuest(null);
      try {
        await questService.updateQuest(editingQuest.id, payload);
      } catch {
        await loadQuests();
      }
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const tempQuest: Quest = {
      id: tempId,
      userId: '',
      ...payload,
      xpReward: 50,
      goldReward: 10,
      isRecurring: false,
      subObjectives: payload.subObjectives ?? [],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuests((previous) => [tempQuest, ...previous]);
    setShowWizard(false);
    setEditingQuest(null);
    try {
      await questService.createQuest(payload);
      await loadQuests();
    } catch {
      setQuests((previous) => previous.filter((item) => item.id !== tempId));
    }
  }

  async function handleArchive(quest: Quest) {
    setQuests((previous) => previous.filter((item) => item.id !== quest.id));
    try {
      await questService.archiveQuest(quest.id);
    } catch {
      await loadQuests();
    }
  }

  async function handleFail(quest: Quest) {
    setQuests((previous) => previous.map((item) => item.id === quest.id ? { ...item, status: 'FAILED' as const } : item));
    try {
      await questService.failQuest(quest.id);
    } catch {
      setQuests((previous) => previous.map((item) => item.id === quest.id ? { ...item, status: 'ACTIVE' as const } : item));
    }
  }

  function handleEdit(quest: Quest) {
    setEditingQuest(quest);
    setShowWizard(true);
  }

  function handleQuestUpdated(updated: Quest) {
    setQuests((previous) => previous.map((item) => item.id === updated.id ? updated : item));
    setSelectedQuest(updated);
  }

  function clearFilters() {
    setSearch('');
    setFilterCategory('');
    setFilterDifficulty('');
    setSortBy('');
  }

  const activeQuests = quests.filter((quest) => quest.status === 'ACTIVE');
  const completedQuests = quests.filter((quest) => quest.status === 'COMPLETED');
  const inactiveQuests = quests.filter((quest) => quest.status === 'FAILED' || quest.status === 'ARCHIVED');
  const displayQuests = activeTab === 'COMPLETED'
    ? completedQuests
    : activeTab
      ? quests
      : [...activeQuests, ...completedQuests.slice(0, 3), ...inactiveQuests];
  const hasFilters = Boolean(search || filterCategory || filterDifficulty || sortBy);
  const sectionTitle = activeTab === 'MAIN'
    ? 'Proyectos'
    : activeTab === 'SIDE'
      ? 'Tareas'
      : activeTab === 'META'
        ? 'Metas'
        : activeTab === 'COMPLETED'
          ? 'Completadas'
          : 'Misiones';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">
      <section className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-gold)]">
            <ClipboardList size={14} strokeWidth={1.9} aria-hidden="true" />
            Planificación
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">Misiones</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
            Proyectos, tareas y metas con plazo, dificultad y progreso en un solo lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SageContextButton message="¿Por dónde empiezo? Prioriza mis misiones activas según lo más urgente." label="Priorizar" />
          <FlowButton
            tone="primary"
            size="md"
            withArrows={false}
            onClick={() => { setEditingQuest(null); setShowWizard(true); }}
            className="gap-2"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Nueva misión
          </FlowButton>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-1.5">
        <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] last:col-span-2 sm:shrink-0 sm:last:col-auto ${
                  selected
                    ? 'bg-[var(--bg-panel-light)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)]'
                }`}
                aria-pressed={selected}
              >
                <Icon size={14} strokeWidth={selected ? 2 : 1.7} aria-hidden="true" className={selected ? 'text-[var(--accent-gold)]' : ''} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 transition-colors focus-within:border-[var(--accent-gold)]">
            <Search size={16} strokeWidth={1.8} className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar misiones"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              aria-label="Buscar misiones"
            />
          </label>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap lg:flex-nowrap">
            <FilterMenu
              label="Categoría"
              value={filterCategory}
              icon={Filter}
              options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={setFilterCategory}
              className="min-w-0 sm:min-w-36"
            />
            <FilterMenu
              label="Dificultad"
              value={filterDifficulty}
              icon={SlidersHorizontal}
              options={DIFFICULTY_OPTIONS}
              onChange={setFilterDifficulty}
              className="min-w-0 sm:min-w-32"
            />
            <FilterMenu
              label="Ordenar"
              value={sortBy}
              icon={ListChecks}
              options={SORT_OPTIONS}
              onChange={setSortBy}
              className="min-w-0 sm:min-w-32"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
              Limpiar
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{sectionTitle}</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {loading ? 'Cargando…' : `${displayQuests.length} ${displayQuests.length === 1 ? 'misión' : 'misiones'}`}
            </p>
          </div>
          {!loading && activeQuests.length > 0 && activeTab !== 'COMPLETED' && (
            <span className="rounded-full bg-[var(--accent-gold)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--accent-gold)]">
              {activeQuests.length} activas
            </span>
          )}
        </header>

        {loading ? (
          <div className="p-4"><SkeletonList count={4} /></div>
        ) : displayQuests.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--accent-gold)]">
              <ClipboardList size={20} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Aún no hay misiones aquí</h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              Crea una tarea, proyecto o meta para darle una fecha y seguir su avance.
            </p>
            <FlowButton
              tone="primary"
              size="sm"
              withArrows={false}
              onClick={() => { setEditingQuest(null); setShowWizard(true); }}
              className="mt-5 gap-1.5"
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Nueva misión
            </FlowButton>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div layout className="divide-y divide-[var(--border)]">
              {displayQuests.map((quest, index) => (
                <motion.div
                  key={quest.id}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{
                    type: 'spring',
                    stiffness: 360,
                    damping: 31,
                    mass: 0.65,
                    delay: Math.min(index * 0.035, 0.18),
                  }}
                >
                  <QuestCard quest={quest} onComplete={handleComplete} onClick={setSelectedQuest} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </section>

      <AnimatePresence>
        {selectedQuest && (
          <QuestModal
            quest={selectedQuest}
            onClose={() => setSelectedQuest(null)}
            onComplete={(quest) => { void handleComplete(quest); }}
            onEdit={handleEdit}
            onArchive={(quest) => { void handleArchive(quest); }}
            onFail={(quest) => { void handleFail(quest); }}
            onQuestUpdated={handleQuestUpdated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWizard && (
          <QuestWizard
            onSubmit={handleWizardSubmit}
            onClose={() => { setShowWizard(false); setEditingQuest(null); }}
            initialData={editingQuest ? {
              type: editingQuest.type,
              title: editingQuest.title,
              description: editingQuest.description ?? '',
              category: editingQuest.category,
              difficulty: editingQuest.difficulty,
              deadline: editingQuest.deadline?.split('T')[0] ?? '',
              subObjectives: (editingQuest.subObjectives as Array<{ title: string }>).map((sub) => sub.title),
            } : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
