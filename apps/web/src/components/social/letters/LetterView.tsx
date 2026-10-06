// La carta: la conversación es una carta de papel (o la foto de fondo que
// eligieron, impresa sobre el papel). Cada mensaje es una tira escrita a mano
// (las tuyas en tinta jade), los días se separan con un matasellos, las fotos de
// la cámara quedan pegadas con cinta y lo que llega con la carta abierta se
// escribe solo (o se revela). Al enviar, el texto se dobla en un sobre que vuela
// y la tira cae en su sitio; la foto sale de la cámara y vuela hasta pegarse en
// la carta. La racha solo se muestra encendida (tres días seguidos hablando).
// Igual para la carta entre dos amigos y la de un gremio.
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Camera, CheckCheck, Coins, Contact, Image as ImageIcon, ImagePlus, MoreHorizontal, Send, Tent, Trash2, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DEFAULT_FIT, socialLink, timeAgo, type GuildDetail, type PublicUser } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { GuildCrest } from '@/components/guild/GuildCrest';
import { emblemOf } from '@/components/guild/emblems';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Modal, Skeleton } from '@/components/ui/lq';
import { PresenceAvatar, StreakFlame, isLit } from '../SocialBits';
import { BackdropEditor } from './BackdropEditor';
import { InstantCamera } from './InstantCamera';
import { InstantPhoto } from './InstantPhoto';
import { LetterBackdrop } from './LetterBackdrop';
import { useDirectLetter, useGuildLetter, type LetterApi, type LetterAuthor, type LetterMsg } from './useLetter';

const toaster = () => useToastStore.getState();
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const dayOf = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
/** Inclinación estable por mensaje: las tiras no quedan todas iguales. */
function tiltOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ((h % 5) - 2) * 0.4;
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

/** Aviso de la carta (cambió el fondo). */
function EventNote({ m }: { m: LetterMsg }) {
  const who = m.author?.name.split(' ')[0] ?? 'Alguien';
  const text = m.content === 'bg-off'
    ? (m.mine ? 'Quitaste el fondo: la carta volvió al papel' : `${who} quitó el fondo: la carta volvió al papel`)
    : (m.mine ? 'Cambiaste el fondo de la carta' : `${who} cambió el fondo de la carta`);
  return (
    <p className="mx-auto my-3 inline-flex max-w-[92%] items-center gap-1.5 self-center rounded-full border border-dashed border-border-strong/60 bg-surface/90 px-3 py-1 text-body-sm text-on-surface-light">
      <ImageIcon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />{text}
    </p>
  );
}

/** Un mensaje: tira de papel. Lo que llega con la carta abierta se escribe solo. */
function Slip({ m }: { m: LetterMsg }) {
  const reduce = useMotionStore((s) => s.reduce);
  const tilt = tiltOf(m.localId ?? m.id);
  const text = m.content ?? '';
  const write = Boolean(m.fresh) && !reduce && text.length <= 160;
  const sending = m.mine && m.pending;
  return (
    <motion.p
      initial={reduce ? (m.fresh || sending ? { opacity: 0 } : false) : sending ? { opacity: 0, y: 26, scale: 0.9, rotate: tilt - 5 } : m.fresh ? { opacity: 0, y: 8, rotate: tilt } : false}
      animate={{ opacity: m.pending ? 0.72 : 1, y: 0, scale: 1, rotate: tilt }}
      transition={sending ? springs.heavy : springs.natural}
      className={cn('lq-slip max-w-[min(32rem,84%)] whitespace-pre-wrap break-words px-4 py-2.5 text-body-lg', m.mine ? 'lq-slip-mine text-forest-text' : 'text-on-background')}
    >
      <span className={cn(write && 'lq-write')} style={write ? { ['--d' as string]: `${Math.min(1100, 380 + text.length * 14)}ms` } : undefined}>{text}</span>
    </motion.p>
  );
}

/** Foto de la cámara pegada en la carta (se puede abrir en grande). */
function LetterPhoto({ m, onOpen }: { m: LetterMsg; onOpen: (m: LetterMsg) => void }) {
  const id = m.localId ?? m.id;
  return (
    <motion.div
      initial={false}
      animate={{ opacity: m.hidden ? 0 : 1, scale: m.hidden ? 1 : [1.04, 1] }}
      transition={{ duration: m.hidden ? 0 : 0.35 }}
      whileHover={{ y: -3 }}
      className="py-2"
    >
      <button
        type="button" data-photo={id} onClick={() => onOpen(m)}
        aria-label={m.mine ? 'Ver tu foto en grande' : `Ver la foto de ${m.author?.name ?? 'tu amigo'} en grande`}
        className="block w-[min(240px,62vw)] rounded-[3px] text-left"
      >
        <InstantPhoto src={m.photoUrl!} alt={m.mine ? 'Tu foto' : `Foto de ${m.author?.name ?? 'tu amigo'}`} caption={m.content} tilt={tiltOf(id) * 3} develop={m.fresh} className={cn('w-full', m.pending && !m.hidden && 'opacity-90')} />
      </button>
    </motion.div>
  );
}

function AuthorTag({ author }: { author: LetterAuthor | null }) {
  if (!author) return null;
  return (
    <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-surface/90 py-0.5 pl-0.5 pr-2.5 text-label-md text-on-surface shadow-sm">
      <AvatarDisplay avatarConfig={author.avatarConfig} avatarUrl={author.avatarUrl} size={20} animate="none" className="overflow-hidden rounded-full" />
      {author.name.split(' ')[0]}
    </span>
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
  onBack?: () => void;
  className?: string;
}

function LetterShell({ api, label, to, shareWith, header, extraMenu = [], empty, group = false, onBack, className }: ShellProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const fine = useMediaQuery('(pointer: fine)');
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [camera, setCamera] = useState(false);
  const [editor, setEditor] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [viewer, setViewer] = useState<LetterMsg | null>(null);
  const [flight, setFlight] = useState<{ id: string; src: string; caption: string; from: DOMRect } | null>(null);
  const [envelopes, setEnvelopes] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const count = api.messages.length;
  const seenCount = useRef(0);

  // La carta baja sola hasta lo último (al abrirla, sin animación).
  useEffect(() => {
    const el = listRef.current;
    if (!el || !count) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce || seenCount.current === 0 ? 'auto' : 'smooth' });
    seenCount.current = count;
  }, [count, reduce]);

  const grow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  };

  function flyEnvelope() {
    if (reduce) return;
    const r = sendRef.current?.getBoundingClientRect();
    if (!r) return;
    const id = Date.now();
    setEnvelopes((l) => [...l, { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }]);
    window.setTimeout(() => setEnvelopes((l) => l.filter((e) => e.id !== id)), 900);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    requestAnimationFrame(grow);
    flyEnvelope();
    try { await api.sendText(content); }
    catch (err) { setText(content); toaster().error((err as Error).message); }
  }

  function onCameraSend(photo: string, caption: string, from: DOMRect | null) {
    const localId = `tmp-${Date.now()}`;
    const fly = Boolean(from) && !reduce;
    if (fly && from) setFlight({ id: localId, src: photo, caption, from });
    api.sendPhoto(photo, caption, localId, fly).catch((err) => { setFlight(null); toaster().error((err as Error).message); });
  }

  async function revive() {
    if (!api.revive) return;
    setReviving(true);
    try { await api.revive(); } finally { setReviving(false); }
  }

  const bg = api.background;
  const current = bg && api.backgroundPhoto ? { ...bg, photoUrl: api.backgroundPhoto } : null;
  const lastMine = [...api.messages].reverse().find((m) => m.mine && !m.pending);
  const streak = api.streak;
  const menu: MenuItem[] = [
    { label: bg ? 'Fondo de la carta' : 'Poner una foto de fondo', icon: ImagePlus, onSelect: () => setEditor(true) },
    ...(bg ? [{ label: 'Quitar el fondo', icon: Trash2, danger: true, onSelect: () => { void api.saveBackground({ photoUrl: null }).catch((err) => toaster().error((err as Error).message)); } }] : []),
    ...extraMenu,
  ];

  return (
    <section aria-label={label} className={cn('relative isolate flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-border bg-surface shadow-md', className)}>
      <LetterBackdrop src={api.backgroundPhoto} fit={bg?.fit ?? DEFAULT_FIT} className="-z-10" />

      {/* z-20: el desenfoque crea su propio apilamiento; así su menú queda por encima de la carta. */}
      <header className="relative z-20 flex items-center gap-3 border-b border-border/80 bg-surface/90 px-3 py-2.5 backdrop-blur-md md:px-5">
        {onBack && (
          <Button variant="icon" aria-label="Volver" onClick={onBack} className="-ml-1"><ArrowLeft aria-hidden className="size-5" /></Button>
        )}
        {header}
        {streak && <StreakFlame streak={streak} size="md" />}
        <LetterMenu items={menu} />
      </header>

      {streak?.revivable && !isLit(streak) && api.revive && (
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 bg-warning/[var(--lq-soft-alpha)] px-4 py-2.5 text-body-sm backdrop-blur-md md:px-5">
          <span className="min-w-0 flex-1 text-on-surface">Su racha de <b className="font-mono">{streak.lost}</b> días se apagó hace poco. Todavía pueden recuperarla.</span>
          <Button size="sm" variant="secondary" loading={reviving} onClick={() => void revive()}><Coins aria-hidden className="size-4" />Revivir · <span className="font-mono">{streak.reviveCost}</span></Button>
        </div>
      )}

      <div ref={listRef} role="log" aria-live="polite" aria-label="Carta" className="relative flex min-h-[280px] flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-5 pt-1 md:px-6">
        {api.status === 'error' ? (
          <div className="m-auto flex flex-col items-center gap-3 text-center">
            <p className="text-body-md text-on-surface">No pudimos abrir la carta.</p>
            <Button size="sm" variant="secondary" onClick={api.retry}>Reintentar</Button>
          </div>
        ) : api.status === 'loading' ? (
          <div className="mt-6 flex flex-col gap-3">
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
          const seen = m.mine && m.id === lastMine?.id && api.seenUntil > 0 && new Date(m.createdAt).getTime() <= api.seenUntil;
          return (
            <Fragment key={m.localId ?? m.id}>
              {newDay && <Postmark iso={m.createdAt} />}
              {m.kind === 'EVENT' ? <EventNote m={m} /> : (
                <div className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start', joined ? 'mt-1' : 'mt-3')}>
                  {group && !m.mine && !joined && <AuthorTag author={m.author} />}
                  {m.kind === 'SNAP' && m.photoUrl ? <LetterPhoto m={m} onOpen={setViewer} /> : <Slip m={m} />}
                  {last && !m.hidden && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface/80 px-1.5 font-mono text-[0.72rem] text-on-surface-light">
                      {m.pending ? 'enviando…' : time(m.createdAt)}
                      <AnimatePresence>
                        {seen && (
                          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="inline-flex items-center gap-0.5 font-sans text-info-text">
                            <CheckCheck aria-hidden className="size-3.5" />Leída
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <form onSubmit={submit} className="relative flex items-end gap-2 border-t border-border/80 bg-surface/92 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md md:px-5">
        <Button type="button" variant="secondary" aria-label={`Tomar una foto para ${to}`} onClick={() => setCamera(true)} className="size-12 shrink-0 rounded-full p-0">
          <Camera aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
        <label htmlFor={inputId} className="sr-only">Escribir a {to}</label>
        <textarea
          id={inputId} ref={inputRef} rows={1} value={text} maxLength={group ? 500 : 1000} autoComplete="off"
          onChange={(e) => { setText(e.target.value); grow(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && fine && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}
          placeholder={`Escribe a ${to}…`}
          className="lq-pen-line min-h-12 flex-1 resize-none px-1 py-3 text-body-lg text-on-background placeholder:text-on-surface-light/80"
        />
        <motion.button
          ref={sendRef} type="submit" aria-label="Enviar carta" disabled={!text.trim()}
          whileTap={reduce ? undefined : { scale: 0.86, rotate: -10 }}
          className="lq-wax flex size-12 shrink-0 items-center justify-center transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send aria-hidden className="size-5" strokeWidth={1.75} />
        </motion.button>
      </form>

      <InstantCamera open={camera} onClose={() => setCamera(false)} to={to} onSend={onCameraSend} />
      <BackdropEditor open={editor} onClose={() => setEditor(false)} current={current} shareWith={shareWith} onSave={api.saveBackground} />
      {flight && <PhotoFlight flight={flight} listRef={listRef} onLanded={() => { api.reveal(flight.id); setFlight(null); }} />}
      <EnvelopeFlights items={envelopes} />
      <Modal open={Boolean(viewer)} onClose={() => setViewer(null)} title={viewer?.mine ? 'Tu foto' : `Foto de ${viewer?.author?.name.split(' ')[0] ?? ''}`} className="max-w-[420px]">
        {viewer?.photoUrl && (
          <div className="flex flex-col items-center gap-2 pb-2">
            <InstantPhoto src={viewer.photoUrl} alt={viewer.mine ? 'Tu foto' : `Foto de ${viewer.author?.name ?? ''}`} caption={viewer.content} tilt={-1.5} className="w-full max-w-[340px]" />
            <p className="font-mono text-body-sm text-on-surface-light">{dayLabel(viewer.createdAt)} · {time(viewer.createdAt)}</p>
          </div>
        )}
      </Modal>
    </section>
  );
}

// ─── Carta entre dos amigos y carta de un gremio ──────────────────────────────

export function DirectLetter({ friend, onBack, onActivity, className }: { friend: PublicUser; onBack?: () => void; onActivity?: () => void; className?: string }) {
  const api = useDirectLetter(friend, onActivity);
  const presence = api.conv?.friend;
  const first = friend.displayName.split(' ')[0];
  const line = !presence ? '…' : presence.online ? (presence.zone ? `En línea · en ${presence.zone}` : 'En línea') : presence.lastSeen ? `Activo ${timeAgo(presence.lastSeen)}` : `@${friend.username}`;
  return (
    <LetterShell
      api={api} label={`Carta con ${friend.displayName}`} to={first} shareWith={first} onBack={onBack} className={className}
      header={(
        <>
          <Link to={`/u/${encodeURIComponent(friend.username)}`} aria-label={`Ver el DNI de ${friend.displayName}`} className="shrink-0 rounded-full">
            <PresenceAvatar user={friend} online={presence?.online} size={44} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-label-lg"><span className="font-normal text-on-surface-light">Para </span>{friend.displayName}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={line} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                className={cn('truncate text-body-sm', presence?.online ? 'text-success-text' : 'text-on-surface-light')}>
                {line}
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

export function GuildLetter({ guildId, guild, reloadGuild, onBack, onActivity, className, showGuildLink = true }: {
  guildId: string;
  /** Si el gremio ya se cargó fuera (en su campamento), se usa ese. */
  guild?: GuildDetail | null;
  reloadGuild?: () => void;
  onBack?: () => void;
  onActivity?: () => void;
  className?: string;
  showGuildLink?: boolean;
}) {
  const api = useGuildLetter(guildId, guild !== undefined ? { guild, reloadGuild, onActivity } : { onActivity });
  const g = api.guild;
  const em = emblemOf(g?.emblem ?? 'shield');
  const name = g?.name ?? 'el gremio';
  const talked = g?.today.talkedUserIds.length ?? 0;
  return (
    <LetterShell
      api={api} group label={`Carta de ${name}`} to={name} shareWith={`todo ${name}`} onBack={onBack} className={className}
      header={(
        <>
          <GuildCrest photoUrl={g?.photoUrl} emblem={em.icon} tone={em.tone} name={name} halo={false} className="size-11 shrink-0 rounded-2xl [&>svg]:size-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-label-lg"><span className="font-normal text-on-surface-light">Para </span>{name}</p>
            <p className="truncate text-body-sm text-on-surface-light">
              {g ? `${g.members.length} ${g.members.length === 1 ? 'miembro' : 'miembros'} · ${talked} ${talked === 1 ? 'escribió' : 'escribieron'} hoy` : '…'}
            </p>
          </div>
        </>
      )}
      extraMenu={showGuildLink ? [{ label: 'Ir al campamento del gremio', icon: Tent, to: socialLink.guild(guildId) }] : []}
      empty={{ title: 'hola a todos:', hint: 'La carta del gremio la escriben entre todos. Si todos escriben tres días seguidos, se enciende la racha del gremio.' }}
    />
  );
}
