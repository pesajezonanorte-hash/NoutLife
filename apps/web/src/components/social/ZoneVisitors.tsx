// Los amigos que están ahora en tu misma zona aparecen como su muñequito pixel
// paseando por el borde de abajo de la pantalla, donde no tapan nada (en el
// móvil, encima de la barra y a la izquierda del botón flotante). Solo se ven
// tus amigos. Al tocar a uno: saludarlo o mandarle un gesto, escribirle una
// carta o ver su DNI. Lo que tú le mandas lo ve en tu muñequito desde su
// pantalla, y lo que te manda lo ves en el suyo; si no está en tu zona, llega
// como aviso. Si te dejó una carta, lleva un sobre sobre la cabeza y al llegar
// enseña un bocadillo con lo que dice.
// Se puede apagar en Ajustes → Privacidad. Con «Reducir movimiento» se quedan
// quietos y los gestos aparecen sin animación.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, animate, motion, useMotionValue, type AnimationPlaybackControls } from 'framer-motion';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Contact, Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  apiError, getZoneVisitors, sendGesture, socialLink, zoneName, type GestureKind, type ZoneVisitor,
} from '@/services/network.service';
import { PixelAvatar } from '@/components/character/pixel/PixelAvatar';
import { lookFrom } from '@/components/character/pixel/look';
import { Button } from '@/components/ui/lq';
import { GESTURE_GLYPH, PixelGlyph } from './PixelGlyph';

/** Preferencia de este dispositivo: ver o no a los amigos paseando. */
export const useVisitorPrefs = create<{ show: boolean; setShow: (show: boolean) => void }>()(
  persist((set) => ({ show: true, setShow: (show) => set({ show }) }), { name: 'lq-zone-visitors' }),
);

export const GESTURES: Array<{ kind: GestureKind; label: string; bubble: string; said: string }> = [
  { kind: 'wave', label: 'Saludar', bubble: '¡Hola!', said: 'te saluda' },
  { kind: 'heart', label: 'Corazón', bubble: 'Para ti', said: 'te manda un corazón' },
  { kind: 'dance', label: 'Bailar', bubble: '¡A bailar!', said: 'baila contigo' },
  { kind: 'cheer', label: 'Animar', bubble: '¡Tú puedes!', said: 'te anima' },
  { kind: 'laugh', label: 'Reír', bubble: '¡Ja, ja!', said: 'se ríe contigo' },
  { kind: 'highfive', label: 'Chocar', bubble: '¡Choca!', said: 'quiere chocar los cinco' },
];
const gestureOf = (k: GestureKind) => GESTURES.find((g) => g.kind === k) ?? GESTURES[0];

/** Movimiento del muñequito al hacer cada gesto. */
const MOVES: Record<GestureKind, { rotate?: number[]; y?: number[]; scale?: number[]; duration: number }> = {
  wave: { rotate: [0, -8, 8, -8, 8, 0], duration: 1.3 },
  heart: { scale: [1, 1.1, 1, 1.08, 1], duration: 1.2 },
  dance: { rotate: [0, -12, 12, -12, 12, 0], y: [0, -3, 0, -3, 0, 0], duration: 1.6 },
  cheer: { y: [0, -12, 0, -7, 0], duration: 1.1 },
  laugh: { rotate: [0, -5, 5, -5, 5, -3, 0], duration: 1 },
  highfive: { y: [0, -5, 0], rotate: [0, 12, 0], duration: 0.8 },
};

const AVATAR = 34;
const POP_W = 276;
const toaster = () => useToastStore.getState();

interface Act { kind: GestureKind; key: number; sent?: boolean }

function Walker({ v, index, width, zone, act, letterBubble, onSent }: {
  v: ZoneVisitor; index: number; width: number; zone: string;
  /** Gesto que está haciendo ahora (recibido o recién enviado). */
  act: Act | null;
  /** Bocadillo con la carta que acaba de llegar. */
  letterBubble: string | null;
  onSent: (kind: GestureKind) => void;
}) {
  const navigate = useNavigate();
  const reduce = useMotionStore((s) => s.reduce);
  const look = useMemo(() => lookFrom(v.avatarConfig), [v.avatarConfig]);
  const start = useMemo(() => {
    let h = 0;
    for (const ch of v.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h % 1000) / 1000;
  }, [v.id]);
  const x = useMotionValue(Math.max(0, (width - AVATAR) * start));
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(index % 2 ? -1 : 1);
  const [open, setOpen] = useState(false);
  const [popLeft, setPopLeft] = useState(0);
  const boxRef = useRef<HTMLLIElement>(null);
  const busy = open || Boolean(act);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const first = v.displayName.split(' ')[0];

  // Si el espacio cambia, que nadie quede fuera.
  useEffect(() => {
    const max = Math.max(0, width - AVATAR);
    if (x.get() > max) x.set(max);
  }, [width, x]);

  // Pasear: elige un sitio, camina hasta él, se para un rato y vuelve a empezar.
  useEffect(() => {
    if (reduce || width < AVATAR * 2) return;
    let cancelled = false;
    let timer = 0;
    const step = () => {
      if (cancelled) return;
      if (busyRef.current) { timer = window.setTimeout(step, 1500); return; }
      const max = Math.max(0, width - AVATAR);
      const target = Math.random() * max;
      const dist = Math.abs(target - x.get());
      if (dist < 24) { timer = window.setTimeout(step, 1200); return; }
      setFacing(target > x.get() ? 1 : -1);
      setWalking(true);
      anim.current = animate(x, target, {
        duration: dist / 26, ease: 'linear',
        onComplete: () => { setWalking(false); timer = window.setTimeout(step, 1800 + Math.random() * 4800); },
      });
    };
    timer = window.setTimeout(step, 700 + index * 900);
    return () => { cancelled = true; window.clearTimeout(timer); anim.current?.stop(); };
  }, [index, reduce, width, x]);

  // Se detiene para atender (menú abierto o gesto en curso) y mira al frente.
  useEffect(() => {
    if (!busy) return;
    anim.current?.stop();
    setWalking(false);
  }, [busy]);

  // Cerrar el menú al tocar fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  function toggle() {
    if (!open) {
      const w = Math.min(POP_W, width);
      const desired = Math.min(Math.max(x.get() + AVATAR / 2 - w / 2, 0), Math.max(0, width - w));
      setPopLeft(desired - x.get());
    }
    setOpen((o) => !o);
  }

  const move = act && !reduce ? MOVES[act.kind] : null;
  const shown = act?.kind === 'laugh' ? { ...look, mouth: 'sonrisota' as const, eyes: 'felices' as const } : look;
  const g = act ? gestureOf(act.kind) : null;

  return (
    <motion.li
      ref={boxRef}
      style={{ x }}
      className="pointer-events-auto absolute bottom-0 left-0"
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10, transition: { duration: 0.2 } }}
      transition={springs.natural}
    >
      {/* Encima de la cabeza: el gesto, la carta que llegó o el sobre que espera */}
      <AnimatePresence>
        {g ? (
          <motion.span
            key={`act-${act!.key}`}
            className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 flex -translate-x-1/2 items-center"
            initial={{ opacity: 0, y: 6, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
            transition={springs.snappy}
          >
            <span className={cn('lq-bubble flex items-center gap-1.5 whitespace-nowrap px-2 py-1 text-[0.72rem] font-semibold', act!.sent ? 'text-on-surface-light' : 'text-on-background')}>
              <motion.span animate={reduce ? undefined : { rotate: act!.kind === 'wave' || act!.kind === 'highfive' ? [0, -18, 14, -18, 0] : 0, y: act!.kind === 'heart' || act!.kind === 'dance' ? [0, -2, 0] : 0 }} transition={{ duration: 0.9, repeat: 1 }} className="inline-flex">
                <PixelGlyph name={GESTURE_GLYPH[act!.kind]} size={15} />
              </motion.span>
              {act!.sent ? 'Enviado' : g.bubble}
            </span>
          </motion.span>
        ) : letterBubble ? (
          <motion.span
            key="letter-bubble"
            className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: 6, scale: 0.7 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
            transition={springs.snappy}
          >
            <span className="lq-bubble flex max-w-[180px] items-center gap-1.5 px-2 py-1 text-[0.72rem] font-medium text-on-background">
              <PixelGlyph name="letter" size={14} className="shrink-0" /><span className="truncate">{letterBubble}</span>
            </span>
          </motion.span>
        ) : v.letter ? (
          <motion.span
            key="letter-wait"
            className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, scale: 0.5 }} animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -3, 0] }}
            exit={{ opacity: 0 }} transition={reduce ? { duration: 0.2 } : { y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }, default: springs.snappy }}
          >
            <PixelGlyph name="letter" size={16} />
          </motion.span>
        ) : null}
      </AnimatePresence>
      {/* Corazones que suben */}
      {act?.kind === 'heart' && !reduce && [0, 1, 2].map((i) => (
        <motion.span
          key={`${act.key}-${i}`} aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2"
          initial={{ opacity: 0, y: 0, x: (i - 1) * 9 }} animate={{ opacity: [0, 1, 0], y: -34 - i * 8, x: (i - 1) * 14 }}
          transition={{ duration: 1.5, delay: 0.25 + i * 0.22, ease: 'easeOut' }}
        >
          <PixelGlyph name="heart" size={10} />
        </motion.span>
      ))}

      <button
        type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
        aria-label={`${v.displayName} está en ${zone}${v.letter ? `, te dejó ${v.letter.count === 1 ? 'una carta' : `${v.letter.count} cartas`}` : ''}. Saludar o escribir`}
        className="group relative block rounded-lg px-1 pt-1 focus-visible:outline-offset-2"
      >
        <span aria-hidden="true" className="lq-walker-shadow absolute -bottom-1 left-1/2 block h-2 w-8 -translate-x-1/2" />
        <span className={cn('block', walking && 'lq-walk')}>
          <span className="block transition-transform duration-200" style={{ transform: `scaleX(${facing})` }}>
            <motion.span
              key={act?.key ?? 'idle'}
              className="block origin-bottom"
              animate={move ? { rotate: move.rotate ?? 0, y: move.y ?? 0, scale: move.scale ?? 1 } : undefined}
              transition={move ? { duration: move.duration, ease: 'easeInOut' } : undefined}
            >
              <PixelAvatar look={shown} size={AVATAR} animate={walking ? 'none' : act?.kind === 'cheer' ? 'celebrate' : 'idle'} />
            </motion.span>
          </span>
        </span>
        <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/95 px-2 py-0.5 text-[0.7rem] font-semibold text-on-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {first}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog" aria-label={`Con ${v.displayName}`}
            className="absolute bottom-[calc(100%+14px)] z-10 rounded-2xl border border-border bg-surface p-3 shadow-lg"
            style={{ left: popLeft, width: Math.min(POP_W, width) }}
            initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.12 } }}
            transition={springs.natural}
          >
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-lg text-on-background">{v.displayName}</p>
                <p className="truncate text-body-sm text-success-text">También en {zone}</p>
              </div>
              <Button variant="icon" aria-label="Cerrar" onClick={() => setOpen(false)} className="-mr-2 -mt-2"><X aria-hidden className="size-5" /></Button>
            </div>
            {v.letter && (
              <button type="button" onClick={() => navigate(socialLink.letter(v.username))} className="lq-pigeon-note mb-2 flex w-full items-center gap-2 px-3 py-2 text-left">
                <PixelGlyph name="letter" size={16} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-body-sm text-on-background">“{v.letter.preview}”</span>
                <span className="text-label-md text-primary-text">Leer</span>
              </button>
            )}
            <div role="group" aria-label="Mandar un gesto" className="grid grid-cols-3 gap-1.5">
              {GESTURES.map((ge) => (
                <button
                  key={ge.kind} type="button" onClick={() => { setOpen(false); onSent(ge.kind); }}
                  className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background text-label-md text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-variant"
                >
                  <PixelGlyph name={GESTURE_GLYPH[ge.kind]} size={18} />
                  {ge.label}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => navigate(socialLink.letter(v.username))}><Mail aria-hidden className="size-4" />Escribir</Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/u/${encodeURIComponent(v.username)}`)} aria-label={`Ver el DNI de ${v.displayName}`}><Contact aria-hidden className="size-4" />DNI</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function ZoneVisitors() {
  const { pathname } = useLocation();
  const zone = zoneName(pathname);
  const show = useVisitorPrefs((s) => s.show);
  const keyboard = useKeyboardOpen();
  const coarse = useMediaQuery('(pointer: coarse)');
  const [visitors, setVisitors] = useState<ZoneVisitor[]>([]);
  const [acts, setActs] = useState<Record<string, Act>>({});
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const [announce, setAnnounce] = useState('');
  const letters = useRef<Record<string, string>>({});
  const timers = useRef<number[]>([]);
  const [area, setArea] = useState<HTMLUListElement | null>(null);
  const [width, setWidth] = useState(0);

  // Ancho del paseo (cambia con la ventana y con el menú lateral).
  useLayoutEffect(() => {
    if (!area) return;
    const read = () => setWidth(area.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(area);
    return () => ro.disconnect();
  }, [area]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const play = useCallback((id: string, act: Act, ms = 3200) => {
    setActs((a) => ({ ...a, [id]: act }));
    later(() => setActs((a) => (a[id]?.key === act.key ? (({ [id]: _drop, ...rest }) => rest)(a) : a)), ms);
  }, []);

  useEffect(() => {
    if (!show) { setVisitors([]); return; }
    let alive = true;
    let first = true;
    const pull = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await getZoneVisitors(zone);
        if (!alive) return;
        setVisitors(r.visitors);
        // Carta nueva de alguien que pasea por aquí: bocadillo con lo que dice.
        for (const v of r.visitors) {
          const at = v.letter?.at;
          if (at && letters.current[v.id] !== at) {
            if (!first || Date.now() - new Date(at).getTime() < 60_000) {
              setBubbles((b) => ({ ...b, [v.id]: v.letter!.preview }));
              setAnnounce(`${v.displayName} te dejó una carta`);
              later(() => setBubbles((b) => (({ [v.id]: _drop, ...rest }) => rest)(b)), 6000);
            }
            letters.current[v.id] = at;
          }
        }
        // Gestos: los hace su muñequito si está aquí; si no, llega un aviso.
        r.gestures.forEach((gst, i) => {
          const name = gst.fromName.split(' ')[0] || 'Un amigo';
          const said = gestureOf(gst.kind).said;
          if (r.visitors.some((v) => v.id === gst.fromId)) {
            later(() => { play(gst.fromId, { kind: gst.kind, key: Date.now() + i }); setAnnounce(`${name} ${said}`); }, i * 3400);
          } else {
            toaster().info(`${name} ${said}`, gst.zone ? `Desde ${gst.zone}` : undefined);
          }
        });
        first = false;
      } catch { /* sin conexión: se reintenta */ }
    };
    void pull();
    const id = window.setInterval(pull, 10_000);
    const onVis = () => { if (document.visibilityState === 'visible') void pull(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [play, show, zone]);

  async function gesture(v: ZoneVisitor, kind: GestureKind) {
    play(v.id, { kind, key: Date.now(), sent: true }, 1800);
    setAnnounce(`Le mandaste a ${v.displayName.split(' ')[0]}: ${gestureOf(kind).label.toLowerCase()}`);
    try { await sendGesture(v.id, kind, zone); }
    catch (e) { toaster().error(apiError(e, 'No se pudo mandar el gesto')); }
  }

  if (!show || (keyboard && coarse) || visitors.length === 0) return null;
  return (
    <div className="pointer-events-none sticky bottom-[calc(3.75rem+max(1rem,env(safe-area-inset-bottom)))] z-20 h-0 md:bottom-0">
      <div className="relative mx-auto h-0 w-full max-w-[1120px] px-4 md:px-8">
        <ul ref={setArea} aria-label={`Amigos en ${zone}`} className="absolute bottom-2 left-4 right-[6.25rem] h-16 md:bottom-4 md:left-8 md:right-8">
          <AnimatePresence>
            {width > 0 && visitors.map((v, i) => (
              <Walker key={v.id} v={v} index={i} width={width} zone={zone} act={acts[v.id] ?? null} letterBubble={bubbles[v.id] ?? null} onSent={(k) => void gesture(v, k)} />
            ))}
          </AnimatePresence>
        </ul>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </div>
  );
}
