// Editor del avatar pixel: vista previa + grupos de opciones. Cada grupo es un
// radiogroup nativo (flechas del teclado gratis); los colores son muestras de
// 44 px con anillo de selección y foco.
import { useId, type ReactNode } from 'react';
import type { AvatarConfig } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/ui/lq';
import { MiguelSprite } from './MiguelSprite';
import {
  ACCESSORIES, ACCESSORY_LABELS, EXPRESSIONS, EXPRESSION_LABELS, HAIR_COLORS, HAIR_STYLES, HAIR_STYLE_LABELS,
  PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS, switchBody,
} from './avatarOptions';

export function AvatarPreview({ config, size = 120, animate = 'idle', className }: {
  config: AvatarConfig; size?: number; animate?: 'idle' | 'celebrate' | 'none'; className?: string;
}) {
  return (
    <span className={cn('flex items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)]', className)} style={{ width: size + 32, height: size + 32 }}>
      <MiguelSprite
        size={size}
        bodyType={config.bodyType}
        hairStyle={config.hairStyle}
        hairColor={config.hairColor}
        skinColor={config.skinColor}
        shirtColor={config.shirtColor}
        pantsColor={config.pants}
        accessory={config.accessory}
        expression={config.expression}
        animate={animate}
      />
    </span>
  );
}

function Group({ label, children }: { label: string; children: (name: string) => ReactNode }) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label-lg text-on-surface">{label}</legend>
      {children(id)}
    </fieldset>
  );
}

export function ChoiceChips<T extends string>({ label, value, options, labels, onChange, cols = 3 }: {
  label: string; value: T; options: T[]; labels: Record<T, string>; onChange: (v: T) => void; cols?: 2 | 3;
}) {
  return (
    <Group label={label}>
      {(name) => (
        <div className={cn('grid gap-2', cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
          {options.map((o) => (
            <label
              key={o}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-3 text-center text-label-lg text-on-surface transition-colors',
                'hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-primary/[var(--lq-soft-alpha)] has-[:checked]:text-primary-text',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
              )}
            >
              <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} className="sr-only" />
              {labels[o]}
            </label>
          ))}
        </div>
      )}
    </Group>
  );
}

export function Swatches({ label, value, colors, onChange }: {
  label: string; value: string; colors: string[]; onChange: (c: string) => void;
}) {
  return (
    <Group label={label}>
      {(name) => (
        <div className="flex flex-wrap gap-2">
          {colors.map((c, i) => (
            <label
              key={c}
              className={cn(
                'relative size-11 cursor-pointer rounded-full border border-border-strong',
                'has-[:checked]:shadow-[0_0_0_3px_rgb(var(--lq-background)),0_0_0_5px_rgb(var(--lq-primary))]',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[6px] has-[:focus-visible]:outline-primary',
              )}
              // Color del avatar (dato del usuario), no un color de interfaz.
              style={{ backgroundColor: c }}
            >
              <input
                type="radio" name={name} value={c} checked={(value ?? '').toLowerCase() === c.toLowerCase()}
                onChange={() => onChange(c)} aria-label={`Opción ${i + 1} de ${colors.length}`}
                className="sr-only"
              />
            </label>
          ))}
        </div>
      )}
    </Group>
  );
}

interface EditorProps {
  config: AvatarConfig;
  onChange: (c: AvatarConfig) => void;
  /** Mostrar el selector de cuerpo (en el onboarding ya se eligió antes). */
  showBody?: boolean;
}

/** Solo los controles; la vista previa la coloca el contenedor. */
export function AvatarPixelEditor({ config, onChange, showBody = true }: EditorProps) {
  const body = config.bodyType ?? 'male';
  const set = <K extends keyof AvatarConfig>(k: K) => (v: AvatarConfig[K]) => onChange({ ...config, [k]: v });
  return (
    <div className="flex flex-col gap-6">
      {showBody && (
        <div className="flex flex-col gap-2">
          <span aria-hidden className="text-label-lg text-on-surface">Cuerpo</span>
          <SegmentedControl
            role="radiogroup" label="Cuerpo"
            value={body} onChange={(b) => onChange(switchBody(config, b))}
            options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }]}
          />
        </div>
      )}
      <ChoiceChips label="Peinado" value={config.hairStyle} options={HAIR_STYLES[body]} labels={HAIR_STYLE_LABELS} onChange={set('hairStyle')} />
      <Swatches label="Color de cabello" value={config.hairColor} colors={HAIR_COLORS} onChange={set('hairColor')} />
      <Swatches label="Tono de piel" value={config.skinColor} colors={SKIN_COLORS} onChange={set('skinColor')} />
      <Swatches label="Camiseta" value={config.shirtColor} colors={SHIRT_COLORS} onChange={set('shirtColor')} />
      <Swatches label="Pantalón" value={config.pants} colors={PANTS_COLORS} onChange={set('pants')} />
      <ChoiceChips label="Accesorio" value={config.accessory} options={ACCESSORIES} labels={ACCESSORY_LABELS} onChange={set('accessory')} />
      <ChoiceChips label="Expresión" value={config.expression} options={EXPRESSIONS} labels={EXPRESSION_LABELS} onChange={set('expression')} cols={2} />
    </div>
  );
}
