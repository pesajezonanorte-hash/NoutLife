// Tutorial de bienvenida: la primera vez que alguien entra a la app, un foco
// recorre las piezas reales de la interfaz (zonas, crear, el Sabio, buscar y
// avisos). El foco viaja con un muelle de un sitio a otro y la tarjeta lo sigue,
// cambiando de tamaño sin saltos; el texto de cada paso entra deslizándose.
// El último paso activa los recordatorios (el permiso necesita un toque real).
//
// Teclado: → o Intro avanza, ← vuelve, Esc lo cierra. Con «Reducir movimiento»
// todo cambia con un fundido corto. Se ve una vez por usuario y dispositivo.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Compass, Plus, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { enablePush, PUSH_MESSAGES, pushSupport } from '@/services/notification.service';
import { markNotificationsAsked } from '@/components/ui/NotificationPermissionModal';

/* ───────── Estado «ya lo vio» ───────── */

const keyFor = (userId: string) => `lq-tour-done:${userId}`;
const EVENT = 'lq-tour-change';

export function isTourDone(userId: string | undefined) {
  if (!userId) return true;
  try { return localStorage.getItem(keyFor(userId)) === '1'; } catch { return true; }
}

/** Ya se mostró una vez (aunque no se terminara): no vuelve a salir. */
export function isTourSeen(userId: string) {
  try { return localStorage.getItem(`lq-tour-seen:${userId}`) === '1' || isTourDone(userId); } catch { return true; }
}
export function markTourSeen(userId: string) {
  try { localStorage.setItem(`lq-tour-seen:${userId}`, '1'); } catch { /* sin storage */ }
}

function markTourDone(userId: string) {
  try { localStorage.setItem(keyFor(userId), '1'); } catch { /* sin storage */ }
  window.dispatchEvent(new Event(EVENT));
}

/** ¿Este usuario ya terminó (o saltó) el tutorial? Se actualiza al cerrarlo. */
export function useTourDone(userId: string | undefined) {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(EVENT, cb); return () => window.removeEventListener(EVENT, cb); },
    () => isTourDone(userId),
    () => true,
  );
}

/* ───────── Pasos ───────── */

interface Step {
  id: string;
  /** data-tour del elemento que se ilumina; sin él, la tarjeta va al centro. */
  target?: string;
  /** Si el elemento no está a la vista (p. ej. en móvil), el paso se salta. */
  optional?: boolean;
  icon: LucideIcon;
  title: string;
  body: string;
}

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;

function buildSteps(name: string): Step[] {
  return [
    { id: 'hola', icon: Compass, title: `Hola, ${name}. Esto es Noutlife.`, body: 'Tu vida real como una partida: cada hábito que cumples te da XP y Gold, y subes de nivel de verdad. Te enseñamos lo básico en medio minuto.' },
    { id: 'zonas', target: 'nav', icon: Compass, title: 'Cada parte de tu vida es un lugar', body: 'Hábitos, finanzas, sueño, tu diario… Cada zona se ve y se siente como lo que es. Muévete entre ellas desde aquí.' },
    { id: 'crear', target: 'create', icon: Plus, title: 'Empieza por un hábito', body: 'Algo pequeño que quieras repetir. Cada vez que lo marcas ganas XP y tu racha crece.' },
    { id: 'sabio', target: 'sage', optional: true, icon: Sparkles, title: 'El Sabio te acompaña', body: 'Lee tu progreso y te da un consejo concreto cuando lo necesitas.' },
    { id: 'buscar', target: 'search', icon: Search, title: 'Encuentra cualquier cosa', body: isDesktop() ? 'Hábitos, misiones o zonas, desde cualquier pantalla. También con Ctrl + K.' : 'Hábitos, misiones o zonas, desde cualquier pantalla.' },
    { id: 'avisos', target: 'bell', icon: Bell, title: 'Que no se te pase nada', body: 'Te avisamos a la hora de tus hábitos y antes de tus eventos, aunque tengas Noutlife cerrada.' },
  ];
}

/* ───────── Geometría ───────── */

interface Box { x: number; y: number; w: number; h: number }
const GAP = 14;
const MARGIN = 16;
const PAD = 8;

function findTarget(id?: string): HTMLElement | null {
  if (!id) return null;
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)];
  return all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) ?? null;
}

function spotFor(el: HTMLElement | null): Box | null {
  if (!el) return null;
  let r = el.getBoundingClientRect();
  // Dentro de la barra lateral recogida, solo cuenta la parte que se ve.
  const frame = el.closest('aside')?.getBoundingClientRect();
  if (frame) r = new DOMRect(Math.max(r.left, frame.left), Math.max(r.top, frame.top), Math.min(r.right, frame.right) - Math.max(r.left, frame.left), Math.min(r.bottom, frame.bottom) - Math.max(r.top, frame.top));
  const vw = window.innerWidth, vh = window.innerHeight;
  // La navegación lateral es muy alta: se ilumina recortada a la pantalla.
  const top = Math.max(MARGIN / 2, r.top - PAD), bottom = Math.min(vh - MARGIN / 2, r.bottom + PAD);
  const left = Math.max(MARGIN / 2, r.left - PAD), right = Math.min(vw - MARGIN / 2, r.right + PAD);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Dónde va la tarjeta: al lado con más sitio (derecha de la barra lateral, debajo o encima). */
function cardPos(spot: Box | null, card: { w: number; h: number }): { x: number; y: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vw - card.w - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh - card.h - MARGIN);
  if (!spot) return { x: (vw - card.w) / 2, y: clampY((vh - card.h) / 2) };
  const roomRight = vw - (spot.x + spot.w);
  if (spot.h > vh * 0.5 && roomRight > card.w + GAP + MARGIN) {
    return { x: spot.x + spot.w + GAP, y: clampY(spot.y + Math.min(spot.h, vh) * 0.2) };
  }
  const below = spot.y + spot.h + GAP;
  if (below + card.h + MARGIN <= vh) return { x: clampX(spot.x + spot.w / 2 - card.w / 2), y: below };
  return { x: clampX(spot.x + spot.w / 2 - card.w / 2), y: clampY(spot.y - GAP - card.h) };
}

/* ───────── Componente ───────── */

export function WelcomeTour({ userId, name }: { userId: string; name: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  const toast = useToastStore();
  const all = useMemo(() => buildSteps(name.split(' ')[0] || name), [name]);
  const [steps, setSteps] = useState(all);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [open, setOpen] = useState(true);
  const [spot, setSpot] = useState<Box | null>(null);
  const [cardSize, setCardSize] = useState({ w: 360, h: 220 });
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState<number | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const support = useMemo(() => pushSupport(), []);

  // Los pasos cuyo elemento no se ve en este tamaño de pantalla se quitan al empezar.
  useEffect(() => { setSteps(all.filter((s) => !s.optional || findTarget(s.target))); }, [all]);

  // El foco sigue a su elemento aunque cambie el tamaño o el scroll.
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setSpot(spotFor(findTarget(step?.target)))); };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step?.target]);

  // Tamaño real de la tarjeta para colocarla sin salirse de la pantalla.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setCardSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { primaryRef.current?.focus({ preventScroll: true }); }, [i, open]);

  // Altura del texto del paso actual (cambia con el paso y con el ancho).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setBodyH(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBodyH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [i, steps]);

  const close = useCallback(() => {
    markTourDone(userId);
    setOpen(false);
  }, [userId]);

  const go = useCallback((d: number) => {
    const n = i + d;
    if (n < 0) return;
    if (n >= steps.length) { close(); return; }
    setDir(d); setI(n);
  }, [i, steps.length, close]);

  async function activate() {
    setBusy(true);
    markNotificationsAsked();
    const result = await enablePush();
    setBusy(false);
    if (result === 'ok') toast.success('Recordatorios activados', 'Te avisaremos a la hora de tus hábitos.');
    else if (result !== 'denied') toast.info(PUSH_MESSAGES[result]);
    close();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') {
        // El foco no sale de la tarjeta.
        const f = cardRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!f?.length) return;
        const first = f[0], end = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, go, close]);

  if (!step) return null;
  const pos = cardPos(spot, cardSize);
  const move = reduce ? { duration: 0.2 } : springs.natural;
  // Sin elemento, el foco se encoge en el centro: queda solo el velo.
  const hole = spot ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0 };
  const Icon = step.icon;
  const askPush = step.id === 'avisos' && support !== 'unsupported';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[160]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.45 } }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          {/* Velo con un hueco de luz sobre el elemento del paso */}
          <motion.div
            aria-hidden="true"
            className="lq-tour-spot pointer-events-none absolute left-0 top-0 rounded-2xl"
            initial={false}
            animate={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h, opacity: 1, transition: move }}
          />
          {/* La tarjeta del paso */}
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lq-tour-title"
            aria-describedby="lq-tour-body"
            className="absolute left-0 top-0 w-[min(22.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface p-5 text-on-background shadow-xl"
            initial={reduce ? { x: pos.x, y: pos.y, opacity: 0 } : { x: pos.x, y: pos.y + 24, opacity: 0, scale: 0.94 }}
            animate={{ x: pos.x, y: pos.y, opacity: 1, scale: 1, transition: reduce ? { duration: 0.2 } : { ...springs.natural, opacity: { duration: 0.3 } } }}
          >
            {/* La altura sigue al texto del paso con el mismo muelle: la tarjeta no salta */}
            <motion.div className="relative" initial={false} animate={{ height: bodyH ?? 'auto', transition: move }}>
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={step.id}
                custom={dir}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0, transition: reduce ? { duration: 0.2 } : { ...springs.natural, opacity: { duration: 0.25, delay: 0.05 } } }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, x: dir * -20, transition: { duration: 0.16 } }}
              >
                <div ref={bodyRef} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {i === 0 ? (
                    <motion.span
                      aria-hidden="true"
                      initial={reduce ? false : { rotate: -12, scale: 0.6 }}
                      animate={{ rotate: 0, scale: 1, transition: { ...springs.natural, delay: 0.15 } }}
                    >
                      <BrandMark size={36} />
                    </motion.span>
                  ) : (
                    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)] text-primary-text">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </span>
                  )}
                  <h2 id="lq-tour-title" className="text-heading-sm">{step.title}</h2>
                </div>
                <p id="lq-tour-body" className="text-body-md text-on-surface">
                  {askPush && support === 'ios-install' ? PUSH_MESSAGES['ios-install'] : step.body}
                </p>
                </div>
              </motion.div>
            </AnimatePresence>
            </motion.div>

            <div className="mt-5 flex items-center justify-between gap-3">
              {/* Progreso: un punto por paso; el actual se alarga */}
              <div className="flex items-center gap-1.5" role="img" aria-label={`Paso ${i + 1} de ${steps.length}`}>
                {steps.map((s, k) => (
                  <motion.span
                    key={s.id}
                    aria-hidden="true"
                    className={k === i ? 'block h-1.5 rounded-full bg-primary' : 'block h-1.5 rounded-full bg-border-strong'}
                    animate={{ width: k === i ? 18 : 6 }}
                    transition={reduce ? { duration: 0 } : springs.natural}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {i === 0 ? (
                  <Button size="sm" variant="ghost" onClick={close}>Saltar</Button>
                ) : !(last && askPush && support === 'ok') && (
                  <Button size="sm" variant="ghost" onClick={() => go(-1)}>Atrás</Button>
                )}
                {last && askPush && support === 'ok' ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={close}>Ahora no</Button>
                    <Button ref={primaryRef} size="sm" loading={busy} onClick={() => void activate()}>Activar avisos</Button>
                  </>
                ) : (
                  <Button ref={primaryRef} size="sm" onClick={() => go(1)}>{i === 0 ? 'Empezar' : last ? 'Listo' : 'Siguiente'}</Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
