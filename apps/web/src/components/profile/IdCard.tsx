// Documento de identidad del jugador (Perfil). Anverso: foto, nombre, clase,
// nivel, número de documento (derivado del ID de usuario), fecha de expedición
// (registro) y franja MRZ; reverso: estadísticas. Usa el flip card existente
// (PerspectiveFlipCard): tocar el anverso lo gira; Escape o «Volver» lo
// devuelven.
//
// Movimiento: la tarjeta aparece pixel a pixel, como el personaje en su creador,
// y el sello oficial cae y estampa (la tarjeta acusa el golpe). Al pasar el
// cursor se inclina en 3D y el holograma sigue a la luz; al salir, los reflejos
// se quedan donde estaban y al volver se deslizan hasta el cursor. En Android
// sigue la inclinación del móvil. Con «Reducir movimiento»: un fundido, sin
// inclinación, el sello ya puesto y el giro como fundido (lo resuelve el flip card).
//
// Giro 360°: arrastrar en horizontal hace girar el carnet entero con inercia (el reverso
// asoma a mitad de vuelta) y siempre aterriza en la cara que estaba; «Girar 360°» da una
// vuelta completa con teclado o ratón.
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { motion, useAnimationControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import { thud } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { PerspectiveFlipCard } from '@/components/ui/perspective-flip-card';
import { PixelReveal, useHoloTilt } from '@/components/ambience';
import { BrandMark } from '@/components/layout/Brand';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const es = {
  docTitle: 'Documento de identidad',
  docNumber: 'Nº de documento',
  docNumberShort: 'Nº',
  name: 'Nombre',
  className: 'Clase',
  level: 'Nivel',
  issued: 'Expedición',
  sealText: 'NOUTLIFE · VERIFICADO · NOUTLIFE · VERIFICADO ·',
  docAria: (name: string): string => `Documento de ${name}`,
  spin: 'Girar 360°',
};

const en: typeof es = {
  docTitle: 'Identity document',
  docNumber: 'Document no.',
  docNumberShort: 'No.',
  name: 'Name',
  className: 'Class',
  level: 'Level',
  issued: 'Issued',
  sealText: 'NOUTLIFE · VERIFIED · NOUTLIFE · VERIFIED ·',
  docAria: (name: string): string => `Document of ${name}`,
  spin: 'Spin 360°',
};

const COPY: Copy<typeof es> = { es, en };

const CLASS_NAMES: Record<Locale, Record<string, string>> = {
  es: { warrior: 'Guerrero', mage: 'Mago', merchant: 'Mercader', paladin: 'Paladín' },
  en: { warrior: 'Warrior', mage: 'Mage', merchant: 'Merchant', paladin: 'Paladin' },
};
const ADVENTURER: Record<Locale, string> = { es: 'Aventurero', en: 'Adventurer' };
export const classLabel = (c?: string | null, locale: Locale = 'es') => (c ? CLASS_NAMES[locale][c] ?? c : ADVENTURER[locale]);

/** Hash FNV-1a de 32 bits (estable para un mismo ID). */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Número de documento de 10 cifras derivado del ID de usuario: «NL 4821 7730 19». */
export function documentNumber(id: string) {
  const digits = (String(hash(id)).padStart(10, '0') + String(hash(`${id}·nl`))).slice(0, 10);
  return { raw: digits, pretty: `NL ${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}` };
}

/** Dígito de control ICAO 9303 (pesos 7-3-1). */
function check(s: string) {
  const v = (c: string) => (c >= '0' && c <= '9' ? +c : c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 55 : 0);
  return String([...s].reduce((a, c, i) => a + v(c) * [7, 3, 1][i % 3], 0) % 10);
}

const mrzText = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '<');
const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n);

/** Dos líneas de 36 caracteres al estilo de un pasaporte (TD2). */
export function mrzLines({ name, id, issued, level }: { name: string; id: string; issued: Date; level: number }) {
  const parts = mrzText(name).split('<').filter(Boolean);
  const surname = parts.length > 1 ? parts.slice(1).join('<') : parts[0] ?? '';
  const given = parts.length > 1 ? parts[0] : '';
  const doc = documentNumber(id).raw.slice(0, 9);
  const ymd = `${String(issued.getFullYear()).slice(2)}${String(issued.getMonth() + 1).padStart(2, '0')}${String(issued.getDate()).padStart(2, '0')}`;
  const lvl = String(level).padStart(3, '0');
  const l2 = `${doc}${check(doc)}NOU${ymd}${check(ymd)}L${lvl}`;
  return [pad(`IDNOU${surname}<<${given}`, 36), pad(`${l2}<<<<<<<<<${check(l2)}`, 36)];
}

/** Sello oficial: anillo con texto y la hoja de Noutlife en el centro. */
function Seal({ className, text }: { className?: string; text: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={cn('overflow-visible', className)}>
      <defs><path id="lq-seal-ring" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0" /></defs>
      <circle cx="50" cy="50" r="46" className="fill-none stroke-current" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="27" className="fill-none stroke-current" strokeWidth="1.2" strokeDasharray="2 2.6" />
      <text className="fill-current font-mono text-[10.5px] font-bold tracking-[.18em]">
        <textPath href="#lq-seal-ring" startOffset="2%">{text}</textPath>
      </text>
      <path d="M41 63V43l18 20V40" className="fill-none stroke-current" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Giro libre del carnet: escribe --spin (grados) en el contenedor; mientras gira, data-spinning
 * quita la transición del rotor y deja ver las dos caras. Al soltar, un muelle lo lleva a la
 * vuelta completa más cercana en el sentido del gesto y --spin vuelve a 0 sin que se note.
 */
function useSpin360(reduce: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useRef({ deg: 0, vel: 0, raf: 0, dragged: false, press: null as null | { id: number; x: number; y: number; base: number; lastX: number; lastT: number; moved: boolean } });
  const paint = (deg: number) => ref.current?.style.setProperty('--spin', `${deg.toFixed(2)}deg`);
  const spinning = (on: boolean) => (on ? ref.current?.setAttribute('data-spinning', '') : ref.current?.removeAttribute('data-spinning'));

  const settle = useCallback((goal?: number) => {
    const st = s.current;
    cancelAnimationFrame(st.raf);
    const target = goal ?? (Math.abs(st.vel) > 120
      ? (st.vel > 0 ? Math.ceil(st.deg / 360 + 0.08) : Math.floor(st.deg / 360 - 0.08)) * 360
      : Math.round(st.deg / 360) * 360);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      st.vel += ((target - st.deg) * 70 - st.vel * 12) * dt;
      st.deg += st.vel * dt;
      paint(st.deg);
      if (Math.abs(target - st.deg) < 0.25 && Math.abs(st.vel) < 6) {
        // Una vuelta entera es lo mismo que ninguna: vuelve a 0 todavía sin transición.
        st.deg = 0;
        st.vel = 0;
        paint(0);
        st.raf = requestAnimationFrame(() => spinning(false));
        return;
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => cancelAnimationFrame(s.current.raf), []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reduce || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const st = s.current;
    cancelAnimationFrame(st.raf);
    st.press = { id: e.pointerId, x: e.clientX, y: e.clientY, base: st.deg, lastX: e.clientX, lastT: performance.now(), moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = s.current.press;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    if (!p.moved) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(e.clientY - p.y) * 1.2) return;
      p.moved = true;
      spinning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const now = performance.now();
    const st = s.current;
    st.deg = p.base + dx * 0.6;
    st.vel = st.vel * 0.6 + (((e.clientX - p.lastX) * 0.6) / Math.max(0.008, (now - p.lastT) / 1000)) * 0.4;
    p.lastX = e.clientX;
    p.lastT = now;
    paint(st.deg);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    const p = st.press;
    st.press = null;
    if (!p || p.id !== e.pointerId || !p.moved) return;
    st.dragged = true;
    settle();
  };
  // Un arrastre no es un toque: el carnet no se da la vuelta al soltar.
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!s.current.dragged) return;
    s.current.dragged = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const spinOnce = () => {
    if (reduce) return;
    const st = s.current;
    spinning(true);
    st.vel = 900;
    settle(Math.ceil((st.deg + 1) / 360) * 360);
  };
  return { ref, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture }, spinOnce };
}

export interface IdCardProps {
  user: { id: string; displayName: string; username?: string; level: number; playerClass?: string | null; createdAt: string };
  title: string;
  photo: ReactNode;
  back: ReactNode;
}

export function IdCard({ user, title, photo, back }: IdCardProps) {
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  const card = useAnimationControls();
  const [flipped, setFlipped] = useState(false);
  // Girada, la tarjeta deja de inclinarse para que el reverso se lea recto.
  const holo = useHoloTilt<HTMLDivElement>(7, { frozen: flipped });
  const spin = useSpin360(reduce);
  const issued = new Date(user.createdAt);
  const doc = documentNumber(user.id);
  const [m1, m2] = mrzLines({ name: user.displayName, id: user.id, issued, level: user.level });
  const locale = useLocale();
  const fmt = (d: Date) => d.toLocaleDateString(INTL_LOCALE[locale], { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
  const classText = classLabel(user.playerClass, locale);

  // El sello cae cuando la tarjeta ya está entera (~1,3 s): la tarjeta acusa el golpe.
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => void card.start(thud), 1480);
    return () => window.clearTimeout(t);
  }, [card, reduce]);

  const front = (
    <div className="lq-tex-paper relative flex size-full flex-col overflow-hidden rounded-[inherit] p-3.5 text-left sm:p-5">
      <span aria-hidden="true" className="lq-guilloche" />
      {/* Franja superior */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrandMark size={24} className="sm:!size-7" />
          <span className="flex flex-col leading-tight">
            <span className="text-label-lg text-on-background">Noutlife</span>
            <span className="text-label-md text-on-surface-light">{t.docTitle}</span>
          </span>
        </div>
        <span className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-label-md text-on-surface-light">{t.docNumber}</span>
          <span className="font-mono text-label-lg text-on-background">{doc.pretty}</span>
        </span>
      </div>
      {/* Foto + datos */}
      <div className="relative mt-2.5 flex min-h-0 flex-1 gap-3 sm:mt-4 sm:gap-5">
        <div className="relative h-full max-h-[7rem] shrink-0 sm:max-h-[10.5rem]">
          <div className="relative aspect-[4/5] h-full overflow-hidden rounded-xl bg-surface-variant ring-1 ring-border">
            {photo}
          </div>
          {/* Sello oficial sobre la esquina de la foto: cae y estampa */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 -right-5 block size-12 text-primary mix-blend-multiply dark:mix-blend-screen sm:-right-7 sm:size-[4.25rem]"
            initial={reduce ? { opacity: 0.72, rotate: -14 } : { opacity: 0, scale: 2.1, rotate: -40, y: -18 }}
            animate={{ opacity: 0.72, scale: 1, rotate: -14, y: 0 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20, mass: 1.1, delay: 1.3, opacity: { duration: 0.12, delay: 1.3 } }}
          >
            <Seal className="size-full" text={t.sealText} />
          </motion.span>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-2 gap-y-1.5 pl-3 sm:gap-x-3 sm:gap-y-2.5 sm:pl-4">
          <div className="col-span-2 min-w-0">
            <dt className="text-label-md text-on-surface-light">{t.name}</dt>
            <dd className="truncate text-body-md font-semibold text-on-background sm:text-heading-sm">{user.displayName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-label-md text-on-surface-light">{t.className}</dt>
            <dd className="truncate text-label-md text-on-background sm:text-label-lg">{classText}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-label-md text-on-surface-light">{t.level}</dt>
            <dd className="truncate text-label-md text-on-background sm:text-label-lg"><span className="font-mono">{user.level}</span> · {title}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label-md text-on-surface-light">{t.issued}</dt>
            <dd className="truncate font-mono text-label-md text-on-background sm:text-label-lg">{fmt(issued)}</dd>
          </div>
          <div className="min-w-0 sm:hidden">
            <dt className="text-label-md text-on-surface-light">{t.docNumberShort}</dt>
            <dd className="truncate font-mono text-label-md text-on-background">{doc.pretty.slice(3)}</dd>
          </div>
        </dl>
      </div>
      {/* Franja MRZ */}
      <div aria-hidden="true" className="relative mt-2 -mx-3.5 -mb-3.5 border-t border-border bg-surface-variant/70 px-3.5 py-1.5 font-mono text-[0.6rem] leading-[1.35] tracking-[.12em] text-on-surface sm:-mx-5 sm:-mb-5 sm:px-5 sm:py-2 sm:text-[0.72rem]">
        <div className="truncate">{m1}</div>
        <div className="truncate">{m2}</div>
      </div>
      {/* Holograma: sigue la luz */}
      <span aria-hidden="true" className="lq-holo" />
    </div>
  );

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[30rem]"
      exit={{ y: '12%', opacity: 0, transition: { duration: 0.2 } }}
    >
      <PixelReveal cols={30} rows={19} delay={140} spread={640} seed={user.id.length + 11}>
        <motion.div animate={card}>
          <div ref={spin.ref} {...spin.handlers} className="relative touch-pan-y">
          <div
            ref={holo.ref}
            onPointerMove={holo.onPointerMove}
            onPointerLeave={holo.onPointerLeave}
            className="relative [transform:perspective(1100px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
          >
            <PerspectiveFlipCard
              label={t.docAria(user.displayName)}
              trigger="tap"
              flipped={flipped}
              onFlipChange={setFlipped}
              className="aspect-[1.32] h-auto min-h-0 max-w-none sm:aspect-[1.586]"
              frontClassName="overflow-hidden shadow-lg"
              backClassName="overflow-hidden shadow-lg"
              front={front}
              back={back}
            />
          </div>
          </div>
        </motion.div>
      </PixelReveal>
      {!reduce && (
        <div className="mt-3 flex justify-center">
          <button type="button" className="lq-flip-chip" onClick={spin.spinOnce}>
            <RotateCw aria-hidden className="size-4" strokeWidth={2} />{t.spin}
          </button>
        </div>
      )}
    </motion.div>
  );
}
