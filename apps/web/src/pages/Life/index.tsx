import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { ProgressRings } from '../../components/ui/ProgressRings';
import { fetchLifeScore, fetchCorrelations, fetchYearInReview } from '../../services/lifescore.service';
import type { LifeScore, YearInReview } from '../../services/lifescore.service';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { useLoadingVisibility } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const AREA_LABELS: Record<string, string> = {
  habits: 'Hábitos', finances: 'Finanzas', fitness: 'Fitness',
  quests: 'Quests', learning: 'Aprendizaje', relationships: 'Relaciones', journal: 'Diario',
};

const AREA_WEIGHTS: Record<string, number> = {
  habits: 25, finances: 20, fitness: 15, quests: 15, learning: 10, relationships: 10, journal: 5,
};

const AREA_COLORS: Record<string, string> = {
  habits: '#8a8a92', finances: '#a8871e', fitness: '#5c5c64',
  quests: '#2a2a2e', learning: '#a1a1aa', relationships: '#c0c0c8', journal: '#6b6b73',
};

function ScoreRing({ score }: { score: LifeScore }) {
  const quests   = Math.round(score.breakdown.quests   ?? 0);
  const habits   = Math.round(score.breakdown.habits   ?? 0);
  const finances = Math.round(score.breakdown.finances ?? 0);
  return (
    <div className="flex justify-center py-4">
      <ProgressRings
        size={240}
        stroke={18}
        gap={5}
        centerLabel={score.total}
        centerSubLabel="LIFE SCORE"
        rings={[
          { progress: quests,   color: '#2a2a2e' },
          { progress: habits,   color: '#8a8a92' },
          { progress: finances, color: '#a8871e' },
        ]}
      />
    </div>
  );
}

export default function LifePage() {
  const [lifeScore, setLifeScore] = useState<LifeScore | null>(null);
  const [correlations, setCorrelations] = useState<string[]>([]);
  const [yearReview, setYearReview] = useState<YearInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'score' | 'correlations' | 'year'>('score');
  const showLoading = useLoadingVisibility(loading);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchLifeScore(),
      fetchCorrelations(),
      fetchYearInReview(),
    ]).then(([ls, cr, yr]) => {
      setLifeScore(ls);
      setCorrelations(cr);
      setYearReview(yr);
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  if (showLoading) {
    return <div className="py-6"><ModernLoader words={[...LOADING_COPY.life]} /></div>;
  }

  if (loading) return null;

  const radarData = lifeScore
    ? Object.entries(lifeScore.breakdown).map(([key, val]) => ({
        area: AREA_LABELS[key] ?? key,
        score: Math.round(val),
        fullMark: 100,
      }))
    : [];

  const barData = lifeScore
    ? Object.entries(lifeScore.breakdown).map(([key, val]) => ({
        name: AREA_LABELS[key] ?? key,
        score: Math.round(val),
        weight: AREA_WEIGHTS[key],
        color: AREA_COLORS[key],
      }))
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="⭐" /> LIFE SCORE</h1>
        <p className="font-vt text-text-secondary text-base">Tu puntuación de vida en tiempo real</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {([['score', ' Score'], ['correlations', ' Correlaciones'], ['year', ' Año en Revisión']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-shrink-0 px-3 py-1.5 border-2 font-pixel transition-all ${tab === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary hover:border-text-secondary'}`}
            style={{ fontSize: '12px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Score tab */}
      {tab === 'score' && lifeScore && (
        <div className="space-y-4">
          <PixelPanel className="p-4">
            <ScoreRing score={lifeScore} />
            <div className="flex justify-center gap-4 mt-3 text-xs flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2a2a2e' }} /><span className="text-[var(--text-secondary)]">Misiones</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#8a8a92' }} /><span className="text-[var(--text-secondary)]">Hábitos</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#a8871e' }} /><span className="text-[var(--text-secondary)]">Finanzas</span></span>
            </div>
            <p className="text-center font-vt text-text-secondary text-base">
              {lifeScore.total >= 75 ? '¡Héroe legendario!' : lifeScore.total >= 50 ? 'Aventurero en progreso' : ' Comenzando la aventura'}
            </p>
          </PixelPanel>

          {/* Radar chart */}
          <PixelPanel className="p-4">
            <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '12px' }}>ÁREAS DE VIDA</p>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="area" tick={{ fontFamily: 'Montserrat', fontSize: 13, fill: 'var(--text-secondary)' }} />
                <Radar dataKey="score" stroke="var(--accent-gold)" fill="var(--accent-gold)" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </PixelPanel>

          {/* Bar breakdown */}
          <PixelPanel className="p-4">
            <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '12px' }}>DETALLE POR ÁREA</p>
            <div className="space-y-3">
              {barData.map(d => (
                <div key={d.name}>
                  <div className="flex justify-between mb-1">
                    <span className="font-vt text-text-primary text-base">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>PESO {d.weight}%</span>
                      <span className="font-pixel" style={{ fontSize: '12px', color: d.color }}>{d.score}/100</span>
                    </div>
                  </div>
                  <div className="stat-bar h-3">
                    <motion.div
                      className="h-full"
                      style={{ background: d.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${d.score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </PixelPanel>
        </div>
      )}

      {/* Correlations tab */}
      {tab === 'correlations' && (
        <div className="space-y-3">
          <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>PATRONES DETECTADOS EN TUS DATOS</p>
          {correlations.length === 0 ? (
            <PixelPanel className="p-8 text-center">
              <p className="text-4xl mb-2"><E e="🔍" /></p>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>SIN SUFICIENTES DATOS</p>
              <p className="font-vt text-text-secondary text-base mt-1">Registra más datos para ver correlaciones</p>
            </PixelPanel>
          ) : (
            correlations.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <PixelPanel className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0"><E e="📊" /></span>
                    <p className="font-vt text-text-primary text-lg">{c}</p>
                  </div>
                </PixelPanel>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Year in Review tab */}
      {tab === 'year' && yearReview && (
        <div className="space-y-4">
          <PixelPanel className="p-5 text-center">
            <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}><E e="🏆" /> {yearReview.year} EN REVISIÓN</p>
            {yearReview.bestMonth && (
              <p className="font-vt text-text-secondary text-base mt-1">Mejor mes: {yearReview.bestMonth.month}</p>
            )}
          </PixelPanel>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'XP GANADO', value: yearReview.totalXp.toLocaleString('es-CO'), icon: '⚡' },
              { label: 'ENTRENAMIENTOS', value: yearReview.totalWorkouts, icon: '🏋️' },
              { label: 'NOCHES REGISTRADAS', value: Math.round(yearReview.avgSleepHours * 100) / 100 + 'h prom', icon: '🌙' },
              { label: 'QUESTS COMPLETADAS', value: yearReview.totalQuestsCompleted, icon: '📜' },
              { label: 'ENTRADAS DEL DIARIO', value: yearReview.totalJournalEntries, icon: '📝' },
              { label: 'LIBROS/CURSOS', value: yearReview.totalBooksCompleted, icon: '📚' },
            ].map(s => (
              <PixelPanel key={s.label} className="p-3 text-center">
                <p className="text-2xl"><E e={s.icon} /></p>
                <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '16px' }}>{s.value}</p>
                <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>{s.label}</p>
              </PixelPanel>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
