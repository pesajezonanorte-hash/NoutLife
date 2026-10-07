// La carta: la conversación es una carta de papel (o la foto de fondo que
// eligieron, impresa sobre el papel). Cada mensaje es una tira escrita a mano
// (las tuyas en tinta jade), los días se separan con un matasellos, las fotos
// quedan pegadas con cinta, las notas de voz llevan su onda, los stickers se
// pegan y los minijuegos se juegan dentro. Todo llega en vivo: lo nuevo, las
// reacciones, las ediciones, quién escribe y quién ya lo vio. Al enviar, el texto
// se dobla en un sobre que vuela; la foto sale de la cámara y vuela hasta su
// sitio. La racha solo se muestra encendida (tres días seguidos hablando).
// Igual para la carta entre dos amigos y la de un gremio.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive, ArrowDown, ArrowLeft, Ban, Coins, Contact, Eraser, Image as ImageIcon, ImagePlus, MoreHorizontal, Pencil, Tent, Trash2, X, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useChatFocus } from '@/store/chatFocusStore';
import { useToastStore } from '@/hooks/useToast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { nameClass } from '@/lib/nameColors';
import { useMedia } from '@/lib/media';
import {
  apiError, blockUser, DEFAULT_FIT, saveSticker, setChatPref, socialLink, timeAgo,
  type GameType, type GuildDetail, type GuildMemberRow, type PublicUser, type RpsPick, type Typing,
} from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { GuildCrest } from '@/components/guild/GuildCrest';
import { emblemOf } from '@/components/guild/emblems';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Modal, Skeleton, useDialogBehavior } from '@/components/ui/lq';
import { PresenceAvatar, StreakFlame, isLit } from '../SocialBits';
import { GuildEditDialog } from '../GuildEditDialog';
import { BackdropEditor } from './BackdropEditor';
import { Composer, type ComposerHandle } from './Composer';
import { InstantCamera, type PhotoSource } from './InstantCamera';
import { VideoRecorder, type VideoClip } from './VideoRecorder';
import { InstantPhoto } from './InstantPhoto';
import { LetterBackdrop } from './LetterBackdrop';
import { ACTION_ICONS, MessageMenu, MessageRow, snippetOf, tiltOf, time, type MenuAction } from './MessageRow';
import { addToCollection } from './StickerPanel';
import { knownKeyboard } from './viewport';
import { useDirectLetter, useGuildLetter, type LetterApi, type LetterMsg } from './useLetter';

const toaster = () => useToastStore.getState();
const dayOf = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
const sameGroup = (a: LetterMsg | undefined, b: LetterMsg) =>
  Boolean(a && a.kind !== 'EVENT' && b.kind !== 'EVENT' && a.author?.id === b.author?.id && dayOf(a.createdAt) === dayOf(b.createdAt)
    && Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000);

// ─── Piezas ───────────────────────────────────────────────────────────────────

/** Matasellos entre días: aro con el día y las ondas de cancelación. */
function Postmark({ iso }: { iso: string }) {
  const d = new Date(iso);
  const label = dayLabel(iso);
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return (
    <div role="separator" aria-label={label} className="my-4 flex items-center justify-center gap-2">
      <span aria-hidden="true" className="lq-postmark relative flex -rotate-6 items-center">
        <svg viewBox="0 0 132 48" className="h-11 w-[121px] overflow-visible" fill="none" stroke="currentColor">
          <circle cx="24" cy="24" r="20" strokeWidth="1.6" />
          <circle cx="24" cy="24" r="15.5" strokeWidth=".8" strokeDasharray="2 2.2" />
          {[15, 24, 33].map((y) => <path key={y} d={`M50 ${y}q6-4.5 12 0t12 0 12 0 12 0 12 0 12 0 12 0`} strokeWidth="1.3" strokeLinecap="round" />)}
        </svg>
        <span className="absolute left-0 top-0 flex size-11 flex-col items-center justify-center font-mono leading-none">
          <span className="text-[12px] font-medium">{d.getDate()}</span>
          <span className="text-[9px]">{month}</span>
        </span>
      </span>
      <span className="rounded-full bg-surface/85 px-2 py-0.5 text-label-md capitalize text-on-surface-light">{label}</span>
    </div>
  );
}

const EDIT_LABEL: Record<string, string> = { name: 'el nombre', description: 'la descripción', emblem: 'el emblema', photo: 'la foto' };

/** Aviso de la carta (cambió el fondo o el gremio). */
function EventNote({ m }: { m: LetterMsg }) {
  const who = m.mine ? 'Tú' : m.author?.name.split(' ')[0] ?? 'Alguien';
  const c = m.content ?? '';
  let text: string;
  if (c.startsWith('edit:')) {
    const parts = c.slice(5).split(',').map((p) => EDIT_LABEL[p]).filter(Boolean);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0] ?? 'el gremio';
    text = `${who} ${m.mine ? 'cambiaste' : 'cambió'} ${list} del gremio`;
  } else if (c === 'bg-off') text = m.mine ? 'Quitaste el fondo: la carta volvió al papel' : `${who} quitó el fondo: la carta volvió al papel`;
  else text = m.mine ? 'Cambiaste el fondo de la carta' : `${who} cambió el fondo de la carta`;
  return (
    <p className="mx-auto my-3 inline-flex max-w-[92%] items-center gap-1.5 self-center rounded-full border border-dashed border-border-strong/60 bg-surface/90 px-3 py-1 text-body-sm text-on-surface-light">
      {c.startsWith('edit:') ? <Pencil aria-hidden className="size-4 shrink-0" strokeWidth={1.75} /> : <ImageIcon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />}{text}
    </p>
  );
}

/** Tres puntos que se escriben solos: alguien está escribiendo. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-end gap-[3px]', className)}>
      {[0, 1, 2].map((i) => <span key={i} className="lq-typing-dot block size-[5px] rounded-full bg-current" style={{ animationDelay: `${i * 0.16}s` }} />)}
    </span>
  );
}

/** La tira de "escribiendo…" al pie de la carta (con quién, en un gremio). */
function TypingSlip({ typing, group, authorOf }: { typing: Typing[]; group: boolean; authorOf: (id: string) => { name: string; avatarConfig?: unknown; avatarUrl?: string | null } | null }) {
  const reduce = useMotionStore((s) => s.reduce);
  const who = typing.map((t) => authorOf(t.userId)).filter(Boolean) as Array<{ name: string; avatarConfig?: unknown; avatarUrl?: string | null }>;
  const names = who.map((w) => w.name.split(' ')[0]);
  const label = !group ? 'Escribiendo' : names.length === 1 ? `${names[0]} escribe` : names.length === 2 ? `${names[0]} y ${names[1]} escriben` : `${names.length} personas escriben`;
  return (
    <motion.div
      key="typing" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }} transition={springs.snappy}
      className="mt-3 flex items-end gap-2" role="status" aria-live="polite"
    >
      {group && who[0] && (
        <span className="inline-flex size-[30px] shrink-0 overflow-hidden rounded-full ring-2 ring-surface">
          <AvatarDisplay avatarConfig={who[0].avatarConfig} avatarUrl={who[0].avatarUrl} size={30} animate="none" className="rounded-full" />
        </span>
      )}
      <span className="lq-slip inline-flex items-center gap-2 px-3.5 py-2.5 text-body-sm text-on-surface-light">
        <TypingDots className="text-on-surface-light" /><span>{label}…</span>
      </span>
    </motion.div>
  );
}

/** La foto vuela desde la cámara hasta su sitio en la carta y se pega. */
function PhotoFlight({ flight, listRef, onLanded }: {
  flight: { id: string; src: string; caption: string; from: DOMRect }; listRef: RefObject<HTMLDivElement>; onLanded: () => void;
}) {
  const [to, setTo] = useState<DOMRect | null>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;
  useLayoutEffect(() => {
    let raf = 0;
    let tries = 0;
    const find = () => {
      const list = listRef.current;
      const el = list?.querySelector<HTMLElement>(`[data-photo="${flight.id}"]`);
      if (list && el) {
        list.scrollTop = list.scrollHeight;
        raf = requestAnimationFrame(() => setTo(el.getBoundingClientRect()));
        return;
      }
      if (++tries < 30) raf = requestAnimationFrame(find);
      else landed.current();
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [flight.id, listRef]);
  const { from } = flight;
  const k = to ? to.width / from.width : 1;
  return createPortal(
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[75]"
      style={{ width: from.width, x: from.left, y: from.top, originX: 0, originY: 0 }}
      animate={to ? {
        x: [from.left, (from.left + to.left) / 2, to.left],
        y: [from.top, Math.min(from.top, to.top) - 80, to.top],
        scale: [1, (1 + k) / 2 + 0.06, k],
        rotate: [0, -8, tiltOf(flight.id) * 3],
      } : undefined}
      transition={{ duration: 0.9, times: [0, 0.45, 1], ease: [0.3, 0.1, 0.25, 1] }}
      onAnimationComplete={() => { if (to) landed.current(); }}
    >
      <InstantPhoto src={flight.src} alt="" caption={flight.caption} tape={false} className="w-full shadow-lg" />
    </motion.div>,
    document.body,
  );
}

/** El texto enviado se va doblado en un sobre que sale volando. */
function EnvelopeFlights({ items }: { items: Array<{ id: number; x: number; y: number }> }) {
  if (!items.length) return null;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[66]">
      {items.map((it) => (
        <motion.div
          key={it.id} className="absolute" style={{ left: it.x - 18, top: it.y - 13 }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.05, 0.95, 0.6], x: [0, -8, -40, -74], y: [0, -28, -92, -156], rotate: [0, -10, -18, -26] }}
          transition={{ duration: 0.8, times: [0, 0.2, 0.6, 1], ease: 'easeOut' }}
        >
          <svg viewBox="0 0 36 26" className="h-[26px] w-9 drop-shadow-[0_3px_4px_rgb(0_0_0/.25)]">
            <rect x="1" y="1" width="34" height="24" rx="3" style={{ fill: 'color-mix(in srgb, rgb(var(--lq-warning)) 14%, white)', stroke: 'rgb(var(--lq-jade-900) / .35)', strokeWidth: 1 }} />
            <path d="M2 3 L18 15 L34 3" style={{ fill: 'none', stroke: 'rgb(var(--lq-jade-900) / .35)', strokeWidth: 1.2, strokeLinejoin: 'round' }} />
            <circle cx="18" cy="15" r="4" style={{ fill: 'rgb(var(--lq-jade-600))' }} />
          </svg>
        </motion.div>
      ))}
    </div>,
    document.body,
  );
}

interface MenuItem { label: string; icon: LucideIcon; to?: string; onSelect?: () => void; danger?: boolean }

function LetterMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const row = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-body-md hover:bg-background focus-visible:bg-background';
  return (
    <div ref={ref} className="relative">
      <Button variant="icon" aria-label="Opciones de la carta" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal aria-hidden className="size-5" />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} transition={springs.natural}
            className="absolute right-0 top-full z-30 mt-2 flex w-64 origin-top-right flex-col rounded-2xl border border-border bg-surface p-1.5 shadow-lg"
          >
            {items.map((it) => {
              const body = <><it.icon aria-hidden className={cn('size-4 shrink-0', it.danger ? 'text-error-text' : 'text-on-surface-light')} strokeWidth={1.75} /><span className={cn(it.danger && 'text-error-text')}>{it.label}</span></>;
              return it.to
                ? <Link key={it.label} role="menuitem" to={it.to} onClick={() => setOpen(false)} className={row}>{body}</Link>
                : <button key={it.label} role="menuitem" type="button" onClick={() => { setOpen(false); it.onSelect?.(); }} className={row}>{body}</button>;
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * La foto en grande, por encima de la carta (si aún no había llegado, se pide
 * aquí). Se cierra tocando fuera, con la X, con Escape o arrastrándola hacia abajo.
 */
function PhotoViewer({ m, side, src, onClose }: { m: LetterMsg | null; side: 'dm' | 'guild'; src: string | null; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>{m && <PhotoLightbox key={m.id} m={m} side={side} src={src} onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}

function PhotoLightbox({ m, side, src, onClose }: { m: LetterMsg; side: 'dm' | 'guild'; src: string | null; onClose: () => void }) {
  const panelRef = useDialogBehavior(true, onClose);
  const reduce = useMotionStore((s) => s.reduce);
  const media = useMedia(side, m.id, { enabled: !src, local: m.local });
  const photo = src ?? media.photoUrl;
  const title = m.mine ? 'Tu foto' : `Foto de ${m.author?.name.split(' ')[0] ?? ''}`;
  return (
    <motion.div
      className="fixed inset-0 z-[82] flex flex-col bg-[rgb(var(--lq-jade-900)/.94)] text-jade-50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="pointer-events-none flex min-h-0 flex-1 flex-col outline-none">
        <div className="pointer-events-auto flex items-center justify-between gap-3 px-3 pt-[max(.75rem,env(safe-area-inset-top))]">
          <p className="min-w-0 truncate pl-2 text-label-lg">{title} <span className="font-mono text-body-sm text-jade-100/75">· {dayLabel(m.createdAt)} · {time(m.createdAt)}</span></p>
          <Button variant="icon" aria-label="Cerrar" onClick={onClose} className="text-jade-50 hover:bg-white/10"><X aria-hidden className="size-6" /></Button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <motion.div
            className="pointer-events-auto w-full max-w-[min(440px,90vw,70svh)] touch-none"
            drag={reduce ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.6}
            onDragEnd={(_, info) => { if (Math.abs(info.offset.y) > 110 || Math.abs(info.velocity.y) > 600) onClose(); }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, rotate: -4, y: 30 }}
            animate={{ opacity: 1, scale: 1, rotate: -1.5, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 40 }}
            transition={reduce ? { duration: 0.15 } : springs.natural}
          >
            <InstantPhoto src={photo} thumb={m.meta?.thumb} alt={title} caption={m.content} tilt={0} className="w-full shadow-2xl" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── La carta ─────────────────────────────────────────────────────────────────

interface ShellProps {
  api: LetterApi;
  label: string;
  /** A quién se escribe (placeholder, cámara). */
  to: string;
  /** Con quién se comparte el fondo (texto del editor). */
  shareWith: string;
  header: ReactNode;
  extraMenu?: MenuItem[];
  empty: { title: string; hint: string };
  group?: boolean;
  /** Miembros del gremio (fotos para "visto por" y "escribiendo"). */
  members?: GuildMemberRow[];
  onBack?: () => void;
  /** Tras archivar, vaciar o bloquear: cerrar la carta. */
  onLeave?: () => void;
  /** Bloquear (solo en la carta con un amigo). */
  blockTarget?: PublicUser;
  className?: string;
}

function LetterShell({ api, label, to, shareWith, header, extraMenu = [], empty, group = false, members, onBack, onLeave, blockTarget, className }: ShellProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const fine = useMediaQuery('(pointer: fine)');
  const listRef = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const [camera, setCamera] = useState(false);
  const [video, setVideo] = useState(false);
  const [editor, setEditor] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [viewer, setViewer] = useState<{ m: LetterMsg; src: string | null } | null>(null);
  const [flight, setFlight] = useState<{ id: string; src: string; caption: string; from: DOMRect } | null>(null);
  const [envelopes, setEnvelopes] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [replying, setReplying] = useState<LetterMsg | null>(null);
  const [editing, setEditing] = useState<LetterMsg | null>(null);
  const [menu, setMenu] = useState<{ m: LetterMsg; rect: DOMRect } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [below, setBelow] = useState(0);
  const [confirm, setConfirm] = useState<'clear' | 'block' | 'delete' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LetterMsg | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const count = api.messages.length;
  const seenCount = useRef(0);
  const stick = useRef(true);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // La carta que está abierta: los avisos de lo que llega a ella no se muestran (ya la estás viendo).
  useEffect(() => {
    useChatFocus.getState().open(api.viewKey);
    return () => useChatFocus.getState().close(api.viewKey);
  }, [api.viewKey]);

  // Al cargar mensajes antiguos arriba, la vista se queda en el mismo mensaje.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && anchor.current) {
      el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.top;
      anchor.current = null;
    }
  });

  // La carta baja sola hasta lo último si ya estabas abajo (o si lo escribiste tú); si estabas
  // leyendo más arriba, se queda donde estás y avisa de lo nuevo. La primera vez, sin animación
  // y antes de pintarse (así no se ve un salto).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !count) return;
    const first = seenCount.current === 0;
    const last = api.messages[count - 1];
    const grew = count > seenCount.current;
    if (first) el.scrollTop = el.scrollHeight;
    else if (grew && (stick.current || last.mine)) { el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); setBelow(0); }
    else if (grew && !anchor.current) setBelow((n) => n + count - seenCount.current);
    seenCount.current = count;
  }, [count, reduce, api.messages]);

  // Si la carta cambia de alto (teclado que se abre, renglón que crece), lo último sigue a la vista.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const typingCount = api.typing.length;
  useEffect(() => { const el = listRef.current; if (el && typingCount && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); }, [typingCount, reduce]);

  const loadOlder = useCallback(async () => {
    const el = listRef.current;
    if (!el || !api.hasMore || loadingOlder) return;
    setLoadingOlder(true);
    anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    try { await api.loadOlder(); } catch { anchor.current = null; } finally { setLoadingOlder(false); }
  }, [api, loadingOlder]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (stick.current) setBelow(0);
    if (el.scrollTop < 120 && api.hasMore && !loadingOlder) void loadOlder();
  }
  function toBottom() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }
  // Deslizar hacia abajo sobre la carta esconde el teclado (como en las apps de mensajería).
  function onTouchStart(e: TouchEvent) { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
  function onTouchMove(e: TouchEvent) {
    const t = touch.current;
    if (!t || !composerFocused) return;
    const dy = e.touches[0].clientY - t.y;
    const dx = Math.abs(e.touches[0].clientX - t.x);
    if (dy > 28 && dx < 24) { composer.current?.blur(); touch.current = null; }
  }

  function flyEnvelope() {
    if (reduce) return;
    const btn = document.querySelector<HTMLElement>('[aria-label="Enviar carta"]');
    const r = btn?.getBoundingClientRect();
    if (!r) return;
    const id = Date.now();
    setEnvelopes((l) => [...l, { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }]);
    window.setTimeout(() => setEnvelopes((l) => l.filter((e) => e.id !== id)), 900);
  }

  async function sendText(content: string) {
    const reply = replying;
    setReplying(null);
    stick.current = true;
    flyEnvelope();
    try { await api.sendText(content, reply); }
    catch (err) { setReplying(reply); throw err; }
  }
  async function saveEdit(content: string) {
    const m = editing;
    setEditing(null);
    if (m) await api.edit(m.id, content);
  }

  function onCameraSend(photo: string, caption: string, from: DOMRect | null, source: PhotoSource) {
    const localId = `tmp-${Date.now()}`;
    const fly = Boolean(from) && !reduce;
    stick.current = true;
    if (fly && from) setFlight({ id: localId, src: photo, caption, from });
    api.sendPhoto(photo, caption, localId, fly, source).catch((err) => { setFlight(null); toaster().error((err as Error).message); });
  }

  async function revive() {
    if (!api.revive) return;
    setReviving(true);
    try { await api.revive(); } finally { setReviving(false); }
  }

  // Nombre y color de quien escribió cada mensaje citado.
  const authors = useMemo(() => {
    const map = new Map<string, { name: string; color?: string | null; avatarConfig?: unknown; avatarUrl?: string | null }>();
    for (const mem of members ?? []) map.set(mem.userId, { name: mem.user.displayName, color: mem.user.nameColor, avatarConfig: mem.user.avatarConfig, avatarUrl: mem.user.avatarUrl });
    for (const m of api.messages) if (m.author) map.set(m.author.id, { name: m.author.name, color: m.author.nameColor, avatarConfig: m.author.avatarConfig, avatarUrl: m.author.avatarUrl });
    return map;
  }, [api.messages, members]);
  const nameOf = useCallback((authorId: string) => (authorId === api.meId ? 'Tú' : authors.get(authorId)?.name.split(' ')[0] ?? (group ? 'Alguien' : to)), [api.meId, authors, group, to]);
  const colorOf = useCallback((authorId: string) => authors.get(authorId)?.color, [authors]);

  function startReply(m: LetterMsg) {
    setMenu(null);
    setEditing(null);
    setReplying(m);
    composer.current?.focus();
  }
  function jump(id: string) {
    const el = listRef.current?.querySelector(`[data-msg="${CSS.escape(id)}"]`);
    if (!el) { toaster().info('Ese mensaje es más antiguo', 'Sube en la carta para cargarlo.'); return; }
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    setFlash(id);
    window.setTimeout(() => setFlash((c) => (c === id ? null : c)), 1400);
  }
  function react(m: LetterMsg, emoji: string) {
    setMenu(null);
    void api.react(m.id, emoji);
  }
  // Manejadores con identidad fija: así las filas (memo) no se repintan cada vez que cambia algo ajeno
  // (scroll, teclado, "escribiendo"). Siempre llaman a la versión más reciente.
  const latest = useRef({ startReply, react, jump, move: api.move });
  latest.current = { startReply, react, jump, move: api.move };
  const rowHandlers = useMemo(() => ({
    onMenu: (msg: LetterMsg, rect: DOMRect) => setMenu({ m: msg, rect }),
    onReply: (msg: LetterMsg) => latest.current.startReply(msg),
    onReact: (msg: LetterMsg, emoji: string) => latest.current.react(msg, emoji),
    onOpenPhoto: (msg: LetterMsg, src: string | null) => setViewer({ m: msg, src }),
    onJump: (id: string) => latest.current.jump(id),
    onMove: (msg: LetterMsg, mv: number | RpsPick) => latest.current.move(msg.id, mv),
  }), []);
  function sendVideo(clip: VideoClip) {
    const reply = replying;
    setReplying(null);
    stick.current = true;
    api.sendVideo(clip, reply).catch((err) => toaster().error((err as Error).message));
  }
  function sendSticker(hash: string) {
    const reply = replying;
    setReplying(null);
    stick.current = true;
    api.sendSticker(hash, reply).catch((err) => toaster().error((err as Error).message));
  }
  function startGame(type: GameType) { stick.current = true; void api.startGame(type); }

  const menuActions = (m: LetterMsg): MenuAction[] => {
    const close = () => setMenu(null);
    const acts: MenuAction[] = [{ id: 'reply', label: 'Responder', icon: ACTION_ICONS.reply, run: () => startReply(m) }];
    if (m.kind === 'TEXT' && m.content) acts.push({ id: 'copy', label: 'Copiar texto', icon: ACTION_ICONS.copy, run: () => { close(); void navigator.clipboard?.writeText(m.content ?? '').then(() => toaster().info('Texto copiado')); } });
    if (m.kind === 'STICKER' && !m.mine && m.meta?.sticker) {
      const hash = m.meta.sticker;
      acts.push({ id: 'save', label: 'Guardar sticker', icon: ACTION_ICONS.save, run: () => {
        close();
        saveSticker(hash).then((row) => { addToCollection(row); toaster().success('Sticker guardado', 'Ya está en tu colección.'); }).catch((e) => toaster().error(apiError(e, 'No se pudo guardar')));
      } });
    }
    if (m.mine && m.kind === 'TEXT') acts.push({ id: 'edit', label: 'Editar', icon: ACTION_ICONS.edit, run: () => { close(); setReplying(null); setEditing(m); } });
    if (m.mine) acts.push({ id: 'remove', label: 'Borrar para todos', icon: ACTION_ICONS.remove, danger: true, run: () => { close(); setPendingDelete(m); setConfirm('delete'); } });
    return acts;
  };

  async function archive() {
    try { await setChatPref(api.viewKey, { archived: true }); toaster().info('Carta archivada', 'La encuentras en «Archivadas», al final del buzón.'); onLeave?.(); }
    catch (e) { toaster().error(apiError(e, 'No se pudo archivar')); }
  }
  async function clearChat() {
    setConfirm(null);
    try { await setChatPref(api.viewKey, { clear: true }); toaster().info('Chat eliminado', 'Se borró el historial solo para ti.'); onLeave?.(); }
    catch (e) { toaster().error(apiError(e, 'No se pudo eliminar el chat')); }
  }
  async function block() {
    if (!blockTarget) return;
    setConfirm(null);
    try { await blockUser(blockTarget.id); toaster().info(`Bloqueaste a ${blockTarget.displayName.split(' ')[0]}`, 'Puedes desbloquearlo en Ajustes → Privacidad.'); onLeave?.(); }
    catch (e) { toaster().error(apiError(e, 'No se pudo bloquear')); }
  }

  const bg = api.background;
  const current = bg && api.backgroundPhoto ? { ...bg, photoUrl: api.backgroundPhoto } : null;
  const lastMine = [...api.messages].reverse().find((m) => m.mine && !m.pending && !m.deletedAt && m.kind !== 'EVENT');
  const lastMineAt = lastMine ? new Date(lastMine.createdAt).getTime() : 0;
  const seenBy = group && lastMine ? (members ?? []).filter((mem) => mem.userId !== api.meId && (api.reads.get(mem.userId) ?? 0) >= lastMineAt) : [];
  const streak = api.streak;
  const letterMenu: MenuItem[] = [
    { label: bg ? 'Fondo de la carta' : 'Poner una foto de fondo', icon: ImagePlus, onSelect: () => setEditor(true) },
    ...(bg ? [{ label: 'Quitar el fondo', icon: Trash2, danger: true, onSelect: () => { void api.saveBackground({ photoUrl: null }).catch((err) => toaster().error((err as Error).message)); } }] : []),
    ...extraMenu,
    { label: 'Archivar carta', icon: Archive, onSelect: () => void archive() },
    { label: 'Eliminar chat', icon: Eraser, danger: true, onSelect: () => setConfirm('clear') },
    ...(blockTarget ? [{ label: `Bloquear a ${blockTarget.displayName.split(' ')[0]}`, icon: Ban, danger: true, onSelect: () => setConfirm('block') }] : []),
  ];

  return (
    <section aria-label={label} className={cn('relative isolate flex min-h-0 flex-col overflow-hidden overflow-x-clip rounded-[22px] border border-border bg-surface shadow-md', className)}>
      <LetterBackdrop src={api.backgroundPhoto} fit={bg?.fit ?? DEFAULT_FIT} className="-z-10" />

      {/* z-20: su menú queda por encima de la carta. */}
      <header className="relative z-20 flex items-center gap-3 border-b border-border/80 bg-surface/95 px-3 py-2.5 md:bg-surface/90 md:px-5 md:backdrop-blur-md">
        {onBack && (
          <Button variant="icon" aria-label="Volver" onClick={onBack} className="-ml-1"><ArrowLeft aria-hidden className="size-5" /></Button>
        )}
        {header}
        {streak && <StreakFlame streak={streak} size="md" />}
        <LetterMenu items={letterMenu} />
      </header>

      {api.gone && (
        <p role="status" className="border-b border-border/80 bg-warning/[var(--lq-soft-alpha)] px-4 py-2.5 text-body-sm text-on-surface md:px-5">{api.gone}</p>
      )}
      {streak?.revivable && !isLit(streak) && api.revive && (
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 bg-warning/[var(--lq-soft-alpha)] px-4 py-2.5 text-body-sm md:px-5">
          <span className="min-w-0 flex-1 text-on-surface">Su racha de <b className="font-mono">{streak.lost}</b> días se apagó hace poco. Todavía pueden recuperarla.</span>
          <Button size="sm" variant="secondary" loading={reviving} onClick={() => void revive()}><Coins aria-hidden className="size-4" />Revivir · <span className="font-mono">{streak.reviveCost}</span></Button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={listRef} onScroll={onScroll} onTouchStart={onTouchStart} onTouchMove={onTouchMove}
          role="log" aria-live="polite" aria-label="Carta"
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-5 pt-1 [overflow-anchor:none] md:px-6"
        >
          {api.hasMore && (
            <div className="flex justify-center py-3">
              <Button size="sm" variant="ghost" loading={loadingOlder} onClick={() => void loadOlder()}>Ver mensajes anteriores</Button>
            </div>
          )}
          {api.status === 'error' ? (
            <div className="m-auto flex flex-col items-center gap-3 text-center">
              <p className="text-body-md text-on-surface">No pudimos abrir la carta.</p>
              <Button size="sm" variant="secondary" onClick={api.retry}>Reintentar</Button>
            </div>
          ) : api.status === 'loading' && count === 0 ? (
            <div className="lq-skeleton-delay mt-6 flex flex-col gap-3">
              <Skeleton className="h-11 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-11 w-1/2 rounded-2xl" />
              <Skeleton className="h-44 w-40 rounded-md" />
            </div>
          ) : count === 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springs.gentle} className="m-auto flex max-w-[330px] flex-col items-center gap-3 text-center">
              <p className="text-display-sm text-on-background"><Lettering text={empty.title} /></p>
              <p className="rounded-xl bg-surface/85 px-3 py-2 text-body-md text-on-surface-light">{empty.hint}</p>
            </motion.div>
          ) : api.messages.map((m, i) => {
            const prev = api.messages[i - 1];
            const next = api.messages[i + 1];
            const newDay = !prev || dayOf(prev.createdAt) !== dayOf(m.createdAt);
            const joined = !newDay && sameGroup(prev, m);
            const last = !next || !sameGroup(m, next);
            const isLastMine = m.id === lastMine?.id;
            const seen = !group && m.mine && isLastMine && api.seenUntil > 0 && new Date(m.createdAt).getTime() <= api.seenUntil;
            return (
              <Fragment key={m.localId ?? m.id}>
                {newDay && <Postmark iso={m.createdAt} />}
                {m.kind === 'EVENT' ? <EventNote m={m} /> : (
                  <MessageRow
                    m={m} side={api.side} meId={api.meId} group={group} joined={joined} last={last || isLastMine} seen={seen} lastMine={isLastMine}
                    seenBy={isLastMine ? seenBy : undefined} coarse={!fine} flash={flash === m.id} nameOf={nameOf} colorOf={colorOf}
                    {...rowHandlers}
                  />
                )}
              </Fragment>
            );
          })}
          <AnimatePresence>
            {api.typing.length > 0 && api.status === 'ready' && (
              <TypingSlip typing={api.typing} group={group} authorOf={(id) => { const a = authors.get(id); return a ? { name: a.name, avatarConfig: a.avatarConfig, avatarUrl: a.avatarUrl } : group ? null : { name: to }; }} />
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {below > 0 && (
            <motion.button
              type="button" onClick={toBottom}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={springs.snappy}
              className="absolute bottom-3 left-1/2 flex min-h-10 -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 text-label-md text-on-primary shadow-lg"
            >
              <ArrowDown aria-hidden className="size-4" />{below} {below === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <Composer
        ref={composer} to={to} maxLength={group ? 500 : 1000} replying={replying} editing={editing} nameOf={nameOf} colorOf={colorOf}
        onCancelReply={() => setReplying(null)} onCancelEdit={() => setEditing(null)}
        onSend={sendText} onEdit={saveEdit} onCamera={() => setCamera(true)} onVideo={() => setVideo(true)} onSticker={sendSticker} onGame={startGame}
        onTyping={api.notifyTyping} onFocusChange={setComposerFocused} keyboardHeight={knownKeyboard()}
      />

      <AnimatePresence>
        {menu && (
          <MessageMenu
            key={menu.m.id} rect={menu.rect} current={menu.m.reactions.find((r) => r.mine)?.emoji}
            actions={menuActions(menu.m)} onPick={(emoji) => react(menu.m, emoji)} onClose={() => setMenu(null)}
          />
        )}
      </AnimatePresence>
      <InstantCamera open={camera} onClose={() => setCamera(false)} to={to} onSend={onCameraSend} />
      <VideoRecorder open={video} onClose={() => setVideo(false)} to={to} onSend={sendVideo} />
      <BackdropEditor open={editor} onClose={() => setEditor(false)} current={current} shareWith={shareWith} onSave={api.saveBackground} />
      {flight && <PhotoFlight flight={flight} listRef={listRef} onLanded={() => { api.reveal(flight.id); setFlight(null); }} />}
      <EnvelopeFlights items={envelopes} />
      <PhotoViewer m={viewer?.m ?? null} side={api.side} src={viewer?.src ?? null} onClose={() => setViewer(null)} />

      <Modal open={confirm === 'delete'} onClose={() => { setConfirm(null); setPendingDelete(null); }} title="¿Borrar el mensaje?">
        <p className="text-body-md text-on-surface">Se borrará para todos. En la carta quedará «Mensaje borrado».</p>
        {pendingDelete && <p className="lq-quote line-clamp-2 text-body-sm text-on-surface-light">{snippetOf(pendingDelete)}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => { setConfirm(null); setPendingDelete(null); }}>Cancelar</Button>
          <Button variant="danger" size="md" onClick={() => { const m = pendingDelete; setConfirm(null); setPendingDelete(null); if (m) void api.remove(m.id); }}>Borrar</Button>
        </div>
      </Modal>
      <Modal open={confirm === 'clear'} onClose={() => setConfirm(null)} title="¿Eliminar este chat?">
        <p className="text-body-md text-on-surface">Se borra el historial solo para ti; {group ? 'los demás' : to} lo seguirán viendo. Lo que se escriba a partir de ahora sí te llega.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button variant="danger" size="md" onClick={() => void clearChat()}>Eliminar chat</Button>
        </div>
      </Modal>
      {blockTarget && (
        <Modal open={confirm === 'block'} onClose={() => setConfirm(null)} title={`¿Bloquear a ${blockTarget.displayName.split(' ')[0]}?`}>
          <p className="text-body-md text-on-surface">Dejarán de ser amigos. No podrá escribirte, enviarte palomas ni gestos, y no se verán en las zonas. Puedes desbloquearlo cuando quieras en Ajustes → Privacidad.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button variant="danger" size="md" onClick={() => void block()}>Bloquear</Button>
          </div>
        </Modal>
      )}
    </section>
  );
}

// ─── Carta entre dos amigos y carta de un gremio ──────────────────────────────

export function DirectLetter({ friend, onBack, onLeave, onActivity, className }: {
  friend: PublicUser; onBack?: () => void; onLeave?: () => void; onActivity?: () => void; className?: string;
}) {
  const api = useDirectLetter(friend, onActivity);
  const presence = api.presence;
  const first = friend.displayName.split(' ')[0];
  const typing = api.typing.length > 0;
  const line = typing ? 'escribiendo' : !presence ? '…' : presence.online ? (presence.zone ? `En línea · en ${presence.zone}` : 'En línea') : presence.lastSeen ? `Activo ${timeAgo(presence.lastSeen)}` : `@${friend.username}`;
  return (
    <LetterShell
      api={api} label={`Carta con ${friend.displayName}`} to={first} shareWith={first} onBack={onBack} onLeave={onLeave ?? onBack} className={className}
      blockTarget={friend}
      header={(
        <>
          <Link to={`/u/${encodeURIComponent(friend.username)}`} aria-label={`Ver el DNI de ${friend.displayName}`} className="shrink-0 rounded-full">
            <PresenceAvatar user={friend} online={presence?.online} size={44} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-label-lg"><span className="font-normal text-on-surface-light">Para </span><span className={nameClass(friend.nameColor)}>{friend.displayName}</span></p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={line} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                className={cn('flex items-center gap-1.5 truncate text-body-sm', typing ? 'text-primary-text' : presence?.online ? 'text-success-text' : 'text-on-surface-light')}>
                {typing && <TypingDots />}{typing ? 'escribiendo…' : line}
              </motion.p>
            </AnimatePresence>
          </div>
        </>
      )}
      extraMenu={[{ label: `Ver el DNI de ${first}`, icon: Contact, to: `/u/${encodeURIComponent(friend.username)}` }]}
      empty={{ title: `hola, ${first}:`, hint: 'Escribe la primera línea de su carta. Si se escriben tres días seguidos, se enciende su racha.' }}
    />
  );
}

export function GuildLetter({ guildId, guild, reloadGuild, onBack, onLeave, onActivity, className, showGuildLink = true }: {
  guildId: string;
  /** Si el gremio ya se cargó fuera (en su campamento), se usa ese. */
  guild?: GuildDetail | null;
  reloadGuild?: () => void;
  onBack?: () => void;
  onLeave?: () => void;
  onActivity?: () => void;
  className?: string;
  showGuildLink?: boolean;
}) {
  const api = useGuildLetter(guildId, guild !== undefined ? { guild, reloadGuild, onActivity } : { onActivity });
  const [edit, setEdit] = useState(false);
  const g = api.guild;
  const em = emblemOf(g?.emblem ?? 'shield');
  const name = g?.name ?? 'el gremio';
  const talked = g?.today.talkedUserIds.length ?? 0;
  const typers = api.typing.map((t) => g?.members.find((mem) => mem.userId === t.userId)?.user.displayName.split(' ')[0]).filter(Boolean) as string[];
  const line = typers.length ? `${typers.length === 1 ? `${typers[0]} escribe` : `${typers.length} escriben`}…`
    : g ? `${g.members.length} ${g.members.length === 1 ? 'miembro' : 'miembros'} · ${talked} ${talked === 1 ? 'escribió' : 'escribieron'} hoy` : '…';
  return (
    <>
      <LetterShell
        api={api} group members={g?.members} label={`Carta de ${name}`} to={name} shareWith={`todo ${name}`} onBack={onBack} onLeave={onLeave ?? onBack} className={className}
        header={(
          <>
            <GuildCrest photoUrl={g?.photoUrl} emblem={em.icon} tone={em.tone} name={name} halo={false} className="size-11 shrink-0 rounded-2xl [&>svg]:size-5" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-label-lg"><span className="font-normal text-on-surface-light">Para </span>{name}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={line} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                  className={cn('flex items-center gap-1.5 truncate text-body-sm', typers.length ? 'text-primary-text' : 'text-on-surface-light')}>
                  {typers.length > 0 && <TypingDots />}{line}
                </motion.p>
              </AnimatePresence>
            </div>
          </>
        )}
        extraMenu={[
          { label: 'Editar gremio', icon: Pencil, onSelect: () => setEdit(true) },
          ...(showGuildLink ? [{ label: 'Ir al campamento del gremio', icon: Tent, to: socialLink.guild(guildId) }] : []),
        ]}
        empty={{ title: 'hola a todos:', hint: 'La carta del gremio la escriben entre todos. Si todos escriben tres días seguidos, se enciende la racha del gremio.' }}
      />
      {g && <GuildEditDialog open={edit} guild={g} onClose={() => setEdit(false)} onSaved={() => reloadGuild?.()} />}
    </>
  );
}

