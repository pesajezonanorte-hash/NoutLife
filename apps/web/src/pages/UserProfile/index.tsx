// El perfil de cada persona (/u/:usuario) es su DNI: el documento aparece
// pixel a pixel, recibe el sello y se gira para ver sus estadísticas en el
// reverso. Al lado, su nombre escrito a mano, dónde anda ahora y su firma (la
// biografía). Debajo, como las páginas de un pasaporte: los logros son sellos,
// los gremios son visados y sus amigos, sus contactos. Lo que se ve depende de
// la privacidad que eligió. Desde aquí se escribe una carta, se saluda, se
// envía una paloma (solicitud), se invita a un gremio o se propone compartir el
// jardín.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, Check, Flag, Hand, Heart, Lock, Mail, MoreHorizontal, Send, Shield, UserMinus, Users, X } from 'lucide-react';
import { ReportDialog } from '@/components/social/ReportDialog';
import { cn } from '@/lib/utils';
import { fmtNumber, item, slam, stagger } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { getLevelTitle } from '@/lib/gameProgress';
import { useToastStore } from '@/hooks/useToast';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Lettering, canLetter } from '@/components/layout/Lettering';
import { E } from '@/components/ui/glyphs';
import { IdCard, documentNumber } from '@/components/profile/IdCard';
import { PixelAvatar } from '@/components/character/pixel/PixelAvatar';
import { lookFrom } from '@/components/character/pixel/look';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { GuildCrest } from '@/components/guild/GuildCrest';
import { emblemOf } from '@/components/guild/emblems';
import { PigeonButton } from '@/components/social/Notebook';
import { sendPigeon } from '@/components/social/CarrierPigeon';
import { PresenceAvatar, StreakFlame, isLit } from '@/components/social/SocialBits';
import {
  blockUser, unblockUser,
  apiError, getMyGuilds, getProfile, invitePartner, inviteToGuild, removeFriend, respondFriendRequest, sendGesture, socialLink, timeAgo, zoneName,
  type GuildSummary, type ProfileData,
} from '@/services/network.service';
import { Badge, Button, EmptyState, ErrorState, Modal, PageLoader } from '@/components/ui/lq';

const toaster = () => useToastStore.getState();
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

/** La foto del documento: su foto si la eligió; si no, el busto de su muñequito. */
function IdPhoto({ user }: { user: ProfileData['user'] }) {
  const mode = (user.avatarConfig as { avatarMode?: string } | undefined)?.avatarMode;
  const photo = user.avatarUrl && (mode === 'photo' || !mode);
  return photo
    ? <img src={user.avatarUrl!} alt="" className="size-full object-cover" />
    : <span className="flex size-full items-end justify-center bg-surface-variant"><PixelAvatar look={lookFrom(user.avatarConfig)} size={200} crop="head" animate="none" className="!h-auto !w-full" /></span>;
}

function GuildInviteModal({ open, onClose, userId, name }: { open: boolean; onClose: () => void; userId: string; name: string }) {
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => { if (open) getMyGuilds().then(setGuilds).catch(() => setGuilds([])); }, [open]);
  async function invite(g: GuildSummary, from: HTMLElement) {
    sendPigeon(from);
    try { await inviteToGuild(g.id, userId); setSent((s) => [...s, g.id]); toaster().success(`Paloma enviada con la invitación a ${g.name}`); }
    catch (e) { toaster().error(apiError(e, 'La paloma no pudo salir')); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Invitar a ${name} a un gremio`}>
      {guilds === null ? <PageLoader size="sm" /> : guilds.length === 0 ? (
        <p className="text-body-md text-on-surface-light">Aún no estás en ningún gremio. <Link to={socialLink.guild()} className="text-primary-text underline">Crea uno</Link> y luego invita a tus amigos.</p>
      ) : (
        <ul className="flex flex-col">
          {guilds.map((g) => {
            const em = emblemOf(g.emblem);
            return (
              <li key={g.id} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2 last:border-0">
                <GuildCrest photoUrl={g.photoUrl} emblem={em.icon} tone={em.tone} name={g.name} halo={false} className="size-10 rounded-xl [&>svg]:size-5" />
                <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{g.name}</span><span className="text-body-sm text-on-surface-light"><span className="font-mono">{g.members}</span> miembros</span></span>
                {sent.includes(g.id) ? <Badge variant="success" icon={Check}>Enviada</Badge> : <Button size="sm" variant="secondary" onClick={(e) => void invite(g, e.currentTarget)}>Invitar</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Página del pasaporte: papel con la trama de seguridad y su número al pie. */
function PassportPage({ title, folio, children, className }: { title: string; folio: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={item} aria-label={title} className={cn('lq-tex-paper relative overflow-hidden rounded-2xl border border-border p-5 shadow-sm md:p-6', className)}>
      <span aria-hidden="true" className="lq-guilloche" />
      <div className="relative flex items-baseline justify-between gap-3 pb-4">
        <h2 className="text-heading-sm text-on-background">{title}</h2>
        <span aria-hidden="true" className="font-mono text-label-md text-on-surface-light">{folio}</span>
      </div>
      <div className="relative">{children}</div>
    </motion.section>
  );
}

export default function UserProfilePage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [data, setData] = useState<ProfileData | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'missing' | 'ready'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [guildOpen, setGuildOpen] = useState(false);
  const [confirm, setConfirm] = useState<'remove' | 'partner' | 'block' | 'report' | null>(null);
  const [waved, setWaved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try { setData(await getProfile(username)); setState('ready'); }
    catch (e) { if (!silent) setState((e as { response?: { status?: number } })?.response?.status === 400 ? 'missing' : 'error'); }
  }, [username]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [menu]);

  if (state === 'loading') return <PageLoader />;
  if (state === 'missing') return <EmptyState icon={Users} title="DNI no encontrado" description="Puede que esa persona haya cambiado de usuario." action={<Button onClick={() => navigate('/social')}>Volver a Social</Button>} className="py-16" />;
  if (state === 'error' || !data) return <ErrorState onRetry={() => void load()} />;

  const { user, presence, relation } = data;
  const first = user.displayName.split(' ')[0];
  const self = relation.status === 'SELF';
  const friends = relation.status === 'FRIENDS';
  const title = getLevelTitle(user.level);
  const doc = documentNumber(user.id);

  async function act(kind: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    try { await fn(); toaster().success(ok); await load(true); }
    catch (e) { toaster().error(apiError(e, 'No se pudo completar')); }
    finally { setBusy(null); setConfirm(null); setMenu(false); }
  }
  async function wave() {
    setWaved(true);
    try { await sendGesture(user.id, 'wave', zoneName(pathname)); toaster().success(`Saludaste a ${first}`, 'Lo verá en tu muñequito.'); }
    catch (e) { toaster().error(apiError(e, 'No se pudo saludar')); }
    finally { window.setTimeout(() => setWaved(false), 2200); }
  }

  const presenceLine = self ? 'Así ven tu DNI los demás' : presence.online ? (presence.zone ? `En línea · ahora en ${presence.zone}` : 'En línea') : presence.lastSeen ? `Activo ${timeAgo(presence.lastSeen)}` : null;
  const bars = Array.from({ length: 46 }, (_, i) => ((doc.raw.charCodeAt(i % 10) * (i + 7)) % 5) + 1);

  const back = (
    <div className="lq-tex-paper relative flex size-full flex-col rounded-[inherit] p-3.5 sm:p-5">
      <span aria-hidden="true" className="lq-guilloche" />
      <div className="relative pr-24">
        <h2 className="text-label-lg text-on-background">Estadísticas del titular</h2>
        <p className="font-mono text-label-md text-on-surface-light">{doc.pretty}</p>
      </div>
      {data.locked ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="-rotate-6 rounded-md border-2 border-dashed border-error-text/60 px-3 py-1 font-mono text-label-lg text-error-text">reservado</span>
          <p className="max-w-[24ch] text-body-sm text-on-surface-light">{first} comparte estos datos solo con sus amigos.</p>
        </div>
      ) : (
        <dl className="relative mt-2.5 grid flex-1 grid-cols-3 content-start gap-x-3 gap-y-2 sm:mt-4 sm:gap-y-4">
          {([
            ['Racha', user.currentStreak], ['Mejor racha', user.longestStreak], ['Logros', data.stats?.achievements ?? 0],
            ['Hábitos', data.stats?.habits ?? 0], ['Con racha', data.stats?.habitsOnStreak ?? 0], ['Amigos', data.stats?.friends ?? 0],
          ] as const).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="truncate text-label-md text-on-surface-light">{k}</dt>
              <dd className="font-mono text-heading-sm tabular-nums text-on-background sm:text-heading-md">{fmtNumber(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="relative flex items-end justify-between gap-3">
        <span className="text-label-md text-on-surface-light">Desde el {fmtDate(user.createdAt)}</span>
        <span aria-hidden="true" className="flex h-7 items-end gap-px sm:h-9">
          {bars.map((w, i) => <span key={i} className="block h-full bg-on-background/80" style={{ width: w * 0.9 }} />)}
        </span>
      </div>
    </div>
  );

  const menuRow = 'flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-body-md hover:bg-background';
  const streak = data.friendStreak;

  return (
    <ZoneShell
      zone="profile-id"
      contentClassName="gap-8 md:gap-10"
      ambience={(
        <>
          <span aria-hidden="true" className="lq-guilloche absolute inset-x-0 top-0 h-[34rem] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <AmbientLight tone="jade-300" alpha={0.12} darkAlpha={0.06} d={16} className="left-[4%] top-[-10%] h-[28rem] w-[62%]" />
        </>
      )}
    >
      <motion.section variants={item} aria-label={`DNI de ${user.displayName}`} className="grid items-center gap-8 pt-4 md:gap-10 md:pt-8 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <IdCard
          user={{ id: user.id, displayName: user.displayName, username: user.username, level: user.level, playerClass: user.playerClass, createdAt: user.createdAt }}
          title={title}
          photo={<IdPhoto user={user} />}
          back={back}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            {!self && <PresenceAvatar user={user} online={presence.online} size={36} />}
            <span className={cn('text-label-lg', presence.online && !self ? 'text-success-text' : 'text-primary-text')}>{presenceLine ?? `@${user.username}`}</span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-display-sm md:text-display-md"><Lettering text={user.displayName} /></h1>
            <p className="text-body-lg text-on-surface-light">@{user.username} · Nivel <span className="font-mono">{user.level}</span> · {title}</p>
          </div>
          {user.bio && (
            <figure className="max-w-[46ch]">
              <blockquote className="border-b border-dashed border-border-strong/60 pb-2 text-body-lg text-on-background">
                {user.bio.length <= 60 && canLetter(user.bio) ? <Lettering text={user.bio} delay={0.6} /> : user.bio}
              </blockquote>
              <figcaption className="mt-1 text-label-md text-on-surface-light">Firma del titular</figcaption>
            </figure>
          )}

          <div ref={menuRef} className="relative flex flex-wrap items-center gap-2 pt-1">
            {self ? (
              <Button variant="secondary" onClick={() => navigate('/settings?tab=privacy')}>Editar mi DNI y privacidad</Button>
            ) : friends ? (
              <>
                <Button onClick={() => navigate(socialLink.letter(user.username))}><Mail aria-hidden className="size-4" />Escribir carta</Button>
                <Button variant="secondary" onClick={() => void wave()} disabled={waved}>
                  <motion.span animate={waved ? { rotate: [0, -20, 16, -20, 0] } : { rotate: 0 }} transition={{ duration: 0.9 }} className="inline-flex"><Hand aria-hidden className="size-4" /></motion.span>
                  {waved ? 'Saludo enviado' : 'Saludar'}
                </Button>
                <Button variant="icon" aria-label="Más opciones" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal aria-hidden className="size-5" /></Button>
                <AnimatePresence>
                  {menu && (
                    <motion.div
                      role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} transition={springs.natural}
                      className="absolute left-0 top-full z-20 mt-2 flex w-64 flex-col rounded-2xl border border-border bg-surface p-1.5 shadow-lg sm:left-auto sm:right-0"
                    >
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirm('partner'); }} className={menuRow}><Heart aria-hidden className="size-4 text-error-text" />Compartir mi jardín</button>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setGuildOpen(true); }} className={menuRow}><Shield aria-hidden className="size-4 text-warning-text" />Invitar a un gremio</button>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirm('remove'); }} className={cn(menuRow, 'text-error-text')}><UserMinus aria-hidden className="size-4" />Borrar de mi directorio</button>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirm('report'); }} className={cn(menuRow, 'text-error-text')}><Flag aria-hidden className="size-4" />Denunciar</button>
                      <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirm('block'); }} className={cn(menuRow, 'text-error-text')}><Ban aria-hidden className="size-4" />Bloquear</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : relation.status === 'PENDING_IN' ? (
              <>
                <Button loading={busy === 'accept'} onClick={() => void act('accept', () => respondFriendRequest(relation.friendshipId!, true), `${first} ya está en tu directorio`)}><Check aria-hidden className="size-4" />Anotar en mi directorio</Button>
                <Button variant="ghost" onClick={() => void act('reject', () => respondFriendRequest(relation.friendshipId!, false), 'Solicitud rechazada')}><X aria-hidden className="size-4" />Rechazar</Button>
              </>
            ) : relation.status === 'BLOCKED' ? (
              <>
                <span className="inline-flex min-h-11 items-center gap-1.5 text-label-lg text-on-surface-light"><Ban aria-hidden className="size-4" />Bloqueaste a {first}</span>
                <Button variant="secondary" loading={busy === 'unblock'} onClick={() => void act('unblock', () => unblockUser(user.id), `Desbloqueaste a ${first}`)}>Desbloquear</Button>
              </>
            ) : relation.status === 'PENDING_OUT' ? (
              <>
                <span className="inline-flex min-h-11 items-center gap-1.5 text-label-lg text-on-surface-light"><Send aria-hidden className="size-4" />Tu paloma va en camino</span>
                <Button variant="ghost" onClick={() => setConfirm('block')}><Ban aria-hidden className="size-4" />Bloquear</Button>
              </>
            ) : (
              <>
                <PigeonButton user={user} relation={relation} size="md" onSent={() => void load(true)} />
                <Button variant="ghost" onClick={() => setConfirm('block')}><Ban aria-hidden className="size-4" />Bloquear</Button>
              </>
            )}
          </div>

          {streak && (isLit(streak) || streak.revivable) && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/[var(--lq-soft-alpha)] px-4 py-3">
              <StreakFlame streak={streak} size="lg" />
              <p className="min-w-0 flex-1 text-body-md">
                {isLit(streak) ? `Llevan ${streak.count} días seguidos escribiéndose.` : `Su racha de ${streak.lost} días se apagó. Pueden revivirla desde su carta.`}
              </p>
              <Button size="sm" variant="secondary" onClick={() => navigate(socialLink.letter(user.username))}>Ir a la carta</Button>
            </div>
          )}
        </div>
      </motion.section>

      {data.locked ? (
        <motion.div variants={item}>
          <PassportPage title="Páginas reservadas" folio="02">
            <EmptyState icon={Lock} title="Solo para amigos" description={`${first} comparte sus sellos, visados y contactos solo con sus amigos.`} className="py-4" />
          </PassportPage>
        </motion.div>
      ) : (
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <PassportPage title="Sellos" folio="02">
              {data.achievements?.length ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {data.achievements.map((a, i) => {
                    const tilt = ((i * 7) % 11) - 5;
                    return (
                      <motion.li
                        key={`${a.title}-${i}`} title={a.description}
                        initial={{ opacity: 0, scale: 1.7, rotate: tilt - 14 }} animate={{ opacity: 1, scale: 1, rotate: tilt }}
                        transition={{ ...slam, delay: 0.25 + i * 0.07 }}
                        className="flex flex-col items-center gap-1.5 p-2 text-center"
                      >
                        <span className="flex size-16 items-center justify-center rounded-full border-[2.5px] border-dashed border-secondary-text/70 text-secondary-text shadow-[inset_0_0_0_4px_rgb(var(--lq-surface)),inset_0_0_0_5.5px_rgb(var(--lq-secondary-text)/.45)]">
                          <E e={a.icon} s={26} />
                        </span>
                        <span className="line-clamp-2 text-body-sm text-on-background">{a.title}</span>
                        <span className="font-mono text-label-md text-on-surface-light">{fmtDate(a.unlockedAt)}</span>
                      </motion.li>
                    );
                  })}
                </ul>
              ) : <p className="text-body-sm text-on-surface-light">Todavía sin sellos.</p>}
            </PassportPage>

            {data.friendsVisible && (
              <PassportPage title="Contactos" folio="03">
                {data.friends?.length ? (
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {data.friends.map((f, i) => (
                      <motion.li key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.natural, delay: 0.2 + i * 0.04 }}>
                        <Link to={`/u/${encodeURIComponent(f.username)}`} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center hover:bg-surface-variant">
                          <span className="lq-snapshot" style={{ rotate: `${((i * 5) % 7) - 3}deg` }}>
                            <AvatarDisplay avatarConfig={f.avatarConfig} avatarUrl={f.avatarUrl} size={48} animate="none" className="[&>div]:!rounded-[1px]" />
                          </span>
                          <span className="w-full truncate text-body-sm">{f.displayName.split(' ')[0]}</span>
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                ) : <p className="text-body-sm text-on-surface-light">Su directorio todavía está en blanco.</p>}
              </PassportPage>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <PassportPage title="Visados" folio="04">
              {data.guilds?.length ? (
                <ul className="flex flex-col gap-3">
                  {data.guilds.map((g, i) => {
                    const em = emblemOf(g.emblem);
                    return (
                      <motion.li key={g.id} initial={{ opacity: 0, x: -10, rotate: 0 }} animate={{ opacity: 1, x: 0, rotate: i % 2 ? 0.8 : -0.8 }} transition={{ ...springs.heavy, delay: 0.2 + i * 0.08 }}
                        className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong/60 bg-surface/80 p-3">
                        <GuildCrest photoUrl={g.photoUrl} emblem={em.icon} tone={em.tone} name={g.name} halo={false} className="size-11 rounded-xl [&>svg]:size-5" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-label-lg">{g.name}</span>
                          <span className="block text-body-sm text-on-surface-light">Visado de miembro</span>
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              ) : <p className="text-body-sm text-on-surface-light">Sin visados de gremio todavía.</p>}
            </PassportPage>

            <PassportPage title="Amistades más cercanas" folio="05">
              {!data.friendsVisible ? (
                <p className="flex items-center gap-2 text-body-sm text-on-surface-light"><Lock aria-hidden className="size-4" />{first} mantiene su directorio en privado.</p>
              ) : data.closeFriends?.length ? (
                <ul className="flex flex-col">
                  {data.closeFriends.map((f, i) => (
                    <motion.li key={f.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springs.natural, delay: 0.15 + i * 0.08 }}>
                      <Link to={`/u/${encodeURIComponent(f.username)}`} className="flex min-h-[60px] items-center gap-3 rounded-xl px-1 hover:bg-surface-variant">
                        <PresenceAvatar user={f} size={40} />
                        <span className="min-w-0 flex-1 truncate text-label-lg">{f.displayName}</span>
                        {f.friendStreak >= 3
                          ? <StreakFlame streak={{ count: f.friendStreak, alive: true, active: true, doneToday: true, revivable: false }} size="sm" label={`Racha de ${f.friendStreak} días (mejor: ${f.best})`} />
                          : <span className="font-mono text-body-sm text-on-surface-light">mejor: {f.best}</span>}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              ) : <p className="text-body-sm text-on-surface-light">Sus rachas con amigos aparecerán aquí.</p>}
            </PassportPage>
          </div>
        </motion.div>
      )}

      {friends && <GuildInviteModal open={guildOpen} onClose={() => setGuildOpen(false)} userId={user.id} name={first} />}
      <ReportDialog open={confirm === 'report'} onClose={() => setConfirm(null)} target={user} />
      <Modal open={confirm === 'block'} onClose={() => setConfirm(null)} title={`¿Bloquear a ${first}?`}>
        <p className="text-body-md text-on-surface">{friends ? 'Dejarán de ser amigos. ' : ''}No podrá escribirte, enviarte palomas ni gestos, y no se verán en las zonas ni en el buscador. Puedes desbloquearlo cuando quieras.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={busy === 'block'} onClick={() => void act('block', () => blockUser(user.id), `Bloqueaste a ${first}`)}><Ban aria-hidden className="size-4" />Bloquear</Button>
        </div>
      </Modal>
      <Modal open={confirm === 'remove'} onClose={() => setConfirm(null)} title={`¿Borrar a ${first} de tu directorio?`}>
        <p className="text-body-md text-on-surface">Dejarán de ver su carta y su racha se perderá.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={busy === 'remove'} onClick={() => void act('remove', () => removeFriend(relation.friendshipId!), `${first} ya no está en tu directorio`)}>Borrar</Button>
        </div>
      </Modal>
      <Modal open={confirm === 'partner'} onClose={() => setConfirm(null)} title={`¿Compartir tu jardín con ${first}?`}>
        <p className="text-body-md text-on-surface">Le llegará una invitación. Si acepta, los dos cuidarán el mismo jardín del corazón: fechas especiales, flores y recuerdos. Tu jardín actual pasa a ser el compartido.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button size="md" loading={busy === 'partner'} onClick={() => void act('partner', () => invitePartner(user.id), 'Invitación enviada: la verá en su jardín')}><Heart aria-hidden className="size-4" />Enviar invitación</Button>
        </div>
      </Modal>
    </ZoneShell>
  );
}
