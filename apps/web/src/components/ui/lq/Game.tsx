// Piezas de juego compartidas por Gremio, Campaña, Ranking y Sabiduría:
// BossBar, SeasonPassTrack, Podium, LeaderRow y QuoteCard.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Gift, Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, springSoft } from '@/lib/motion';
import { Badge } from './Badge';
import { IconChip } from './IconChip';
import { ProgressBar } from './Progress';
import { softTone, textTone, type Tone } from './tones';

// ───────────────────────────── BossBar ─────────────────────────────

export interface BossBarProps {
  name: string;
  /** Vida actual y máxima. */
  hp: number;
  maxHp: number;
  eyebrow?: string;
  /** Texto bajo la barra (recompensa, reglas…). */
  note?: ReactNode;
  icon?: LucideIcon;
  /** Acción (p. ej. «Atacar»). */
  action?: ReactNode;
  /** Badge a la derecha (tiempo restante…). */
  aside?: ReactNode;
  className?: string;
}

/** Jefe con barra de vida: shine en la barra, transición de scaleX con expo. */
export function BossBar({ name, hp, maxHp, eyebrow = 'Jefe', note, icon, action, aside, className }: BossBarProps) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-4">
        <IconChip icon={icon} tone="error" className="size-14 rounded-2xl [&>svg]:size-8" />
        <div className="min-w-0 flex-1">
          <span className="text-label-lg text-primary-text">{eyebrow}</span>
          <h2 className="text-heading-md">{name}</h2>
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between gap-2">
          <span className="text-label-lg text-error-text">Vida del jefe</span>
          <span className="font-mono text-label-lg tabular-nums">{Math.round(hp).toLocaleString('es-CO')} / {maxHp.toLocaleString('es-CO')}</span>
        </div>
        <ProgressBar value={pct} tone="error" size="lg" shine label={`Vida de ${name}`} valueText={`${Math.round(pct)}%`} />
        {note && <p className="text-body-sm text-on-surface-light">{note}</p>}
      </div>
      {action}
    </div>
  );
}

// ───────────────────────────── SeasonPassTrack ─────────────────────────────

export interface PassReward {
  level: number;
  name: string;
  icon: LucideIcon;
  tone: Exclude<Tone, 'muted'>;
  state: 'claimed' | 'claimable' | 'locked' | 'premium';
}

export interface SeasonPassTrackProps {
  rewards: PassReward[];
  /** 0–100: avance de la pista. */
  progress: number;
  onClaim?: (reward: PassReward) => void;
  className?: string;
}

const STATE = {
  claimed: { label: 'Reclamado', badge: 'success', icon: Check },
  claimable: { label: 'Reclamar', badge: 'primary', icon: Gift },
  locked: { label: 'Bloqueado', badge: 'neutral', icon: Lock },
  premium: { label: 'Premium', badge: 'secondary', icon: Lock },
} as const;

/** Pista horizontal del pase: línea que crece y recompensas que aparecen en cascada;
 *  la reclamable lleva halo y borde primario. Desplazable en horizontal. */
export function SeasonPassTrack({ rewards, progress, onClaim, className }: SeasonPassTrackProps) {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 pb-4 pt-2 md:mx-0 md:px-1', className)}>
      <ol className="relative grid w-max auto-cols-[112px] grid-flow-col gap-4">
        <span aria-hidden className="absolute left-14 right-14 top-[35px] h-1 overflow-hidden rounded-full bg-surface-variant">
          <motion.span
            className="block h-full origin-left rounded-full bg-primary"
            initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0, Math.min(1, progress / 100)) }}
            transition={{ duration: 1.6, ease: expo, delay: 0.3 }}
          />
        </span>
        {rewards.map((r, i) => {
          const st = STATE[r.state];
          const locked = r.state === 'locked' || r.state === 'premium';
          return (
            <motion.li
              key={`${r.level}-${r.name}`}
              className="relative flex flex-col items-center gap-2.5 text-center"
              initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springSoft, delay: 0.15 + i * 0.06 }}
            >
              {/* Fondo opaco: la línea de la pista no se ve a través del tinte. */}
              <span className="relative z-10 rounded-[22px] bg-surface">
              <button
                type="button"
                disabled={r.state !== 'claimable'}
                onClick={() => onClaim?.(r)}
                aria-label={`${r.name}, nivel ${r.level}: ${st.label.toLowerCase()}`}
                className={cn(
                  'flex size-[72px] items-center justify-center rounded-[22px] border-2 transition-transform duration-300 enabled:hover:scale-105 enabled:active:scale-95',
                  locked ? 'border-transparent bg-surface-variant text-on-surface-light grayscale' : softTone[r.tone],
                  r.state === 'claimable' ? 'lq-halo border-primary' : 'border-transparent',
                )}
              >
                <r.icon aria-hidden className="size-8" strokeWidth={1.75} />
              </button>
              </span>
              <span className="text-label-md text-on-surface-light">NIVEL {r.level}</span>
              <span className={cn('text-body-sm leading-tight', locked ? 'text-on-surface-light' : 'text-on-background')}>{r.name}</span>
              <Badge variant={st.badge} icon={st.icon}>{st.label}</Badge>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

// ───────────────────────────── Podium + LeaderRow ─────────────────────────────

export interface Leader {
  id: string | number;
  name: string;
  initials: string;
  score: string;
  isYou?: boolean;
}

/** Podio 2 · 1 · 3: las bases suben con scaleY escalonado; el primero lleva halo dorado. */
export function Podium({ top }: { top: Leader[] }) {
  const order = [1, 0, 2].filter((i) => top[i]);
  const heights = [160, 116, 84];
  const delays = [0.35, 0.2, 0.5];
  return (
    <div className="flex items-end justify-center gap-3 md:gap-4" aria-label="Podio">
      {order.map((i) => {
        const p = top[i];
        const first = i === 0;
        return (
          <div key={p.id} className="flex max-w-[180px] flex-1 flex-col items-center gap-3">
            <span
              className={cn(
                'flex items-center justify-center rounded-full font-bold shadow-[0_0_0_4px_rgb(var(--lq-background))]',
                first ? 'lq-halo size-[72px] text-heading-sm text-warning-text ring-2 ring-warning ring-offset-4 ring-offset-background' : 'size-[60px] text-label-lg ring-2 ring-offset-4 ring-offset-background',
                !first && (p.isYou ? 'ring-primary' : 'ring-border'),
                p.isYou ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'bg-surface-variant text-on-surface',
              )}
            >
              {p.initials}
            </span>
            <div className="text-center">
              <div className="text-label-lg md:text-body-md md:font-semibold">{p.name}</div>
              <div className="font-mono text-body-sm tabular-nums text-on-surface-light">{p.score}</div>
            </div>
            <motion.div
              className={cn('flex w-full origin-bottom justify-center rounded-t-2xl rounded-b-md pt-4', first ? 'bg-warning/[var(--lq-soft-alpha)]' : 'bg-surface-variant')}
              style={{ height: heights[i] }}
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.9, ease: expo, delay: delays[i] }}
            >
              <span className={cn('font-mono text-display-sm tabular-nums', first ? 'text-warning-text' : 'text-on-surface')}>{i + 1}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export interface LeaderRowProps extends Leader {
  position: number;
  subtitle?: string;
  trend?: { dir: 'up' | 'down' | 'flat'; label: string };
  toneIndex?: number;
}

const AVATAR_TONES: Tone[] = ['primary', 'success', 'warning', 'info', 'secondary'];
const TREND = { up: { cls: 'text-success-text', d: 'm6 15 6-6 6 6', sr: 'sube' }, down: { cls: 'text-error-text', d: 'm6 9 6 6 6-6', sr: 'baja' }, flat: { cls: 'text-on-surface-light', d: 'M6 12h12', sr: 'igual' } };

/** Fila de clasificación: posición, avatar, nombre (+ «Tú»), tendencia y puntuación. */
export function LeaderRow({ position, name, initials, score, isYou, subtitle, trend, toneIndex = 0 }: LeaderRowProps) {
  const t = trend ? TREND[trend.dir] : null;
  return (
    <li
      aria-current={isYou || undefined}
      className={cn('flex min-h-16 items-center gap-3 rounded-xl px-3 md:gap-4', isYou && 'bg-primary/[var(--lq-soft-alpha)]')}
    >
      <span className="w-7 text-center font-mono text-label-lg tabular-nums text-on-surface-light">{position}</span>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-label-lg font-bold', softTone[AVATAR_TONES[toneIndex % AVATAR_TONES.length]])}>{initials}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-label-lg md:text-body-md md:font-semibold', isYou ? 'text-primary-text' : 'text-on-background')}>{name}</span>
          {isYou && <Badge variant="primary">Tú</Badge>}
        </div>
        {subtitle && <div className="truncate text-body-sm text-on-surface-light">{subtitle}</div>}
      </div>
      {t && trend && (
        <span className={cn('hidden w-11 items-center gap-0.5 text-body-sm sm:flex', t.cls)}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d={t.d} /></svg>
          <span className="sr-only">{t.sr}</span>{trend.label}
        </span>
      )}
      <span className="w-24 text-right font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{score}</span>
    </li>
  );
}

// ───────────────────────────── QuoteCard ─────────────────────────────

export interface QuoteCardProps {
  category: string;
  icon: LucideIcon;
  tone: Exclude<Tone, 'muted'>;
  text?: string;
  author?: string;
  /** Si no hay texto, nivel en que se desbloquea. */
  unlockLevel?: number;
  action?: ReactNode;
  className?: string;
}

/** Principio abierto (cita) o bloqueado (líneas fantasma + «Se desbloquea en el nivel N»). */
export function QuoteCard({ category, icon: Icon, tone, text, author, unlockLevel, action, className }: QuoteCardProps) {
  const open = Boolean(text);
  return (
    <div className={cn('flex h-full flex-col gap-4', className)}>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex size-9 items-center justify-center rounded-[10px]', open ? softTone[tone] : softTone.muted)}>
          <Icon aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
        <span className={cn('text-label-lg', open ? textTone[tone] : 'text-on-surface-light')}>{category}</span>
      </div>
      {open ? (
        <blockquote className="flex flex-1 flex-col gap-2">
          <p className="text-heading-sm font-medium">“{text}”</p>
          {author && <footer className="text-body-sm text-on-surface-light">— {author}</footer>}
        </blockquote>
      ) : (
        <div className="flex flex-1 flex-col gap-2" aria-label={`Bloqueado hasta el nivel ${unlockLevel}`}>
          <span aria-hidden className="h-3.5 w-[92%] rounded-md bg-surface-variant" />
          <span aria-hidden className="h-3.5 w-[70%] rounded-md bg-surface-variant" />
          <span className="mt-2 flex items-center gap-1.5 text-body-sm text-on-surface-light">
            <Lock aria-hidden className="size-4" strokeWidth={1.75} />Se desbloquea en el nivel {unlockLevel}
          </span>
        </div>
      )}
      {action}
    </div>
  );
}
