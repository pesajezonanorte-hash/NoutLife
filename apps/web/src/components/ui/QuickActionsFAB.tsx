import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Plus, X, Swords, Wallet, Flame, NotebookPen, Zap, ChevronRight, type LucideIcon } from 'lucide-react';
import { createQuest } from '../../services/quest.service';
import { createTransaction } from '../../services/finance.service';
import { fetchHabits, logHabit } from '../../services/habit.service';
import { createJournalEntry } from '../../services/journal.service';
import { useUIStore } from '../../store/uiStore';
import { useToastStore } from '../../hooks/useToast';
import { refreshUser } from '../../hooks/useAuth';
import type { Habit } from '../../services/habit.service';
import { E } from '@/components/ui/glyphs';
import { Dock, DockIcon, DockItem, DockLabel } from './dock';
import { Slider } from './slider';

type ModalType = 'quest' | 'expense' | 'habit' | 'note' | 'checkin' | null;

const ACTIONS: { icon: LucideIcon; label: string; color: string; modal: Exclude<ModalType, null> }[] = [
  { icon: Swords,      label: 'Nueva misión',  color: '#a8871e', modal: 'quest' },
  { icon: Wallet,      label: 'Gasto rápido',  color: '#5c5c64', modal: 'expense' },
  { icon: Flame,       label: 'Marcar hábito', color: '#b5453a', modal: 'habit' },
  { icon: NotebookPen, label: 'Nota rápida',   color: '#8f8f98', modal: 'note' },
  { icon: Zap,         label: 'Check-in',      color: '#6b6b73', modal: 'checkin' },
];

function mobileActionsForPath(pathname: string) {
  if (pathname === '/quests' || pathname.startsWith('/quests/')) return [ACTIONS[0]];
  if (pathname === '/habits' || pathname.startsWith('/habits/')) return [ACTIONS[2]];
  if (pathname === '/finances' || pathname.startsWith('/finances/')) return [ACTIONS[1]];
  return [];
}

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isMobile;
}

// ── Quest Modal ──────────────────────────────────────────────────────────────
function QuestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'SIDE' | 'MAIN' | 'META'>('SIDE');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createQuest({ title, type, difficulty: 'EASY', category: 'PERSONAL', xpReward: type === 'META' ? 75 : 50, goldReward: 10 });
      useToastStore.getState().success('¡Misión creada!', 'El XP se gana al completarla');
      onDone();
    } catch { setSaving(false); }
  }

  return (
    <ModalShell title="Nueva misión" onClose={onClose}>
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder="Nombre de la misión..."
        className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]"
      />
      <div className="flex gap-1.5 mt-2">
        {(['SIDE', 'MAIN', 'META'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} className="min-h-11 flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-all"
            style={{ border: `1px solid ${type === t ? 'var(--accent-gold)' : 'var(--border)'}`, background: type === t ? 'color-mix(in oklab, var(--accent-gold) 12%, transparent)' : 'transparent', color: type === t ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
            {t === 'SIDE' ? <><E e="📜" s={11} /> Tarea</> : t === 'MAIN' ? <><E e="⚔️" s={11} /> Proyecto</> : <><E e="🎯" s={11} /> Meta</>}
          </button>
        ))}
      </div>
      <SaveButton onClick={handleSave} saving={saving} disabled={!title.trim()} />
    </ModalShell>
  );
}

// ── Expense Modal ────────────────────────────────────────────────────────────
function ExpenseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount || isNaN(Number(amount))) return;
    setSaving(true);
    try {
      await createTransaction({ type: 'EXPENSE', amount: Number(amount), category: 'OTHER', description: desc || undefined });
      useToastStore.getState().success('Gasto registrado');
      onDone();
    } catch { setSaving(false); }
  }

  return (
    <ModalShell title="Gasto Rápido" onClose={onClose}>
      <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)}
        placeholder="Monto" className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-green)]" />
      <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder="Descripción (opcional)" className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-green)]" />
      <SaveButton onClick={handleSave} saving={saving} disabled={!amount || isNaN(Number(amount))} color="var(--accent-green)" />
    </ModalShell>
  );
}

// ── Habit Modal ──────────────────────────────────────────────────────────────
function HabitModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const { addFloatingXP } = useUIStore();

  useEffect(() => {
    fetchHabits().then(h => setHabits(h.filter(h => !h.todayCompleted).slice(0, 5))).catch(() => null);
  }, []);

  async function handleLog(id: string) {
    setSaving(id);
    try {
      const r = await logHabit(id, 'completed');
      setHabits(prev => prev.filter(h => h.id !== id));
      // XP REAL que otorgó el backend (no un número inventado)
      addFloatingXP(r.rewards?.xpEarned ?? 0, window.innerWidth / 2, 200);
      void refreshUser();
      if (habits.length <= 1) onDone();
      else setSaving(null);
    } catch { setSaving(null); }
  }

  return (
    <ModalShell title="Marcar Hábito" onClose={onClose}>
      {habits.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>¡Todos tus hábitos del día están completos!</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {habits.map(h => (
            <motion.button key={h.id} whileTap={{ scale: 0.97 }} onClick={() => handleLog(h.id)}
              disabled={saving === h.id}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-left transition-all hover:border-[var(--accent-red)] disabled:opacity-50"
              style={{ background: 'var(--bg-panel-light)' }}>
              <span className="text-base"><E e={h.icon} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{h.title}</p>
                {h.currentStreak > 0 && <p className="text-[10px]" style={{ color: 'var(--accent-gold)' }}><E e="🔥" /> {h.currentStreak} días</p>}
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--accent-cyan)' }}>+{h.xpReward} XP</span>
            </motion.button>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

// ── Note Modal ───────────────────────────────────────────────────────────────
function NoteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await createJournalEntry({ content, title: content.slice(0, 40) });
      useToastStore.getState().success('Nota guardada');
      onDone();
    } catch { setSaving(false); }
  }

  return (
    <ModalShell title="Nota Rápida" onClose={onClose}>
      <textarea autoFocus value={content} onChange={e => setContent(e.target.value)} rows={3}
        placeholder="Escribe tu nota aquí..."
        className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--bg-deep)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-cyan)] resize-none" />
      <SaveButton onClick={handleSave} saving={saving} disabled={!content.trim()} color="var(--accent-cyan)" />
    </ModalShell>
  );
}

// ── Checkin Modal ────────────────────────────────────────────────────────────
function CheckinModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [saving, setSaving] = useState(false);
  const { addFloatingXP } = useUIStore();

  async function handleSave() {
    setSaving(true);
    try {
      const api = (await import('../../lib/api')).default;
      const res = await api.post('/checkin', { mood, energy });
      // Bonus diario REAL: +15 XP solo en el primer check-in del día
      const rewards = (res.data as { rewards?: { xpEarned?: number } | null })?.rewards;
      if (rewards && (rewards.xpEarned ?? 0) > 0) {
        addFloatingXP(rewards.xpEarned!, window.innerWidth / 2, 200);
        useToastStore.getState().success('Check-in registrado', `+${rewards.xpEarned} XP · ¡Bonus diario!`);
      } else {
        useToastStore.getState().success('Check-in actualizado', 'El bonus diario de hoy ya estaba reclamado');
      }
      void refreshUser();
      onDone();
    } catch { setSaving(false); }
  }

  const MOODS = ['😢', '😕', '😐', '🙂', '😄'];

  return (
    <ModalShell title="Check-in" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Estado de ánimo</p>
          <div className="flex justify-between gap-1">
            {MOODS.map((m, i) => (
              <button key={i} onClick={() => setMood(i + 1)} className="flex h-11 w-11 items-center justify-center text-xl transition-all"
                style={{ opacity: mood === i + 1 ? 1 : 0.35, transform: mood === i + 1 ? 'scale(1.25)' : 'scale(1)' }}>
                <E e={m} s={18} className="inline-block" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Energía: {energy}/10</p>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[energy]}
            onValueChange={([value]) => setEnergy(value)}
            accent="var(--accent-cyan)"
            aria-label="Nivel de energía"
          />
        </div>
        <SaveButton onClick={handleSave} saving={saving} color="var(--accent-purple)" label="Registrar check-in" />
      </div>
    </ModalShell>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const isMobile = useMobileViewport();

  return (
    <motion.section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      drag={isMobile && !shouldReduceMotion ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 180 }}
      dragElastic={{ top: 0, bottom: 0.14 }}
      dragSnapToOrigin
      onDragEnd={(_, info) => {
        if (window.innerWidth < 768 && (info.offset.y > 90 || info.velocity.y > 520)) onClose();
      }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
      transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.2, ease: 'easeOut', delay: 0.05 }}
      className="w-full max-h-[min(84dvh,46rem)] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-lg md:w-80 md:max-h-[calc(100dvh-2rem)] md:rounded-2xl md:p-4"
      onClick={e => e.stopPropagation()}
    >
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--border-strong)] md:hidden" aria-hidden="true" />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--text-primary)]">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Cerrar ${title}`}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] md:h-6 md:w-6 md:rounded-full"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {children}
    </motion.section>
  );
}

function SaveButton({ onClick, saving, disabled, color = 'var(--accent-gold)', label = 'Guardar' }: {
  onClick: () => void; saving: boolean; disabled?: boolean; color?: string; label?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled || saving}
      className="mt-3 min-h-11 w-full rounded-xl text-xs font-bold transition-all disabled:opacity-40"
      style={{ background: `${color}22`, border: `1px solid ${color}66`, color }}
    >
      {saving ? '...' : label}
    </motion.button>
  );
}

// ── Dock de acciones de escritorio ────────────────────────────────────────────
function DesktopQuickActionsDock({ onOpen }: { onOpen: (modal: ModalType) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 md:block">
      <div className="pointer-events-auto">
        <Dock
          containerClassName="w-fit max-w-[calc(100vw-2rem)]"
          className="gap-1 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-1.5 shadow-[var(--shadow-lg)]"
          panelHeight={52}
          maxHeight={98}
          magnification={78}
          distance={135}
          ariaLabel="Acciones rápidas"
        >
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <DockItem key={action.modal}>
                <DockLabel>{action.label}</DockLabel>
                <DockIcon className="aspect-square">
                  <button
                    type="button"
                    onClick={() => onOpen(action.modal)}
                    aria-label={action.label}
                    title={action.label}
                    className="flex h-full w-full items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
                    style={{
                      color: action.color,
                      borderColor: `color-mix(in oklab, ${action.color} 34%, var(--border))`,
                      background: `color-mix(in oklab, ${action.color} 13%, transparent)`,
                    }}
                  >
                    <Icon className="h-[78%] w-[78%]" strokeWidth={1.75} />
                  </button>
                </DockIcon>
              </DockItem>
            );
          })}
        </Dock>
      </div>
    </div>
  );
}

function MobileActionSheet({
  actions,
  onOpen,
  onClose,
}: {
  actions: typeof ACTIONS;
  onOpen: (modal: ModalType) => void;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      className="fixed inset-0 z-[150] md:hidden"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.18 }}
    >
      <button
        type="button"
        aria-label="Cerrar acciones rápidas"
        className="absolute inset-0 w-full bg-[var(--scrim)]"
        onClick={onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="Acciones rápidas"
        drag={shouldReduceMotion ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 220 }}
        dragElastic={{ top: 0, bottom: 0.16 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.y > 96 || info.velocity.y > 520) onClose();
        }}
        initial={shouldReduceMotion ? false : { y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 shadow-lg"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Acciones rápidas</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Registra el siguiente paso de tu aventura.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar acciones rápidas"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.modal}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onOpen(action.modal)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-left transition-colors hover:border-[var(--accent-gold)]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `color-mix(in oklab, ${action.color} 14%, transparent)`, color: action.color }}
                >
                  <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--text-primary)]">{action.label}</span>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              </motion.button>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}

// ── Main FAB ─────────────────────────────────────────────────────────────────
export function QuickActionsFAB({ mobileHidden = false }: { mobileHidden?: boolean }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const mobileActions = mobileActionsForPath(pathname);
  const showMobileFab = !mobileHidden && mobileActions.length > 0;

  useEffect(() => {
    setOpen(false);
    setActiveModal(null);
  }, [pathname]);

  useEffect(() => {
    if (!showMobileFab) setOpen(false);
  }, [showMobileFab]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveModal(null);
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  function openModal(modal: ModalType) {
    setOpen(false);
    setActiveModal(modal);
  }

  function onDone() {
    // Sin XP falso: crear quest/gasto/nota no otorga XP en LifeQuest (el XP se
    // gana completando). El feedback honesto lo dan los toasts de cada modal.
    setActiveModal(null);
  }

  return (
    <>
      <AnimatePresence>
        {activeModal && (
          <motion.div
            className="fixed inset-0 z-[160] flex items-end justify-center bg-[var(--scrim)] p-0 backdrop-blur-sm md:items-center md:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActiveModal(null)}
          >
            {activeModal === 'quest' && <QuestModal onClose={() => setActiveModal(null)} onDone={onDone} />}
            {activeModal === 'expense' && <ExpenseModal onClose={() => setActiveModal(null)} onDone={onDone} />}
            {activeModal === 'habit' && <HabitModal onClose={() => setActiveModal(null)} onDone={onDone} />}
            {activeModal === 'note' && <NoteModal onClose={() => setActiveModal(null)} onDone={onDone} />}
            {activeModal === 'checkin' && <CheckinModal onClose={() => setActiveModal(null)} onDone={onDone} />}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMobileFab && open && (
          <MobileActionSheet
            actions={mobileActions}
            onOpen={openModal}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showMobileFab && !open && !activeModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="fixed z-[120] md:hidden"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)',
              right: 'calc(env(safe-area-inset-right) + 0.75rem)',
            }}
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setOpen(true)}
              aria-label="Abrir acciones rápidas"
              className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--bg-deep)] shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)]"
            >
              <Plus size={24} aria-hidden="true" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <DesktopQuickActionsDock onOpen={openModal} />
    </>
  );
}
