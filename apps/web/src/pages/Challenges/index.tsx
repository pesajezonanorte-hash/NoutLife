import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Swords, Plus, Users, Trophy } from 'lucide-react';
import { getChallenges, createChallenge, joinChallenge } from '../../services/social.service';
import { useAuthStore } from '../../store/authStore';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

interface Challenge {
  id: string;
  title: string;
  description?: string;
  type: string;
  targetValue: number;
  goldWager: number;
  startDate: string;
  endDate: string;
  status: string;
  isParticipant: boolean;
  myProgress: number | null;
  participants: Array<{
    userId: string;
    currentValue: number;
    isWinner: boolean;
    user: { id: string; username: string; displayName: string; level: number };
  }>;
}

const TYPE_LABELS: Record<string, string> = {
  quests_completed: 'Quests Completadas',
  habits_streak: 'Racha de Hábitos',
  gym_sessions: 'Sesiones Gym',
  savings_percent: '% de Ahorro',
};

export default function ChallengesPage() {
  const { user } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', type: 'quests_completed',
    targetValue: 10, goldWager: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    isPublic: true,
  });

  const load = () => {
    setLoading(true);
    getChallenges().then((d) => setChallenges(d as Challenge[])).catch(() => null).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    try {
      await createChallenge(form);
      setCreating(false);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleJoin = async (id: string) => {
    try {
      await joinChallenge(id);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="text-accent-crimson" size={28} />
          <h1 className="font-pixel text-accent-crimson" style={{ fontSize: '16px' }}>RETOS</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-bg-panel border-2 border-accent-gold font-pixel text-accent-gold hover:bg-accent-gold hover:text-bg-deep transition-colors"
          style={{ fontSize: '9px' }}
        >
          <Plus size={14} /> NUEVO RETO
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-bg-panel border-4 border-border-pixel p-4 space-y-3">
          <div className="font-pixel text-accent-gold mb-3" style={{ fontSize: '11px' }}>CREAR RETO</div>
          <input
            placeholder="Título del reto"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none focus:border-accent-gold"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none"
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-pixel text-text-dim block mb-1" style={{ fontSize: '9px' }}>META</label>
              <input
                type="number" min={1}
                value={form.targetValue}
                onChange={(e) => setForm({ ...form, targetValue: parseInt(e.target.value) || 1 })}
                className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="font-pixel text-text-dim block mb-1" style={{ fontSize: '9px' }}>GOLD APUESTA</label>
              <input
                type="number" min={0}
                value={form.goldWager}
                onChange={(e) => setForm({ ...form, goldWager: parseInt(e.target.value) || 0 })}
                className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="font-pixel text-text-dim block mb-1" style={{ fontSize: '9px' }}>INICIO</label>
              <input
                type="date" value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="font-pixel text-text-dim block mb-1" style={{ fontSize: '9px' }}>FIN</label>
              <input
                type="date" value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-sm text-text-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="flex-1 py-2 bg-accent-gold border-2 border-accent-gold text-bg-deep font-pixel hover:opacity-90 transition-opacity"
              style={{ fontSize: '9px' }}
            >
              CREAR
            </button>
            <button
              onClick={() => setCreating(false)}
              className="flex-1 py-2 border-2 border-border-pixel text-text-dim font-pixel hover:text-text-primary transition-colors"
              style={{ fontSize: '9px' }}
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}

      {/* Challenges list */}
      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.challenges]} />}>
        {loading ? null : challenges.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Swords className="mx-auto text-text-dim" size={48} />
          <p className="font-vt text-text-dim">No hay retos activos. ¡Crea el primero!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((c) => {
            const end = new Date(c.endDate);
            const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
            const myProgress = c.myProgress ?? 0;
            const progress = Math.min(100, (myProgress / c.targetValue) * 100);

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-bg-panel border-4 border-border-pixel p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-pixel text-text-primary mb-1 truncate" style={{ fontSize: '11px' }}>
                      {c.title}
                    </div>
                    <div className="flex items-center gap-2 font-vt text-text-dim text-xs">
                      <span className="px-1 border border-text-dim"><E e={TYPE_LABELS[c.type] ?? c.type} /></span>
                      <span>Meta: {c.targetValue}</span>
                      {c.goldWager > 0 && <span className="text-accent-gold"><E e="💰" /> {c.goldWager} Gold</span>}
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className={`font-pixel text-xs ${c.status === 'ACTIVE' ? 'text-accent-emerald' : 'text-text-dim'}`}>
                      {c.status === 'ACTIVE' ? `${daysLeft}d` : c.status}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {c.isParticipant && (
                  <div>
                    <div className="flex justify-between font-vt text-xs text-text-dim mb-1">
                      <span>Tu progreso</span>
                      <span>{myProgress}/{c.targetValue}</span>
                    </div>
                    <div className="h-2 bg-bg-deep border border-border-pixel">
                      <div
                        className="h-full bg-accent-gold transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Participants */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 font-vt text-xs text-text-dim">
                    <Users size={12} />
                    <span>{c.participants.length} participante{c.participants.length !== 1 ? 's' : ''}</span>
                  </div>

                  {!c.isParticipant && c.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleJoin(c.id)}
                      className="px-3 py-1 bg-accent-crimson/20 border border-accent-crimson text-accent-crimson font-pixel hover:bg-accent-crimson hover:text-white transition-colors"
                      style={{ fontSize: '9px' }}
                    >
                      UNIRSE
                    </button>
                  )}
                  {c.isParticipant && (
                    <span className="font-pixel text-accent-emerald" style={{ fontSize: '9px' }}><E e="✓" /> PARTICIPANDO</span>
                  )}
                </div>

                {/* Top 3 */}
                {c.participants.length > 0 && (
                  <div className="space-y-1">
                    {c.participants.slice(0, 3).map((p, i) => (
                      <div key={p.userId} className="flex items-center gap-2 text-xs font-vt">
                        <span><E e={['🥇', '🥈', '🥉'][i]} s={14} /></span>
                        <span className={p.userId === user?.id ? 'text-accent-gold' : 'text-text-dim'}>
                          {p.user.displayName}
                        </span>
                        <span className="ml-auto text-text-dim">{p.currentValue}/{c.targetValue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        )}
      </LoadingGate>
    </div>
  );
}
