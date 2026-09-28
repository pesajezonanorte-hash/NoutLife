import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, TrendingUp } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../hooks/useToast';
import { refreshUser } from '../../hooks/useAuth';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { ModalFrame } from '../../components/ui/ModalFrame';
import type { LearningItem, LearningStats } from '@lifequest/shared';
import * as learningService from '../../services/learning.service';
import { PomodoroTimer, NotesPanel, VocabPanel } from '../../components/learning/LearningExtras';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader-adapted';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const TYPE_ICONS: Record<string, string> = { BOOK: '📖', COURSE: '💻', PODCAST: '🎙️', VIDEO: '🎥', LANGUAGE: '🗣️' };
const STATUS_LABELS: Record<string, string> = { NOT_STARTED: 'Por empezar', IN_PROGRESS: 'En progreso', COMPLETED: 'Completado', ABANDONED: 'Abandonado' };
const STATUS_COLORS: Record<string, string> = { NOT_STARTED: 'text-text-secondary', IN_PROGRESS: 'text-accent-gold', COMPLETED: 'text-accent-green', ABANDONED: 'text-accent-red' };

function AddItemModal({ onClose, onSave }: { onClose: () => void; onSave: (item: LearningItem) => void }) {
  const [type, setType] = useState('BOOK');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalProgress, setTotalProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const inputClass = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]';

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const item = await learningService.createLearning({
        type,
        title,
        author: author || undefined,
        totalProgress: totalProgress ? Number(totalProgress) : 0,
      });
      onSave(item);
      toast.success('¡Ítem agregado!');
    } catch {
      toast.error('Error al agregar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      title="Agregar a tu biblioteca"
      description="Elige el formato y guarda algo que quieras estudiar, leer o escuchar."
      icon={<BookOpen className="h-4 w-4" aria-hidden="true" />}
      onClose={onClose}
      footer={(
        <div className="grid grid-cols-2 gap-2.5">
          <PixelButton variant="ghost" onClick={onClose} className="w-full">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={save} disabled={!title.trim() || saving} className="w-full">
            {saving ? 'Agregando…' : 'Agregar'}
          </PixelButton>
        </div>
      )}
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Formato</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(TYPE_ICONS).map(([key, icon]) => {
              const selected = type === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  aria-pressed={selected}
                  className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium transition-colors ${
                    selected
                      ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--text-primary)]'
                      : 'border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span aria-hidden="true">{icon}</span>
                  <span className="truncate">{key === 'LANGUAGE' ? 'Idioma' : key === 'COURSE' ? 'Curso' : key === 'PODCAST' ? 'Podcast' : key === 'VIDEO' ? 'Video' : 'Libro'}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Título</span>
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void save()}
            placeholder="Ej. Hábitos atómicos"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Autor o plataforma <span className="font-normal text-[var(--text-muted)]">(opcional)</span></span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="Ej. James Clear o Coursera"
            className={inputClass}
          />
        </label>

        {type === 'BOOK' && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Total de páginas <span className="font-normal text-[var(--text-muted)]">(opcional)</span></span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={totalProgress}
              onChange={(event) => setTotalProgress(event.target.value)}
              placeholder="Ej. 320"
              className={inputClass}
            />
          </label>
        )}
      </div>
    </ModalFrame>
  );
}

function ProgressModal({ item, onClose, onUpdate }: { item: LearningItem; onClose: () => void; onUpdate: (item: LearningItem) => void }) {
  const [progress, setProgress] = useState(String(item.currentProgress));
  const [status, setStatus] = useState(item.status);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { addFloatingXP } = useUIStore();
  const inputClass = 'w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]';

  async function save() {
    setSaving(true);
    try {
      const result = await learningService.updateLearning(item.id, { currentProgress: Number(progress), status });
      onUpdate(result.item);
      if (result.rewards && (result.rewards as { xpGained: number }).xpGained) {
        addFloatingXP((result.rewards as { xpGained: number }).xpGained, window.innerWidth / 2, 200);
        toast.success('¡Ítem completado!', `+${(result.rewards as { xpGained: number }).xpGained} XP`);
        void refreshUser();
      }
      onClose();
    } catch {
      toast.error('Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  const pct = item.totalProgress > 0 ? Math.min((Number(progress) / item.totalProgress) * 100, 100) : 0;

  return (
    <ModalFrame
      title="Actualizar progreso"
      description={item.title}
      icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
      onClose={onClose}
      footer={(
        <div className="grid grid-cols-2 gap-2.5">
          <PixelButton variant="ghost" onClick={onClose} className="w-full">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={save} disabled={saving} className="w-full">
            {saving ? 'Guardando…' : 'Guardar'}
          </PixelButton>
        </div>
      )}
    >
      <div className="space-y-5">
        {item.totalProgress > 0 && (
          <div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Progreso actual de {item.totalProgress}</span>
              <input
                type="number"
                min="0"
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
                placeholder="Página actual"
                className={inputClass}
              />
            </label>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <motion.div className="h-full rounded-full bg-[var(--accent-gold)]" animate={{ width: `${pct}%` }} transition={{ duration: 0.35 }} />
            </div>
            <p className="mt-1.5 text-right text-xs font-medium tabular-nums text-[var(--accent-gold)]">{Math.round(pct)}%</p>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Estado</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as LearningItem['status'])} className={inputClass}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>
    </ModalFrame>
  );
}

export default function LearningPage() {
  const toast = useToast();
  const [items, setItems] = useState<LearningItem[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [updating, setUpdating] = useState<LearningItem | null>(null);
  const [filter, setFilter] = useState<string>('IN_PROGRESS');
  const [tab, setTab] = useState<'biblioteca' | 'pomodoro' | 'detalle'>('biblioteca');
  const [selectedItem, setSelectedItem] = useState<LearningItem | null>(null);
  const [detailTab, setDetailTab] = useState<'notas' | 'vocab'>('notas');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [it, st] = await Promise.all([learningService.fetchLearning(), learningService.fetchLearningStats()]);
      setItems(it);
      setStats(st);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter ? items.filter(i => i.status === filter) : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="📚" /> LA BIBLIOTECA</h1>
          <p className="font-vt text-text-secondary text-base">Conocimiento es poder</p>
        </div>
        <div className="flex items-center gap-2">
          <SageContextButton message="¿Qué debería estudiar o leer ahora dado lo que llevo en la Biblioteca?" label="Pídele recomendación al Sabio" />
          <PixelButton variant="primary" onClick={() => setShowAdd(true)}>+ AGREGAR</PixelButton>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1">
        {([['biblioteca', ' Biblioteca'], ['pomodoro', ' Pomodoro']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSelectedItem(null); }}
            className={`flex-shrink-0 px-3 py-1.5 border-2 font-pixel transition-all ${tab === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary hover:border-text-secondary'}`}
            style={{ fontSize: '8px' }}
          >
            {label}
          </button>
        ))}
        {selectedItem && (
          <button
            onClick={() => setTab('detalle')}
            className={`flex-shrink-0 px-3 py-1.5 border-2 font-pixel transition-all ${tab === 'detalle' ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary'}`}
            style={{ fontSize: '8px' }}
          >
            <E e="📖" /> {selectedItem.title.slice(0, 15)}...
          </button>
        )}
      </div>

      {tab === 'pomodoro' && <PomodoroTimer />}

      {tab === 'detalle' && selectedItem && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setTab('biblioteca')} className="font-pixel text-text-secondary hover:text-accent-gold transition-colors" style={{ fontSize: '8px' }}>← VOLVER</button>
            <p className="font-vt text-text-primary text-lg">{selectedItem.title}</p>
          </div>
          <div className="flex gap-1">
            {(['notas', 'vocab'] as const).map(dt => (
              <button
                key={dt}
                onClick={() => setDetailTab(dt)}
                className={`px-3 py-1.5 border-2 font-pixel transition-all ${detailTab === dt ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary'}`}
                style={{ fontSize: '8px' }}
              >
                {dt === 'notas' ? ' Notas' : ' Vocabulario'}
              </button>
            ))}
          </div>
          {detailTab === 'notas' ? <NotesPanel itemId={selectedItem.id} /> : <VocabPanel itemId={selectedItem.id} />}
        </div>
      )}

      {tab !== 'biblioteca' ? null : <>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'EN PROGRESO', value: stats.inProgress, icon: '📖' },
            { label: 'COMPLETADOS', value: stats.totalCompleted, icon: '✅' },
            { label: 'ESTE AÑO', value: stats.completedThisYear, icon: '🏆' },
            { label: 'PÁGINAS', value: stats.totalPages, icon: '📄' },
          ].map(s => (
            <PixelPanel key={s.label} className="p-3 text-center">
              <p className="text-2xl"><E e={s.icon} /></p>
              <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '14px' }}>{s.value}</p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '6px' }}>{s.label}</p>
            </PixelPanel>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-1">
        {[['', ' Todos'], ['IN_PROGRESS', ' En progreso'], ['NOT_STARTED', '⏳ Por empezar'], ['COMPLETED', ' Completados']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`flex-shrink-0 px-3 py-1.5 border-2 font-pixel transition-all ${filter === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary'}`} style={{ fontSize: '8px' }}>
            {label}
          </button>
        ))}
      </div>

      <LoadingGate loading={loading} fallback={<ModernLoader variant="compact" words={LOADING_COPY.learning} />}>
        {loading ? null : filtered.length === 0 ? (
        <PixelPanel className="p-8 text-center">
          <p className="text-4xl mb-2"><E e="📚" /></p>
          <p className="font-pixel text-text-secondary" style={{ fontSize: '9px' }}>LA BIBLIOTECA ESTÁ VACÍA</p>
        </PixelPanel>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {filtered.map((item, i) => {
              const pct = item.totalProgress > 0 ? Math.min((item.currentProgress / item.totalProgress) * 100, 100) : 0;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <PixelPanel className="p-3 cursor-pointer hover:border-accent-gold/50 transition-colors" onClick={() => setUpdating(item)}>
                    <div className="flex justify-end mb-1">
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedItem(item); setTab('detalle'); setDetailTab('notas'); }}
                        className="font-pixel text-text-secondary hover:text-accent-gold transition-colors"
                        style={{ fontSize: '7px' }}
                      >
                        <E e="📝" /> NOTAS/VOCAB
                      </button>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl"><E e={TYPE_ICONS[item.type]} /></span>
                          <p className="font-vt text-text-primary text-lg">{item.title}</p>
                        </div>
                        {item.author && <p className="font-pixel text-text-secondary ml-8" style={{ fontSize: '7px' }}>{item.author}</p>}
                        <p className={`font-pixel ml-8 mt-1 ${STATUS_COLORS[item.status]}`} style={{ fontSize: '7px' }}><E e={STATUS_LABELS[item.status]} /></p>
                      </div>
                      {item.rating && (
                        <p className="font-vt text-accent-gold text-base">{Array.from({ length: item.rating }).map((_, i) => <E key={i} e="⭐" s={14} className="inline-block" />)}</p>
                      )}
                    </div>
                    {item.totalProgress > 0 && (
                      <div className="mt-2">
                        <div className="stat-bar h-2">
                          <div className="h-full bg-accent-gold" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="font-pixel text-text-secondary mt-0.5 text-right" style={{ fontSize: '7px' }}>{item.currentProgress}/{item.totalProgress} pág · {Math.round(pct)}%</p>
                      </div>
                    )}
                  </PixelPanel>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
        )}
      </LoadingGate>

      <AnimatePresence>
        {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSave={item => { setItems(prev => [item, ...prev]); setShowAdd(false); }} />}
        {updating && <ProgressModal item={updating} onClose={() => setUpdating(null)} onUpdate={updated => { setItems(prev => prev.map(i => i.id === updated.id ? updated : i)); setUpdating(null); }} />}
      </AnimatePresence>
      </>}
    </div>
  );
}
