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
import { genderOptionsFor } from '@/utils/gender';
import { ChipGroup, type ChipIcon, Field, IconChip, Input, type Tone, DatePicker } from '@/components/ui/lq';
import { AvatarPreview, AvatarStudio } from '@/components/character/AvatarPixelEditor';
import { HomeWindow, useNow } from '@/components/dashboard/HomeWindow';
import type { ThemeMode } from '@/store/themeStore';
import type { CreateHabitPayload } from '@/services/habit.service';
import { useLocale, type Copy, type Locale } from '@/lib/i18n';

// ── Movimiento ───────────────────────────────────────────────────────────────
/** Un bloque del paso: sube y aparece (hereda enter/center del paso). */
export const rise: Variants = { enter: { opacity: 0, y: 14 }, center: { opacity: 1, y: 0, transition: springs.natural } };
/** Lista o rejilla cuyos hijos (rise) entran uno tras otro. */
export const cascade: Variants = { enter: {}, center: { transition: { staggerChildren: 0.04 } } };

// ── Textos ───────────────────────────────────────────────────────────────────
const es = {
  howFound: { tiktok: 'TikTok', instagram: 'Instagram', friend: 'Una persona', creator: 'Un creador', other: 'Otro' },
  character: 'Tu personaje',
  characterBody: 'Te acompaña en tu espacio. Puedes cambiarlo cuando quieras.',
  createAvatar: 'Crea tu avatar',
  name: 'Tu nombre',
  namePlaceholder: 'Tu nombre',
  identify: '¿Cómo te identificas?',
  identifyHelp: 'Para hablarte bien y mostrarte zonas como Ciclo. Puedes cambiarlo en Ajustes.',
  found: '¿Cómo nos conociste?',
  optional: '(opcional)',
  birth: 'Fecha de nacimiento',
  birthHelp: 'Opcional. Para celebrar tu cumpleaños.',
  birthPlaceholder: 'Tu cumpleaños',
  avatarDone: '¡Listo!',
  lights: {
    light: { label: 'Claro', desc: 'Luz de día, papel cálido' },
    dark: { label: 'Oscuro', desc: 'Aurora: verde profundo y calma' },
    auto: { label: 'Automático', desc: 'Sigue la luz de tu teléfono' },
  },
  chooseLight: 'Elige tu luz',
  lightHelp: 'Puedes cambiarla cuando quieras en Ajustes.',
  areasLegend: 'Áreas para empezar',
  chosen: (n: number, max: number) => `${n} de ${max} elegidas`,
  yearGoal: 'Define tu meta del año',
  yearGoalHelp: (year: number) => `Opcional. Queda como tu meta principal hasta el 31 de diciembre de ${year}.`,
  yearGoalPlaceholder: 'Ej. Correr mi primera carrera de 10 km',
  goals: {
    FITNESS: { label: 'Entrenamiento', desc: 'Pesas, cardio, deporte o caminatas' },
    HEALTH: { label: 'Nutrición y salud', desc: 'Comer mejor, hidratación, descanso' },
    SLEEP: { label: 'Sueño', desc: 'Dormir bien y recuperarte' },
    FINANCE: { label: 'Finanzas', desc: 'Ahorrar, invertir, controlar gastos' },
    LEARNING: { label: 'Aprendizaje', desc: 'Habilidades, idiomas, cursos' },
    LOVE: { label: 'Relaciones', desc: 'Pareja, familia, amigos' },
    PERSONAL: { label: 'Bienestar mental', desc: 'Calma, meditación, propósito' },
    CREATIVE: { label: 'Creatividad', desc: 'Arte, música, escritura' },
  } as Record<string, { label: string; desc: string }>,
  packs: {
    'calm-morning': { name: 'Mañana en calma', desc: 'Agua, 5 minutos de orden y el plan del día.' },
    'no-screen-night': { name: 'Noche sin pantalla', desc: 'Lectura antes de dormir y el celular lejos.' },
    'ordered-week': { name: 'Semana ordenada', desc: 'El domingo planeas la semana y revisas tus metas.' },
  } as Record<string, { name: string; desc: string }>,
  habits: {
    water: 'Un vaso de agua al despertar',
    order: '5 minutos de orden',
    plan: 'Plan del día en la libreta',
    read: 'Leer 10 minutos antes de dormir',
    weekPlan: 'Plan de la semana en la libreta',
    reviewGoals: 'Revisar mis 3 metas',
  },
  obstacle: 'Pantalla después de las 11 p. m.',
};

const en: typeof es = {
  howFound: { tiktok: 'TikTok', instagram: 'Instagram', friend: 'A friend', creator: 'A creator', other: 'Other' },
  character: 'Your character',
  characterBody: 'It keeps you company in your space. You can change it anytime.',
  createAvatar: 'Create your avatar',
  name: 'Your name',
  namePlaceholder: 'Your name',
  identify: 'How do you identify?',
  identifyHelp: 'So we can speak to you well and show zones like Cycle. You can change it in Settings.',
  found: 'How did you find us?',
  optional: '(optional)',
  birth: 'Date of birth',
  birthHelp: 'Optional. So we can celebrate your birthday.',
  birthPlaceholder: 'Your birthday',
  avatarDone: 'Done!',
  lights: {
    light: { label: 'Light', desc: 'Daylight, warm paper' },
    dark: { label: 'Dark', desc: 'Aurora: deep green and calm' },
    auto: { label: 'Automatic', desc: 'Follows your phone’s light' },
  },
  chooseLight: 'Choose your light',
  lightHelp: 'You can change it anytime in Settings.',
  areasLegend: 'Areas to start with',
  chosen: (n, max) => `${n} of ${max} selected`,
  yearGoal: 'Set your goal for the year',
  yearGoalHelp: (year) => `Optional. It stays as your main goal until December 31, ${year}.`,
  yearGoalPlaceholder: 'E.g. Run my first 10K',
  goals: {
    FITNESS: { label: 'Training', desc: 'Weights, cardio, sports or walks' },
    HEALTH: { label: 'Nutrition & health', desc: 'Eat better, hydration, rest' },
    SLEEP: { label: 'Sleep', desc: 'Sleep well and recover' },
    FINANCE: { label: 'Finances', desc: 'Save, invest, control spending' },
    LEARNING: { label: 'Learning', desc: 'Skills, languages, courses' },
    LOVE: { label: 'Relationships', desc: 'Partner, family, friends' },
    PERSONAL: { label: 'Mental wellbeing', desc: 'Calm, meditation, purpose' },
    CREATIVE: { label: 'Creativity', desc: 'Art, music, writing' },
  },
  packs: {
    'calm-morning': { name: 'Calm morning', desc: 'Water, 5 minutes of order and your plan for the day.' },
    'no-screen-night': { name: 'Screen-free night', desc: 'Reading before bed and your phone out of reach.' },
    'ordered-week': { name: 'Organized week', desc: 'On Sunday you plan the week and review your goals.' },
  },
  habits: {
    water: 'A glass of water when you wake up',
    order: '5 minutes of tidying up',
    plan: 'Plan the day in your notebook',
    read: 'Read 10 minutes before bed',
    weekPlan: 'Plan the week in your notebook',
    reviewGoals: 'Review my 3 goals',
  },
  obstacle: 'Screens after 11 p.m.',
};

const COPY: Copy<typeof es> = { es, en };

/** Textos del onboarding en el idioma de la persona. */
export function onboardingCopy(locale: Locale) { return COPY[locale]; }

// ── Identidad y personaje ────────────────────────────────────────────────────
const HOW_FOUND_VALUES = ['tiktok', 'instagram', 'friend', 'creator', 'other'] as const;
export type HowFound = (typeof HOW_FOUND_VALUES)[number];

const HOW_FOUND_ICON: Record<HowFound, LucideIcon> = { tiktok: TikTok as LucideIcon, instagram: Instagram, friend: Users, creator: Star, other: Globe };

/** «¿Cómo nos conociste?» en el idioma indicado. */
export function howFoundOptions(locale: Locale) {
  return HOW_FOUND_VALUES.map((value) => ({ value, label: COPY[locale].howFound[value], icon: HOW_FOUND_ICON[value] }));
}

const GENDER_ICON: Record<Gender, ChipIcon> = { female: Venus, male: Mars, other: GenderOther, unspecified: Sparkle };

export function IdentityFields({ name, onName, nameError, gender, onGender, genderError, lockGender, config, avatarAnimate = 'idle', onEditAvatar, howFound, onHowFound, birthDate, onBirthDate }: {
  name: string; onName: (v: string) => void; nameError?: string;
  gender: Gender | ''; onGender: (g: Gender) => void; genderError?: string; lockGender: boolean;
  config: AvatarConfig; avatarAnimate?: PixelAnimation; onEditAvatar: () => void;
  howFound: HowFound | ''; onHowFound: (v: HowFound) => void;
  birthDate: string; onBirthDate: (v: string) => void;
}) {
  const locale = useLocale();
  const t = COPY[locale];
  const genderChips = genderOptionsFor(locale).map((o) => ({ ...o, icon: GENDER_ICON[o.value] }));
  return (
    <motion.div variants={cascade} className="flex flex-col gap-6">
      {/* El personaje: se ve desde el primer paso y se personaliza en su estudio. */}
      <motion.div variants={rise} className="flex items-center gap-4">
        <AvatarPreview config={config} size={72} animate={avatarAnimate} className="shrink-0" />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-label-lg">{t.character}</span>
          <span className="text-body-sm text-on-surface-light">{t.characterBody}</span>
          <button type="button" onClick={onEditAvatar} className="inline-flex min-h-11 items-center text-label-lg text-primary-text underline underline-offset-4">
            {t.createAvatar}
          </button>
        </div>
      </motion.div>
      <motion.div variants={rise}>
        <Field label={t.name} error={nameError}>
          <Input value={name} onChange={(e) => onName(e.target.value)} placeholder={t.namePlaceholder} maxLength={60} autoComplete="nickname" />
        </Field>
      </motion.div>
      {!lockGender && (
        <motion.div variants={rise} className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">{t.identify}</span>
          <ChipGroup<Gender | ''> label={t.identify} value={gender} onChange={(g) => g && onGender(g)} options={genderChips} />
          {genderError
            ? <span role="alert" className="text-body-sm text-error-text">{genderError}</span>
            : <span className="text-body-sm text-on-surface-light">{t.identifyHelp}</span>}
        </motion.div>
      )}
      <motion.div variants={rise} className="flex flex-col gap-2">
        <span aria-hidden className="text-label-lg text-on-surface">{t.found} <span className="font-normal text-on-surface-light">{t.optional}</span></span>
        <ChipGroup<HowFound | ''> label={`${t.found} ${t.optional}`} value={howFound} onChange={(v) => v && onHowFound(v)} options={howFoundOptions(locale)} />
      </motion.div>
      <motion.div variants={rise}>
        <Field label={t.birth} help={t.birthHelp}>
          <DatePicker clearable value={birthDate} onChange={onBirthDate} max={new Date().toISOString().slice(0, 10)} placeholder={t.birthPlaceholder} />
        </Field>
      </motion.div>
    </motion.div>
  );
}

/** Estudio del avatar a pantalla completa (el mismo que en Perfil). */
export function AvatarContent({ config, onChange, celebrate = 0 }: { config: AvatarConfig; onChange: (c: AvatarConfig) => void; celebrate?: number }) {
  const t = COPY[useLocale()];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border bg-background shadow-lg"
    >
      <AvatarStudio config={config} onChange={onChange} celebrate={celebrate} doneLabel={t.avatarDone} />
    </motion.div>
  );
}

// ── Luz ──────────────────────────────────────────────────────────────────────
const LIGHT_ICON: Record<ThemeMode, LucideIcon> = { light: Sun, dark: MoonStar, auto: Monitor };

/** Tres opciones; al elegir, toda la pantalla cambia al momento (la vista previa es la app misma). */
export function LightChoice({ mode, onMode }: { mode: ThemeMode; onMode: (m: ThemeMode) => void }) {
  const t = COPY[useLocale()];
  const now = useNow();
  // La ventana es la pieza más pesada del paso: se monta cuando el paso ya terminó de entrar,
  // así el deslizamiento no pierde cuadros en móviles. Su caja queda reservada (sin saltos).
  const [windowReady, setWindowReady] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setWindowReady(true), 380); return () => window.clearTimeout(t); }, []);
  const lights: ThemeMode[] = ['light', 'dark', 'auto'];
  return (
    <motion.div variants={cascade} className="flex flex-col gap-6">
      <motion.div variants={rise} className="min-h-[226px]">{windowReady && <HomeWindow now={now} className="max-w-[320px]" />}</motion.div>
      <motion.fieldset variants={cascade} className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">{t.chooseLight}</legend>
        {lights.map((m) => (
          <motion.label
            key={m}
            variants={rise}
            className={cn(
              'lq-choice flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 sm:flex-col sm:items-start',
              'hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-background',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
            )}
          >
            <input type="radio" name="light" checked={mode === m} onChange={() => onMode(m)} className="sr-only" />
            <IconChip icon={LIGHT_ICON[m]} tone="primary" size="sm" />
            <span className="min-w-0">
              <span className="block text-label-lg">{t.lights[m].label}</span>
              <span className="block text-body-sm text-on-surface-light">{t.lights[m].desc}</span>
            </span>
          </motion.label>
        ))}
      </motion.fieldset>
      <motion.p variants={rise} className="text-body-sm text-on-surface-light">{t.lightHelp}</motion.p>
    </motion.div>
  );
}

// ── Áreas y meta del año ─────────────────────────────────────────────────────
const GOAL_ICON: Record<string, { icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  FITNESS: { icon: Dumbbell, tone: 'success' },
  HEALTH: { icon: Apple, tone: 'error' },
  SLEEP: { icon: Moon, tone: 'info' },
  FINANCE: { icon: Wallet, tone: 'warning' },
  LEARNING: { icon: BookOpen, tone: 'primary' },
  LOVE: { icon: Heart, tone: 'error' },
  PERSONAL: { icon: Leaf, tone: 'success' },
  CREATIVE: { icon: Palette, tone: 'forest' },
};

export const MAX_GOALS = 3;

/** Las áreas para empezar, en el idioma indicado. */
export function goalsFor(locale: Locale) {
  return Object.entries(COPY[locale].goals).map(([id, g]) => ({ id, ...g, ...GOAL_ICON[id] }));
}

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
  const locale = useLocale();
  const t = COPY[locale];
  const countId = useId();
  return (
    <motion.div variants={cascade} className="flex flex-col gap-6">
      <fieldset aria-describedby={countId} className="flex flex-col gap-3">
        <legend className="sr-only">{t.areasLegend}</legend>
        <motion.p variants={rise} id={countId} aria-live="polite" className="text-label-lg text-primary-text">{t.chosen(selected.length, MAX_GOALS)}</motion.p>
        <motion.div variants={cascade} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {goalsFor(locale).map((g) => {
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
        <Field label={t.yearGoal} help={t.yearGoalHelp(new Date().getFullYear())}>
          <Input value={yearGoal} onChange={(e) => onYearGoal(e.target.value)} placeholder={t.yearGoalPlaceholder} maxLength={120} />
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

/** Los packs de un toque, con los títulos de hábito en el idioma de la persona (se guardan así en su cuenta). */
export function packsFor(locale: Locale): Pack[] {
  const t = COPY[locale];
  return [
    {
      id: 'calm-morning', icon: Sunrise, name: t.packs['calm-morning'].name, desc: t.packs['calm-morning'].desc,
      habits: [
        { title: t.habits.water, category: 'HEALTH' },
        { title: t.habits.order, category: 'PERSONAL' },
        { title: t.habits.plan, category: 'PERSONAL' },
      ],
    },
    {
      id: 'no-screen-night', icon: Moon, name: t.packs['no-screen-night'].name, desc: t.packs['no-screen-night'].desc,
      habits: [{ title: t.habits.read, category: 'LEARNING' }],
      obstacles: [t.obstacle],
    },
    {
      id: 'ordered-week', icon: CalendarCheck, name: t.packs['ordered-week'].name, desc: t.packs['ordered-week'].desc,
      habits: [
        { title: t.habits.weekPlan, category: 'PERSONAL', frequency: SUNDAY },
        { title: t.habits.reviewGoals, category: 'PERSONAL', frequency: SUNDAY },
      ],
    },
  ];
}
