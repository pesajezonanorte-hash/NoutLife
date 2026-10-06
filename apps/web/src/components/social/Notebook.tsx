// El directorio: tus contactos y tus gremios anotados a mano en una agenda de
// direcciones. Hojas con renglones y margen, espiral en el lomo, pestañas del
// índice alfabético en el canto (llevan a cada letra) y, en cada entrada, la foto
// carné pegada, el nombre escrito con la letra de la marca, dónde anda ahora y
// su racha si está encendida. Tocar un contacto o un gremio abre su carta (en
// Cartas); el carné abre su DNI. Arriba, las palomas recibidas (solicitudes de
// amistad e invitaciones a gremios) y el buscador, que filtra tu directorio y
// busca en Noutlife para enviar una paloma a alguien nuevo.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Contact, Mail, Search, Send, Shield, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import {
  apiError, respondFriendRequest, respondGuildInvite, searchUsers, sendFriendRequest, socialLink, timeAgo,
  type FriendItem, type GuildInvite, type GuildSummary, type PendingRequest, type PublicUser, type Relation,
} from '@/services/network.service';
import { nameClass } from '@/lib/nameColors';
import { GuildCrest } from '@/components/guild/GuildCrest';
import { emblemOf } from '@/components/guild/emblems';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { Lettering, canLetter } from '@/components/layout/Lettering';
import { Button, Skeleton } from '@/components/ui/lq';
import { Pigeon, sendPigeon } from './CarrierPigeon';
import { StreakFlame } from './SocialBits';

const toaster = () => useToastStore.getState();
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Letra del índice de una persona (A–Z; lo demás va en «#»). */
const initialOf = (name: string) => { const c = strip(name.trim())[0]?.toUpperCase() ?? '#'; return /[A-Z]/.test(c) ? c : '#'; };
const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

/** Nombre escrito a mano (si el alfabeto de la marca lo admite). */
function Handwritten({ text, draw = true, delay = 0, className }: { text: string; draw?: boolean; delay?: number; className?: string }) {
  return canLetter(text) ? <Lettering text={text} draw={draw} delay={delay} className={cn('[word-spacing:0.28em]', className)} /> : <span className={cn('font-medium', className)}>{text}</span>;
}

/** La espiral del lomo: perforaciones con su anilla. */
function Coil({ rings }: { rings: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -left-3 top-6 bottom-6 flex w-7 flex-col justify-between">
      {Array.from({ length: rings }, (_, i) => (
        <span key={i} className="relative block h-3.5 w-7">
          <span className="lq-coil-hole absolute right-0.5 top-1/2 block size-2 -translate-y-1/2 rounded-full" />
          <span className="lq-coil absolute left-0 top-0 block h-3.5 w-6" />
        </span>
      ))}
    </div>
  );
}

function Entry({ f, active, index, onOpen }: { f: FriendItem; active: boolean; index: number; onOpen: () => void }) {
  const navigate = useNavigate();
  const line = f.friend.online
    ? (f.friend.zone ? `Ahora en ${f.friend.zone}` : 'En línea')
    : f.lastMessage ? `${f.lastMessage.mine ? 'Tú: ' : ''}${f.lastMessage.preview}` : f.friend.lastSeen ? `Activo ${timeAgo(f.friend.lastSeen)}` : `@${f.friend.username}`;
  const tilt = ((f.friend.id.charCodeAt(0) + index) % 5 - 2) * 1.6;
  return (
    <li className="relative">
      <div
        role="button" tabIndex={0} aria-current={active ? 'true' : undefined}
        aria-label={`Escribir a ${f.friend.displayName}${f.unread ? `, ${f.unread} sin leer` : ''}${f.friend.online ? ', en línea' : ''}`}
        onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        className="lq-entry group flex min-h-[var(--lq-rule-2)] cursor-pointer items-center gap-3 rounded-lg py-1 pl-1 pr-1 outline-none [--lq-rule-2:calc(var(--lq-rule)*2)]"
      >
        <span className="lq-snapshot relative shrink-0" style={{ rotate: `${tilt}deg` }}>
          <AvatarDisplay avatarConfig={f.friend.avatarConfig} avatarUrl={f.friend.avatarUrl} size={40} animate="none" className="rounded-[1px] [&>div]:!rounded-[1px]" />
          {f.friend.online && <span className="absolute -right-1 -top-1 block size-3 rounded-full bg-success ring-2 ring-surface"><span className="sr-only">en línea</span></span>}
        </span>
        <span className="min-w-0 flex-1">
          {/* El nombre escrito a mano puede ocupar dos renglones; nunca se corta a media palabra. */}
          <span className={cn('block text-[1.0625rem] leading-tight md:text-heading-sm md:leading-tight', nameClass(f.friend.nameColor) || (f.unread > 0 ? 'text-primary-text' : 'text-on-background'), !canLetter(f.friend.displayName) && 'truncate')}>
            <Handwritten text={f.friend.displayName} delay={0.15 + Math.min(index, 10) * 0.06} />
          </span>
          <span className={cn('mt-0.5 block truncate text-body-sm', f.friend.online ? 'text-success-text' : 'text-on-surface-light')}>{line}</span>
        </span>
        <StreakFlame streak={f.streak} size="sm" />
        <AnimatePresence initial={false}>
          {f.unread > 0 && (
            <motion.span key="unread" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={springs.snappy}
              className="lq-wax flex h-8 min-w-8 items-center justify-center px-1.5 font-mono text-label-md">
              {f.unread > 9 ? '9+' : f.unread}<span className="sr-only"> cartas sin leer</span>
            </motion.span>
          )}
        </AnimatePresence>
        <button
          type="button" aria-label={`Ver el DNI de ${f.friend.displayName}`}
          onClick={(e) => { e.stopPropagation(); navigate(`/u/${encodeURIComponent(f.friend.username)}`); }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-light transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <Contact aria-hidden className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}

/** Botón «Enviar paloma»: manda la solicitud y suelta la paloma desde el botón. */
export function PigeonButton({ user, relation, onSent, size = 'sm' }: { user: PublicUser; relation: Relation; onSent?: () => void; size?: 'sm' | 'md' }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState(relation.status);
  const [busy, setBusy] = useState(false);
  useEffect(() => setState(relation.status), [relation.status]);
  async function send() {
    setBusy(true);
    sendPigeon(ref.current);
    try {
      await sendFriendRequest(user.username);
      const accepted = state === 'PENDING_IN';
      setState(accepted ? 'FRIENDS' : 'PENDING_OUT');
      toaster().success(accepted ? `${user.displayName.split(' ')[0]} ya está en tu directorio` : `Paloma enviada a ${user.displayName.split(' ')[0]}`);
      onSent?.();
    } catch (e) { toaster().error(apiError(e, 'La paloma no pudo salir')); }
    finally { setBusy(false); }
  }
  if (state === 'FRIENDS') {
    return <Button size={size} variant="secondary" onClick={() => navigate(socialLink.letter(user.username))}><Mail aria-hidden className="size-4" />Escribir</Button>;
  }
  if (state === 'PENDING_OUT') {
    return <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-label-md text-on-surface-light"><Send aria-hidden className="size-4" />Paloma en camino</span>;
  }
  return (
    <Button ref={ref} size={size} loading={busy} onClick={() => void send()}>
      <UserPlus aria-hidden className="size-4" />{state === 'PENDING_IN' ? 'Aceptar' : 'Enviar paloma'}
    </Button>
  );
}

/** Palomas recibidas: solicitudes de amistad e invitaciones a gremios. */
function Arrivals({ pending, invites, onChanged }: { pending: PendingRequest[]; invites: GuildInvite[]; onChanged: () => void }) {
  const navigate = useNavigate();
  const [gone, setGone] = useState<string[]>([]);
  async function friend(r: PendingRequest, accept: boolean) {
    setGone((g) => [...g, r.id]);
    try {
      await respondFriendRequest(r.id, accept);
      if (accept) toaster().success(`${r.requester.displayName.split(' ')[0]} ya está en tu directorio`);
      onChanged();
    } catch (e) { setGone((g) => g.filter((x) => x !== r.id)); toaster().error(apiError(e, 'No se pudo responder')); }
  }
  async function guild(inv: GuildInvite, accept: boolean) {
    setGone((g) => [...g, inv.id]);
    try {
      const res = await respondGuildInvite(inv.id, accept);
      onChanged();
      if (accept) { toaster().success(`Te uniste a ${inv.guild.name}`); navigate(socialLink.guild(res.guildId)); }
    } catch (e) { setGone((g) => g.filter((x) => x !== inv.id)); toaster().error(apiError(e, 'No se pudo responder')); }
  }
  const people = pending.filter((p) => !gone.includes(p.id));
  const guilds = invites.filter((i) => !gone.includes(i.id));
  if (!people.length && !guilds.length) return null;
  return (
    <section id="palomas" aria-label="Palomas recibidas" className="flex flex-col gap-3 pb-2">
      <h3 className="text-label-lg text-on-surface-light">Palomas recibidas · <span className="font-mono">{people.length + guilds.length}</span></h3>
      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {people.map((r, i) => (
            <motion.li
              key={r.id} layout initial={{ opacity: 0, y: -14, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: i % 2 ? 0.6 : -0.6 }}
              exit={{ opacity: 0, x: 60, rotate: 6, transition: { duration: 0.22 } }} transition={{ ...springs.heavy, delay: i * 0.06 }}
              className="lq-pigeon-note relative flex flex-wrap items-center gap-3 py-2.5 pl-3 pr-2"
            >
              <Pigeon className="pointer-events-none absolute -top-7 right-10 h-9 w-12" />
              <Link to={`/u/${encodeURIComponent(r.requester.username)}`} className="flex min-w-0 flex-[1_1_180px] items-center gap-3 rounded-xl">
                <AvatarDisplay avatarConfig={r.requester.avatarConfig} avatarUrl={r.requester.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
                <span className="min-w-0">
                  <span className="block truncate text-label-lg">{r.requester.displayName}</span>
                  <span className="block truncate text-body-sm text-on-surface-light">Quiere anotarte en su directorio · {timeAgo(r.createdAt)}</span>
                </span>
              </Link>
              <span className="flex gap-1">
                <Button size="sm" onClick={() => void friend(r, true)}><Check aria-hidden className="size-4" />Anotar</Button>
                <Button variant="icon" aria-label={`Rechazar a ${r.requester.displayName}`} onClick={() => void friend(r, false)}><X aria-hidden className="size-5" /></Button>
              </span>
            </motion.li>
          ))}
          {guilds.map((inv, i) => (
            <motion.li
              key={inv.id} layout initial={{ opacity: 0, y: -14, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: i % 2 ? -0.6 : 0.6 }}
              exit={{ opacity: 0, x: 60, rotate: 6, transition: { duration: 0.22 } }} transition={{ ...springs.heavy, delay: (people.length + i) * 0.06 }}
              className="lq-pigeon-note relative flex flex-wrap items-center gap-3 py-2.5 pl-3 pr-2"
            >
              <Pigeon className="pointer-events-none absolute -top-7 right-10 h-9 w-12" />
              {inv.guild.photoUrl
                ? <img src={inv.guild.photoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
                : <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/[var(--lq-soft-alpha)] text-warning-text"><Shield aria-hidden className="size-5" /></span>}
              <span className="min-w-0 flex-[1_1_180px]">
                <span className="block truncate text-label-lg">{inv.guild.name}</span>
                <span className="block truncate text-body-sm text-on-surface-light">{inv.inviter.displayName} te invita · <span className="font-mono">{inv.guild._count.members}</span> miembros</span>
              </span>
              <span className="flex gap-1">
                <Button size="sm" onClick={() => void guild(inv, true)}>Unirme</Button>
                <Button variant="icon" aria-label={`Rechazar ${inv.guild.name}`} onClick={() => void guild(inv, false)}><X aria-hidden className="size-5" /></Button>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

/** Buscar en Noutlife: personas que no están en tu directorio. */
function Directory({ term, known, onChanged }: { term: string; known: Set<string>; onChanged: () => void }) {
  const [results, setResults] = useState<Array<{ user: PublicUser; relation: Relation }> | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    const t = window.setTimeout(() => {
      searchUsers(q).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [term]);
  const others = (results ?? []).filter((r) => !known.has(r.user.id));
  if (term.trim().length < 2) return null;
  return (
    <section aria-label="Personas en Noutlife" className="flex flex-col gap-2 border-t border-dashed border-border-strong/50 pt-3">
      <h3 className="text-label-lg text-on-surface-light">En Noutlife</h3>
      {loading ? <Skeleton className="h-14 rounded-xl" /> : others.length === 0 ? (
        <p className="text-body-sm text-on-surface-light">Nadie nuevo con ese nombre. Prueba con su @usuario o su código de invitación.</p>
      ) : (
        <ul className="flex flex-col">
          {others.map(({ user, relation }, i) => (
            <motion.li key={user.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springs.natural, delay: i * 0.04 }}
              className="flex min-h-[64px] flex-wrap items-center gap-3 py-1.5">
              <Link to={`/u/${encodeURIComponent(user.username)}`} className="flex min-w-0 flex-[1_1_160px] items-center gap-3 rounded-xl">
                <AvatarDisplay avatarConfig={user.avatarConfig} avatarUrl={user.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
                <span className="min-w-0"><span className="block truncate text-label-lg">{user.displayName}</span><span className="block truncate text-body-sm text-on-surface-light">@{user.username} · Nivel <span className="font-mono">{user.level}</span></span></span>
              </Link>
              <PigeonButton user={user} relation={relation} onSent={onChanged} />
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Un gremio anotado en el directorio: su escudo, su nombre a mano y las cartas sin abrir. */
function GuildEntry({ g, index, onOpen }: { g: GuildSummary; index: number; onOpen: () => void }) {
  const em = emblemOf(g.emblem);
  return (
    <li>
      <button type="button" onClick={onOpen} aria-label={`Escribir en la carta de ${g.name}${g.unread ? `, ${g.unread} sin leer` : ''}`}
        className="lq-entry group flex min-h-[var(--lq-rule-2)] w-full cursor-pointer items-center gap-3 rounded-lg py-1 pl-1 pr-1 text-left outline-none [--lq-rule-2:calc(var(--lq-rule)*2)]">
        <span className="lq-snapshot relative shrink-0" style={{ rotate: `${((index % 5) - 2) * 1.4}deg` }}>
          <GuildCrest photoUrl={g.photoUrl} emblem={em.icon} tone={em.tone} name={g.name} halo={false} className="size-10 rounded-[1px] [&>svg]:size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[1.0625rem] leading-tight md:text-heading-sm md:leading-tight', g.unread > 0 ? 'text-primary-text' : 'text-on-background', !canLetter(g.name) && 'truncate')}>
            <Handwritten text={g.name} delay={0.15 + Math.min(index, 6) * 0.06} />
          </span>
          <span className="mt-0.5 block truncate text-body-sm text-on-surface-light">
            <span className="font-mono">{g.members}</span> {g.members === 1 ? 'miembro' : 'miembros'}{g.lastMessage ? ` · ${g.lastMessage.mine ? 'Tú' : g.lastMessage.author.split(' ')[0]}: ${g.lastMessage.preview}` : ''}
          </span>
        </span>
        <StreakFlame streak={g.streak} size="sm" />
        {g.unread > 0 && (
          <span className="lq-wax flex h-8 min-w-8 items-center justify-center px-1.5 font-mono text-label-md">{g.unread > 9 ? '9+' : g.unread}<span className="sr-only"> cartas sin leer</span></span>
        )}
      </button>
    </li>
  );
}

export interface NotebookProps {
  friends: FriendItem[] | null;
  guilds: GuildSummary[] | null;
  onOpenGuild: (guildId: string) => void;
  onNewGuild: () => void;
  pending: PendingRequest[];
  invites: GuildInvite[];
  error?: boolean;
  activeUsername: string | null;
  focus?: 'requests' | 'search' | null;
  onOpen: (username: string) => void;
  onChanged: () => void;
  onRetry: () => void;
}

export function Notebook({ friends, guilds, onOpenGuild, onNewGuild, pending, invites, error, activeUsername, focus, onOpen, onChanged, onRetry }: NotebookProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const [term, setTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus === 'search') searchRef.current?.focus();
    if (focus === 'requests') document.getElementById('palomas')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }, [focus, reduce]);

  const q = strip(term.trim());
  const shown = useMemo(() => {
    const list = [...(friends ?? [])].sort((a, b) => strip(a.friend.displayName).localeCompare(strip(b.friend.displayName)));
    return q ? list.filter((f) => strip(`${f.friend.displayName} ${f.friend.username}`).includes(q)) : list;
  }, [friends, q]);
  const sections = useMemo(() => {
    const map = new Map<string, FriendItem[]>();
    for (const f of shown) { const k = initialOf(f.friend.displayName); map.set(k, [...(map.get(k) ?? []), f]); }
    return ALPHABET.filter((k) => map.has(k)).map((k) => ({ letter: k, items: map.get(k)! }));
  }, [shown]);
  const known = useMemo(() => new Set((friends ?? []).map((f) => f.friend.id)), [friends]);
  const letters = new Set(sections.map((s) => s.letter));
  const showIndex = (friends?.length ?? 0) >= 8 && !q;
  const online = (friends ?? []).filter((f) => f.friend.online).length;

  const jump = (letter: string) => {
    listRef.current?.querySelector(`[data-letter="${letter}"]`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  let row = 0;
  return (
    <div className="relative pl-3">
      {/* Tapa de cuero detrás */}
      <span aria-hidden="true" className="lq-addressbook-cover absolute -bottom-2 -right-1 left-1 top-2 rounded-[18px]" />
      <motion.div
        initial={reduce ? false : { y: 14, rotate: -0.6, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={springs.heavy}
        className="lq-addressbook relative rounded-[14px] py-4 pl-7 pr-3 md:pl-9 md:pr-12"
      >
        <Coil rings={9} />
        {/* Margen rojo */}
        <motion.span aria-hidden="true" className="lq-tex-margin pointer-events-none absolute inset-y-0 left-[3.1rem] w-0 origin-top md:left-[3.6rem]"
          initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1, transition: { ...springs.gentle, delay: 0.2 } }} />

        {/* Pestañas del índice en el canto */}
        {showIndex && (
          <nav aria-label="Índice del directorio" className="absolute -right-3 top-3 bottom-3 z-10 hidden flex-col justify-between md:flex">
            {ALPHABET.map((l) => (
              <button
                key={l} type="button" disabled={!letters.has(l)} onClick={() => jump(l)}
                aria-label={`Ir a la ${l === '#' ? 'sección de otros' : `letra ${l}`}`}
                className="lq-thumb-tab flex h-[calc((100%-2rem)/27)] min-h-[18px] w-6 items-center justify-center font-mono text-[10px] text-on-surface"
              >
                {l}
              </button>
            ))}
          </nav>
        )}

        <div className="relative flex flex-col gap-4 pl-3 md:pl-4">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 text-heading-md text-on-background"><Lettering text="directorio" /></h2>
            <span className="text-body-sm text-on-surface-light">
              <span className="font-mono">{friends?.length ?? 0}</span> {friends?.length === 1 ? 'amigo' : 'amigos'}{online ? <> · <span className="font-mono text-success-text">{online}</span> en línea</> : null}
            </span>
          </div>

          <label htmlFor="notebook-search" className="sr-only">Buscar en tu directorio o en Noutlife</label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-1 top-1/2 size-5 -translate-y-1/2 text-on-surface-light" strokeWidth={1.75} />
            <input
              id="notebook-search" ref={searchRef} value={term} onChange={(e) => setTerm(e.target.value)}
              placeholder="Busca un nombre, @usuario o código" autoCapitalize="none" autoComplete="off"
              className="lq-pen-line h-12 w-full pl-8 pr-10 text-body-lg text-on-background placeholder:text-on-surface-light/80"
            />
            {term && (
              <button type="button" aria-label="Borrar la búsqueda" onClick={() => setTerm('')} className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-light hover:bg-surface-variant">
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>

          {!q && <Arrivals pending={pending} invites={invites} onChanged={onChanged} />}

          <div ref={listRef} className="flex flex-col">
            {error ? (
              <div className="flex flex-col items-start gap-3 py-6">
                <p className="text-body-md text-on-surface">No pudimos abrir tu directorio.</p>
                <Button size="sm" variant="secondary" onClick={onRetry}>Reintentar</Button>
              </div>
            ) : friends === null ? (
              <div className="flex flex-col gap-3 py-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : friends.length === 0 && !q ? (
              <div className="flex flex-col items-start gap-3 py-6">
                <p className="text-display-sm text-on-background"><Lettering text="en blanco" /></p>
                <p className="max-w-[46ch] text-body-md text-on-surface-light">Tu directorio todavía no tiene a nadie. Busca a tus amigos arriba y envíales una paloma: cuando acepten, quedarán anotados aquí.</p>
                <Button onClick={() => searchRef.current?.focus()}><Search aria-hidden className="size-4" />Buscar amigos</Button>
              </div>
            ) : shown.length === 0 ? (
              <p className="py-3 text-body-sm text-on-surface-light">Nadie en tu directorio con «{term.trim()}».</p>
            ) : (
              sections.map((s) => (
                <section key={s.letter} data-letter={s.letter} aria-label={s.letter === '#' ? 'Otros' : `Letra ${s.letter}`} className="scroll-mt-28">
                  <h3 aria-hidden="true" className="flex h-[var(--lq-rule)] items-end pb-1 text-heading-lg leading-none text-primary-text/80">
                    <Handwritten text={s.letter === '#' ? '#' : s.letter.toLowerCase()} draw={false} />
                  </h3>
                  <ul className="flex flex-col">
                    {s.items.map((f) => (
                      <Entry key={f.friendshipId} f={f} index={row++} active={f.friend.username === activeUsername} onOpen={() => onOpen(f.friend.username)} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          {!q && (
            <section aria-label="Tus gremios" className="flex flex-col border-t border-dashed border-border-strong/50 pt-2">
              <div className="flex h-[var(--lq-rule)] items-end justify-between pb-1">
                <h3 className="text-heading-lg leading-none text-primary-text/80"><Handwritten text="gremios" draw={false} /></h3>
                <button type="button" onClick={onNewGuild} className="min-h-9 rounded-full px-3 text-label-md text-primary-text hover:bg-primary/10">Crear o unirme</button>
              </div>
              {guilds === null ? (
                <Skeleton className="my-2 h-14 rounded-xl" />
              ) : guilds.length === 0 ? (
                <p className="py-3 text-body-sm text-on-surface-light">Todavía no estás en ningún gremio.</p>
              ) : (
                <ul className="flex flex-col">
                  {guilds.map((g, i) => <GuildEntry key={g.id} g={g} index={i} onOpen={() => onOpenGuild(g.id)} />)}
                </ul>
              )}
            </section>
          )}

          <Directory term={term} known={known} onChanged={onChanged} />
        </div>
      </motion.div>
    </div>
  );
}
