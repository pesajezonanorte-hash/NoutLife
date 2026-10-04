// Editor del personaje pixel. Dos presentaciones con los mismos controles:
//  - AvatarPixelEditor (onboarding): escenario compacto fijo arriba + pestañas.
//  - AvatarStudio (Perfil → Personalizar): escenario grande con foco de luz a la
//    izquierda (arriba en móvil) y panel de pestañas a la derecha.
// Cada cambio se anima en el escenario píxel a píxel; las opciones entran
// escalonadas, el marco de selección se desliza entre miniaturas y la cámara se
// acerca a la cabeza o al cuerpo según la pestaña. Historial con deshacer/rehacer.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Check, Dices, Redo2, Undo2 } from 'lucide-react';
import type { AvatarConfig } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { Button, SegmentedControl, Switch, Tabs } from '@/components/ui/lq';
import { PixelAvatar, type PixelAnimation } from './pixel/PixelAvatar';
import { PixelStage, type StageFocus } from './pixel/PixelStage';
import { ColorField } from './pixel/ColorField';
import type { Body, PixelLook } from './pixel/engine';
import {
  BOTTOMS, BROWS, CLOTH_COLORS, EXTRAS, EYES, EYE_COLORS, FACIALS, HAIRS, HAIR_COLORS, MOUTHS, SHOES, SKINS, TOPS,
  lookFrom, randomLook, switchBody, toConfig, toggleExtra, type Option,
} from './pixel/look';

/** Fondo de cuadros (tokens) para vistas previas pequeñas. */
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

// ── Historial ───────────────────────────────────────────────────────────────
function useLookHistory(look: PixelLook, onCommit: (l: PixelLook) => void) {
  const [past, setPast] = useState<PixelLook[]>([]);
  const [future, setFuture] = useState<PixelLook[]>([]);
  const last = useRef(0);
  const commit = useCallback((next: PixelLook) => {
    // Los arrastres del mezclador se agrupan en un solo paso.
    const now = Date.now();
    if (now - last.current > 400) setPast((p) => [...p.slice(-29), look]);
    last.current = now;
    setFuture([]);
    onCommit(next);
  }, [look, onCommit]);
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [look, ...f]); last.current = 0; onCommit(prev); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, look]); last.current = 0; onCommit(next); };
  return { commit, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

// ── Opciones ────────────────────────────────────────────────────────────────
const gridV: Variants = { initial: {}, animate: { transition: { staggerChildren: 0.022 } } };
const tileV: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 26 } },
};
const tileCls = cn(
  'group relative flex min-h-[100px] cursor-pointer flex-col items-center justify-end gap-1 rounded-2xl border border-border bg-background px-1 pb-2 pt-1 text-center',
  'transition-[border-color] duration-200 hover:border-border-strong',
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
);

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 flex w-full items-baseline justify-between gap-2">
        <span className="text-label-lg text-on-surface">{title}</span>
        {count !== undefined && <span className="text-body-sm text-on-surface-light">{count} estilos</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Selected({ id }: { id: string }) {
  return (
    <>
      <motion.span aria-hidden layoutId={id} className="absolute inset-0 rounded-2xl border-2 border-primary bg-primary/[var(--lq-soft-alpha)]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
      <motion.span aria-hidden initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 18, delay: 0.08 }} className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary-strong text-on-primary">
        <Check className="size-3" strokeWidth={3} />
      </motion.span>
    </>
  );
}

function OptionGrid<T extends string>({ title, look, options, value, preview, crop, onSelect }: {
  title: string; look: PixelLook; options: Option<T>[]; value: T; preview: (l: PixelLook, v: T) => PixelLook;
  crop: 'head' | 'body'; onSelect: (v: T) => void;
}) {
  const name = useId();
  return (
    <Section title={title} count={options.length}>
      <motion.div variants={gridV} initial="initial" animate="animate" className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <motion.label key={o.id} variants={tileV} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }} className={tileCls}>
              <input type="radio" name={name} value={o.id} checked={on} onChange={() => onSelect(o.id)} className="sr-only" />
              {on && <Selected id={`sel-${name}`} />}
              <span className="relative transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:scale-110">
                <PixelAvatar look={preview(look, o.id)} size={crop === 'body' ? 72 : 66} crop={crop} animate={on ? 'idle' : 'none'} />
              </span>
              <span className={cn('relative text-label-md leading-tight', on ? 'text-primary-text' : 'text-on-surface')}>{o.label}</span>
            </motion.label>
          );
        })}
      </motion.div>
    </Section>
  );
}

function ExtrasGrid({ look, onChange }: { look: PixelLook; onChange: (l: PixelLook) => void }) {
  return (
    <Section title="Accesorios" count={EXTRAS.length}>
      <p className="-mt-1 text-body-sm text-on-surface-light">Combina los que quieras; solo un sombrero y unas gafas a la vez.</p>
      <motion.div variants={gridV} initial="initial" animate="animate" className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
        {EXTRAS.map((o) => {
          const on = look.extras.includes(o.id);
          return (
            <motion.label key={o.id} variants={tileV} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }} className={tileCls}>
              <input type="checkbox" checked={on} onChange={() => onChange(toggleExtra(look, o.id))} className="sr-only" />
              <AnimatePresence>
                {on && (
                  <motion.span key="on" aria-hidden initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute inset-0">
                    <span className="absolute inset-0 rounded-2xl border-2 border-primary bg-primary/[var(--lq-soft-alpha)]" />
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary-strong text-on-primary"><Check className="size-3" strokeWidth={3} /></span>
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="relative transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:scale-110">
                <PixelAvatar look={on ? look : toggleExtra(look, o.id)} size={66} crop={o.id === 'bufanda' || o.id === 'collar' ? 'body' : 'head'} animate={on ? 'idle' : 'none'} />
              </span>
              <span className={cn('relative text-label-md leading-tight', on ? 'text-primary-text' : 'text-on-surface')}>{o.label}</span>
            </motion.label>
          );
        })}
      </motion.div>
    </Section>
  );
}

// ── Pestañas ────────────────────────────────────────────────────────────────
type Tab = 'cuerpo' | 'pelo' | 'cara' | 'ropa' | 'extras';
const TABS: { value: Tab; label: string }[] = [
  { value: 'cuerpo', label: 'Cuerpo' }, { value: 'pelo', label: 'Pelo' }, { value: 'cara', label: 'Cara' },
  { value: 'ropa', label: 'Ropa' }, { value: 'extras', label: 'Extras' },
];
const FOCUS: Record<Tab, StageFocus> = { cuerpo: 'full', pelo: 'head', cara: 'head', ropa: 'body', extras: 'full' };

function Controls({ look, commit, tab, setTab }: { look: PixelLook; commit: (l: PixelLook) => void; tab: Tab; setTab: (t: Tab) => void }) {
  const set = <K extends keyof PixelLook>(k: K) => (v: PixelLook[K]) => commit({ ...look, [k]: v });
  const dir = useRef(0);
  const prev = useRef(tab);
  if (prev.current !== tab) { dir.current = TABS.findIndex((t) => t.value === tab) > TABS.findIndex((t) => t.value === prev.current) ? 1 : -1; prev.current = tab; }

  return (
    <div className="flex flex-col gap-5">
      <Tabs label="Partes del personaje" value={tab} onChange={setTab} options={TABS} />
      <AnimatePresence mode="wait" initial={false} custom={dir.current}>
        <motion.div
          key={tab}
          role="tabpanel"
          aria-label={TABS.find((t) => t.value === tab)?.label}
          custom={dir.current}
          variants={{
            initial: (d: number) => ({ opacity: 0, x: d * 28 }),
            animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } },
            exit: (d: number) => ({ opacity: 0, x: d * -20, transition: { duration: 0.14 } }),
          }}
          initial="initial" animate="animate" exit="exit"
          className="flex flex-col gap-8"
        >
          {tab === 'cuerpo' && (
            <>
              <ColorField label="Tono de piel" value={look.skin} colors={SKINS} onChange={set('skin')} />
              <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 transition-colors hover:border-border-strong">
                <span className="flex flex-col">
                  <span className="text-label-lg">Mejillas sonrosadas</span>
                  <span className="text-body-sm text-on-surface-light">Un toque de color en la cara</span>
                </span>
                <Switch checked={look.blush} onChange={(e) => set('blush')(e.target.checked)} aria-label="Mejillas sonrosadas" />
              </label>
            </>
          )}
          {tab === 'pelo' && (
            <>
              <OptionGrid title="Peinado" look={look} options={HAIRS} value={look.hair} preview={(l, v) => ({ ...l, hair: v, extras: [] })} crop="head" onSelect={set('hair')} />
              <ColorField label="Color de pelo" value={look.hairColor} colors={HAIR_COLORS} onChange={set('hairColor')} />
              <OptionGrid title="Vello facial" look={look} options={FACIALS} value={look.facial} preview={(l, v) => ({ ...l, facial: v })} crop="head" onSelect={set('facial')} />
            </>
          )}
          {tab === 'cara' && (
            <>
              <OptionGrid title="Ojos" look={look} options={EYES} value={look.eyes} preview={(l, v) => ({ ...l, eyes: v, extras: l.extras.filter((e) => e !== 'gafas_sol' && e !== 'parche') })} crop="head" onSelect={set('eyes')} />
              <ColorField label="Color de ojos" value={look.eyeColor} colors={EYE_COLORS} onChange={set('eyeColor')} />
              <OptionGrid title="Cejas" look={look} options={BROWS} value={look.brows} preview={(l, v) => ({ ...l, brows: v })} crop="head" onSelect={set('brows')} />
              <OptionGrid title="Boca" look={look} options={MOUTHS} value={look.mouth} preview={(l, v) => ({ ...l, mouth: v })} crop="head" onSelect={set('mouth')} />
            </>
          )}
          {tab === 'ropa' && (
            <>
              <OptionGrid title="Parte de arriba" look={look} options={look.body === 'female' ? TOPS.filter((t) => t.id !== 'sin_camiseta') : TOPS} value={look.top} preview={(l, v) => ({ ...l, top: v })} crop="body" onSelect={set('top')} />
              <ColorField label="Color de arriba" value={look.topColor} colors={CLOTH_COLORS} onChange={set('topColor')} />
              <OptionGrid title="Parte de abajo" look={look} options={BOTTOMS} value={look.bottom} preview={(l, v) => ({ ...l, bottom: v })} crop="body" onSelect={set('bottom')} />
              <ColorField label="Color de abajo" value={look.bottomColor} colors={CLOTH_COLORS} onChange={set('bottomColor')} />
              <OptionGrid title="Calzado" look={look} options={SHOES} value={look.shoes} preview={(l, v) => ({ ...l, shoes: v })} crop="body" onSelect={set('shoes')} />
              <ColorField label="Color del calzado" value={look.shoesColor} colors={CLOTH_COLORS} onChange={set('shoesColor')} />
            </>
          )}
          {tab === 'extras' && (
            <>
              <ExtrasGrid look={look} onChange={commit} />
              <ColorField label="Color de accesorios" value={look.extraColor} colors={CLOTH_COLORS} onChange={set('extraColor')} />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Barra de acciones del escenario ─────────────────────────────────────────
type History = ReturnType<typeof useLookHistory>;

function StageBar({ look, history, onRoll }: { look: PixelLook; history: History; onRoll: () => void }) {
  const [spin, setSpin] = useState(0);
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
      <SegmentedControl
        role="radiogroup" label="Tipo de cuerpo" className="w-48 sm:w-56"
        value={look.body} onChange={(b: Body) => history.commit(switchBody(look, b))}
        options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Femenino' }]}
      />
      <Button variant="secondary" size="sm" aria-label="Personaje aleatorio" onClick={() => { setSpin((s) => s + 1); onRoll(); }} className="px-3">
        <motion.span animate={{ rotate: spin * 360 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }} className="flex"><Dices aria-hidden className="size-5" strokeWidth={1.75} /></motion.span>
        <span className="hidden sm:inline">Aleatorio</span>
      </Button>
      <Button variant="icon" aria-label="Deshacer" disabled={!history.canUndo} onClick={history.undo}><Undo2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      <Button variant="icon" aria-label="Rehacer" disabled={!history.canRedo} onClick={history.redo}><Redo2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
    </div>
  );
}

interface EditorProps {
  config: AvatarConfig;
  onChange: (c: AvatarConfig) => void;
  /** Compatibilidad: el cuerpo siempre se puede elegir. */
  showBody?: boolean;
}

function useEditor(config: AvatarConfig, onChange: (c: AvatarConfig) => void) {
  const look = useMemo(() => lookFrom(config), [config]);
  const onCommit = useCallback((l: PixelLook) => onChange(toConfig(l, config)), [config, onChange]);
  const history = useLookHistory(look, onCommit);
  const [tab, setTab] = useState<Tab>('cuerpo');

  // Ctrl/⌘+Z deshace y Ctrl/⌘+Shift+Z (o Ctrl+Y) rehace mientras el editor está montado.
  const ref = useRef(history);
  ref.current = history;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); ref.current.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); ref.current.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { look, history, tab, setTab, roll: () => history.commit(randomLook(look.body)) };
}

/** Onboarding: escenario compacto fijo arriba + pestañas debajo. */
export function AvatarPixelEditor({ config, onChange }: EditorProps) {
  const { look, history, tab, setTab, roll } = useEditor(config, onChange);
  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 rounded-3xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
        <PixelStage look={look} focus={FOCUS[tab]} className="h-44 rounded-2xl" />
        <StageBar look={look} history={history} onRoll={roll} />
      </div>
      <Controls look={look} commit={history.commit} tab={tab} setTab={setTab} />
    </div>
  );
}

/** Perfil: estudio a pantalla completa (escenario grande + panel de opciones). */
export function AvatarStudio({ config, onChange, celebrate = 0, doneLabel }: EditorProps & { celebrate?: number; doneLabel?: string }) {
  const { look, history, tab, setTab, roll } = useEditor(config, onChange);
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(300px,46dvh)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(380px,500px)] md:grid-rows-1">
      <div className="relative flex min-h-0 flex-col">
        <PixelStage look={look} focus={FOCUS[tab]} celebrate={celebrate} doneLabel={doneLabel} className="min-h-0 flex-1 pb-16 md:pb-24" />
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26, delay: 0.2 }}
          className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 md:bottom-8"
        >
          <div className="pointer-events-auto rounded-2xl border border-border bg-background/85 p-1.5 shadow-lg backdrop-blur-md">
            <StageBar look={look} history={history} onRoll={roll} />
          </div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
        className="min-h-0 overflow-y-auto overscroll-contain border-t border-border bg-background px-4 pb-10 pt-5 md:border-l md:border-t-0 md:px-6"
      >
        <Controls look={look} commit={history.commit} tab={tab} setTab={setTab} />
      </motion.div>
    </div>
  );
}
