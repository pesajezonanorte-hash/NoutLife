// Perfil social (/u/:usuario): avatar con presencia, apodo y biografía, sus
// rachas (general y de hábitos), logros, amistades más cercanas, amigos y
// gremios. Lo que se ve depende de la privacidad que eligió esa persona.
// Desde aquí se agrega, se escribe, se invita a un gremio o se propone
// compartir el jardín.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Flame, Heart, Lock, MessageCircle, MoreHorizontal, Shield, Sprout, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { useToast } from '@/hooks/useToast';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { E } from '@/components/ui/glyphs';
import { PresenceAvatar, StreakFlame } from '@/components/social/SocialBits';
import {
  apiError, getMyGuilds, getProfile, invitePartner, inviteToGuild, removeFriend, respondFriendRequest, sendFriendRequest, timeAgo,
  type GuildSummary, type ProfileData,
} from '@/services/network.service';
import { AnimatedValue, Badge, Button, Card, EmptyState, ErrorState, Modal, PageLoader } from '@/components/ui/lq';

function StatTile({ icon: Icon, tone, value, label, suffix }: { icon: typeof Flame; tone: string; value: number; label: string; suffix?: string }) {
  return (
    <motion.li variants={item}>
      <Card padding="md" className="flex h-full flex-col gap-2">
        <Icon aria-hidden className={cn('size-5', tone)} strokeWidth={1.75} />
        <span className="font-mono text-heading-lg tabular-nums"><AnimatedValue value={value} />{suffix && <span className="text-body-md text-on-surface-light">{suffix}</span>}</span>
        <span className="text-body-sm text-on-surface-light">{label}</span>
      </Card>
    </motion.li>
  );
}

function GuildInviteModal({ open, onClose, userId, name }: { open: boolean; onClose: () => void; userId: string; name: string }) {
  const toast = useToast();
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => { if (open) getMyGuilds().then(setGuilds).catch(() => setGuilds([])); }, [open]);
  async function invite(g: GuildSummary) {
    try { await inviteToGuild(g.id, userId); setSent((s) => [...s, g.id]); toast.success(`Invitación a ${g.name} enviada`); }
    catch (e) { toast.error(apiError(e, 'No se pudo invitar')); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Invitar a ${name} a un gremio`}>
      {guilds === null ? <PageLoader size="sm" /> : guilds.length === 0 ? (
        <p className="text-body-md text-on-surface-light">Aún no estás en ningún gremio. <Link to="/guild" className="text-primary-text underline">Crea uno</Link> y luego invita a tus amigos.</p>
      ) : (
        <ul className="flex flex-col">
          {guilds.map((g) => (
            <li key={g.id} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2 last:border-0">
              {g.photoUrl ? <img src={g.photoUrl} alt="" className="size-10 rounded-xl object-cover" /> : <span className="flex size-10 items-center justify-center rounded-xl bg-warning/[var(--lq-soft-alpha)] text-warning-text"><Shield aria-hidden className="size-5" /></span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{g.name}</span><span className="text-body-sm text-on-surface-light">{g.members} miembros</span></span>
              {sent.includes(g.id) ? <Badge variant="success" icon={Check}>Enviada</Badge> : <Button size="sm" variant="secondary" onClick={() => void invite(g)}>Invitar</Button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function UserProfilePage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'missing' | 'ready'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [guildOpen, setGuildOpen] = useState(false);
  const [confirm, setConfirm] = useState<'remove' | 'partner' | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try { setData(await getProfile(username)); setState('ready'); }
    catch (e) { if (!silent) setState((e as { response?: { status?: number } })?.response?.status === 400 ? 'missing' : 'error'); }
  }, [username]);
  useEffect(() => { void load(); }, [load]);

  if (state === 'loading') return <PageLoader />;
  if (state === 'missing') return <EmptyState icon={Users} title="Perfil no encontrado" description="Puede que el usuario haya cambiado de nombre." action={<Button onClick={() => navigate('/friends')}>Volver a Amigos</Button>} className="py-16" />;
  if (state === 'error' || !data) return <ErrorState onRetry={() => void load()} />;

  const { user, presence, relation } = data;
  const first = user.displayName.split(' ')[0];
  const self = relation.status === 'SELF';
  const friends = relation.status === 'FRIENDS';

  async function act(kind: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    try { await fn(); toast.success(ok); await load(true); }
    catch (e) { toast.error(apiError(e, 'No se pudo completar')); }
    finally { setBusy(null); setConfirm(null); setMenu(false); }
  }

  const presenceLine = self ? 'Así te ven los demás' : presence.online ? (presence.zone ? `En línea · en ${presence.zone}` : 'En línea') : presence.lastSeen ? `Activo ${timeAgo(presence.lastSeen)}` : null;

  return (
    <ZoneShell
      zone="friends"
      contentClassName="gap-8 md:gap-10"
      ambience={<AmbientLight tone="warning" alpha={0.1} darkAlpha={0.06} d={16} className="left-[10%] top-[-10%] h-[28rem] w-[70%]" />}
    >
      <motion.section variants={item} className="flex flex-wrap items-center gap-6 md:gap-8">
        <motion.span initial={{ scale: 0.85, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={springs.heavy} className="relative">
          <PresenceAvatar user={user} online={!self && presence.online} size={112} className="[&>span:first-child]:ring-4 [&>span:first-child]:ring-surface" />
        </motion.span>
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <span className={cn('text-label-lg', presence.online && !self ? 'text-success-text' : 'text-primary-text')}>{presenceLine ?? `@${user.username}`}</span>
          <h1 className="text-display-sm md:text-display-md"><Lettering text={user.displayName} /></h1>
          <p className="text-body-md text-on-surface-light">@{user.username} · Nivel {user.level} · En Noutlife desde {new Date(user.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          {user.bio && <p className="max-w-[60ch] text-body-lg">{user.bio}</p>}
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          {self ? (
            <Button variant="secondary" onClick={() => navigate('/settings?tab=privacy')}>Editar perfil y privacidad</Button>
          ) : friends ? (
            <>
              <Button onClick={() => navigate(`/friends?chat=${encodeURIComponent(user.username)}`)}><MessageCircle aria-hidden className="size-4" />Mensaje</Button>
              <Button variant="icon" aria-label="Más opciones" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal aria-hidden className="size-5" /></Button>
              <AnimatePresence>
                {menu && (
                  <motion.div
                    role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} transition={springs.natural}
                    className="absolute right-0 top-full z-20 mt-2 flex w-64 flex-col rounded-2xl border border-border bg-surface p-1.5 shadow-lg"
                  >
                    <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirm('partner'); }} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-body-md hover:bg-background"><Heart aria-hidden className="size-4 text-error-text" />Compartir mi jardín</button>
                    <button role="menuitem" type="button" onClick={() => { setMenu(false); setGuildOpen(true); }} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-body-md hover:bg-background"><Shield aria-hidden className="size-4 text-warning-text" />Invitar a un gremio</button>
                    <button role="menuitem" type="button" onClick={() => { setMenu(false); setConfirm('remove'); }} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-body-md text-error-text hover:bg-background"><UserMinus aria-hidden className="size-4" />Quitar de amigos</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : relation.status === 'PENDING_IN' ? (
            <>
              <Button loading={busy === 'accept'} onClick={() => void act('accept', () => respondFriendRequest(relation.friendshipId!, true), `${first} ya es tu amigo`)}><Check aria-hidden className="size-4" />Aceptar solicitud</Button>
              <Button variant="ghost" onClick={() => void act('reject', () => respondFriendRequest(relation.friendshipId!, false), 'Solicitud rechazada')}><X aria-hidden className="size-4" />Rechazar</Button>
            </>
          ) : relation.status === 'PENDING_OUT' ? (
            <Badge size="lg">Solicitud enviada</Badge>
          ) : (
            <Button loading={busy === 'add'} onClick={() => void act('add', () => sendFriendRequest(user.username), 'Solicitud enviada')}><UserPlus aria-hidden className="size-4" />Agregar a amigos</Button>
          )}
        </div>
      </motion.section>

      {data.friendStreak && (data.friendStreak.alive || data.friendStreak.revivable || data.friendStreak.best > 0) && (
        <motion.div variants={item}>
          <Card padding="md" className="flex flex-wrap items-center gap-4 bg-warning/[var(--lq-soft-alpha)]">
            <StreakFlame streak={data.friendStreak} size="lg" />
            <p className="min-w-0 flex-1 text-body-md">
              {data.friendStreak.alive ? `Llevan ${data.friendStreak.count} ${data.friendStreak.count === 1 ? 'día' : 'días'} de racha de fotos juntos.` : data.friendStreak.revivable ? `Su racha de ${data.friendStreak.lost} días se apagó. Pueden revivirla desde el chat.` : `Su mejor racha fue de ${data.friendStreak.best} días.`}
            </p>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/friends?chat=${encodeURIComponent(user.username)}`)}>Ir al chat</Button>
          </Card>
        </motion.div>
      )}

      {data.locked ? (
        <motion.div variants={item}>
          <Card padding="lg"><EmptyState icon={Lock} title="Perfil solo para amigos" description={`${first} comparte sus hábitos, logros y amigos solo con sus amigos.`} className="py-6" /></Card>
        </motion.div>
      ) : (
        <>
          <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 md:gap-4">
            <StatTile icon={Flame} tone="text-warning-text" value={user.currentStreak} label={`Días de racha (mejor: ${user.longestStreak})`} />
            <StatTile icon={Sprout} tone="text-success-text" value={data.stats?.habitsOnStreak ?? 0} suffix={` / ${data.stats?.habits ?? 0}`} label="Hábitos con racha activa" />
            <StatTile icon={Flame} tone="text-error-text" value={data.stats?.bestHabitStreak ?? 0} label="Racha de hábito más larga hoy" />
            <StatTile icon={Trophy} tone="text-secondary-text" value={data.stats?.achievements ?? 0} label="Logros" />
            <StatTile icon={Users} tone="text-info-text" value={data.stats?.friends ?? 0} label="Amigos" />
          </motion.ul>

          <div className="flex flex-wrap items-start gap-6">
            <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-6">
              <motion.div variants={item}>
                <Card padding="lg" className="flex flex-col gap-4">
                  <h2 className="text-heading-sm">Logros recientes</h2>
                  {data.achievements?.length ? (
                    <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {data.achievements.map((a, i) => (
                        <motion.li key={`${a.title}-${i}`} variants={item} title={a.description} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-background p-3 text-center">
                          <motion.span initial={{ rotate: -12, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ ...springs.heavy, delay: 0.1 + i * 0.05 }}
                            className="flex size-12 items-center justify-center rounded-full bg-secondary/[var(--lq-soft-alpha)] text-secondary-text">
                            <E e={a.icon} s={24} />
                          </motion.span>
                          <span className="line-clamp-2 text-body-sm">{a.title}</span>
                        </motion.li>
                      ))}
                    </motion.ul>
                  ) : <p className="text-body-sm text-on-surface-light">Todavía sin logros.</p>}
                </Card>
              </motion.div>

              {data.friendsVisible && (
                <motion.div variants={item}>
                  <Card padding="lg" className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3"><h2 className="text-heading-sm">Amigos</h2><span className="font-mono text-body-sm text-on-surface-light">{data.friends?.length ?? 0}</span></div>
                    {data.friends?.length ? (
                      <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                        {data.friends.map((f) => (
                          <motion.li key={f.id} variants={item}>
                            <Link to={`/u/${encodeURIComponent(f.username)}`} className="flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center hover:bg-background">
                              <PresenceAvatar user={f} size={52} />
                              <span className="w-full truncate text-body-sm">{f.displayName.split(' ')[0]}</span>
                            </Link>
                          </motion.li>
                        ))}
                      </motion.ul>
                    ) : <p className="text-body-sm text-on-surface-light">Sin amigos todavía.</p>}
                  </Card>
                </motion.div>
              )}
            </div>

            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-6">
              <motion.div variants={item}>
                <Card padding="lg" className="flex flex-col gap-3">
                  <h2 className="text-heading-sm">Amistades más cercanas</h2>
                  {!data.friendsVisible ? (
                    <p className="flex items-center gap-2 text-body-sm text-on-surface-light"><Lock aria-hidden className="size-4" />{first} mantiene su lista de amigos privada.</p>
                  ) : data.closeFriends?.length ? (
                    <ul className="flex flex-col">
                      {data.closeFriends.map((f, i) => (
                        <motion.li key={f.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springs.natural, delay: 0.15 + i * 0.08 }}>
                          <Link to={`/u/${encodeURIComponent(f.username)}`} className="flex min-h-[60px] items-center gap-3 rounded-xl px-1 hover:bg-background">
                            <PresenceAvatar user={f} size={40} />
                            <span className="min-w-0 flex-1 truncate text-label-lg">{f.displayName}</span>
                            <StreakFlame streak={{ count: f.friendStreak, alive: f.friendStreak > 0, doneToday: false, revivable: false }} size="sm" label={`Mejor racha: ${f.best} días`} />
                          </Link>
                        </motion.li>
                      ))}
                    </ul>
                  ) : <p className="text-body-sm text-on-surface-light">Las rachas de fotos con amigos aparecerán aquí.</p>}
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card padding="lg" className="flex flex-col gap-3">
                  <h2 className="text-heading-sm">Gremios</h2>
                  {data.guilds?.length ? (
                    <ul className="flex flex-col gap-2">
                      {data.guilds.map((g) => (
                        <li key={g.id} className="flex items-center gap-3">
                          {g.photoUrl ? <img src={g.photoUrl} alt="" className="size-10 rounded-xl object-cover" /> : <span className="flex size-10 items-center justify-center rounded-xl bg-warning/[var(--lq-soft-alpha)] text-warning-text"><Shield aria-hidden className="size-5" /></span>}
                          <span className="truncate text-label-lg">{g.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-body-sm text-on-surface-light">No está en ningún gremio.</p>}
                </Card>
              </motion.div>
            </div>
          </div>
        </>
      )}

      {friends && <GuildInviteModal open={guildOpen} onClose={() => setGuildOpen(false)} userId={user.id} name={first} />}
      <Modal open={confirm === 'remove'} onClose={() => setConfirm(null)} title={`¿Quitar a ${first} de tus amigos?`}>
        <p className="text-body-md text-on-surface">Dejarán de ver sus mensajes y su racha de fotos se perderá.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={busy === 'remove'} onClick={() => void act('remove', () => removeFriend(relation.friendshipId!), `${first} ya no está en tus amigos`)}>Quitar</Button>
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
