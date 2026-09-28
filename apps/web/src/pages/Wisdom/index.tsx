import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Lock, Sparkles, Swords, Brain, Coins, Dumbbell, Heart, TreePine, type LucideIcon } from 'lucide-react';
import * as wisdomService from '../../services/wisdom.service';
import type { WisdomCard } from '../../services/wisdom.service';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { E } from '@/components/ui/glyphs';

type CategoryConfig = { label: string; color: string; Icon: LucideIcon };

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  discipline:    { label: 'Disciplina',  color: 'var(--accent-red)',   Icon: Swords },
  mindset:       { label: 'Mentalidad',  color: 'var(--accent-cyan)',  Icon: Brain },
  finance:       { label: 'Finanzas',    color: 'var(--accent-gold)',  Icon: Coins },
  health:        { label: 'Salud',       color: 'var(--accent-green)', Icon: Dumbbell },
  relationships: { label: 'Relaciones',  color: 'var(--accent-pink)',  Icon: Heart },
  growth:        { label: 'Crecimiento', color: 'var(--accent-cyan)',  Icon: TreePine },
};

function WisdomCardUI({ card, delay = 0 }: { card: WisdomCard; delay?: number }) {
  const cfg: CategoryConfig = CATEGORY_CONFIG[card.category] ?? { label: card.category, color: 'var(--text-muted)', Icon: BookOpen };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ delay: delay * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 flex flex-col gap-3"
      style={{ borderColor: cfg.color + '33' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg"><E e={cfg.Icon} s={18} /></span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.color + '22', color: cfg.color }}>
          {cfg.label}
        </span>
        {card.levelRequired > 1 && (
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">Nv. {card.levelRequired}</span>
        )}
      </div>

      <blockquote className="text-sm text-[var(--text-primary)] leading-relaxed font-medium italic">
        "{card.quote}"
      </blockquote>

      {card.author && (
        <p className="text-xs text-[var(--text-muted)] text-right">— {card.author}</p>
      )}
    </motion.div>
  );
}

export default function WisdomPage() {
  const [data, setData] = useState<{
    available: WisdomCard[];
    locked: { id: string; category: string; levelRequired: number }[];
    userLevel: number;
  } | null>(null);
  const [dailyCard, setDailyCard] = useState<WisdomCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    Promise.allSettled([
      wisdomService.getDailyCard(),
      wisdomService.getAllCards(),
    ]).then(([daily, all]) => {
      if (daily.status === 'fulfilled') setDailyCard(daily.value);
      if (all.status === 'fulfilled') setData(all.value);
    }).finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...Object.keys(CATEGORY_CONFIG)];
  const filtered = data?.available.filter((c) =>
    filter === 'all' || c.category === filter
  ) ?? [];
  const featuredWisdom = dailyCard ?? data?.available[0] ?? null;
  const featuredConfig = featuredWisdom ? (CATEGORY_CONFIG[featuredWisdom.category] ?? { label: featuredWisdom.category, color: 'var(--accent-gold)', Icon: BookOpen }) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <BookOpen className="text-[var(--accent-gold)]" size={24} />
          Biblioteca de Sabiduría
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Principios que desbloqueas con el nivel — {data?.available.length ?? 0} disponibles
        </p>
      </div>

      {/* Featured wisdom uses the 3D surface; the library below remains a lightweight grid. */}
      {featuredWisdom && featuredConfig && (
        <LifeQuestFlipCard
          eyebrow={dailyCard ? 'Sabiduría del día' : 'Principio destacado'}
          title={featuredConfig.label}
          description={`“${featuredWisdom.quote}”${featuredWisdom.author ? ` — ${featuredWisdom.author}` : ''}`}
          visual={<E e={featuredConfig.Icon} s={64} />}
          visualLabel={`Sabiduría destacada: ${featuredConfig.label}`}
          badge={featuredWisdom.levelRequired > 1 ? `Nivel ${featuredWisdom.levelRequired}` : 'Disponible'}
          frontFooter={<p className="text-xs font-semibold [color:var(--flip-accent)]">{data?.available.length ?? 0} principios disponibles</p>}
          backDescription={<p>Explora más principios de {featuredConfig.label.toLowerCase()} y llévalos a tu práctica diaria con una intención concreta.</p>}
          metrics={[
            { label: 'Tu nivel', value: data?.userLevel ?? '—' },
            { label: 'Disponibles', value: data?.available.length ?? 0 },
            { label: 'Bloqueadas', value: data?.locked.length ?? 0 },
          ]}
          actionLabel="Explorar categoría"
          onAction={() => { setFilter(featuredWisdom.category); document.getElementById('wisdom-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          accent="var(--accent-gold)"
          className="h-[clamp(21rem,54dvh,25rem)] min-h-[21rem] max-w-xl"
        />
      )}

      {/* Filter */}
      <div id="wisdom-library" className="flex gap-2 flex-wrap">
        {categories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                background: filter === cat ? (cfg?.color ?? 'var(--accent-gold)') + '33' : 'transparent',
                border: `1px solid ${filter === cat ? (cfg?.color ?? 'var(--accent-gold)') : 'var(--border)'}`,
                color: filter === cat ? (cfg?.color ?? 'var(--accent-gold)') : 'var(--text-muted)',
              }}
            >
              {cfg ? <><E e={cfg.Icon} s={13} /> <span>{cfg.label}</span></> : 'Todas'}
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((card, i) => (
            <WisdomCardUI key={card.id} card={card} delay={i} />
          ))}
        </div>
      )}

      {/* Locked section */}
      {data && data.locked.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] flex items-center gap-2">
            <Lock size={14} />
            {data.locked.length} cartas bloqueadas — sigue subiendo de nivel
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.locked.slice(0, 6).map((card) => {
              const cfg = CATEGORY_CONFIG[card.category];
              return (
                <div key={card.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 flex flex-col items-center gap-2 opacity-40">
                  <Lock size={20} className="text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-muted)]"><E e={cfg?.Icon ?? BookOpen} /> {cfg?.label ?? card.category}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Nivel {card.levelRequired}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
