// Pasos del onboarding con el sistema lq. El shell (progreso, título, botones)
// vive en pages/Onboarding; aquí solo el contenido de cada paso.
import { useId } from 'react';
import {
  Apple, BookOpen, Check, Dumbbell, Heart, Leaf, Monitor, Moon, MoonStar, Palette, Sun, Sunrise, Wallet, CalendarCheck, type LucideIcon,
} from 'lucide-react';
import type { AvatarConfig, Gender } from '@noutlife/shared';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GENDER_OPTIONS } from '@/utils/gender';
import { ChipGroup, Field, IconChip, Input, type Tone, DatePicker } from '@/components/ui/lq';
import { AvatarPreview, AvatarStudio } from '@/components/character/AvatarPixelEditor';
import { HomeWindow, useNow } from '@/components/dashboard/HomeWindow';
import type { ThemeMode } from '@/store/themeStore';
import type { CreateHabitPayload } from '@/services/habit.service';

// ── Identidad y personaje ────────────────────────────────────────────────────
export const HOW_FOUND = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'friend', label: 'Una persona' },
  { value: 'creator', label: 'Un creador' },
  { value: 'other', label: 'Otro' },
] as const;
export type HowFound = (typeof HOW_FOUND)[number]['value'];

export function IdentityFields({ name, onName, nameError, gender, onGender, genderError, lockGender, config, onEditAvatar, howFound, onHowFound, birthDate, onBirthDate }: {
  name: string; onName: (v: string) => void; nameError?: string;
  gender: Gender | ''; onGender: (g: Gender) => void; genderError?: string; lockGender: boolean;
  config: AvatarConfig; onEditAvatar: () => void;
  howFound: HowFound | ''; onHowFound: (v: HowFound) => void;
  birthDate: string; onBirthDate: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* El personaje: se ve desde el primer paso y se personaliza en su estudio. */}
      <div className="flex items-center gap-4">
        <AvatarPreview config={config} size={72} className="shrink-0" />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-label-lg">Tu personaje</span>
          <span className="text-body-sm text-on-surface-light">Te acompaña en tu espacio. Puedes cambiarlo cuando quieras.</span>
          <button type="button" onClick={onEditAvatar} className="inline-flex min-h-11 items-center text-label-lg text-primary-text underline underline-offset-4">
            Crea tu avatar
          </button>
        </div>
      </div>
      <Field label="Tu nombre" error={nameError}>
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Tu nombre" maxLength={60} autoComplete="nickname" />
      </Field>
      {!lockGender && (
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">¿Cómo te identificas?</span>
          <ChipGroup<Gender | ''> label="¿Cómo te identificas?" value={gender} onChange={(g) => g && onGender(g)} options={GENDER_OPTIONS} />
          {genderError
            ? <span role="alert" className="text-body-sm text-error-text">{genderError}</span>
            : <span className="text-body-sm text-on-surface-light">Para hablarte bien y mostrarte zonas como Ciclo. Puedes cambiarlo en Ajustes.</span>}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-label-lg text-on-surface">¿Cómo nos conociste? <span className="font-normal text-on-surface-light">(opcional)</span></span>
        <ChipGroup<HowFound | ''> label="¿Cómo nos conociste? (opcional)" value={howFound} onChange={(v) => v && onHowFound(v)} options={[...HOW_FOUND]} />
      </div>
      <Field label="Fecha de nacimiento" help="Opcional. Para celebrar tu cumpleaños.">
        <DatePicker clearable value={birthDate} onChange={onBirthDate} max={new Date().toISOString().slice(0, 10)} placeholder="Tu cumpleaños" />
      </Field>
    </div>
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
  return (
    <div className="flex flex-col gap-6">
      <HomeWindow now={now} className="max-w-[320px]" />
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Elige tu luz</legend>
        {LIGHTS.map((l) => (
          <label
            key={l.mode}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 sm:flex-col sm:items-start',
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
          </label>
        ))}
      </fieldset>
      <p className="text-body-sm text-on-surface-light">Puedes cambiarla cuando quieras en Ajustes.</p>
    </div>
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

export function GoalsContent({ selected, onToggle, yearGoal, onYearGoal }: { selected: string[]; onToggle: (id: string) => void; yearGoal: string; onYearGoal: (v: string) => void }) {
  const countId = useId();
  return (
    <div className="flex flex-col gap-6">
      <fieldset aria-describedby={countId} className="flex flex-col gap-3">
        <legend className="sr-only">Áreas para empezar</legend>
        <p id={countId} aria-live="polite" className="text-label-lg text-primary-text">{selected.length} de {MAX_GOALS} elegidas</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {GOALS.map((g) => {
            const on = selected.includes(g.id);
            const disabled = !on && selected.length >= MAX_GOALS;
            return (
              <label
                key={g.id}
                className={cn(
                  'relative flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3',
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
                <span aria-hidden className={cn('flex size-6 shrink-0 items-center justify-center rounded-md', on ? 'bg-primary-strong text-on-primary' : 'border-2 border-border-strong')}>
                  {on && <Check className="size-4" strokeWidth={3} />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="Define tu meta del año" help={`Opcional. Queda como tu meta principal hasta el 31 de diciembre de ${new Date().getFullYear()}.`}>
        <Input value={yearGoal} onChange={(e) => onYearGoal(e.target.value)} placeholder="Ej. Correr mi primera carrera de 10 km" maxLength={120} />
      </Field>
    </div>
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
