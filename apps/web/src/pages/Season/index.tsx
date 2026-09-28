import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { Skull, Trophy, Swords } from 'lucide-react';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { useLoadingVisibility } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

interface SeasonParticipant {
  userId: string;
  damageDealt: number;
  user: { displayName: string; username: string; level: number };
}

interface SeasonEvent {
  id: string;
  name: string;
  description: string;
  bonusXpMult: number;
  category?: string;
  startDate: string;
  endDate: string;
}

interface Season {
  id: string;
  name: string;
  description: string;
  bossName: string;
  bossHp: number;
  currentHp: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  rewards: Array<{ type: string; amount?: number; itemId?: string }>;
  participants: SeasonParticipant[];
  events: SeasonEvent[];
}

interface SeasonData {
  season: Season;
  userDamage: number;
}

function BossHealthBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, (current / max) * 100);
  const color = pct > 60 ? 'var(--accent-green)' : pct > 30 ? 'var(--accent-gold)' : 'var(--accent-red)';

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <span className="font-pixel text-text-primary" style={{ fontSize: '10px' }}>HP DEL JEFE</span>
        <span className="font-vt text-text-secondary text-lg">
          {current.toLocaleString('es-CO')} / {max.toLocaleString('es-CO')}
        </span>
      </div>
      <div
        className="border-4 border-border-pixel relative overflow-hidden"
        style={{ height: '32px', background: 'rgba(0,0,0,0.5)' }}
      >
        <motion.div
          className="h-full relative"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ backgroundColor: color }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.12) 20px, rgba(0,0,0,0.12) 22px)',
            }}
          />
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'linear' }}
          />
        </motion.div>
        {pct <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-pixel text-accent-gold" style={{ fontSize: '10px' }}>¡DERROTADO!</span>
          </div>
        )}
      </div>
      <div className="mt-1 font-pixel text-center" style={{ fontSize: '8px', color }}>
        {pct.toFixed(1)}% DE HP RESTANTE
      </div>
    </div>
  );
}

function BossSprite({ defeated }: { defeated: boolean }) {
  return (
    <motion.div
      animate={defeated ? { opacity: 0.3, scale: 0.8 } : { y: [0, -6, 0] }}
      transition={defeated ? {} : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      className="flex flex-col items-center"
    >
      <Skull size={80} className={defeated ? 'text-[#555]' : 'text-accent-red'} />
      {!defeated && (
        <motion.div
          className="w-20 h-1 bg-accent-red/30 rounded-full mt-2"
          animate={{ scaleX: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

export default function SeasonPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showLoading = useLoadingVisibility(loading);

  const fetchSeason = async () => {
    try {
      const res = await api.get<SeasonData>('/seasons/active');
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeason();
    // Poll every 30s
    pollingRef.current = setInterval(fetchSeason, 30_000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  if (showLoading) {
    return <div className="py-6"><ModernLoader words={[...LOADING_COPY.season]} /></div>;
  }

  if (loading) return null;

  if (!data?.season) {
    return (
      <PixelPanel className="p-8 text-center">
        <p className="font-pixel text-text-secondary" style={{ fontSize: '10px' }}>
          No hay temporada activa en este momento.
        </p>
        <p className="font-vt text-text-secondary text-lg mt-2">
          Vuelve pronto para la próxima batalla.
        </p>
      </PixelPanel>
    );
  }

  const { season, userDamage } = data;
  const hpPct = (season.currentHp / season.bossHp) * 100;
  const defeated = season.currentHp <= 0;
  const daysLeft = Math.max(0, Math.ceil((new Date(season.endDate).getTime() - Date.now()) / 86400000));

  return (
    <div className="space-y-6">
      {/* Header épico */}
      <div className="text-center space-y-1">
        <h1 className="font-pixel text-accent-red" style={{ fontSize: '14px', textShadow: '3px 3px 0 rgba(0,0,0,0.55), 0 0 20px color-mix(in oklab, var(--accent-red) 50%, transparent)' }}>
          {season.name}
        </h1>
        <p className="font-vt text-text-secondary text-xl">{season.description}</p>
      </div>

      <LifeQuestFlipCard
        eyebrow="Campaña activa"
        title={season.bossName}
        description={season.description}
        visual={<Skull className={defeated ? 'h-20 w-20 text-muted-foreground' : 'h-20 w-20 text-destructive'} strokeWidth={1.2} aria-hidden="true" />}
        visualLabel={`Jefe de temporada: ${season.bossName}`}
        badge={defeated ? 'Derrotado' : `${daysLeft} días restantes`}
        frontFooter={<p className="text-xs font-semibold [color:var(--flip-accent)]">{hpPct.toFixed(1)}% de HP restante</p>}
        backDescription={<p>Tu daño se suma al esfuerzo del reino. Completa retos y misiones para ayudar a inclinar la batalla.</p>}
        metrics={[
          { label: 'Tu daño', value: userDamage.toLocaleString('es-CO') },
          { label: 'HP restante', value: season.currentHp.toLocaleString('es-CO') },
          { label: 'Eventos', value: season.events.length },
        ]}
        actionLabel="Ver retos"
        onAction={() => navigate('/challenges')}
        accent="var(--accent-gold)"
        className="h-[clamp(21rem,54dvh,25rem)] min-h-[21rem] max-w-xl"
      />

      {/* Boss card */}
      <PixelPanel className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <BossSprite defeated={defeated} />
            <p className="font-pixel text-accent-red mt-3" style={{ fontSize: '9px' }}>{season.bossName}</p>
          </div>
          <div className="flex-1 w-full">
            <BossHealthBar current={season.currentHp} max={season.bossHp} />

            {defeated && (
              <motion.div
                className="mt-4 p-3 border-2 border-accent-gold bg-accent-gold/10 text-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <p className="font-pixel text-accent-gold" style={{ fontSize: '10px' }}>
                  ¡VICTORIA ÉPICA DEL REINO!
                </p>
              </motion.div>
            )}

            {hpPct <= 15 && !defeated && (
              <motion.div
                className="mt-3 p-2 border-2 border-accent-red bg-accent-red/10"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <p className="font-pixel text-accent-red text-center" style={{ fontSize: '8px' }}>
                  ¡EL JEFE TIENE {hpPct.toFixed(0)}% DE HP! ¡ÚLTIMO EMPUJÓN!
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t-2 border-border-pixel pt-4">
          <div className="text-center">
            <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>TU DAÑO</p>
            <p className="font-vt text-accent-gold text-2xl">{userDamage.toLocaleString('es-CO')}</p>
          </div>
          <div className="text-center">
            <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>HP RESTANTE</p>
            <p className="font-vt text-accent-red text-2xl">{season.currentHp.toLocaleString('es-CO')}</p>
          </div>
          <div className="text-center">
            <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>DÍAS RESTANTES</p>
            <p className="font-vt text-accent-cyan text-2xl">{daysLeft}</p>
          </div>
        </div>
      </PixelPanel>

      {/* Active events */}
      {season.events.length > 0 && (
        <div>
          <h2 className="font-pixel text-accent-gold mb-3" style={{ fontSize: '10px' }}>
            EVENTOS ACTIVOS
          </h2>
          <div className="grid gap-3">
            {season.events.map((ev) => (
              <PixelPanel key={ev.id} className="p-3 border-accent-cyan">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-pixel text-accent-cyan" style={{ fontSize: '9px' }}>{ev.name}</p>
                    <p className="font-vt text-text-secondary text-base mt-1">{ev.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="bg-accent-gold text-border-pixel font-pixel px-2 py-1 border-2 border-border-pixel" style={{ fontSize: '8px' }}>
                      ×{ev.bonusXpMult} XP
                    </div>
                    {ev.category && (
                      <p className="font-pixel text-text-secondary mt-1" style={{ fontSize: '7px' }}>{ev.category}</p>
                    )}
                  </div>
                </div>
              </PixelPanel>
            ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      {season.rewards.length > 0 && (
        <PixelPanel className="p-4">
          <h2 className="font-pixel text-accent-gold mb-3" style={{ fontSize: '10px' }}>
            RECOMPENSAS AL DERROTAR AL JEFE
          </h2>
          <div className="flex flex-wrap gap-3">
            {season.rewards.map((r, i) => (
              <div key={i} className="flex items-center gap-2 bg-bg-deep border-2 border-border-pixel px-3 py-2">
                <Trophy size={16} />
                <span className="font-vt text-text-primary text-lg">
                  {r.type === 'gold' ? `${r.amount?.toLocaleString('es-CO')} Oro` : `${r.amount} XP`}
                </span>
              </div>
            ))}
          </div>
        </PixelPanel>
      )}

      {/* Top 10 leaderboard */}
      {season.participants.length > 0 && (
        <div>
          <h2 className="font-pixel text-accent-gold mb-3" style={{ fontSize: '10px' }}>
            HÉROES MÁS VALIENTES
          </h2>
          <PixelPanel className="p-0 overflow-hidden">
            {season.participants.map((p, i) => (
              <div
                key={p.userId}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border-pixel last:border-0 ${i === 0 ? 'bg-accent-gold/10' : ''}`}
              >
                <span className="font-pixel text-accent-gold w-6 text-right" style={{ fontSize: '9px' }}>
                  {i === 0 ? <E e="👑" s={12} /> : `#${i + 1}`}
                </span>
                <Swords size={16} className={i === 0 ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
                <div className="flex-1">
                  <p className="font-pixel text-text-primary" style={{ fontSize: '8px' }}>{p.user.displayName}</p>
                  <p className="font-vt text-text-secondary text-sm">Lv.{p.user.level}</p>
                </div>
                <div className="text-right">
                  <p className="font-vt text-accent-red text-xl">{p.damageDealt.toLocaleString('es-CO')}</p>
                  <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>DMG</p>
                </div>
              </div>
            ))}
          </PixelPanel>
        </div>
      )}
    </div>
  );
}
