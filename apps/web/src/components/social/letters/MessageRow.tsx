// Un mensaje de la carta, de cualquier tipo: tira de papel (texto), foto
// instantánea (de la cámara o de la galería), nota de voz, sticker pegado,
// minijuego o el hueco de un mensaje borrado. En un gremio lleva la foto de
// perfil y el nombre (con su color) de quien lo escribió. Debajo, sus reacciones,
// la hora y el visto. Deslizarlo hacia la derecha lo responde; mantenerlo pulsado
// (o clic derecho) abre reacciones y acciones: responder, copiar, editar, borrar
// o guardar el sticker.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Bookmark, CheckCheck, Copy, Pencil, Reply, SmilePlus, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { nameClass } from '@/lib/nameColors';
import { useMedia, useNearScreen } from '@/lib/media';
import { REACTIONS, type GuildMemberRow, type ReplyRef, type RpsPick } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { InstantPhoto } from './InstantPhoto';
import { VoiceNote } from './VoiceNote';
import { GameCard } from './GameCard';
import { StickerImage } from './StickerPanel';
import type { LetterAuthor, LetterMsg } from './useLetter';

export const time = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

/** Inclinación estable por mensaje: las tiras no quedan todas iguales. */
export function tiltOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 5) - 2) * 0.4;
}

/** Fragmento corto de un mensaje (o de la cita de uno). */
export function snippetOf(m: { kind: string; content: string | null; deleted?: boolean; deletedAt?: string | null }) {
  if (m.deleted || m.deletedAt) return 'Mensaje borrado';
  switch (m.kind) {
    case 'SNAP': case 'PHOTO': return m.content ? `Foto · ${m.content}` : 'Foto';
    case 'VOICE': return 'Nota de voz';
    case 'STICKER': return 'Sticker';
    case 'GAME': return 'Minijuego';
    default: return m.content ?? '';
  }
}

/** Mantener pulsado (en táctil) abre las opciones del mensaje. */
function useLongPress(onLong: (el: HTMLElement) => void, ms = 420) {
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const clear = () => { window.clearTimeout(timer.current); start.current = null; };
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      const el = e.currentTarget;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => { start.current = null; navigator.vibrate?.(12); onLong(el); }, ms);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  };
}

/** Cita del mensaje al que se responde; al tocarla, la carta salta a él. */
export function Quote({ r, name, nameColor, onJump, className }: { r: ReplyRef; name: string; nameColor?: string | null; onJump?: (id: string) => void; className?: string }) {
  const body = (
    <>
      <span className={cn('block truncate text-label-md', nameClass(nameColor) || 'text-primary-text')}>{name}</span>
      <span className={cn('line-clamp-2 block break-words text-body-sm text-on-surface-light', r.deleted && 'italic')}>{snippetOf(r) || 'Mensaje'}</span>
    </>
  );
  return onJump
    ? <button type="button" onClick={() => onJump(r.id)} aria-label={`Ir al mensaje de ${name}`} className={cn('lq-quote', className)}>{body}</button>
    : <span className={cn('lq-quote cursor-default', className)}>{body}</span>;
}

/** Tira de papel: lo que llega con la carta abierta se escribe solo. */
function Slip({ m, quote, children }: { m: LetterMsg; quote?: ReactNode; children?: ReactNode }) {
  const reduce = useMotionStore((s) => s.reduce);
  const tilt = tiltOf(m.localId ?? m.id);
  const text = m.content ?? '';
  const write = Boolean(m.fresh) && !reduce && text.length <= 160 && m.kind === 'TEXT';
  const sending = m.mine && m.pending;
  return (
    <motion.div
      initial={reduce ? (m.fresh || sending ? { opacity: 0 } : false) : sending ? { opacity: 0, y: 26, scale: 0.9, rotate: tilt - 5 } : m.fresh ? { opacity: 0, y: 8, rotate: tilt } : false}
      animate={{ opacity: m.pending ? 0.72 : 1, y: 0, scale: 1, rotate: tilt }}
      transition={sending ? springs.heavy : springs.natural}
      className={cn('lq-slip max-w-full whitespace-pre-wrap break-words px-4 py-2.5 text-body-lg [-webkit-touch-callout:none]', m.mine ? 'lq-slip-mine text-forest-text' : 'text-on-background')}
    >
      {quote}
      {children ?? <span className={cn(write && 'lq-write')} style={write ? { ['--d' as string]: `${Math.min(1100, 380 + text.length * 14)}ms` } : undefined}>{text}</span>}
      {m.editedAt && !m.deletedAt && <span className="ml-1.5 align-baseline text-[0.7rem] italic text-on-surface-light">(editado)</span>}
    </motion.div>
  );
}

/** Foto pegada en la carta (se pide al acercarse a la pantalla; mientras, su miniatura). */
function LetterPhoto({ m, side, onOpen }: { m: LetterMsg; side: 'dm' | 'guild'; onOpen: (m: LetterMsg, src: string | null) => void }) {
  const id = m.localId ?? m.id;
  const { ref, near } = useNearScreen<HTMLDivElement>();
  const media = useMedia(side, m.id, { enabled: near, local: m.local, hasThumb: Boolean(m.meta?.thumb) });
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{ opacity: m.hidden ? 0 : 1, scale: m.hidden ? 1 : [1.04, 1] }}
      transition={{ duration: m.hidden ? 0 : 0.35 }}
      whileHover={{ y: -3 }}
      className="py-2"
    >
      <button
        type="button" data-photo={id} onClick={() => onOpen(m, media.photoUrl)}
        aria-label={m.mine ? 'Ver tu foto en grande' : `Ver la foto de ${m.author?.name ?? 'tu amigo'} en grande`}
        className="block w-[min(240px,62vw)] rounded-[3px] text-left"
      >
        <InstantPhoto
          src={media.photoUrl} thumb={m.meta?.thumb} alt={m.mine ? 'Tu foto' : `Foto de ${m.author?.name ?? 'tu amigo'}`}
          caption={m.content} tilt={tiltOf(id) * 3} develop={m.fresh} className={cn('w-full', m.pending && !m.hidden && 'opacity-90')}
        />
      </button>
    </motion.div>
  );
}

/** Sticker pegado: cae despegándose y se queda un poco ladeado. */
function StickerMsg({ m }: { m: LetterMsg }) {
  const reduce = useMotionStore((s) => s.reduce);
  const tilt = tiltOf(m.localId ?? m.id) * 5;
  return (
    <motion.div
      initial={reduce || !(m.fresh || m.pending) ? false : { opacity: 0, scale: 1.25, rotate: tilt - 14, y: -10 }}
      animate={{ opacity: m.pending ? 0.75 : 1, scale: 1, rotate: tilt, y: 0 }}
      transition={springs.heavy}
      className="py-1"
    >
      {m.meta?.sticker ? <StickerImage hash={m.meta.sticker} className="size-32 md:size-36" alt={m.mine ? 'Tu sticker' : `Sticker de ${m.author?.name ?? 'tu amigo'}`} /> : null}
    </motion.div>
  );
}

/** Foto de perfil junto a cada mensaje de un gremio: así se sabe de quién es. */
function MessageAvatar({ author, mine }: { author: LetterAuthor | null; mine: boolean }) {
  if (!author) return <span aria-hidden className="size-[30px] shrink-0" />;
  const face = <AvatarDisplay avatarConfig={author.avatarConfig} avatarUrl={author.avatarUrl} size={30} animate="none" className="overflow-hidden rounded-full" />;
  return (
    <span className="mb-0.5 inline-flex size-[30px] shrink-0 rounded-full bg-surface shadow-sm ring-2 ring-surface">
      {!mine && author.username
        ? <Link to={`/u/${encodeURIComponent(author.username)}`} aria-label={`Ver el DNI de ${author.name}`} className="rounded-full">{face}</Link>
        : face}
    </span>
  );
}

/** Arrastrar un mensaje hacia la derecha (en táctil) lo pone como respuesta. */
function SwipeReply({ enabled, onReply, children }: { enabled: boolean; onReply: () => void; children: ReactNode }) {
  const x = useMotionValue(0);
  const icon = useTransform(x, [12, 60], [0, 1]);
  const scale = useTransform(x, [12, 60], [0.6, 1]);
  const armed = useRef(false);
  if (!enabled) return <>{children}</>;
  return (
    <div className="relative">
      <motion.span aria-hidden style={{ opacity: icon, scale }} className="pointer-events-none absolute -left-9 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-primary-text shadow-sm">
        <Reply className="size-4" strokeWidth={2} />
      </motion.span>
      <motion.div
        drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.5 }} dragSnapToOrigin
        style={{ x, touchAction: 'pan-y' }}
        onDrag={(_, info) => { const on = info.offset.x > 56; if (on && !armed.current) navigator.vibrate?.(10); armed.current = on; }}
        onDragEnd={(_, info) => { armed.current = false; if (info.offset.x > 56) onReply(); }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export interface RowProps {
  m: LetterMsg;
  side: 'dm' | 'guild';
  meId: string;
  group: boolean;
  joined: boolean;
  last: boolean;
  /** Carta de dos: tu mensaje ya lo vio. */
  seen: boolean;
  /** Es tu último mensaje (ahí van "Enviado" y "Visto"). */
  lastMine?: boolean;
  /** Carta de gremio: quiénes leyeron tu mensaje. */
  seenBy?: GuildMemberRow[];
  coarse: boolean;
  flash: boolean;
  nameOf: (authorId: string) => string;
  colorOf: (authorId: string) => string | null | undefined;
  onMenu: (m: LetterMsg, rect: DOMRect) => void;
  onReply: (m: LetterMsg) => void;
  onReact: (m: LetterMsg, emoji: string) => void;
  onOpenPhoto: (m: LetterMsg, src: string | null) => void;
  onJump: (id: string) => void;
  onMove: (m: LetterMsg, move: number | RpsPick) => Promise<void>;
}

export function MessageRow({ m, side, meId, group, joined, last, seen, lastMine = false, seenBy, coarse, flash, nameOf, colorOf, onMenu, onReply, onReact, onOpenPhoto, onJump, onMove }: RowProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const deleted = Boolean(m.deletedAt);
  const acts = !m.pending && !m.hidden;
  const bubble = useRef<HTMLDivElement>(null);
  const open = (el: HTMLElement) => { if (acts) onMenu(m, el.getBoundingClientRect()); };
  const press = useLongPress(open);
  const quote = m.replyTo && !deleted ? <Quote r={m.replyTo} name={nameOf(m.replyTo.authorId)} nameColor={colorOf(m.replyTo.authorId)} onJump={onJump} className="mb-1.5" /> : null;
  const firstName = m.author?.name.split(' ')[0] ?? '';

  let body: ReactNode;
  if (deleted) {
    body = (
      <div className="lq-slip lq-slip-gone flex items-center gap-1.5 px-3.5 py-2 text-body-md italic text-on-surface-light">
        <Trash2 aria-hidden className="size-4" strokeWidth={1.6} />{m.mine ? 'Borraste este mensaje' : 'Mensaje borrado'}
      </div>
    );
  } else if ((m.kind === 'SNAP' || m.kind === 'PHOTO') && m.media.photo) {
    body = <LetterPhoto m={m} side={side} onOpen={onOpenPhoto} />;
  } else if (m.kind === 'VOICE') {
    body = (
      <Slip m={m} quote={quote}>
        <VoiceNote side={side} id={m.id} mine={m.mine} durationMs={m.meta?.durationMs ?? 0} peaks={m.meta?.peaks ?? []} localUrl={m.local?.audioUrl} />
      </Slip>
    );
  } else if (m.kind === 'STICKER') {
    body = <StickerMsg m={m} />;
  } else if (m.kind === 'GAME' && m.meta?.game) {
    body = <GameCard game={m.meta.game} meId={meId} group={group} nameOf={nameOf} onMove={(mv) => onMove(m, mv)} />;
  } else {
    body = <Slip m={m} quote={quote} />;
  }

  return (
    <div data-msg={m.id} className={cn('group/msg relative flex w-full items-end gap-2', m.mine && 'flex-row-reverse', joined ? 'mt-1' : 'mt-3', flash && 'lq-flash')}>
      {group && <MessageAvatar author={m.author} mine={m.mine} />}
      <div className={cn('flex min-w-0 flex-col', m.mine ? 'items-end' : 'items-start', group ? 'max-w-[min(32rem,calc(100%-4.75rem))]' : 'max-w-[min(32rem,84%)]')}>
        {group && !m.mine && !joined && (
          <span className={cn('mb-1 max-w-full truncate rounded-full bg-surface/90 px-2.5 py-0.5 text-label-md shadow-sm', nameClass(m.author?.nameColor) || 'text-on-surface')}>{firstName}</span>
        )}
        <SwipeReply enabled={coarse && acts && !deleted} onReply={() => onReply(m)}>
          <div
            ref={bubble} {...press}
            onContextMenu={(e) => { if (!acts) return; e.preventDefault(); open(e.currentTarget); }}
            onDoubleClick={() => { if (acts && !deleted && m.kind !== 'SNAP' && m.kind !== 'PHOTO' && m.kind !== 'GAME') onReact(m, '❤️'); }}
            className="max-w-full"
          >
            {body}
          </div>
        </SwipeReply>
        {m.reactions.length > 0 && !m.hidden && !deleted && (
          <div className={cn('relative z-[1] -mt-2 flex flex-wrap gap-1 px-2', m.mine ? 'justify-end' : 'justify-start')}>
            <AnimatePresence initial={false}>
              {m.reactions.map((r) => (
                <motion.button
                  key={r.emoji} type="button" layout={!reduce} aria-pressed={r.mine}
                  initial={reduce ? false : { scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.12 } }} transition={springs.snappy}
                  onClick={() => onReact(m, r.emoji)}
                  aria-label={`${r.emoji} ${r.count} ${r.count === 1 ? 'persona' : 'personas'}${r.mine ? '. Tocar para quitar tu reacción' : '. Tocar para reaccionar igual'}`}
                  className="lq-react"
                >
                  <span aria-hidden className="text-[0.95rem]">{r.emoji}</span>
                  {r.count > 1 && <span className="font-mono text-[0.72rem] text-on-surface">{r.count}</span>}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
        {last && !m.hidden && (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-1.5 font-mono text-[0.72rem] text-on-surface-light">
            {m.pending ? 'enviando…' : time(m.createdAt)}
            <AnimatePresence>
              {seen && (
                <motion.span key="seen" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-0.5 font-sans text-info-text">
                  <CheckCheck aria-hidden className="size-3.5" />Visto
                </motion.span>
              )}
              {!seen && lastMine && !m.pending && !group && (
                <span key="sent" className="inline-flex items-center gap-0.5 font-sans">Enviado</span>
              )}
            </AnimatePresence>
          </span>
        )}
        {seenBy && seenBy.length > 0 && (
          <motion.span
            initial={reduce ? false : { opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }}
            title={`Visto por ${seenBy.map((s) => s.user.displayName.split(' ')[0]).join(', ')}`}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface/85 py-0.5 pl-1 pr-2 text-[0.72rem] text-info-text"
          >
            <span className="flex -space-x-1.5">
              {seenBy.slice(0, 4).map((s) => (
                <span key={s.userId} className="inline-flex size-4 overflow-hidden rounded-full ring-1 ring-surface">
                  <AvatarDisplay avatarConfig={s.user.avatarConfig} avatarUrl={s.user.avatarUrl} size={16} animate="none" className="rounded-full" />
                </span>
              ))}
            </span>
            Visto{seenBy.length > 4 ? ` por ${seenBy.length}` : ''}
            <span className="sr-only"> por {seenBy.map((s) => s.user.displayName).join(', ')}</span>
          </motion.span>
        )}
      </div>
      {acts && !deleted && (
        <div className="hidden shrink-0 items-center gap-0.5 self-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100 md:flex">
          <button type="button" aria-label="Reaccionar y más opciones" aria-haspopup="menu" onClick={() => bubble.current && onMenu(m, bubble.current.getBoundingClientRect())}
            className="flex size-8 items-center justify-center rounded-full bg-surface/90 text-on-surface-light shadow-sm hover:text-on-background focus-visible:text-on-background">
            <SmilePlus aria-hidden className="size-4" strokeWidth={1.8} />
          </button>
          <button type="button" aria-label="Responder" onClick={() => onReply(m)}
            className="flex size-8 items-center justify-center rounded-full bg-surface/90 text-on-surface-light shadow-sm hover:text-on-background focus-visible:text-on-background">
            <Reply aria-hidden className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Menú de un mensaje ───────────────────────────────────────────────────────

export interface MenuAction { id: string; label: string; icon: LucideIcon; danger?: boolean; run: () => void }

/** Reacciones arriba y acciones debajo, flotando junto al mensaje elegido. */
export function MessageMenu({ rect, current, actions, onPick, onClose }: {
  rect: DOMRect; current?: string; actions: MenuAction[]; onPick: (emoji: string) => void; onClose: () => void;
}) {
  const reduce = useMotionStore((s) => s.reduce);
  const width = Math.min(336, window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
  const listH = actions.length * 46 + 12;
  const above = rect.top > 76;
  const top = above ? rect.top - 62 : Math.min(rect.bottom + 8, window.innerHeight - 70 - listH);
  // Las acciones van debajo del mensaje (o de la tira de reacciones); si no caben, encima de todo.
  let listTop = above ? rect.bottom + 8 : top + 62;
  if (listTop + listH > window.innerHeight - 8) listTop = Math.max(8, (above ? top : rect.top) - listH - 8);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const away = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('[data-msg-menu]')) onClose(); };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('resize', onClose);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', away, true); window.removeEventListener('resize', onClose); };
  }, [onClose]);
  return createPortal(
    <>
      <motion.div aria-hidden className="fixed inset-0 z-[79] bg-jade-900/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        data-msg-menu role="menu" aria-label="Reaccionar"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: above ? 10 : -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }} transition={springs.snappy}
        style={{ left, top, width, originY: above ? 1 : 0 }}
        className="lq-picker fixed z-[80] flex items-center justify-between gap-0.5 p-1.5"
      >
        {REACTIONS.map((emoji, i) => (
          <motion.button
            key={emoji} type="button" role="menuitem" aria-label={`Reaccionar con ${emoji}`} aria-pressed={current === emoji}
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...springs.snappy, delay: reduce ? 0 : 0.03 * i }}
            whileHover={reduce ? undefined : { scale: 1.25, y: -3 }} whileTap={reduce ? undefined : { scale: 0.85 }}
            onClick={() => onPick(emoji)}
            className={cn('flex size-11 items-center justify-center rounded-full text-[1.55rem] leading-none', current === emoji && 'bg-primary/15 ring-2 ring-primary/60')}
          >
            {emoji}
          </motion.button>
        ))}
      </motion.div>
      {actions.length > 0 && (
        <motion.div
          data-msg-menu role="menu" aria-label="Acciones del mensaje"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ ...springs.natural, delay: reduce ? 0 : 0.04 }}
          style={{ left: Math.min(Math.max(8, rect.left), window.innerWidth - 216), top: listTop }}
          className="lq-picker fixed z-[80] flex w-52 flex-col p-1.5"
        >
          {actions.map((a) => (
            <button key={a.id} type="button" role="menuitem" onClick={a.run}
              className={cn('flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-left text-body-md hover:bg-background focus-visible:bg-background', a.danger && 'text-error-text')}>
              <a.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.8} />{a.label}
            </button>
          ))}
        </motion.div>
      )}
    </>,
    document.body,
  );
}

export const ACTION_ICONS = { reply: Reply, copy: Copy, edit: Pencil, remove: Trash2, save: Bookmark };
