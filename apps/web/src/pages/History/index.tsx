import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { fetchHistory, fetchDayDetail } from '../../services/history.service';
import type { HistorySummary, DayDetail } from '../../services/history.service';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const CATEGORY_COLORS: Record<string, string> = {
  FITNESS: '#5c5c64', HEALTH: '#8a8a92', FINANCE: '#a8871e',
  LEARNING: '#4a4a52', LOVE: '#c0c0c8', SOCIAL: '#a1a1aa', PERSONAL: '#2a2a2e', CREATIVE: '#bdbdc5',
};

const CATEGORY_LABELS: Record<string, string> = {
  FITNESS: 'Fitness', HEALTH: 'Salud', FINANCE: 'Finanzas', LEARNING: 'Aprendizaje',
  LOVE: 'Amor', SOCIAL: 'Social', PERSONAL: 'Personal', CREATIVE: 'Creativo',
};

function getProductivityColor(score: number): string {
  if (score >= 70) return 'var(--accent-green)';
  if (score >= 40) return 'var(--accent-gold)';
  if (score > 0)   return 'var(--accent-red)';
  return 'var(--border-strong)';
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-panel border-2 border-border-pixel px-3 py-2">
      <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>{label}</p>
      <p className="font-vt text-accent-gold text-base">+{payload[0].value} XP</p>
    </div>
  );
}

export default function HistoryPage() {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [view, setView] = useState<'calendar' | 'charts'>('calendar');

  useEffect(() => {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    fetchHistory(from, to)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDayClick(date: string, score: number) {
    if (score === 0) return;
    setSelectedDay(date);
    const detail = await fetchDayDetail(date).catch(() => null);
    setDayDetail(detail);
  }

  const today = new Date();
  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (29 - i));
    return date.toISOString().split('T')[0];
  });

  const dayMap = new Map(summary?.days.map((d) => [d.date, d]) ?? []);

  const chartData = summary?.days.map((d) => ({
    date: d.date.slice(5),
    xp: d.xpGained,
  })) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}><E e="📊" /> HISTORIAL DE AVENTURAS</h1>
        <p className="font-vt text-text-secondary text-base">Los últimos 30 días de tu épica</p>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'XP GANADO', value: summary.totalXp.toLocaleString(), color: 'text-accent-gold' },
            { label: 'MISIONES', value: summary.totalQuestsCompleted, color: 'text-accent-blue' },
            { label: 'HÁBITOS', value: summary.totalHabitsCompleted, color: 'text-accent-green' },
            { label: 'GOLD', value: summary.totalGold.toLocaleString(), color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <PixelPanel key={label} className="p-3 text-center">
              <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>{label}</p>
              <p className={`font-vt ${color} text-2xl`}>{value}</p>
            </PixelPanel>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="flex gap-2">
        {[{ key: 'calendar', label: ' Calendario' }, { key: 'charts', label: ' Gráficas' }].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key as 'calendar' | 'charts')}
            className={`px-3 py-1.5 border-2 font-pixel transition-all ${
              view === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary'
            }`}
            style={{ fontSize: '12px' }}
          >
            {label}
          </button>
        ))}
      </div>

      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.history]} />}>
        {loading ? null : view === 'calendar' ? (
        <PixelPanel className="p-4">
          <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '12px' }}>ACTIVIDAD DIARIA (ÚLTIMOS 30 DÍAS)</p>
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((date) => {
              const day = dayMap.get(date);
              const score = day?.productivityScore ?? 0;
              const isToday = date === today.toISOString().split('T')[0];
              const isSelected = date === selectedDay;
              const dayNum = new Date(date).getDate();

              return (
                <motion.button
                  key={date}
                  onClick={() => handleDayClick(date, score)}
                  className="aspect-square flex flex-col items-center justify-center border-2 text-center transition-all"
                  style={{
                    backgroundColor: getProductivityColor(score),
                    borderColor: isSelected ? 'var(--text-primary)' : isToday ? 'var(--accent-gold)' : 'transparent',
                    opacity: score === 0 ? 0.4 : 1,
                  }}
                  whileHover={{ scale: 1.15 }}
                  title={`${date}: ${day ? `${score} pts, ${day.questsCompleted} misiones, ${day.habitsCompleted} hábitos` : 'Sin actividad'}`}
                >
                  <span className="font-vt text-white text-xs font-bold" style={{ textShadow: '0 0 3px rgba(0,0,0,0.55)' }}>{dayNum}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 justify-end">
            {[
              { color: 'var(--accent-green)', label: 'Excelente' },
              { color: 'var(--accent-gold)', label: 'Bien' },
              { color: 'var(--accent-red)', label: 'Poco' },
              { color: 'var(--border-strong)', label: 'Sin actividad' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-3 h-3 border border-border-pixel" style={{ backgroundColor: color }} />
                <span className="font-vt text-text-secondary text-xs">{label}</span>
              </div>
            ))}
          </div>

          {/* Day detail */}
          {selectedDay && dayDetail && (
            <motion.div
              className="mt-4 border-t-2 border-border-pixel pt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="font-pixel text-text-secondary mb-3" style={{ fontSize: '12px' }}>
                {new Date(selectedDay).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="flex gap-4 mb-3">
                <span className="font-vt text-accent-gold text-base">+{dayDetail.totalXp} XP</span>
                <span className="font-vt text-yellow-400 text-base"><E e="💰" />{dayDetail.totalGold}</span>
              </div>
              {dayDetail.questsCompleted.length > 0 && (
                <div className="mb-2">
                  <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>MISIONES COMPLETADAS</p>
                  {dayDetail.questsCompleted.map((q) => (
                    <div key={q.questId} className="flex items-center gap-2 py-0.5">
                      <span className="text-accent-green"><E e="✓" /></span>
                      <span className="font-vt text-text-primary text-sm">{q.title}</span>
                      <span className="font-pixel text-accent-gold ml-auto" style={{ fontSize: '12px' }}>+{q.xpEarned}XP</span>
                    </div>
                  ))}
                </div>
              )}
              {dayDetail.habitLogs.length > 0 && (
                <div>
                  <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>HÁBITOS</p>
                  {dayDetail.habitLogs.map((l) => (
                    <div key={l.habitId} className="flex items-center gap-2 py-0.5">
                      <span><E e={l.icon} /></span>
                      <span className="font-vt text-text-primary text-sm">{l.title}</span>
                      <span className={`ml-auto font-vt text-sm ${l.status === 'completed' ? 'text-accent-green' : l.status === 'failed' ? 'text-accent-red' : 'text-yellow-400'}`}>
                        {l.status === 'completed' ? '✓' : l.status === 'failed' ? '✗' : '~'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </PixelPanel>
      ) : (
        <div className="space-y-4">
          {/* XP line chart */}
          <PixelPanel className="p-4">
            <p className="font-pixel text-text-secondary mb-4" style={{ fontSize: '12px' }}>XP GANADO POR DÍA</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Montserrat' }} />
                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Montserrat' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="xp" stroke="#a8871e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </PixelPanel>

          {/* Category distribution */}
          {summary && summary.categoryDistribution.length > 0 && (
            <PixelPanel className="p-4">
              <p className="font-pixel text-text-secondary mb-4" style={{ fontSize: '12px' }}>DISTRIBUCIÓN POR CATEGORÍA</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={summary.categoryDistribution}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ category, percent }) => `${CATEGORY_LABELS[category] ?? category} ${Math.round((percent ?? 0) * 100)}%`}
                  >
                    {summary.categoryDistribution.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#8a8a92'} />
                    ))}
                  </Pie>
                  <Legend formatter={(value) => CATEGORY_LABELS[value] ?? value} />
                </PieChart>
              </ResponsiveContainer>
            </PixelPanel>
          )}
        </div>
        )}
      </LoadingGate>
    </div>
  );
}
