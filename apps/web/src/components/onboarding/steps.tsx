// Pasos del onboarding con el sistema lq. El shell (progreso, título, botones)
// vive en pages/Onboarding; aquí solo el contenido de cada paso.
// Movimiento: cada bloque entra en cascada con las variantes del paso (enter → center,
// solo transform y opacidad) y las opciones elegidas laten con borde de luz (.lq-choice).
import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Apple, BookOpen, Check, Dumbbell, Globe, Heart, Instagram, Leaf, Monitor, Moon, MoonStar, Palette, Sparkle, Star, Sun, Sunrise, Users, Wallet, CalendarCheck, type LucideIcon,
} from 'lucide-react';
import type { AvatarConfig, Gender } from '@noutlife/shared';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { springs } from '@/lib/motion';
import type { PixelAnimation } from '@/components/character/pixel/PixelAvatar';
import { GenderOther, Mars, TikTok, Venus } from './symbols';
import { cn } from '@/lib/utils';
import { GENDER_OPTIONS } from '@/utils/gender';
import { ChipGroup, type ChipIcon, Field, IconChip, Input, type Tone, DatePicker } from '@/components/ui/lq';
import { AvatarPreview, AvatarStudio } from '@/components/character/AvatarPixelEditor';
import { HomeWindow, useNow } from '@/components/dashboard/HomeWindow';
import type { ThemeMode } from '@/store/themeStore';
import type { CreateHabitPayload } from '@/services/habit.service';

// ── Movimiento ───────────────────────────────────────────────────────────────
/** Un bloque del paso: sube y aparece (hereda enter/center del paso). */
export const rise: Variants = { enter: { opacity: 0, y: 14 }, center: { opacity: 1, y: 0, transition: springs.natural } };
/** Lista o rejilla cuyos hijos (rise) entran uno tras otro. */
export const cascade: Variants = { enter: {}, center: { transition: { staggerChildren: 0.04 } } };

// ── Identidad y personaje ────────────────────────────────────────────────────
export const HOW_FOUND = [
  { value: 'tiktok', label: 'TikTok', icon: TikTok },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'friend', label: 'Una persona', icon: Users },
  { value: 'creator', label: 'Un creador', icon: Star },
  { value: 'other', label: 'Otro', icon: Globe },
] as const;
export type HowFound = (typeof HOW_FOUND)[number]['value'];

const GENDER_ICON: Record<Gender, ChipIcon> = { female: Venus, male: Mars, other: GenderOther, unspecified: Sparkle };
const GENDER_CHIPS = GENDER_OPTIONS.map((o) => ({ ...o, icon: GENDER_ICON[o.value] }));

export function IdentityFields({ name, onName, nameError, gender, onGender, genderError, lockGender, config, avatarAnimate = 'idle', onEditAvatar, howFound, onHowFound, birthDate, onBirthDate }: {
  name: string; onName: (v: string) => void; nameError?: string;
  gender: Gender | ''; onGender: (g: Gender) => void; genderError?: string; lockGender: boolean;
  config: AvatarConfig; avatarAnimate?: PixelAnimation; onEditAvatar: () => void;
  howFound: HowFound | ''; onHowFound: (v: HowFound) => void;
  birthDate: string; onBirthDate: (v: string) => void;
}) {
  return (
    <motion.div variants={cascade} className="flex flex-col gap-6">
      {/* El personaje: se ve desde el primer paso y se personaliza en su estudio. */}
      <motion.div variants={rise} className="flex items-center gap-4">
        <AvatarPreview config={config} size={72} animate={avatarAnimate} className="shrink-0" />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-label-lg">Tu personaje</span>
          <span className="text-body-sm text-on-surface-light">Te acompaña en tu espacio. Puedes cambiarlo cuando quieras.</span>
          <button type="button" onClick={onEditAvatar} className="inline-flex min-h-11 items-center text-label-lg text-primary-text underline underline-offset-4">
            Crea tu avatar
          </button>
        </div>
      </motion.div>
      <motion.div variants={rise}>
        <Field label="Tu nombre" error={nameError}>
          <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Tu nombre" maxLength={60} autoComplete="nickname" />
        </Field>
      </motion.div>
      {!lockGender && (
        <motion.div variants={rise} className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">¿Cómo te identificas?</span>
          <ChipGroup<Gender | ''> label="¿Cómo te identificas?" value={gender} onChange={(g) => g && onGender(g)} options={GENDER_CHIPS} />
          {genderError
            ? <span role="alert" className="text-body-sm text-error-text">{genderError}</span>
            : <span className="text-body-sm text-on-surface-light">Para hablarte bien y mostrarte zonas como Ciclo. Puedes cambiarlo en Ajustes.</span>}
        </motion.div>
      )}
      <motion.div variants={rise} className="flex flex-col gap-2">
        <span aria-hidden className="text-label-lg text-on-surface">¿Cómo nos conociste? <span className="font-normal text-on-surface-light">(opcional)</span></span>
        <ChipGroup<HowFound | ''> label="¿Cómo nos conociste? (opcional)" value={howFound} onChange={(v) => v && onHowFound(v)} options={[...HOW_FOUND]} />
      </motion.div>
      <motion.div variants={rise}>
        <Field label="Fecha de nacimiento" help="Opcional. Para celebrar tu cumpleaños.">
          <DatePicker clearable value={birthDate} onChange={onBirthDate} max={new Date().toISOString().slice(0, 10)} placeholder="Tu cumpleaños" />
        </Field>
      </motion.div>
    </motion.div>
  );
}

/** Estudio del avatar a pantalla completa (el mismo que en Perfil). */
export function AvatarContent({ config, onChange, celebrate = 0 }: { config: AvatarConfig; onChange: (c: AvatarConfig) => void; celebrate?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-lg"
    >
      <AvatarStudio config={config} onChange={onChange} celebrate={celebrate} doneLabel="¡Listo!" />
    </motion.div>
  );
}

// ── Luz ──────────────────────────────────────────────────────────────────────
const LIGHTS: Array<{ mode: ThemeMode; icon: LucideIcon; label: string; desc: string }> = [
  { mode: 'light', icon: Sun, label: 'Claro', desc: 'Luz de día, papel cálido' },
  { mode: 'dark', icon: MoonStar, label: 'Oscuro', desc: 'Aurora: verde profundo y calma' },
  { mode: 'auto', icon: Monitor, label: 'Automático', desc: 'Sigue la luz de tu teléfono' },
];

/** Tres opciones; al elegir, toda la pantalla cambia al momento (la vista previa es la app misma). */
export function LightChoice({ mode, onMode }: { mode: ThemeMode; onMode: (m: ThemeMode) => void }) {
  const now = useNow();
  // La ventana es la pieza más pesada del paso: se monta cuando el paso ya terminó de entrar,
  // así el deslizamiento no pierde cuadros en móviles. Su caja queda reservada (sin saltos).
  const [windowReady, setWindowReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setWindowReady(true), 380); return () => window.clearTimeout(t); }, []);
  return (
    <motion.div variants={cascade} className="flex flex-col gap-6">
      <motion.div variants={rise} className="min-h-[226px]">{windowReady && <HomeWindow now={now} className="max-w-[320px]" />}</motion.div>
      <motion.fieldset variants={cascade} className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Elige tu luz</legend>
        {LIGHTS.map((l) => (
          <motion.label
            key={l.mode}
            variants={rise}
            className={cn(
              'lq-choice flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 sm:flex-col sm:items-start',
              'hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-background',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
            )}
          >
            <input type="radio" name="light" checked={mode === l.mode} onChange={() => onMode(l.mode)} className="sr-only" />
            <IconChip icon={l.icon} tone="primary" size="sm" />
            <span className="min-w-0">
              <span className="block text-label-lg">{l.label}</span>
              <span className="block text-body-sm text-on-surface-light">{l.desc}</span>
            </span>
          </motion.label>
        ))}
      </motion.fieldset>
      <motion.p variants={rise} className="text-body-sm text-on-surface-light">Puedes cambiarla cuando quieras en Ajustes.</motion.p>
    </motion.div>
  );
}

// ── Áreas y meta del año ─────────────────────────────────────────────────────
export const GOALS: Array<{ id: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'>; label: string; desc: string }> = [
  { id: 'FITNESS', icon: Dumbbell, tone: 'success', label: 'Entrenamiento', desc: 'Pesas, cardio, deporte o caminatas' },
  { id: 'HEALTH', icon: Apple, tone: 'error', label: 'Nutrición y salud', desc: 'Comer mejor, hidratación, descanso' },
  { id: 'SLEEP', icon: Moon, tone: 'info', label: 'Sueño', desc: 'Dormir bien y recuperarte' },
  { id: 'FINANCE', icon: Wallet, tone: 'warning', label: 'Finanzas', desc: 'Ahorrar, invertir, controlar gastos' },
  { id: 'LEARNING', icon: BookOpen, tone: 'primary', label: 'Aprendizaje', desc: 'Habilidades, idiomas, cursos' },
  { id: 'LOVE', icon: Heart, tone: 'error', label: 'Relaciones', desc: 'Pareja, familia, amigos' },
  { id: 'PERSONAL', icon: Leaf, tone: 'success', label: 'Bienestar mental', desc: 'Calma, meditación, propósito' },
  { id: 'CREATIVE', icon: Palette, tone: 'forest', label: 'Creatividad', desc: 'Arte, música, escritura' },
];
export const MAX_GOALS = 3;

/** Categoría de la meta del año según la primera área elegida (Sueño cuenta como Salud). */
export const goalCategoryOf = (areas: string[]) => (areas[0] === 'SLEEP' ? 'HEALTH' : areas[0] ?? 'PERSONAL');

/** Marca de una opción elegida: la palomita entra con un muelle. */
export function ChoiceMark({ on, off = null, round }: { on: boolean; off?: ReactNode; round?: boolean }) {
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center transition-colors duration-200', round ? 'size-8 rounded-full' : 'size-6 rounded-md', on ? 'bg-primary-strong text-on-primary' : 'border-2 border-border-strong')}>
      <AnimatePresence mode="popLayout" initial={false}>
        {on ? (
          <motion.span key="on" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={springs.snappy}>
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        ) : off && <motion.span key="off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.snappy}>{off}</motion.span>}
      </AnimatePresence>
    </span>
  );
}

export function GoalsContent({ selected, onToggle, yearGoal, onYearGoal }: { selected: string[]; onToggle: (id: string) => void; yearGoal: string; onYearGoal: (v: string) => void }) {
  const countId = useId();
  return (
    <motion.div variants={cascade} className="flex flex-col gap-6">
      <fieldset aria-describedby={countId} className="flex flex-col gap-3">
        <legend className="sr-only">Áreas para empezar</legend>
        <motion.p variants={rise} id={countId} aria-live="polite" className="text-label-lg text-primary-text">{selected.length} de {MAX_GOALS} elegidas</motion.p>
        <motion.div variants={cascade} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GOALS.map((g) => {
            const on = selected.includes(g.id);
            const disabled = !on && selected.length >= MAX_GOALS;
            return (
              <motion.label
                key={g.id}
                variants={rise}
                className={cn(
                  'lq-choice relative flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3',
                  'hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-background',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <input type="checkbox" checked={on} disabled={disabled} onChange={() => onToggle(g.id)} className="sr-only" />
                <IconChip icon={g.icon} tone={g.tone} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-label-lg">{g.label}</span>
                  <span className="block text-body-sm text-on-surface-light">{g.desc}</span>
                </span>
                <ChoiceMark on={on} />
              </motion.label>
            );
          })}
        </motion.div>
      </fieldset>
      <motion.div variants={rise}>
      <Field label="Define tu meta del año" help={`Opcional. Queda como tu meta principal hasta el 31 de diciembre de ${new Date().getFullYear()}.`}>
        <Input value={yearGoal} onChange={(e) => onYearGoal(e.target.value)} placeholder="Ej. Correr mi primera carrera de 10 km" maxLength={120} />
      </Field>
      </motion.div>
    </motion.div>
  );
}

// ── Packs: un sistema listo de un toque ──────────────────────────────────────
export interface Pack {
  id: string;
  icon: LucideIcon;
  name: string;
  desc: string;
  habits: CreateHabitPayload[];
  /** Obstáculos (anti-hábitos) que trae el pack. */
  obstacles?: string[];
}

const SUNDAY = { type: 'days_per_week' as const, days: [0] };

export const PACKS: Pack[] = [
  {
    id: 'calm-morning', icon: Sunrise, name: 'Mañana en calma', desc: 'Agua, 5 minutos de orden y el plan del día.',
    habits: [
      { title: 'Un vaso de agua al despertar', category: 'HEALTH' },
      { title: '5 minutos de orden', category: 'PERSONAL' },
      { title: 'Plan del día en la libreta', category: 'PERSONAL' },
    ],
  },
  {
    id: 'no-screen-night', icon: Moon, name: 'Noche sin pantalla', desc: 'Lectura antes de dormir y el celular lejos.',
    habits: [{ title: 'Leer 10 minutos antes de dormir', category: 'LEARNING' }],
    obstacles: ['Pantalla después de las 11 p. m.'],
  },
  {
    id: 'ordered-week', icon: CalendarCheck, name: 'Semana ordenada', desc: 'El domingo planeas la semana y revisas tus metas.',
    habits: [
      { title: 'Plan de la semana en la libreta', category: 'PERSONAL', frequency: SUNDAY },
      { title: 'Revisar mis 3 metas', category: 'PERSONAL', frequency: SUNDAY },
    ],
  },
];
