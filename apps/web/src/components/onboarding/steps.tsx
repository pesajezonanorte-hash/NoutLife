// Pasos del onboarding con el sistema lq. El shell (progreso, título, botones)
// vive en pages/Onboarding; aquí solo el contenido de cada paso.
import { useId } from 'react';
import {
  Apple, BookOpen, Check, Dumbbell, Heart, Leaf, Moon, Palette, Sparkles, Wallet, type LucideIcon,
} from 'lucide-react';
import type { AvatarConfig } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { Field, IconChip, Input, SegmentedControl, Select, type Tone } from '@/components/ui/lq';
import { AvatarPixelEditor, AvatarPreview } from '@/components/character/AvatarPixelEditor';

// ── Identidad ────────────────────────────────────────────────────────────────
export function IdentityFields({ name, onName, nameError, birthDate, onBirthDate, gender, onGender, lockGender, timezone }: {
  name: string; onName: (v: string) => void; nameError?: string;
  birthDate: string; onBirthDate: (v: string) => void;
  gender: 'male' | 'female'; onGender: (g: 'male' | 'female') => void; lockGender: boolean;
  timezone: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="¿Cómo quieres que te llamemos?" error={nameError}>
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Tu nombre de héroe" maxLength={60} autoComplete="nickname" />
      </Field>
      {!lockGender && (
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">Tu personaje</span>
          <SegmentedControl role="radiogroup" label="Tu personaje" value={gender} onChange={onGender}
            options={[{ value: 'male', label: 'Héroe' }, { value: 'female', label: 'Heroína' }]} />
        </div>
      )}
      <Field label="Fecha de nacimiento" help="Opcional. Para celebrar tu cumpleaños en LifeQuest.">
        <Input type="date" value={birthDate} onChange={(e) => onBirthDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
      </Field>
      <div className="flex flex-col gap-1">
        <span className="text-label-lg text-on-surface">Zona horaria</span>
        <span className="text-body-md">{timezone}</span>
        <span className="text-body-sm text-on-surface-light">Detectada automáticamente; puedes cambiarla luego en Ajustes.</span>
      </div>
    </div>
  );
}

// ── Bienvenida ───────────────────────────────────────────────────────────────
export function WelcomeContent({ config }: { config: AvatarConfig }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <AvatarPreview config={config} size={112} className="lq-halo" />
      <div className="flex w-full flex-col gap-3 rounded-2xl bg-secondary/[var(--lq-soft-alpha)] p-5 text-left">
        <span className="flex items-center gap-2 text-label-lg text-secondary-text">
          <Sparkles aria-hidden className="size-4" strokeWidth={1.75} />El Sabio
        </span>
        <p className="text-body-md text-on-surface">
          ¡Hola! Tu vida es una aventura y hoy empieza la partida. Personaliza tu avatar, elige qué quieres mejorar y crea tu primera misión. Te acompaño en cada paso.
        </p>
      </div>
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function AvatarContent({ config, onChange }: { config: AvatarConfig; onChange: (c: AvatarConfig) => void }) {
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[200px_1fr] md:items-start md:gap-8">
      <div className="flex justify-center md:sticky md:top-8">
        <AvatarPreview config={config} size={120} />
      </div>
      <AvatarPixelEditor config={config} onChange={onChange} showBody={false} />
    </div>
  );
}

// ── Metas ────────────────────────────────────────────────────────────────────
export const GOALS: Array<{ id: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'>; label: string; desc: string }> = [
  { id: 'FITNESS', icon: Dumbbell, tone: 'success', label: 'Gimnasio y fuerza', desc: 'Entrenar, ganar músculo, perder grasa' },
  { id: 'HEALTH', icon: Apple, tone: 'error', label: 'Nutrición y salud', desc: 'Comer mejor, hidratación, descanso' },
  { id: 'SLEEP', icon: Moon, tone: 'info', label: 'Sueño', desc: 'Dormir bien y recuperarte' },
  { id: 'FINANCE', icon: Wallet, tone: 'warning', label: 'Finanzas', desc: 'Ahorrar, invertir, controlar gastos' },
  { id: 'LEARNING', icon: BookOpen, tone: 'primary', label: 'Aprendizaje', desc: 'Habilidades, idiomas, cursos' },
  { id: 'LOVE', icon: Heart, tone: 'error', label: 'Relaciones', desc: 'Pareja, familia, amigos' },
  { id: 'PERSONAL', icon: Leaf, tone: 'success', label: 'Bienestar mental', desc: 'Mindfulness, meditación, propósito' },
  { id: 'CREATIVE', icon: Palette, tone: 'secondary', label: 'Creatividad', desc: 'Arte, música, escritura' },
];
export const MAX_GOALS = 3;

export function GoalsContent({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const countId = useId();
  return (
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
  );
}

// ── Primera misión ───────────────────────────────────────────────────────────
const QUEST_CATEGORIES = [
  ['PERSONAL', 'Personal'], ['FITNESS', 'Fitness'], ['FINANCE', 'Finanzas'], ['LEARNING', 'Aprendizaje'],
  ['HEALTH', 'Salud'], ['LOVE', 'Relaciones'], ['CREATIVE', 'Creatividad'], ['SOCIAL', 'Social'],
] as const;

export function FirstQuestFields({ title, onTitle, titleError, category, onCategory, deadline, onDeadline }: {
  title: string; onTitle: (v: string) => void; titleError?: string;
  category: string; onCategory: (v: string) => void;
  deadline: string; onDeadline: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Tu meta principal" help="Será tu misión principal: 500 XP al completarla." error={titleError}>
        <Input value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Ej. Correr mi primera carrera de 10 km" maxLength={120} />
      </Field>
      <Field label="Categoría">
        <Select value={category} onChange={(e) => onCategory(e.target.value)}>
          {QUEST_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </Field>
      <Field label="Fecha objetivo">
        <Input type="date" value={deadline} onChange={(e) => onDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
      </Field>
    </div>
  );
}
