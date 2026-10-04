// Selector de color del estudio: paleta con anillo que se desliza a la muestra
// elegida y onda al tocarla, y un mezclador propio (saturación/brillo + tono +
// hex + recientes) que se despliega con muelle. Los colores son datos del
// personaje; el plano de color y el arcoíris son la propia herramienta.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { AnimatePresence, PresenceContext, motion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── HSV ─────────────────────────────────────────────────────────────────────
type HSV = { h: number; s: number; v: number };
function hexToHsv(hex: string): HSV {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, v: 50 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(((h * 60) + 360) % 360), s: Math.round(max ? (d / max) * 100 : 0), v: Math.round(max * 100) };
}
function hsvToHex({ h, s, v }: HSV) {
  const S = s / 100, V = v / 100;
  const f = (n: number) => { const k = (n + h / 60) % 6; return V - V * S * Math.max(0, Math.min(k, 4 - k, 1)); };
  return `#${[f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const RECENT_KEY = 'lq-px-recent';
function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; }
}

// ── Mezclador ───────────────────────────────────────────────────────────────
function Mixer({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hex, setHex] = useState(value);
  const plane = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Si el valor cambia desde fuera (paleta, aleatorio), el mezclador lo sigue.
  useEffect(() => {
    if (hsvToHex(hsv).toLowerCase() !== value.toLowerCase()) setHsv(hexToHsv(value));
    setHex(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (next: HSV) => { setHsv(next); const h = hsvToHex(next); setHex(h); onChange(h); };
  const fromPointer = (e: PointerEvent) => {
    const r = plane.current!.getBoundingClientRect();
    apply({ ...hsv, s: Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 100), v: Math.round(100 - clamp((e.clientY - r.top) / r.height, 0, 1) * 100) });
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (!d[e.key]) return;
    e.preventDefault();
    apply({ ...hsv, s: clamp(hsv.s + d[e.key][0], 0, 100), v: clamp(hsv.v + d[e.key][1], 0, 100) });
  };
  const hue = `hsl(${hsv.h} 100% 50%)`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <div
        ref={plane}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: saturación y brillo`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hsv.s}
        aria-valuetext={`Saturación ${hsv.s} %, brillo ${hsv.v} %`}
        onKeyDown={onKey}
        onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => { dragging.current = false; }}
        className="relative h-40 cursor-crosshair touch-none overflow-hidden rounded-xl outline-none ring-primary ring-offset-2 ring-offset-surface focus-visible:ring-[3px]"
        style={{ backgroundColor: hue }}
      >
        {/* Plano de color: blanco → tono (horizontal) y transparente → negro (vertical). */}
        <span aria-hidden className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to right, rgb(255 255 255), transparent)' }} />
        <span aria-hidden className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to top, rgb(0 0 0), transparent)' }} />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute size-6 rounded-full border-[3px] border-background shadow-lg"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, x: '-50%', y: '-50%', backgroundColor: hex }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        />
      </div>

      <input
        type="range" min={0} max={359} value={hsv.h}
        onChange={(e) => apply({ ...hsv, h: +e.target.value })}
        aria-label={`${label}: tono`}
        className="lq-hue h-3 w-full cursor-pointer rounded-full"
        style={{ backgroundImage: 'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(359 100% 50%))', ['--thumb' as string]: hue }}
      />

      <div className="flex items-center gap-3">
        <motion.span key={hex} aria-hidden initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="size-11 shrink-0 rounded-xl border border-border-strong shadow-sm" style={{ backgroundColor: hex }} />
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border-strong bg-background px-3 transition-colors focus-within:border-primary hover:border-on-surface-light">
          <span className="font-mono text-body-md text-on-surface-light">#</span>
          <input
            value={hex.replace('#', '')}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
              setHex(`#${v}`);
              if (v.length === 6) { const h = `#${v}`.toLowerCase(); setHsv(hexToHsv(h)); onChange(h); }
            }}
            aria-label={`${label}: código hexadecimal`}
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-body-md uppercase tracking-wider text-on-background outline-none"
          />
        </label>
      </div>
    </div>
  );
}

// ── Campo completo ──────────────────────────────────────────────────────────
/** Aislado del contexto de presencia: el anillo usa layoutId (ver Controls). */
export function ColorField(props: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  return <PresenceContext.Provider value={null}><ColorFieldInner {...props} /></PresenceContext.Provider>;
}

function ColorFieldInner({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  const name = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const isCustom = !colors.some((c) => c.toLowerCase() === value.toLowerCase());
  const extra = recent.filter((c) => !colors.some((p) => p.toLowerCase() === c.toLowerCase()));

  // Al cerrar el mezclador, el color personalizado pasa a «recientes».
  const toggle = () => {
    if (open && isCustom) {
      const next = [value, ...recent.filter((c) => c.toLowerCase() !== value.toLowerCase())].slice(0, 8);
      setRecent(next);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* sin storage */ }
    }
    setOpen((o) => !o);
  };

  const swatch = (c: string, i: number, small = false) => {
    const on = value.toLowerCase() === c.toLowerCase();
    return (
      <motion.label
        key={c}
        layout
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 26, delay: i * 0.018 }}
        whileHover={{ scale: 1.14, y: -2 }}
        whileTap={{ scale: 0.88 }}
        className={cn('relative cursor-pointer rounded-full', small ? 'size-9' : 'size-11', 'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[6px] has-[:focus-visible]:outline-primary')}
      >
        <input type="radio" name={name} checked={on} onChange={() => onChange(c)} aria-label={`${label}: color ${i + 1}`} className="sr-only" />
        {/* Color del personaje (dato del usuario). */}
        <span aria-hidden className="absolute inset-0 rounded-full border border-on-background/15 shadow-sm" style={{ backgroundColor: c }} />
        {on && <motion.span aria-hidden layoutId={`ring-${name}`} className="absolute -inset-[5px] rounded-full border-2 border-primary" transition={{ type: 'spring', stiffness: 420, damping: 30 }} />}
        <AnimatePresence>
          {on && (
            <motion.span key={c} aria-hidden className="absolute inset-0 rounded-full" style={{ backgroundColor: c }} initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 2.2, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          )}
        </AnimatePresence>
      </motion.label>
    );
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 flex w-full items-center justify-between gap-2">
        <span className="text-label-lg text-on-surface">{label}</span>
        <span className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={value} aria-hidden className="size-5 rounded-full" style={{ backgroundColor: value }} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} />
          </AnimatePresence>
          <span className="font-mono text-body-sm uppercase tabular-nums text-on-surface-light">{value}</span>
        </span>
      </legend>

      <div className="flex flex-wrap gap-2.5">
        {colors.map((c, i) => swatch(c, i))}
        <motion.button
          type="button"
          layout
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${label}: mezclar un color propio`}
          onClick={toggle}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 26, delay: colors.length * 0.018 }}
          whileHover={{ scale: 1.14, y: -2 }} whileTap={{ scale: 0.88 }}
          className="relative flex size-11 items-center justify-center rounded-full"
        >
          {/* Anillo de arcoíris que gira: invita a crear un color propio. */}
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ backgroundImage: 'conic-gradient(hsl(0 90% 60%), hsl(60 90% 60%), hsl(120 90% 55%), hsl(180 90% 55%), hsl(240 90% 65%), hsl(300 90% 60%), hsl(360 90% 60%))' }}
            animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
          <span aria-hidden className="absolute inset-[3px] flex items-center justify-center rounded-full bg-background" style={isCustom ? { backgroundColor: value } : undefined}>
            <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className={cn('flex', !isCustom && 'text-on-surface')} style={isCustom ? { color: hexToHsv(value).v > 60 && hexToHsv(value).s < 60 ? 'rgb(20 20 24)' : 'rgb(255 255 255)' } : undefined}>
              {isCustom && !open ? <Check className="size-5" strokeWidth={2.5} /> : <Plus className="size-5" strokeWidth={2} />}
            </motion.span>
          </span>
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            style={{ transformOrigin: 'top right' }}
            className="flex flex-col gap-3"
          >
            <Mixer value={value} onChange={onChange} label={label} />
            {extra.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-label-md text-on-surface-light">Recientes</span>
                <div className="flex flex-wrap gap-2">{extra.map((c, i) => swatch(c, i, true))}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </fieldset>
  );
}
