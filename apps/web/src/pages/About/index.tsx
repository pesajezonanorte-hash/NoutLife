import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Star, Zap, Target, Trophy, Calendar } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { E } from '@/components/ui/glyphs';

const PHASES = [
  { num: 1, title: 'Los Cimientos', desc: 'Auth, perfil de héroe, sistema de XP/nivel/stats, onboarding RPG' },
  { num: 2, title: 'El Sistema de Misiones', desc: 'CRUD de quests con tipos, dificultad, sub-objetivos y completion' },
  { num: 3, title: 'El Sistema de Hábitos', desc: 'Hábitos con rachas, logs diarios, logros y sistema de XP por completar' },
  { num: 4, title: 'La Economía del Héroe', desc: 'Finanzas, ingresos/gastos, presupuestos, metas financieras, análisis' },
  { num: 5, title: 'El Cuerpo del Héroe', desc: 'Gimnasio, nutrición con IA, sueño, peso corporal y fotos de progreso' },
  { num: 6, title: 'La Mente del Héroe', desc: 'Aprendizaje, diario personal, relaciones, tienda, logros épicos' },
  { num: 7, title: 'El Mundo Exterior', desc: 'Social, gremio, retos PvP, temporadas, integraciones, agenda' },
  { num: 8, title: 'La Inteligencia Artificial', desc: 'El Sabio con memoria, sugerencias, análisis contextual, LifeScore' },
  { num: 9, title: 'El Glow Up', desc: 'Metas maestras, rituales diarios, check-in, sabiduría desbloqueada, modo enfoque' },
  { num: 10, title: 'La Fase Final', desc: 'Centro de notificaciones, búsqueda global, exportación, tour, esta página' },
];

const TECH_STACK = [
  { category: 'Frontend', items: ['React 18 + TypeScript', 'Vite', 'Tailwind CSS', 'Framer Motion', 'Zustand', 'React Router v6'] },
  { category: 'Backend', items: ['Node.js + Express', 'TypeScript', 'Prisma ORM', 'PostgreSQL (Supabase)', 'JWT Auth', 'Google Gemini AI'] },
  { category: 'Herramientas', items: ['pnpm workspaces', 'Concurrently', 'tsx watch', 'ESLint', 'Web Push (VAPID)', 'Netlify'] },
];

export default function AboutPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<{ quests: number; habits: number; workouts: number } | null>(null);

  const startDate = user?.createdAt ? new Date(user.createdAt) : null;
  const daysPlaying = startDate
    ? Math.floor((Date.now() - startDate.getTime()) / 86400000)
    : 0;

  useEffect(() => {
    Promise.all([
      api.get('/quests?status=COMPLETED&limit=1'),
      api.get('/habits?limit=1'),
      api.get('/workouts?limit=1'),
    ])
      .then(([q, h, w]) => {
        setStats({
          quests: q.data?.total ?? q.data?.quests?.length ?? 0,
          habits: h.data?.total ?? h.data?.habits?.length ?? 0,
          workouts: w.data?.total ?? w.data?.workouts?.length ?? 0,
        });
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent-gold)12, var(--accent-cyan)08)', border: '1px solid var(--accent-gold)33' }}
      >
        <div className="text-6xl mb-4"><E e="🏆" /></div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">LifeQuest</h1>
        <p className="text-[var(--text-secondary)] text-sm">RPG de Vida Real · Versión 10.0.0</p>
        <p className="text-[var(--text-muted)] text-xs mt-4 leading-relaxed max-w-md mx-auto">
          {user?.displayName ? <>Hola, <span className="text-[var(--accent-gold)] font-semibold">{user.displayName}</span> — </> : null}
          porque convertir tu vida en un juego es la forma más épica de ganarla.
        </p>
      </motion.div>

      {/* Estadísticas del viaje */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Star className="text-[var(--accent-gold)]" size={20} /> Tu Viaje
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Días jugando', value: daysPlaying, icon: <Calendar size={20} />, color: 'var(--accent-gold)' },
            { label: 'Nivel actual', value: user?.level ?? 1, icon: <Zap size={20} />, color: 'var(--accent-cyan)' },
            { label: 'Racha actual', value: `${user?.currentStreak ?? 0}d`, icon: <Target size={20} />, color: 'var(--accent-green)' },
            { label: 'XP total', value: (user?.xp ?? 0).toLocaleString('es-CO'), icon: <Trophy size={20} />, color: 'var(--accent-pink)' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 text-center">
              <div className="flex justify-center mb-2" style={{ color: stat.color }}>{stat.icon}</div>
              <p className="text-xl font-bold text-[var(--text-primary)]">{stat.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Las 10 Fases */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Zap className="text-[var(--accent-cyan)]" size={20} /> Las 10 Fases de LifeQuest
        </h2>
        <div className="space-y-2">
          {PHASES.map((phase, i) => (
            <motion.div
              key={phase.num}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3"
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--accent-gold)22', color: 'var(--accent-gold)' }}
              >
                {phase.num}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{phase.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{phase.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stack técnico */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4"><E e="⚙" /> Stack Técnico</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TECH_STACK.map((group) => (
            <div key={group.category} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
              <p className="text-sm font-medium text-[var(--accent-cyan)] mb-3">{group.category}</p>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-[var(--accent-gold)] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Créditos */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl p-6 text-center"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}
      >
        <Heart className="mx-auto text-[var(--accent-pink)] mb-3" size={28} />
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Diseñado y desarrollado como un sistema de mejora personal que convierte cada hábito,
          misión y logro en un verdadero avance de héroe.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          LifeQuest v10.0.0 · 2025 · {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2025'}–presente
        </p>
      </motion.div>
    </div>
  );
}
