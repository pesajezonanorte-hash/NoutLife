// Estudio del personaje pixel: vista previa fija arriba (fondo de cuadros) con
// cuerpo y «Aleatorio», y pestañas Cuerpo · Pelo · Cara · Ropa · Extras. Cada
// opción se muestra con una miniatura del propio personaje. Los grupos de
// opciones son radiogroups nativos (flechas del teclado); los extras, casillas.
// Se usa en el onboarding y en Perfil → Personalizar avatar.
import { useId, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dices, Pipette, Undo2 } from 'lucide-react';
import type { AvatarConfig } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { Button, SegmentedControl, Switch, Tabs } from '@/components/ui/lq';
import { PixelAvatar, type PixelAnimation } from './pixel/PixelAvatar';
import type { Body, ExtraId, PixelLook } from './pixel/engine';
import {
  BOTTOMS, BROWS, CLOTH_COLORS, EXTRAS, EYES, EYE_COLORS, FACIALS, HAIRS, HAIR_COLORS, MOUTHS, SHOES, SKINS, TOPS,
  lookFrom, randomLook, switchBody, toConfig, toggleExtra, type Option,
} from './pixel/look';

/** Fondo de cuadros del escenario (tokens; el personaje es lo único con colores propios). */
const STAGE = 'bg-surface-variant bg-[repeating-conic-gradient(rgb(var(--lq-primary)/0.09)_0_25%,transparent_0_50%)] bg-[length:16px_16px]';

export function AvatarPreview({ config, size = 120, animate = 'idle', className }: {
  config: AvatarConfig; size?: number; animate?: PixelAnimation; className?: string;
}) {
  const look = useMemo(() => lookFrom(config), [config]);
  return (
    <span className={cn('flex items-end justify-center overflow-hidden rounded-3xl pb-2', STAGE, className)} style={{ width: size + 40, height: size * 1.125 + 28 }}>
      <PixelAvatar look={look} size={size} animate={animate} />
    </span>
  );
}

// ── Controles ───────────────────────────────────────────────────────────────
function Group({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 flex w-full items-center justify-between gap-2 text-label-lg text-on-surface">{label}{aside}</legend>
      {children}
    </fieldset>
  );
}

const tileCls = cn(
  'group relative flex min-h-[92px] cursor-pointer flex-col items-center justify-end gap-1 overflow-hidden rounded-xl border border-border bg-background px-1 pb-1.5 pt-1 text-center',
  'transition-[border-color,background-color,transform] duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-border-strong active:scale-[.97]',
  'has-[:checked]:border-primary has-[:checked]:bg-primary/[var(--lq-soft-alpha)]',
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
);

/** Rejilla de opciones con miniatura (radio). */
function OptionGrid<T extends string>({ label, look, options, value, apply, crop, onSelect }: {
  label: string; look: PixelLook; options: Option<T>[]; value: T; apply: (l: PixelLook, v: T) => PixelLook; crop: 'head' | 'body' | 'full'; onSelect: (v: T) => void;
}) {
  const name = useId();
  return (
    <Group label={label}>
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5">
        {options.map((o) => (
          <label key={o.id} className={tileCls}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onSelect(o.id)} className="sr-only" />
            <PixelAvatar look={apply(look, o.id)} size={crop === 'body' ? 72 : 66} crop={crop} animate="none" />
            <span className="text-label-md leading-tight text-on-surface group-has-[:checked]:text-primary-text">{o.label}</span>
          </label>
        ))}
      </div>
    </Group>
  );
}

function Swatches({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  const name = useId();
  const custom = !colors.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <Group label={label}>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <label
            key={c}
            className={cn(
              'relative size-11 cursor-pointer rounded-full border border-border-strong transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] hover:scale-110 active:scale-95',
              'has-[:checked]:shadow-[0_0_0_3px_rgb(var(--lq-background)),0_0_0_5px_rgb(var(--lq-primary))]',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[6px] has-[:focus-visible]:outline-primary',
            )}
            // Color del avatar (dato del usuario), no un color de interfaz.
            style={{ backgroundColor: c }}
          >
            <input type="radio" name={name} checked={value.toLowerCase() === c.toLowerCase()} onChange={() => onChange(c)} aria-label={`Color ${i + 1} de ${colors.length}`} className="sr-only" />
          </label>
        ))}
        <label
          className={cn(
            'relative flex size-11 cursor-pointer items-center justify-center rounded-full border border-dashed border-border-strong text-on-surface transition-transform duration-200 hover:scale-110',
            custom && 'shadow-[0_0_0_3px_rgb(var(--lq-background)),0_0_0_5px_rgb(var(--lq-primary))]',
            'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[6px] has-[:focus-visible]:outline-primary',
          )}
          style={custom ? { backgroundColor: value } : undefined}
        >
          {!custom && <Pipette aria-hidden className="size-5" strokeWidth={1.75} />}
          <input type="color" value={value.length === 7 ? value : '#888888'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: color personalizado`} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </Group>
  );
}

function ExtrasGrid({ look, onChange }: { look: PixelLook; onChange: (l: PixelLook) => void }) {
  return (
    <Group label="Accesorios" aside={<span className="text-body-sm text-on-surface-light">Combina los que quieras</span>}>
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-5">
        {EXTRAS.map((o) => (
          <label key={o.id} className={tileCls}>
            <input type="checkbox" checked={look.extras.includes(o.id)} onChange={() => onChange(toggleExtra(look, o.id))} className="sr-only" />
            <PixelAvatar look={{ ...look, extras: look.extras.includes(o.id) ? look.extras : toggleExtra(look, o.id).extras }} size={66} crop={o.id === 'bufanda' || o.id === 'collar' ? 'body' : 'head'} animate="none" />
            <span className="text-label-md leading-tight text-on-surface group-has-[:checked]:text-primary-text">{o.label}</span>
          </label>
        ))}
      </div>
    </Group>
  );
}

// ── Estudio ─────────────────────────────────────────────────────────────────
type Section = 'cuerpo' | 'pelo' | 'cara' | 'ropa' | 'extras';
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'cuerpo', label: 'Cuerpo' }, { value: 'pelo', label: 'Pelo' }, { value: 'cara', label: 'Cara' },
  { value: 'ropa', label: 'Ropa' }, { value: 'extras', label: 'Extras' },
];

interface EditorProps {
  config: AvatarConfig;
  onChange: (c: AvatarConfig) => void;
  /** Compatibilidad: el cuerpo siempre se puede elegir en el estudio. */
  showBody?: boolean;
}

export function AvatarPixelEditor({ config, onChange }: EditorProps) {
  const look = useMemo(() => lookFrom(config), [config]);
  const [section, setSection] = useState<Section>('cuerpo');
  const [undo, setUndo] = useState<PixelLook | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const panelId = useId();

  const commit = (next: PixelLook) => onChange(toConfig(next, config));
  const set = <K extends keyof PixelLook>(k: K) => (v: PixelLook[K]) => commit({ ...look, [k]: v });
  const roll = () => { setUndo(look); setRollKey((k) => k + 1); commit(randomLook(look.body)); };

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-4 rounded-2xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur sm:gap-5">
        <motion.span key={rollKey} initial={rollKey ? { scale: 0.9, opacity: 0.4 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 20 }} className={cn('flex shrink-0 items-end justify-center overflow-hidden rounded-2xl pb-1.5', STAGE)} style={{ width: 112, height: 128 }}>
          <PixelAvatar look={look} size={96} />
        </motion.span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <SegmentedControl
            role="radiogroup" label="Tipo de cuerpo"
            value={look.body} onChange={(b: Body) => commit(switchBody(look, b))}
            options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={roll}><Dices aria-hidden className="size-4" strokeWidth={1.75} />Aleatorio</Button>
            {undo && <Button variant="ghost" size="sm" onClick={() => { commit(undo); setUndo(null); }}><Undo2 aria-hidden className="size-4" strokeWidth={1.75} />Deshacer</Button>}
          </div>
        </div>
      </div>

      <Tabs label="Partes del personaje" value={section} onChange={setSection} options={SECTIONS} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          id={panelId}
          role="tabpanel"
          aria-label={SECTIONS.find((s) => s.value === section)?.label}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease } }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="flex flex-col gap-6"
        >
          {section === 'cuerpo' && (
            <>
              <Swatches label="Tono de piel" value={look.skin} colors={SKINS} onChange={set('skin')} />
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-background px-4">
                <span className="text-label-lg">Mejillas sonrosadas</span>
                <Switch checked={look.blush} onChange={(e) => set('blush')(e.target.checked)} aria-label="Mejillas sonrosadas" />
              </label>
            </>
          )}
          {section === 'pelo' && (
            <>
              <OptionGrid label="Peinado" look={look} options={HAIRS} value={look.hair} apply={(l, v) => ({ ...l, hair: v, extras: [] })} crop="head" onSelect={set('hair')} />
              <Swatches label="Color de pelo" value={look.hairColor} colors={HAIR_COLORS} onChange={set('hairColor')} />
              <OptionGrid label="Vello facial" look={look} options={FACIALS} value={look.facial} apply={(l, v) => ({ ...l, facial: v })} crop="head" onSelect={set('facial')} />
            </>
          )}
          {section === 'cara' && (
            <>
              <OptionGrid label="Ojos" look={look} options={EYES} value={look.eyes} apply={(l, v) => ({ ...l, eyes: v, extras: l.extras.filter((e) => !['gafas_sol', 'parche'].includes(e)) })} crop="head" onSelect={set('eyes')} />
              <Swatches label="Color de ojos" value={look.eyeColor} colors={EYE_COLORS} onChange={set('eyeColor')} />
              <OptionGrid label="Cejas" look={look} options={BROWS} value={look.brows} apply={(l, v) => ({ ...l, brows: v })} crop="head" onSelect={set('brows')} />
              <OptionGrid label="Boca" look={look} options={MOUTHS} value={look.mouth} apply={(l, v) => ({ ...l, mouth: v })} crop="head" onSelect={set('mouth')} />
            </>
          )}
          {section === 'ropa' && (
            <>
              <OptionGrid label="Parte de arriba" look={look} options={look.body === 'female' ? TOPS.filter((t) => t.id !== 'sin_camiseta') : TOPS} value={look.top} apply={(l, v) => ({ ...l, top: v })} crop="body" onSelect={set('top')} />
              <Swatches label="Color de arriba" value={look.topColor} colors={CLOTH_COLORS} onChange={set('topColor')} />
              <OptionGrid label="Parte de abajo" look={look} options={BOTTOMS} value={look.bottom} apply={(l, v) => ({ ...l, bottom: v })} crop="body" onSelect={set('bottom')} />
              <Swatches label="Color de abajo" value={look.bottomColor} colors={CLOTH_COLORS} onChange={set('bottomColor')} />
              <OptionGrid label="Calzado" look={look} options={SHOES} value={look.shoes} apply={(l, v) => ({ ...l, shoes: v })} crop="body" onSelect={set('shoes')} />
              <Swatches label="Color del calzado" value={look.shoesColor} colors={CLOTH_COLORS} onChange={set('shoesColor')} />
            </>
          )}
          {section === 'extras' && (
            <>
              <ExtrasGrid look={look} onChange={commit} />
              <Swatches label="Color de accesorios" value={look.extraColor} colors={CLOTH_COLORS} onChange={set('extraColor')} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export type { ExtraId };
