import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Loader2, Trash2, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { useToastStore } from '../../hooks/useToast';
import api from '../../lib/api';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader-adapted';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoneQuest {
  id: string;
  title: string;
  status: string;
  xpReward: number;
  difficulty: string;
}

interface ZoneHabit {
  id: string;
  title: string;
  currentStreak: number;
  icon: string;
  xpReward: number;
}

interface CustomZone {
  id: string;
  name: string;
  description?: string;
  icon: string;
  accentColor: string;
  isMeasurable: boolean;
  measureMetric?: string;
  weeklyXpGoal?: number;
  sections?: { type: string; title: string; description: string }[];
  actions?: { label: string; type: string }[];
  content: unknown[];
  quests: ZoneQuest[];
  habits: ZoneHabit[];
}

interface AISuggestion {
  name: string;
  description: string;
  icon: string;
  color: string;
  isMeasurable: boolean;
  measureReason: string;
  sections: { type: string; title: string; description: string }[];
  habits: { title: string; frequency: string }[];
  actions: { label: string; type: string }[];
}

const COLOR_PALETTE = [
  '#2a2a2e', '#5c5c64', '#8a8a92', '#c0c0c8',
  '#a8871e', '#4a825f', '#b5453a', '#d9b44a',
];

const DIFFICULTY_LABELS: Record<string, string> = { EASY: 'Fácil', NORMAL: 'Normal', HARD: 'Difícil' };
const DIFFICULTY_COLORS: Record<string, string> = { EASY: 'var(--text-muted)', NORMAL: 'var(--text-secondary)', HARD: 'var(--text-primary)' };

const ZONE_ICON_KEYS = ['target', 'book', 'brain', 'money', 'heart', 'leaf', 'music', 'star', 'gym', 'notes', 'code', 'moon'];

// Detect if an action type creates a habit or quest
function actionCreatesHabit(type: string) {
  return type === 'new_habit' || type.includes('habit') || type.includes('habito') || type.includes('habito') || type.includes('rutina');
}

function actionCategory(type: string): string {
  if (type.includes('lesson') || type.includes('leccion') || type.includes('lección') || type.includes('study') || type.includes('estudio')) return 'LEARNING';
  return 'PERSONAL';
}

// ─── Inline Action Form ───────────────────────────────────────────────────────

function ActionForm({
  action,
  zone,
  onDone,
  onClose,
}: {
  action: { label: string; type: string };
  zone: CustomZone;
  onDone: () => void;
  onClose: () => void;
}) {
  const toast = useToastStore();
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD'>('NORMAL');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHabit = actionCreatesHabit(action.type);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (isHabit) {
        await api.post(`/custom-zones/${zone.id}/habits`, { title: title.trim() });
        toast.success('¡Hábito creado en la zona!');
      } else {
        await api.post(`/custom-zones/${zone.id}/quests`, {
          title: title.trim(),
          type: 'SIDE',
          difficulty,
          category: actionCategory(action.type),
        });
        toast.success('¡Misión creada en la zona!');
      }
      setTitle('');
      onDone();
    } catch {
      toast.error('Error al crear. Intenta de nuevo.');
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div
        className="mt-2 rounded-xl p-3 space-y-2"
        style={{ background: `${zone.accentColor}10`, border: `1px solid ${zone.accentColor}30` }}
      >
        <p className="text-xs font-semibold" style={{ color: zone.accentColor }}>
          {isHabit ? <><E e="🔥" s={11} /> Nuevo hábito</> : `+ ${action.label}`}
        </p>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
          placeholder={isHabit ? 'Nombre del hábito...' : 'Nombre de la misión...'}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--bg-panel)',
            border: `1px solid ${zone.accentColor}40`,
            color: 'var(--text)',
          }}
        />
        {!isHabit && (
          <div className="flex gap-1.5">
            {(['EASY', 'NORMAL', 'HARD'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="flex-1 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: difficulty === d ? `${DIFFICULTY_COLORS[d]}22` : 'var(--bg-soft)',
                  border: `1px solid ${difficulty === d ? DIFFICULTY_COLORS[d] : 'var(--border)'}`,
                  color: difficulty === d ? DIFFICULTY_COLORS[d] : 'var(--text-muted)',
                }}
              >
                <E e={DIFFICULTY_LABELS[d]} />
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: zone.accentColor, color: '#fff' }}
          >
            {saving ? '...' : 'Crear'}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--bg-soft)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Zone Card ────────────────────────────────────────────────────────────────

function ZoneCard({ zone: initialZone, onDelete }: { zone: CustomZone; onDelete: () => void }) {
  const [zone, setZone] = useState(initialZone);
  const [expanded, setExpanded] = useState(true);
  const [activeAction, setActiveAction] = useState<{ label: string; type: string } | null>(null);
  const [completingQuest, setCompletingQuest] = useState<string | null>(null);
  const toast = useToastStore();

  // Keep zone in sync if parent updates
  useEffect(() => { setZone(initialZone); }, [initialZone]);

  async function refreshZone() {
    try {
      const { data } = await api.get<CustomZone>(`/custom-zones/${zone.id}`);
      setZone(data);
    } catch { /* silent */ }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la zona "${zone.name}"?`)) return;
    try {
      await api.delete(`/custom-zones/${zone.id}`);
      toast.success('Zona eliminada');
      onDelete();
    } catch { toast.error('Error eliminando zona'); }
  }

  async function handleCompleteQuest(questId: string) {
    setCompletingQuest(questId);
    try {
      await api.post(`/quests/${questId}/complete`);
      toast.success('¡Misión completada! ');
      await refreshZone();
    } catch { toast.error('Error completando misión'); }
    finally { setCompletingQuest(null); }
  }

  function toggleAction(a: { label: string; type: string }) {
    setActiveAction(prev => (prev?.type === a.type && prev?.label === a.label) ? null : a);
  }

  const hasContent = zone.quests.length > 0 || zone.habits.length > 0;

  return (
    <PixelPanel className="overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1 w-full" style={{ background: zone.accentColor }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-3 flex-1 text-left"
            onClick={() => setExpanded(v => !v)}
          >
            <span style={{ fontSize: 22 }}><E e={zone.icon} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm truncate">{zone.name}</p>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: `${zone.accentColor}20`, color: zone.accentColor }}
                >
                  {zone.quests.length}M · {zone.habits.length}H
                </span>
              </div>
              {zone.description && (
                <p className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{zone.description}</p>
              )}
            </div>
            {expanded
              ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              : <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            }
          </button>
          <button
            onClick={handleDelete}
            className="ml-2 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Eliminar zona"
          >
            <Trash2 size={14} />
          </button>
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
              <div className="pt-3 space-y-3">

                {/* Quick action buttons — always show base buttons + any custom ones */}
                {(() => {
                  const defaultActions: { label: string; type: string }[] = [
                    { label: 'Nueva misión', type: 'new_quest' },
                    { label: 'Nuevo hábito', type: 'new_habit' },
                  ];
                  const customActions = (zone.actions ?? []).filter(
                    a => a.type !== 'new_quest' && a.type !== 'new_habit'
                  );
                  const allActions = [...defaultActions, ...customActions];
                  return (
                    <div className="flex gap-2 flex-wrap">
                      {allActions.map((a, i) => (
                        <button
                          key={i}
                          onClick={() => toggleAction(a)}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                          style={{
                            background: activeAction?.label === a.label
                              ? zone.accentColor
                              : `${zone.accentColor}20`,
                            color: activeAction?.label === a.label ? '#fff' : zone.accentColor,
                            border: `1px solid ${zone.accentColor}50`,
                          }}
                        >
                          {activeAction?.label === a.label ? <><E e="✕" s={11} /> Cancelar</> : `+ ${a.label}`}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Inline creation form */}
                <AnimatePresence>
                  {activeAction && (
                    <ActionForm
                      key={activeAction.type + activeAction.label}
                      action={activeAction}
                      zone={zone}
                      onDone={async () => { setActiveAction(null); await refreshZone(); }}
                      onClose={() => setActiveAction(null)}
                    />
                  )}
                </AnimatePresence>

                {/* Quests list */}
                {zone.quests.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <E e="⚔" /> Misiones ({zone.quests.length})
                    </p>
                    <div className="space-y-1">
                      {zone.quests.map(q => (
                        <div
                          key={q.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg group"
                          style={{ background: 'var(--bg-soft)' }}
                        >
                          <button
                            onClick={() => handleCompleteQuest(q.id)}
                            disabled={completingQuest === q.id}
                            className="flex-shrink-0 transition-all"
                            title="Completar misión"
                          >
                            {completingQuest === q.id
                              ? <Loader2 size={15} className="animate-spin" style={{ color: zone.accentColor }} />
                              : <Circle size={15} style={{ color: zone.accentColor }} className="hover:opacity-70" />
                            }
                          </button>
                          <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{q.title}</span>
                          <span
                            className="text-[10px] font-medium flex-shrink-0"
                            style={{ color: DIFFICULTY_COLORS[q.difficulty] ?? 'var(--text-muted)' }}
                          >
                            <E e={DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty} />
                          </span>
                          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--accent-cyan)' }}>
                            +{q.xpReward}xp
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Habits list */}
                {zone.habits.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <E e="🔥" /> Hábitos ({zone.habits.length})
                    </p>
                    <div className="space-y-1">
                      {zone.habits.map(h => (
                        <div
                          key={h.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                          style={{ background: 'var(--bg-soft)' }}
                        >
                          <span className="flex-shrink-0"><E e={h.icon} /></span>
                          <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>{h.title}</span>
                          {h.currentStreak > 0 && (
                            <span
                              className="text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                              style={{ background: 'color-mix(in oklab, var(--accent-gold) 15%, transparent)', color: 'var(--accent-gold)' }}
                            >
                              <E e="🔥" /> {h.currentStreak}d
                            </span>
                          )}
                          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--accent-cyan)' }}>
                            +{h.xpReward}xp
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!hasContent && !activeAction && (
                  <p className="text-xs py-1" style={{ color: 'var(--text-muted)' }}>
                    Usa los botones de arriba para añadir misiones o hábitos a esta zona.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PixelPanel>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

function ZoneWizard({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const toast = useToastStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [editedColor, setEditedColor] = useState('#5c5c64');
  const [editedIcon, setEditedIcon] = useState('target');
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAsk() {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/custom-zones/suggest', { description });
      setSuggestion(data);
      setEditedColor(data.color ?? '#5c5c64');
      setEditedIcon(data.icon ?? 'target');
      setIsMeasurable(data.isMeasurable ?? false);
      setStep(2);
    } catch {
      toast.error('Error generando sugerencia. Intenta de nuevo.');
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!suggestion) return;
    setSaving(true);
    try {
      await api.post('/custom-zones', {
        name: suggestion.name,
        description: suggestion.description,
        icon: editedIcon,
        accentColor: editedColor,
        isMeasurable,
        sections: suggestion.sections,
        actions: suggestion.actions,
      });
      toast.success(`¡Zona "${suggestion.name}" creada!`);
      onCreated();
    } catch {
      toast.error('Error creando zona');
    } finally { setSaving(false); }
  }

  return (
    <PixelPanel className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} style={{ color: 'var(--primary)' }} />
        <h2 className="font-semibold text-sm">
          {step === 1 ? 'El Sabio construye tu zona' : 'Revisa y ajusta'}
        </h2>
      </div>

      {step === 1 && (
        <>
          <textarea
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}
            rows={4}
            placeholder="Ej: Quiero organizar mis clases de inglés, tener mis notas de vocabulario, repasar el material..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAsk(); }}
          />
          <div className="flex gap-2">
            <PixelButton variant="primary" onClick={handleAsk} disabled={loading || !description.trim()}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generando...</> : 'El Sabio construye mi zona →'}
            </PixelButton>
            <PixelButton variant="secondary" onClick={onCancel}>Cancelar</PixelButton>
          </div>
        </>
      )}

      {step === 2 && suggestion && (
        <>
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: `${editedColor}18`, border: `1px solid ${editedColor}40` }}>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center"><E e={editedIcon} s={28} /></span>
              <div>
                <p className="font-bold">{suggestion.name}</p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>{suggestion.description}</p>
              </div>
            </div>
            {suggestion.sections?.map((s, i) => (
              <div key={i} className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--bg-panel)' }}>
                <span className="font-semibold">{s.title}</span>
                <span style={{ color: 'var(--text-2)' }}> — {s.description}</span>
              </div>
            ))}
            {suggestion.actions?.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-1">
                {suggestion.actions.map((a, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: `${editedColor}25`, color: editedColor }}>
                    + {a.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Ícono</p>
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Ícono de la zona">
              {ZONE_ICON_KEYS.map((iconKey) => (
                <button
                  key={iconKey}
                  type="button"
                  title={iconKey}
                  aria-label={`Elegir ícono ${iconKey}`}
                  aria-pressed={editedIcon === iconKey}
                  onClick={() => setEditedIcon(iconKey)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                  style={{
                    background: editedIcon === iconKey ? `${editedColor}20` : 'var(--bg-soft)',
                    border: `1px solid ${editedIcon === iconKey ? editedColor : 'var(--border)'}`,
                    color: editedIcon === iconKey ? editedColor : 'var(--text-2)',
                  }}
                >
                  <E e={iconKey} s={16} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Color de la zona</p>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PALETTE.map(c => (
                <button key={c} onClick={() => setEditedColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, background: c,
                    border: editedColor === c ? '2px solid white' : '2px solid transparent',
                    boxShadow: editedColor === c ? `0 0 0 2px ${c}` : 'none',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 rounded-lg px-3"
            style={{ background: 'var(--bg-soft)' }}>
            <div>
              <p className="text-sm font-medium">¿Contar en tu Life Score?</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{suggestion.measureReason}</p>
            </div>
            <button onClick={() => setIsMeasurable(v => !v)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: isMeasurable ? editedColor : 'var(--border)' }}>
              <motion.div
                animate={{ x: isMeasurable ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
              />
            </button>
          </div>

          <div className="flex gap-2">
            <PixelButton variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creando...' : 'Crear mi zona →'}
            </PixelButton>
            <PixelButton variant="secondary" onClick={() => setStep(1)}>Atrás</PixelButton>
          </div>
        </>
      )}
    </PixelPanel>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomZonesPage() {
  const toast = useToastStore();
  const [zones, setZones] = useState<CustomZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<CustomZone[]>('/custom-zones');
      setZones(data);
    } catch { toast.error('Error cargando zonas'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-[var(--accent-gold)]" style={{ fontSize: '14px' }}>
            <E e="target" /> MIS ZONAS
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Zonas personalizadas creadas con El Sabio · {zones.length}/10 activas
          </p>
        </div>
        {!showWizard && zones.length < 10 && (
          <PixelButton variant="primary" onClick={() => setShowWizard(true)}>
            <Plus size={14} /> Nueva zona
          </PixelButton>
        )}
      </div>

      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <ZoneWizard
              onCreated={() => { setShowWizard(false); load(); }}
              onCancel={() => setShowWizard(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <LoadingGate loading={loading} fallback={<ModernLoader variant="compact" words={LOADING_COPY.customZones} />}>
        {loading ? null : zones.length === 0 ? (
        <PixelPanel className="p-10 text-center">
          <p className="text-4xl mb-3"><E e="🏰" /></p>
          <p className="font-pixel text-[var(--text-2)]" style={{ fontSize: '10px' }}>SIN ZONAS PERSONALIZADAS</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            El Sabio puede construir una zona personalizada a partir de tu descripción
          </p>
          <div className="mt-4">
            <PixelButton variant="primary" onClick={() => setShowWizard(true)}>
              <Sparkles size={14} /> Crear primera zona
            </PixelButton>
          </div>
        </PixelPanel>
      ) : (
        <div className="space-y-3">
          {zones.map(z => (
            <motion.div key={z.id} layout>
              <ZoneCard zone={z} onDelete={load} />
            </motion.div>
          ))}
        </div>
        )}
      </LoadingGate>
    </div>
  );
}
