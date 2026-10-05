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
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import { thud } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { PerspectiveFlipCard } from '@/components/ui/perspective-flip-card';
import { PixelReveal, useHoloTilt } from '@/components/ambience';

const CLASS_NAMES: Record<string, string> = { warrior: 'Guerrero', mage: 'Mago', merchant: 'Mercader', paladin: 'Paladín' };
export const classLabel = (c?: string | null) => (c ? CLASS_NAMES[c] ?? c : 'Aventurero');

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
function Seal({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={cn('overflow-visible', className)}>
      <defs><path id="lq-seal-ring" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1-72 0" /></defs>
      <circle cx="50" cy="50" r="46" className="fill-none stroke-current" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="27" className="fill-none stroke-current" strokeWidth="1.2" strokeDasharray="2 2.6" />
      <text className="fill-current font-mono text-[10.5px] font-bold tracking-[.18em]">
        <textPath href="#lq-seal-ring" startOffset="2%">NOUTLIFE · VERIFICADO · NOUTLIFE · VERIFICADO ·</textPath>
      </text>
      <path d="M41 63V43l18 20V40" className="fill-none stroke-current" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface IdCardProps {
  user: { id: string; displayName: string; username?: string; level: number; playerClass?: string | null; createdAt: string };
  title: string;
  photo: ReactNode;
  back: ReactNode;
}

export function IdCard({ user, title, photo, back }: IdCardProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const card = useAnimationControls();
  const [flipped, setFlipped] = useState(false);
  // Girada, la tarjeta deja de inclinarse para que el reverso se lea recto.
  const holo = useHoloTilt<HTMLDivElement>(7, { frozen: flipped });
  const issued = new Date(user.createdAt);
  const doc = documentNumber(user.id);
  const [m1, m2] = mrzLines({ name: user.displayName, id: user.id, issued, level: user.level });
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');

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
          <img src="/brand/noutlife-mark.svg" alt="" aria-hidden="true" className="size-6 dark:hidden sm:size-7" draggable={false} />
          <img src="/brand/noutlife-mark-on-dark.svg" alt="" aria-hidden="true" className="hidden size-6 dark:block sm:size-7" draggable={false} />
          <span className="flex flex-col leading-tight">
            <span className="text-label-lg text-on-background">Noutlife</span>
            <span className="text-label-md text-on-surface-light">Documento de identidad</span>
          </span>
        </div>
        <span className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-label-md text-on-surface-light">Nº de documento</span>
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
            <Seal className="size-full" />
          </motion.span>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-2 gap-y-1.5 pl-3 sm:gap-x-3 sm:gap-y-2.5 sm:pl-4">
          <div className="col-span-2 min-w-0">
            <dt className="text-label-md text-on-surface-light">Nombre</dt>
            <dd className="truncate text-body-md font-semibold text-on-background sm:text-heading-sm">{user.displayName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-label-md text-on-surface-light">Clase</dt>
            <dd className="truncate text-label-md text-on-background sm:text-label-lg">{classLabel(user.playerClass)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-label-md text-on-surface-light">Nivel</dt>
            <dd className="truncate text-label-md text-on-background sm:text-label-lg"><span className="font-mono">{user.level}</span> · {title}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-label-md text-on-surface-light">Expedición</dt>
            <dd className="truncate font-mono text-label-md text-on-background sm:text-label-lg">{fmt(issued)}</dd>
          </div>
          <div className="min-w-0 sm:hidden">
            <dt className="text-label-md text-on-surface-light">Nº</dt>
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
          <div
            ref={holo.ref}
            onPointerMove={holo.onPointerMove}
            onPointerLeave={holo.onPointerLeave}
            className="relative [transform:perspective(1100px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
          >
            <PerspectiveFlipCard
              label={`Documento de ${user.displayName}`}
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
        </motion.div>
      </PixelReveal>
    </motion.div>
  );
}
