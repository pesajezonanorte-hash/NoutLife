// Amigos: la red social de Noutlife. Lista de amigos con presencia (en línea y
// zona), racha de fotos diarias y mensajes sin leer; solicitudes (amistad y
// gremios) y búsqueda de personas. Al elegir a alguien se abre su conversación.
// Zona ambientada: un porche de noche con guirnaldas de luces; cada amigo
// conectado enciende una bombilla. Las fotos del día caen como polaroids.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { Camera, Check, MessageCircle, Search, Shield, UserPlus, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { useToast } from '@/hooks/useToast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ZoneShell } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { ChatPanel } from '@/components/social/ChatPanel';
import { PresenceAvatar, StreakFlame } from '@/components/social/SocialBits';
import {
  apiError, getGuildInvites, getNetwork, getPendingRequests, respondFriendRequest, respondGuildInvite,
  searchUsers, sendFriendRequest, timeAgo,
  type FriendItem, type GuildInvite, type PublicUser, type Relation,
} from '@/services/network.service';
import { Badge, Button, Card, EmptyState, ErrorState, Input, SegmentedControl, Skeleton } from '@/components/ui/lq';

type Tab = 'friends' | 'requests' | 'search';
type Pending = { id: string; createdAt: string; requester: PublicUser };

/** Guirnalda de luces del porche: una bombilla encendida por amigo en línea. */
function StringLights({ lit }: { lit: number }) {
  const reduce = useReducedMotionConfig();
  const bulbs = 13;
  return (
    <svg aria-hidden viewBox="0 0 1200 120" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-24 w-full md:h-28">
      <path d="M0 18 Q300 92 600 40 T1200 26" fill="none" stroke="rgb(var(--lq-on-surface-light) / .35)" strokeWidth="1.5" />
      {Array.from({ length: bulbs }, (_, i) => {
        const t = (i + 0.5) / bulbs;
        const x = t * 1200;
        // Punto exacto del cable (dos curvas cuadráticas) para colgar cada bombilla.
        const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
        const y = t < 0.5
          ? (1 - u) ** 2 * 18 + 2 * (1 - u) * u * 92 + u ** 2 * 40
          : (1 - u) ** 2 * 40 + 2 * (1 - u) * u * -12 + u ** 2 * 26;
        // Media guirnalda siempre encendida; cada amigo en línea enciende dos más.
        const on = i % 2 === 0 || i < lit * 2;
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgb(var(--lq-on-surface-light) / .35)" strokeWidth="1.2" />
            <motion.ellipse
              cx="0" cy="15" rx="5" ry="7"
              fill={on ? 'rgb(var(--lq-warning))' : 'rgb(var(--lq-on-surface-light) / .25)'}
              initial={{ opacity: 0 }}
              animate={reduce || !on ? { opacity: on ? 0.9 : 0.6 } : { opacity: [0.55, 1, 0.7, 0.95, 0.55] }}
              transition={reduce || !on ? { duration: 0.6, delay: i * 0.05 } : { duration: 3 + (i % 4), repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
              style={on ? { filter: 'drop-shadow(0 0 6px rgb(var(--lq-warning) / .7))' } : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}

function FriendRow({ f, active, onOpen }: { f: FriendItem; active: boolean; onOpen: () => void }) {
  const line = f.friend.online
    ? (f.friend.zone ? `En ${f.friend.zone}` : 'En línea')
    : f.lastMessage ? `${f.lastMessage.mine ? 'Tú: ' : ''}${f.lastMessage.preview}` : f.friend.lastSeen ? `Activo ${timeAgo(f.friend.lastSeen)}` : `@${f.friend.username}`;
  const waitingSnap = f.streak.alive && !f.streak.mineToday;
  return (
    <motion.li variants={item} layout="position">
      <button
        type="button" onClick={onOpen} aria-current={active ? 'true' : undefined}
        className={cn('group flex w-full min-h-[72px] items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors',
          active ? 'bg-primary/[var(--lq-soft-alpha)]' : 'hover:bg-background')}
      >
        <PresenceAvatar user={f.friend} online={f.friend.online} size={48} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-label-lg', f.unread > 0 && 'font-semibold')}>{f.friend.displayName}</span>
            {(f.streak.alive || f.streak.revivable) && <StreakFlame streak={f.streak} size="sm" />}
          </span>
          <span className={cn('block truncate text-body-sm', f.friend.online ? 'text-success-text' : f.unread ? 'text-on-background' : 'text-on-surface-light')}>{line}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {f.lastMessage && <span className="text-[0.75rem] text-on-surface-light">{timeAgo(f.lastMessage.at).replace('hace ', '')}</span>}
          <AnimatePresence>
            {f.unread > 0 ? (
              <motion.span key="unread" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.snappy}
                className="flex min-w-6 items-center justify-center rounded-full bg-primary-strong px-1.5 text-label-md tabular-nums text-on-primary">
                {f.unread}<span className="sr-only"> sin leer</span>
              </motion.span>
            ) : waitingSnap ? (
              <motion.span key="snap" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} title="Falta tu foto de hoy"
                className="flex size-6 items-center justify-center rounded-full bg-warning/[var(--lq-soft-alpha)] text-warning-text">
                <Camera aria-hidden className="size-3.5" /><span className="sr-only">Falta tu foto de hoy</span>
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </button>
    </motion.li>
  );
}

function RelationButton({ user, relation, onChanged }: { user: PublicUser; relation: Relation; onChanged: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(relation.status);
  async function add() {
    setBusy(true);
    try { await sendFriendRequest(user.username); setState(state === 'PENDING_IN' ? 'FRIENDS' : 'PENDING_OUT'); toast.success(state === 'PENDING_IN' ? `Ahora eres amigo de ${user.displayName}` : 'Solicitud enviada'); onChanged(); }
    catch (e) { toast.error(apiError(e, 'No se pudo enviar la solicitud')); }
    finally { setBusy(false); }
  }
  if (state === 'FRIENDS') return <Button size="sm" variant="secondary" onClick={() => navigate(`/friends?chat=${encodeURIComponent(user.username)}`)}><MessageCircle aria-hidden className="size-4" />Mensaje</Button>;
  if (state === 'PENDING_OUT') return <Badge>Solicitud enviada</Badge>;
  return <Button size="sm" loading={busy} onClick={() => void add()}><UserPlus aria-hidden className="size-4" />{state === 'PENDING_IN' ? 'Aceptar' : 'Agregar'}</Button>;
}

function SearchPanel({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ user: PublicUser; relation: Relation }> | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    setLoading(true);
    const t = window.setTimeout(() => {
      searchUsers(term).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="friend-search" className="sr-only">Buscar personas</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-on-surface-light" />
        <Input id="friend-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, @usuario o código de invitación" className="pl-11" autoCapitalize="none" autoFocus />
      </div>
      {loading ? <Skeleton className="h-16 rounded-2xl" /> : results === null ? (
        <p className="text-body-sm text-on-surface-light">Escribe al menos 2 letras. Tu código de invitación está en tu perfil.</p>
      ) : results.length === 0 ? (
        <p className="text-body-sm text-on-surface-light">Nadie con ese nombre todavía.</p>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col">
          {results.map(({ user, relation }) => (
            <motion.li key={user.id} variants={item} className="flex min-h-[64px] items-center gap-3 border-b border-border py-2 last:border-0">
              <Link to={`/u/${encodeURIComponent(user.username)}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl">
                <PresenceAvatar user={user} size={44} />
                <span className="min-w-0"><span className="block truncate text-label-lg">{user.displayName}</span><span className="block truncate text-body-sm text-on-surface-light">@{user.username} · Nivel {user.level}</span></span>
              </Link>
              <RelationButton user={user} relation={relation} onChanged={onChanged} />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function RequestsPanel({ pending, invites, onChanged }: { pending: Pending[]; invites: GuildInvite[]; onChanged: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [gone, setGone] = useState<string[]>([]);
  async function friend(id: string, accept: boolean, name: string) {
    setGone((g) => [...g, id]);
    try { await respondFriendRequest(id, accept); if (accept) toast.success(`${name} ya es tu amigo`); onChanged(); }
    catch (e) { setGone((g) => g.filter((x) => x !== id)); toast.error(apiError(e, 'No se pudo responder')); }
  }
  async function guild(inv: GuildInvite, accept: boolean) {
    setGone((g) => [...g, inv.id]);
    try {
      const r = await respondGuildInvite(inv.id, accept);
      onChanged();
      if (accept) { toast.success(`Te uniste a ${inv.guild.name}`); navigate(`/guild?id=${r.guildId}`); }
    } catch (e) { setGone((g) => g.filter((x) => x !== inv.id)); toast.error(apiError(e, 'No se pudo responder')); }
  }
  const people = pending.filter((p) => !gone.includes(p.id));
  const guilds = invites.filter((i) => !gone.includes(i.id));
  if (!people.length && !guilds.length) {
    return <EmptyState icon={UserPlus} tone="forest" title="Sin solicitudes" description="Cuando alguien quiera ser tu amigo o te invite a su gremio, aparecerá aquí y en tus notificaciones." className="py-8" />;
  }
  return (
    <div className="flex flex-col gap-5">
      {people.length > 0 && (
        <section aria-label="Solicitudes de amistad" className="flex flex-col gap-1">
          <h3 className="text-label-lg text-on-surface-light">Quieren ser tus amigos</h3>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {people.map((r) => (
                <motion.li key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }} transition={springs.natural}
                  className="flex min-h-[64px] items-center gap-3 border-b border-border py-2 last:border-0">
                  <Link to={`/u/${encodeURIComponent(r.requester.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <PresenceAvatar user={r.requester} size={44} />
                    <span className="min-w-0"><span className="block truncate text-label-lg">{r.requester.displayName}</span><span className="block truncate text-body-sm text-on-surface-light">@{r.requester.username} · {timeAgo(r.createdAt)}</span></span>
                  </Link>
                  <Button variant="icon" aria-label={`Aceptar a ${r.requester.displayName}`} onClick={() => void friend(r.id, true, r.requester.displayName)} className="text-success-text"><Check aria-hidden className="size-5" /></Button>
                  <Button variant="icon" aria-label={`Rechazar a ${r.requester.displayName}`} onClick={() => void friend(r.id, false, r.requester.displayName)} className="text-error-text"><X aria-hidden className="size-5" /></Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
      {guilds.length > 0 && (
        <section aria-label="Invitaciones a gremios" className="flex flex-col gap-1">
          <h3 className="text-label-lg text-on-surface-light">Te invitan a un gremio</h3>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {guilds.map((inv) => (
                <motion.li key={inv.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }} transition={springs.natural}
                  className="flex min-h-[64px] items-center gap-3 border-b border-border py-2 last:border-0">
                  {inv.guild.photoUrl
                    ? <img src={inv.guild.photoUrl} alt="" className="size-11 shrink-0 rounded-2xl object-cover" />
                    : <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-warning/[var(--lq-soft-alpha)] text-warning-text"><Shield aria-hidden className="size-5" /></span>}
                  <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{inv.guild.name}</span><span className="block truncate text-body-sm text-on-surface-light">De {inv.inviter.displayName} · {inv.guild._count.members} miembros</span></span>
                  <Button size="sm" onClick={() => void guild(inv, true)}>Unirme</Button>
                  <Button variant="icon" aria-label={`Rechazar ${inv.guild.name}`} onClick={() => void guild(inv, false)}><X aria-hidden className="size-5" /></Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const [params, setParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') === 'requests' ? 'requests' : 'friends'));
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [filter, setFilter] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [f, p, g] = await Promise.all([getNetwork(), getPendingRequests().catch(() => []), getGuildInvites().catch(() => [])]);
      setFriends(f); setPending(p); setInvites(g); setState('ready');
    } catch { if (!silent) setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // La lista se refresca sola (presencia, rachas y mensajes nuevos).
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 20_000);
    return () => window.clearInterval(id);
  }, [load]);
  useEffect(() => { if (params.get('tab') === 'requests') setTab('requests'); }, [params]);

  const chatName = params.get('chat');
  const chatWith = useMemo(() => friends.find((f) => f.friend.username === chatName)?.friend ?? null, [friends, chatName]);
  const open = (username: string | null) => {
    const next = new URLSearchParams(params);
    if (username) next.set('chat', username); else next.delete('chat');
    next.delete('tab');
    setParams(next, { replace: !username });
    if (username) setFriends((list) => list.map((f) => (f.friend.username === username ? { ...f, unread: 0 } : f)));
  };
  const refreshQuiet = useCallback(() => { void load(true); }, [load]);

  const online = friends.filter((f) => f.friend.online).length;
  const requests = pending.length + invites.length;
  const shown = friends.filter((f) => !filter.trim() || `${f.friend.displayName} ${f.friend.username}`.toLowerCase().includes(filter.trim().toLowerCase()));

  const list = (
    <Card padding="none" className="flex min-w-0 flex-col gap-3 p-3 md:p-4">
      <SegmentedControl
        label="Sección" value={tab} onChange={setTab}
        options={[{ value: 'friends', label: `Amigos${friends.length ? ` · ${friends.length}` : ''}` }, { value: 'requests', label: requests ? `Solicitudes · ${requests}` : 'Solicitudes' }, { value: 'search', label: 'Buscar' }]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={springs.natural} className="flex flex-col gap-3">
          {tab === 'search' ? <SearchPanel onChanged={refreshQuiet} />
            : tab === 'requests' ? <RequestsPanel pending={pending} invites={invites} onChanged={refreshQuiet} />
            : state === 'loading' ? <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}</div>
            : state === 'error' ? <ErrorState onRetry={() => void load()} />
            : friends.length === 0 ? (
              <EmptyState icon={Users} tone="forest" title="Tu porche está vacío" description="Busca a tus amigos por su nombre o usuario y empieza una racha de fotos con ellos."
                action={<Button onClick={() => setTab('search')}><UserPlus aria-hidden className="size-4" />Buscar amigos</Button>} className="py-8" />
            ) : (
              <>
                {friends.length > 6 && (
                  <><label htmlFor="friend-filter" className="sr-only">Filtrar amigos</label>
                    <Input id="friend-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar amigos" /></>
                )}
                <motion.ul variants={stagger} initial="initial" animate="animate" className="-mx-1 flex flex-col">
                  {shown.map((f) => <FriendRow key={f.friendshipId} f={f} active={f.friend.username === chatName} onOpen={() => open(f.friend.username)} />)}
                </motion.ul>
              </>
            )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );

  return (
    <ZoneShell
      zone="friends"
      contentClassName="gap-6 md:gap-8"
      ambience={<StringLights lit={online} />}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4 pt-10 md:pt-14">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-label-lg text-primary-text">Comunidad</span>
          <h1 className="text-display-sm md:text-display-md"><Lettering text="Amigos" /></h1>
          <p className="max-w-[56ch] text-body-lg text-on-surface-light">
            {online > 0 ? `${online} ${online === 1 ? 'amigo está' : 'amigos están'} en línea ahora.` : 'Tu gente, sus fotos del día y las rachas que sostienen juntos.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setTab('search')}><UserPlus aria-hidden className="size-4" />Agregar amigos</Button>
      </motion.section>

      <motion.div variants={item} className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[1_1_340px] lg:max-w-[420px]">{list}</div>
        {isDesktop && (
          <div className="sticky top-20 min-w-0 flex-[2_1_480px]">
            <AnimatePresence mode="wait">
              {chatWith ? (
                <motion.div key={chatWith.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }} transition={springs.natural}>
                  <ChatPanel friend={chatWith} onActivity={refreshQuiet} className="h-[max(520px,calc(100dvh-21rem))]" />
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card padding="lg" className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
                    <motion.span initial={{ rotate: -6, y: -6 }} animate={{ rotate: 0, y: 0 }} transition={springs.heavy}
                      className="flex size-16 items-center justify-center rounded-2xl bg-warning/[var(--lq-soft-alpha)] text-warning-text">
                      <MessageCircle aria-hidden className="size-8" strokeWidth={1.5} />
                    </motion.span>
                    <h2 className="text-heading-sm">Elige a un amigo</h2>
                    <p className="max-w-[340px] text-body-md text-on-surface-light">Escríbele o envíale tu foto del día. Si los dos envían una cada día, su racha crece.</p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* En móvil la conversación entra desde la derecha a pantalla completa. */}
      <AnimatePresence>
        {!isDesktop && chatWith && (
          <motion.div
            key="mobile-chat"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }} transition={springs.natural}
            className="fixed inset-0 z-[60] flex flex-col bg-background pt-[env(safe-area-inset-top)]"
          >
            <ChatPanel friend={chatWith} onBack={() => open(null)} onActivity={refreshQuiet} className="h-full rounded-none border-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </ZoneShell>
  );
}
