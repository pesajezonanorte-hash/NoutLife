import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { AchievementCard } from '../../components/achievements/AchievementCard';
import { fetchAchievements } from '../../services/achievement.service';
import type { Achievement } from '../../services/achievement.service';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const CATEGORY_TABS = [
  { key: '',        label: 'Todos',    icon: '🏆' },
  { key: 'quest',   label: 'Misiones', icon: '⚔️' },
  { key: 'habit',   label: 'Hábitos',  icon: '🔥' },
  { key: 'level',   label: 'Nivel',    icon: '⬆️' },
  { key: 'category', label: 'Categoría', icon: '📋' },
  { key: 'special', label: 'Especiales', icon: '✨' },
] as const;

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAchievements(await fetchAchievements());
    } catch {
      setLoadError('No pudimos cargar tu catálogo de logros. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  const filtered = activeTab
    ? achievements.filter((a) => a.category === activeTab)
    : achievements;

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalXp = achievements.filter((a) => a.unlocked).reduce((s, a) => s + a.xpReward, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="🏆" /> SALA DE LOGROS</h1>
        <p className="font-vt text-text-secondary text-base">
          {achievements.length === 0 && !loading
            ? 'Preparando catálogo de logros…'
            : `${unlockedCount}/${achievements.length} desbloqueados · ${totalXp.toLocaleString()} XP ganados`}
        </p>
      </div>

      {/* Progress bar global */}
      {(loading || achievements.length > 0) && (
        <div>
          <div className="flex justify-between font-pixel mb-1" style={{ fontSize: '7px' }}>
            <span className="text-text-secondary">PROGRESO GLOBAL</span>
            <span className="text-accent-gold">{Math.round(achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0)}%</span>
          </div>
          <div className="h-2 bg-bg-panel border-2 border-border-pixel">
            <motion.div
              className="h-full bg-accent-gold"
              initial={{ width: 0 }}
              animate={{ width: `${achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-11 min-w-0 px-3 py-1.5 border-2 font-pixel transition-all ${
              activeTab === tab.key
                ? 'border-accent-gold bg-accent-gold text-bg-deep'
                : 'border-border-pixel text-text-secondary hover:border-text-secondary'
            }`}
            style={{ fontSize: '7px' }}
          >
            <E e={tab.icon} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <LoadingGate loading={loading} fallback={<ModernLoader variant="compact" words={LOADING_COPY.achievements} />}>
        {loading ? null : loadError ? (
        <PixelPanel className="mx-auto max-w-xl p-8 text-center">
          <p className="text-4xl"><E e="⚠" /></p>
          <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">No pudimos abrir tus logros</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">{loadError}</p>
          <PixelButton variant="secondary" onClick={() => void loadAchievements()} className="mt-5">Reintentar</PixelButton>
        </PixelPanel>
      ) : filtered.length === 0 ? (
        <PixelPanel className="mx-auto max-w-xl p-8 text-center">
          <p className="text-4xl"><E e={achievements.length === 0 ? '🏆' : '🔎'} /></p>
          <h2 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{achievements.length === 0 ? 'Tu sala de logros se está preparando' : 'No hay logros en esta categoría'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
            {achievements.length === 0
              ? 'Vuelve a intentarlo en unos segundos. Si el problema continúa, avísanos desde Feedback.'
              : 'Explora otra categoría para ver todos los desafíos disponibles.'}
          </p>
          {achievements.length === 0 ? (
            <PixelButton variant="secondary" onClick={() => void loadAchievements()} className="mt-5">Actualizar logros</PixelButton>
          ) : (
            <PixelButton variant="ghost" onClick={() => setActiveTab('')} className="mt-5">Ver todos</PixelButton>
          )}
        </PixelPanel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Unlocked first */}
          {[...filtered.filter(a => a.unlocked), ...filtered.filter(a => !a.unlocked)].map((ach, i) => (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <AchievementCard achievement={ach} onClick={setSelectedAch} />
            </motion.div>
          ))}
        </div>
        )}
      </LoadingGate>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedAch && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedAch(null)} />
            <motion.div
              className="relative z-10 max-h-[86dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl border-2 border-border-pixel bg-bg-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center sm:rounded-2xl sm:p-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={selectedAch.unlocked ? { boxShadow: '0 0 30px #ffd23f44' } : {}}
            >
              <motion.div
                className={`text-6xl mb-4 ${!selectedAch.unlocked ? 'grayscale opacity-40' : ''}`}
                animate={selectedAch.unlocked ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <E e={selectedAch.icon} />
              </motion.div>
              <h3 className={`font-pixel mb-2 ${selectedAch.unlocked ? 'text-accent-gold' : 'text-text-secondary'}`} style={{ fontSize: '11px' }}>
                {selectedAch.title}
              </h3>
              <p className="font-vt text-text-primary text-base mb-4">{selectedAch.description}</p>

              {selectedAch.unlocked ? (
                <div className="space-y-1">
                  <p className="font-pixel text-accent-gold" style={{ fontSize: '9px' }}><E e="✓" /> DESBLOQUEADO</p>
                  {selectedAch.unlockedAt && (
                    <p className="font-vt text-text-secondary text-sm">
                      {new Date(selectedAch.unlockedAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                  {selectedAch.xpReward > 0 && (
                    <p className="font-pixel text-accent-gold" style={{ fontSize: '8px' }}>+{selectedAch.xpReward} XP</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}><E e="🔒" /> BLOQUEADO</p>
                  {selectedAch.progress !== null && selectedAch.target && (
                    <p className="font-vt text-text-secondary text-sm mt-1">
                      {selectedAch.progress}/{selectedAch.target}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => setSelectedAch(null)}
                className="mt-4 min-h-11 font-pixel text-text-secondary hover:text-text-primary border-2 border-border-pixel px-4 py-1"
                style={{ fontSize: '8px' }}
              >
                CERRAR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
