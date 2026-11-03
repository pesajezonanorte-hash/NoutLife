// Cambio de zona sin parpadeos. La zona nueva se monta oculta mientras la vieja sigue a la vista, y se
// revela cuando ya pintó su contenido (como mucho tras HOLD_MAX_MS: entonces con su cargador). El relevo
// es un solo fundido de opacidad y ocurre en un commit: la altura de la página pasa de una zona a otra y
// el salto arriba del todo se hace sin pintarse, así que nunca hay un fotograma vacío, ni el pie legal
// sube a la vista, ni la zona vieja salta antes de irse. El shell (AppShell) no se entera de nada.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { useLocation, useNavigationType, type Location } from 'react-router-dom';
import { Spinner } from '@/components/ui/lq';
import { LOADER_DELAY_MS, useLoadingVisibility } from '@/components/ui/LoadingGate';
import { setQuietEntrance } from '@/lib/motion';
import { useText, type Copy } from '@/lib/i18n';
import { RoutePendingContext, watchReads, type RoutePending } from '@/lib/routeStage';
import { useMotionStore } from '@/store/motionStore';

/** Lo más que la zona vieja espera a la nueva: con datos más lentos, se revela con su cargador. */
const HOLD_MAX_MS = 800;
/** Lo que dura el fundido de salida (.lq-route-leave), con margen por si la animación no llega a terminar. */
const LEAVE_MS = 110;

const COPY: Copy<{ loading: string }> = { es: { loading: 'Cargando…' }, en: { loading: 'Loading…' } };

type Phase = 'active' | 'preparing' | 'leaving';
interface Frame { top: number; left: number; width: number; height?: number }
interface Entry { id: number; location: Location; phase: Phase; frame?: Frame }

/** La zona no se vuelve a pintar cuando solo cambia su fase. */
const RouteContent = memo(function RouteContent({ location, render }: { location: Location; render: (location: Location) => ReactNode }) {
  return <>{render(location)}</>;
});

function styleOf({ phase, frame }: Entry): CSSProperties | undefined {
  if (!frame || phase === 'active') return undefined;
  const box: CSSProperties = { position: 'fixed', top: frame.top, left: frame.left, width: frame.width, overflow: 'hidden', pointerEvents: 'none' };
  // Oculta pero con su sitio real, donde quedará: los observadores de vista y las escenas 3D ya arrancan.
  if (phase === 'preparing') return { ...box, height: `calc(100dvh - ${frame.top}px)`, opacity: 0 };
  return { ...box, height: frame.height };
}

export function RouteStage({ render, prepare }: {
  render: (location: Location) => ReactNode;
  /** Trae el código de la zona de destino (null si es una redirección). */
  prepare: (pathname: string) => Promise<unknown> | null;
}) {
  const t = useText(COPY);
  const location = useLocation();
  const navigationType = useNavigationType();
  const reduceMotion = useReducedMotionConfig();
  const [entries, setEntries] = useState<Entry[]>(() => [{ id: 0, location, phase: 'active' }]);
  const list = useRef(entries);
  list.current = entries;
  const nextId = useRef(1);
  const stage = useRef<HTMLDivElement>(null);
  const activeEl = useRef<HTMLDivElement | null>(null);
  const [waiting, setWaiting] = useState(false);
  const showCue = useLoadingVisibility(waiting, { delayMs: LOADER_DELAY_MS * 2 });
  /** Dónde estaba cada pantalla: al volver atrás (botón del sistema), se regresa al mismo sitio. */
  const scrollByKey = useRef(new Map<string, number>());

  // ─── Lo que retiene el relevo ───
  const holds = useRef(0);
  const recheck = useRef<(() => void) | null>(null);
  const pending = useMemo<RoutePending>(() => ({
    hold: () => {
      holds.current += 1;
      return () => {
        holds.current -= 1;
        recheck.current?.();
      };
    },
  }), []);

  const reveal = useCallback((id: number) => {
    const rect = activeEl.current?.getBoundingClientRect();
    const quick = useMotionStore.getState().reduce;
    setEntries((current) => current.flatMap((entry): Entry[] => {
      if (entry.id === id) return [{ ...entry, phase: 'active' }];
      if (entry.phase !== 'active') return [entry];
      if (quick || !rect) return [];
      return [{ ...entry, phase: 'leaving', frame: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }];
    }));
    setWaiting(false);
  }, []);

  // ─── La ruta cambió ───
  useEffect(() => {
    const active = list.current.find((e) => e.phase === 'active');
    if (!active) return undefined;

    // Misma zona (?tab=…, volver a tocar su pestaña): sin relevo, y se abandona cualquier otro destino.
    if (active.location.pathname === location.pathname) {
      setEntries((current) => current
        .filter((e) => e.phase !== 'preparing')
        .map((e) => (e.id === active.id ? { ...e, location } : e)));
      setWaiting(false);
      return undefined;
    }

    // Ya se está preparando ese destino: solo cambia lo que hay detrás de la ruta.
    const already = list.current.find((e) => e.phase === 'preparing' && e.location.pathname === location.pathname);
    if (already) {
      setEntries((current) => current.map((e) => (e.id === already.id ? { ...e, location } : e)));
      return undefined;
    }

    let cancelled = false;
    setWaiting(true);
    const mount = () => {
      if (cancelled) return;
      const box = stage.current?.getBoundingClientRect();
      // El sitio que tendrá al revelarse: arriba del todo de la página.
      const frame = box ? { top: box.top + window.scrollY, left: box.left, width: box.width } : undefined;
      setQuietEntrance(true);
      setEntries((current) => [
        ...current.filter((e) => e.phase !== 'preparing'),
        { id: nextId.current++, location, phase: 'preparing', frame },
      ]);
    };
    const loading = prepare(location.pathname);
    if (loading) loading.then(mount, mount);
    else mount();
    return () => { cancelled = true; };
  }, [location, prepare]);

  // ─── Preparación: se revela cuando no queda nada pendiente ───
  const preparingId = entries.find((e) => e.phase === 'preparing')?.id;
  // Antes de los efectos de la página (los del padre en layout corren antes que los pasivos de los hijos): así se ven sus lecturas.
  useLayoutEffect(() => {
    if (preparingId === undefined) return undefined;
    let done = false;
    let frame = 0;
    const finish = () => {
      if (done) return;
      done = true;
      reveal(preparingId);
    };
    const check = () => {
      frame = 0;
      if (holds.current === 0 && reads.pending() === 0) finish();
    };
    const schedule = () => { if (!frame && !done) frame = requestAnimationFrame(check); };
    const reads = watchReads(schedule);
    recheck.current = schedule;
    // Dos fotogramas: en el primero la página apenas lanzó sus lecturas; una respuesta ya guardada llega antes del segundo.
    let first = requestAnimationFrame(() => { first = requestAnimationFrame(check); });
    const deadline = window.setTimeout(finish, HOLD_MAX_MS);
    return () => {
      done = true;
      cancelAnimationFrame(first);
      cancelAnimationFrame(frame);
      window.clearTimeout(deadline);
      reads.stop();
      recheck.current = null;
      setQuietEntrance(false);
    };
  }, [preparingId, reveal]);

  // ─── Relevo: en el mismo commit, antes de pintar ───
  const activeId = entries.find((e) => e.phase === 'active')?.id;
  const activeKey = useRef(location.key);
  useLayoutEffect(() => {
    if (!activeId) return;
    // Atrás recupera el sitio donde estabas; ir a otra zona empieza arriba del todo.
    const entry = list.current.find((e) => e.id === activeId);
    const top = navigationType === 'POP' && entry ? scrollByKey.current.get(entry.location.key) ?? 0 : 0;
    window.scrollTo({ top, behavior: 'instant' });
    activeKey.current = entry?.location.key ?? activeKey.current;
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Antes de que la ruta cambie no hay ningún aviso: se apunta el sitio cada vez que se detiene el scroll.
  useEffect(() => {
    let timer = 0;
    const remember = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!list.current.some((e) => e.phase === 'preparing')) scrollByKey.current.set(activeKey.current, window.scrollY); }, 120);
    };
    window.addEventListener('scroll', remember, { passive: true });
    return () => { window.removeEventListener('scroll', remember); window.clearTimeout(timer); };
  }, []);

  // ─── La zona vieja se va al terminar su fundido ───
  const leaving = entries.filter((e) => e.phase === 'leaving').map((e) => e.id).join();
  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => setEntries((current) => current.filter((e) => e.phase !== 'leaving')), LEAVE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <div ref={stage} className="relative">
      {entries.map((entry) => {
        const preparing = entry.phase === 'preparing';
        return (
          <div
            key={entry.id}
            ref={entry.phase === 'active' ? activeEl : undefined}
            // La de entrada solo una vez: al terminar se quita para no dejar contexto de apilamiento.
            className={entry.phase === 'leaving' ? 'lq-route-leave' : entry.phase === 'active' && entry.id !== 0 ? 'lq-route-enter' : undefined}
            onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('lq-route-enter'); }}
            style={styleOf(entry) ?? (preparingId !== undefined && entry.phase === 'active' ? { pointerEvents: 'none' } : undefined)}
            aria-hidden={entry.phase === 'active' ? undefined : true}
            {...(entry.phase === 'active' ? {} : { inert: '' })}
          >
            <RoutePendingContext.Provider value={preparing ? pending : null}>
              <RouteContent location={entry.location} render={render} />
            </RoutePendingContext.Provider>
          </div>
        );
      })}

      {/* Solo si la espera se nota: la zona vieja sigue a la vista y esto dice que el toque se recibió. */}
      <AnimatePresence initial={false}>
        {showCue && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-20 flex justify-center px-4"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <span role="status" className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-label-lg text-on-surface shadow-md">
              <Spinner size="sm" className="text-primary-text" />
              {t.loading}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
