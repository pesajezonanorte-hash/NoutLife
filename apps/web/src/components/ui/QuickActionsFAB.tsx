import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOpenOrigin } from '@/lib/origin';
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
        className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--bg-deep)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)]"
      />
      <div className="flex gap-1.5 mt-2">
        {(['SIDE', 'MAIN', 'META'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
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
      await createTransaction({ type: 'EXPENSE', amount: Number(amount), category: 'Otros', description: desc || undefined });
      useToastStore.getState().success('Gasto registrado');
      onDone();
    } catch { setSaving(false); }
  }

  return (
    <ModalShell title="Gasto Rápido" onClose={onClose}>
      <input autoFocus type="number" value={amount} onChange={e => setAmount(e.target.value)}
        placeholder="Monto" className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--bg-deep)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-green)]" />
      <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder="Descripción (opcional)" className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--bg-deep)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-green)] mt-2" />
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
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] text-left transition-all hover:border-[var(--accent-red)] disabled:opacity-50"
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
              <button key={i} onClick={() => setMood(i + 1)} className="text-xl transition-all"
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay: 0.05 }}
      className="w-80 rounded-2xl shadow-2xl p-4"
      style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-full" style={{ color: 'var(--text-muted)', background: 'var(--bg-panel-light)' }}>
          <X size={12} />
        </button>
      </div>
      {children}
    </motion.div>
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
      className="w-full mt-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
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

// ── Main FAB ─────────────────────────────────────────────────────────────────
export function QuickActionsFAB() {
  const [open, setOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Cierra con Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setActiveModal(null); }
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
      {/* Modal overlay - centrado en pantalla */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', transformOrigin: getOpenOrigin() }}
            onClick={() => setActiveModal(null)}
          >
            <div onClick={e => e.stopPropagation()}>
              {activeModal === 'quest'   && <QuestModal   onClose={() => setActiveModal(null)} onDone={onDone} />}
              {activeModal === 'expense' && <ExpenseModal onClose={() => setActiveModal(null)} onDone={onDone} />}
              {activeModal === 'habit'   && <HabitModal   onClose={() => setActiveModal(null)} onDone={onDone} />}
              {activeModal === 'note'    && <NoteModal    onClose={() => setActiveModal(null)} onDone={onDone} />}
              {activeModal === 'checkin' && <CheckinModal onClose={() => setActiveModal(null)} onDone={onDone} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB container */}
      <div
        ref={fabRef}
        className="fixed z-50 md:hidden"
        style={{
          bottom: 'var(--fab-bottom, 1.5rem)',
          right: 'var(--fab-right, 1.25rem)',
        }}
      >
        {/* ── Menú desplegable: panel único y organizado ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute flex flex-col overflow-hidden rounded-2xl"
              style={{
                bottom: 'calc(100% + 12px)',
                right: 0,
                width: 224,
                maxWidth: 'calc(100vw - 2rem)',
                maxHeight: 'min(420px, calc(100vh - var(--fab-bottom, 1.5rem) - 5.5rem))',
                background: 'color-mix(in oklab, var(--bg-panel) 96%, transparent)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.38)',
                transformOrigin: 'bottom right',
              }}
            >
              {/* Cabecera del menú */}
              <div
                className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-widest flex-shrink-0"
                style={{ color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}
              >
                Acciones rápidas
              </div>

              {/* Lista de acciones */}
              <div className="flex flex-col gap-1 p-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {ACTIONS.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.modal}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28, delay: i * 0.025 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => openModal(action.modal)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left transition-colors"
                      style={{ background: 'transparent', border: 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${action.color}14`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `${action.color}1f`, color: action.color }}
                      >
                        <Icon size={16} strokeWidth={1.8} />
                      </span>
                      <span className="flex-1 truncate" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>
                        {action.label}
                      </span>
                      <ChevronRight size={14} strokeWidth={1.8} className="flex-shrink-0" style={{ color: 'var(--text-3)' }} />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Botón principal + ── */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
          aria-expanded={open}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl relative z-10"
          style={{
            background: open
              ? 'linear-gradient(135deg, #2a2a2e, #0a0a0a)'
              : 'linear-gradient(135deg, var(--accent-gold), var(--accent-cyan))',
            border: 'none',
            color: '#fff',
            boxShadow: open
              ? '0 8px 28px rgba(0,0,0,0.35)'
              : '0 8px 28px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,210,63,0.15)',
            transition: 'background 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <motion.div
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.2, type: 'spring', stiffness: 420, damping: 22 }}
          >
            <Plus size={24} />
          </motion.div>
        </motion.button>
      </div>

      <DesktopQuickActionsDock onOpen={openModal} />

      {/* CSS para posición responsive */}
      <style>{`
        @media (max-width: 767px) {
          :root {
            --fab-bottom: 5rem;
            --fab-right: 0.75rem;
          }
        }
        @media (min-width: 768px) {
          :root {
            --fab-bottom: 1.5rem;
            --fab-right: 1.25rem;
          }
        }
      `}</style>
    </>
  );
}
