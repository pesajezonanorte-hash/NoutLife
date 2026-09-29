import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { AvatarDisplay } from '../../components/character/AvatarDisplay';
import { StatBlock } from '../../components/character/StatBlock';
import { AvatarCustomizer } from '../../components/character/AvatarCustomizer';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { PixelButton } from '../../components/ui/PixelButton';
import { xpProgressPercent } from '../../lib/xp';
import { getLevelTitle } from '../../lib/gameProgress';
import { E } from '@/components/ui/glyphs';

const EQUIPMENT_SLOTS = [
  { key: 'hat', icon: '🎩', label: 'Sombrero', userField: 'equippedHat' },
  { key: 'aura', icon: '✨', label: 'Aura', userField: 'equippedAura' },
  { key: 'frame', icon: '🖼️', label: 'Marco', userField: 'equippedFrame' },
  { key: 'theme', icon: '🎨', label: 'Tema', userField: 'equippedTheme' },
  { key: 'pet', icon: '🐾', label: 'Mascota', userField: null },
];

const AURA_STYLES: Record<string, { gradient: string; shadow: string }> = {
  aura_fire:    { gradient: 'radial-gradient(ellipse at center, #ff6b0044 0%, #ff000022 60%, transparent 100%)', shadow: '0 0 32px 12px #ff6b0066' },
  aura_ice:     { gradient: 'radial-gradient(ellipse at center, #7dd3fc44 0%, #38bdf822 60%, transparent 100%)', shadow: '0 0 32px 12px #7dd3fc66' },
  aura_gold:    { gradient: 'radial-gradient(ellipse at center, #ffd23f44 0%, #f59e0b22 60%, transparent 100%)', shadow: '0 0 32px 12px #ffd23f88' },
  aura_storm:   { gradient: 'radial-gradient(ellipse at center, #a78bfa44 0%, #7c3aed22 60%, transparent 100%)', shadow: '0 0 32px 12px #a78bfa66' },
  aura_rainbow: { gradient: 'conic-gradient(from 0deg, #ff000022, #ff7f0022, #ffff0022, #00ff0022, #0000ff22, #8b00ff22, #ff000022)', shadow: '0 0 32px 12px rgba(255,200,50,0.4)' },
};

export default function CharacterPage() {
  const user = useAuthStore((s) => s.user);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  if (!user) return null;

  const avatarCfg = user.avatarConfig;
  const isMinecraftSkin = avatarCfg.avatarMode === 'minecraft' && !!avatarCfg.minecraftSkinUrl;
  const xpPct = xpProgressPercent(user.xp, user.xpToNextLevel);

  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          <E e="🧙" /> Ficha del héroe
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ── Columna izquierda: ficha destacada ── */}
      <LifeQuestFlipCard
        eyebrow="Ficha del héroe"
        title={user.displayName}
        description={`${getLevelTitle(user.level)} · Día ${daysSinceJoin} de tu aventura.`}
        visual={<AvatarDisplay avatarConfig={avatarCfg} avatarUrl={user.avatarUrl} size={112} animate="idle" />}
        visualLabel={`Avatar de ${user.displayName}`}
        badge={`Nivel ${user.level}`}
        frontFooter={(
          <div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>XP actual</span><span>{user.xp.toLocaleString()} / {user.xpToNextLevel.toLocaleString()}</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${xpPct}%` }} /></div>
          </div>
        )}
        backDescription={<p>Personaliza tu aspecto, revisa tus atributos y prepara el equipo que llevará tu héroe a la próxima misión.</p>}
        metrics={[
          { label: 'Nivel', value: user.level },
          { label: 'Racha', value: `${user.currentStreak} días` },
          { label: 'Gold', value: user.gold.toLocaleString() },
        ]}
        actionLabel="Cambiar apariencia"
        onAction={() => setCustomizerOpen(true)}
        accent="var(--accent-gold)"
      />

        {/* ── Columna central: Stats ── */}
        <PixelPanel animate className="p-5 space-y-3">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] text-center mb-3">
            Atributos
          </h2>

          <StatBlock
            icon="❤️" label="HP" value={user.hp} max={user.maxHp}
            color="text-[var(--accent-pink)]" barColor="bg-accent-pink"
            tooltip="Puntos de vida. Sube con cada nivel y buenos hábitos de salud."
          />
          <StatBlock
            icon="🔵" label="MP" value={user.mp} max={user.maxMp}
            color="text-[var(--accent-cyan)]" barColor="bg-accent-cyan"
            tooltip="Puntos de maná. Representa tu energía mental y foco."
          />

          <div className="border-t border-[var(--border)] pt-3 space-y-2">
            <StatBlock
              icon="⚔️" label="FUERZA (STR)" value={user.strength}
              color="text-[var(--accent-red)]"
              tooltip="Sube al completar misiones de FITNESS y GYM. Aumenta daño físico."
            />
            <StatBlock
              icon="🧠" label="INTELIGENCIA (INT)" value={user.intelligence}
              color="text-[var(--accent-blue)]"
              tooltip="Sube al completar misiones de LEARNING y FINANCE. Amplifica XP ganado."
            />
            <StatBlock
              icon="✨" label="CARISMA (CHA)" value={user.charisma}
              color="text-[var(--accent-pink)]"
              tooltip="Sube al completar misiones de LOVE y SOCIAL. Mejora recompensas de gold."
            />
          </div>

          <div className="border-t border-[var(--border)] pt-3">
            <div className="flex items-center justify-center gap-2 bg-[var(--bg-panel-light)] border border-[var(--border)] rounded-lg px-4 py-2">
              <span className="text-[var(--accent-gold)] text-2xl"><E e="💰" /></span>
              <span className="text-xl font-bold text-[var(--accent-gold)]">{user.gold.toLocaleString()}</span>
              <span className="text-sm font-medium text-[var(--text-secondary)]">GOLD</span>
            </div>
          </div>
        </PixelPanel>

        {/* ── Columna derecha: Equipamiento ── */}
        <PixelPanel animate className="p-5">
          <h2 className="text-sm font-medium text-[var(--text-secondary)] text-center mb-4">
            Equipamiento
          </h2>

          <div className="space-y-2">
            {EQUIPMENT_SLOTS.map((slot) => {
              const equippedKey = slot.userField ? (user as unknown as Record<string, unknown>)[slot.userField] as string | null : null;
              const isEquipped = !!equippedKey;
              return (
                <motion.div
                  key={slot.key}
                  whileHover={{ x: 3 }}
                  className={`flex items-center gap-3 border rounded-lg bg-[var(--bg-panel-light)] p-2 cursor-pointer transition-colors group ${isEquipped ? 'border-[var(--accent-gold)]' : 'border-[var(--border)] hover:border-[var(--accent-gold)]'}`}
                >
                  <span className="text-xl w-8 text-center"><E e={slot.icon} /></span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {slot.label}
                    </p>
                    <p className={`text-xs ${isEquipped ? 'text-[var(--accent-gold)]' : 'text-[var(--text-muted)]'}`}>
                      {isEquipped ? equippedKey!.replace(/_/g, ' ') : '— vacío —'}
                    </p>
                  </div>
                  {isEquipped && <span className="text-xs text-[var(--accent-green)]"><E e="✓" /></span>}
                </motion.div>
              );
            })}
          </div>

          <p className="text-xs text-[var(--text-secondary)] text-center mt-4">
            Compra items en el mercado para equiparlos <E e="🛒" />
          </p>

          {/* Logros recientes */}
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Logros desbloqueados</h3>
            <div className="space-y-1.5">
              {[
                { icon: '🌟', title: '¡El Héroe Despierta!', desc: 'Primera sesión' },
                { icon: '🔥', title: 'Semana de Fuego', desc: '7 días seguidos' },
                { icon: '⚔️', title: 'Primera Misión', desc: 'Completaste tu primera misión' },
              ].map((ach) => (
                <div key={ach.title} className="flex items-center gap-2 bg-[var(--bg-panel-light)] border border-[var(--border)] rounded-lg px-2 py-1.5">
                  <span><E e={ach.icon} /></span>
                  <div>
                    <p className="text-xs font-semibold text-[var(--accent-gold)]">{ach.title}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{ach.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PixelPanel>
      </div>

      <AvatarCustomizer isOpen={customizerOpen} onClose={() => setCustomizerOpen(false)} />
    </div>
  );
}
