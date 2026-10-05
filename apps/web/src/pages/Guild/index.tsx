// Gremios (GuildDesktop). Cada persona puede estar en varios (como grupos): arriba
// se elige cuál ver y llegan las invitaciones. Crear (nombre, emblema y foto
// opcional) o unirse con un código OTP de 6 casillas. En cada gremio: su foto,
// código e invitar amigos, el enemigo del día (cada foto del día de un miembro le
// quita vida; si todos envían la suya cae y la racha del gremio suma), el muro de
// fotos de hoy, miembros y chat.
// Zona ambientada: una fogata. Al anochecer el fuego se enciende entre piedras y
// leños, suben brasas y los miembros llegan a sentarse alrededor; al fondo, las
// tiendas y el banderín del gremio. El fuego crece con cada foto del día (desde tu
// última visita). Tocarlo lo aviva con chispas.
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Camera, Check, CheckCheck, Copy, Crown, Flame, LogIn, LogOut, PawPrint, Plus, Send, Shield, Star, Swords, UserPlus, Users, type LucideIcon,
} from 'lucide-react';
import { springs } from '@/lib/motion/presets';
import { Polaroid, PresenceAvatar, SnapDialog, StreakFlame } from '@/components/social/SocialBits';
import {
  apiError, getGuild, getGuildInvites, getGuildMessagesAfter, getMyGuilds, getNetwork, inviteToGuild, postGuildSnap, respondGuildInvite,
  type FriendItem, type GuildInvite as GuildInviteRow, type GuildSummary, type StreakView,
} from '@/services/network.service';
import { item, pop3, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { createGuild, joinGuild, postGuildMessage, leaveGuild, updateGuild } from '@/services/social.service';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Campfire } from '@/components/guild/Campfire';
import { CrestEditButton, GuildCrest, GuildPhotoDialog } from '@/components/guild/GuildCrest';
import { Lettering } from '@/components/layout/Lettering';
import {
  Badge, BossBar, Button, Card, ErrorState, Field, IconChip, Input, Modal, OtpInput, PageLoader, ProgressBar, ProgressRing, SpotCard, type Tone,
} from '@/components/ui/lq';

interface MemberUser {
  id: string; username: string; displayName: string; level: number; currentStreak: number; xp: number;
  avatarConfig?: unknown; avatarUrl?: string | null; equippedAura?: string | null; equippedFrame?: string | null;
}
interface Message {
  id: string; content: string; createdAt: string; userId: string; kind?: string; photoUrl?: string | null; dayKey?: string | null;
  user: { displayName: string; avatarConfig?: unknown; avatarUrl?: string | null };
}
interface Guild {
  id: string; name: string; description?: string; emblem: string; photoUrl?: string | null; leaderId: string; level: number; xp: number; inviteCode: string;
  members: Array<{ id: string; userId: string; role: string; user: MemberUser; snappedToday: boolean }>;
  today: { day: string; snappedUserIds: string[]; enemy: { name: string; hp: number; maxHp: number; defeated: boolean } };
  streak: StreakView;
}

const EMBLEMS: Array<{ id: string; name: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = [
  { id: 'shield', name: 'Escudo', icon: Shield, tone: 'warning' },
  { id: 'sword', name: 'Espadas', icon: Swords, tone: 'error' },
  { id: 'crown', name: 'Corona', icon: Crown, tone: 'primary' },
  { id: 'star', name: 'Estrella', icon: Star, tone: 'info' },
  { id: 'dragon', name: 'Llama', icon: Flame, tone: 'forest' },
  { id: 'wolf', name: 'Lobo', icon: PawPrint, tone: 'success' },
];
const emblemOf = (id: string) => EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
const MAX_MEMBERS = 10;
const MAX_GUILDS = 5;
/** Vida que le quita al enemigo del día cada foto (igual que en la API). */
const ENEMY_HIT = 100;
/** Tamaño del fuego visto la última vez por gremio (para que crezca si el gremio avanzó). */
const FIRE_KEY = 'lq-guild-fire';
const readFire = (id: string): number | null => { try { const v = JSON.parse(localStorage.getItem(FIRE_KEY) || '{}')[id]; return typeof v === 'number' ? v : null; } catch { return null; } };
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (e as Error)?.message ?? 'Algo salió mal';

function NoGuild({ onEntered, hasGuilds = false }: { onEntered: (msg: string) => void; hasGuilds?: boolean }) {
  const [name, setName] = useState('');
  const [emblem, setEmblem] = useState('shield');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<{ create?: string; join?: string }>({});
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError({ create: 'Ponle un nombre a tu gremio' }); return; }
    setBusy('create'); setError({});
    try { await createGuild({ name: name.trim(), emblem, ...(photo ? { photoUrl: photo } : {}) }); onEntered('Gremio creado · eres el líder'); }
    catch (err) { setError({ create: errMsg(err) }); }
    finally { setBusy(null); }
  }
  async function join(e: FormEvent) {
    e.preventDefault();
    if (code.length < 4) { setError({ join: 'Escribe el código completo' }); return; }
    setBusy('join'); setError({});
    try { await joinGuild(code); onEntered('Te uniste al gremio'); }
    catch (err) { setError({ join: errMsg(err) }); }
    finally { setBusy(null); }
  }
  // Radiogroup con flechas (patrón WAI-ARIA).
  const onRadioKey = (i: number) => (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + EMBLEMS.length) % EMBLEMS.length;
    setEmblem(EMBLEMS[n].id);
    radios.current[n]?.focus();
  };

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="mx-auto flex w-full max-w-[920px] flex-col gap-8 md:gap-12">
      <motion.section variants={item} className="flex flex-col items-center gap-4 pt-2 text-center">
        <IconChip icon={Shield} tone="warning" size="lg" className="lq-halo size-24 animate-float rounded-[32px] [.reduce-motion_&]:animate-none md:size-28" />
        <span className="text-label-lg text-primary-text">Comunidad</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={hasGuilds ? 'Otro gremio' : 'Aún no tienes gremio'} /></h1>
        <p className="max-w-[540px] text-body-lg text-on-surface-light">Crea un grupo con tu gente o únete con un código. Cada día envían una foto haciendo un hábito para vencer al enemigo del día y sostener su racha. Hasta {MAX_MEMBERS} aventureros por gremio y {MAX_GUILDS} gremios por persona.</p>
      </motion.section>

      <motion.div variants={item} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <SpotCard aria-labelledby="g-create" padding="md" className="md:p-8">
          <form noValidate onSubmit={create} className="flex h-full flex-col gap-4">
            <IconChip icon={Plus} tone="primary" />
            <h2 id="g-create" className="text-heading-md">Crear gremio</h2>
            <Field label="Nombre" error={error.create}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Los Constantes" maxLength={40} />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-label-lg text-on-surface">Emblema</legend>
              <div role="radiogroup" aria-label="Emblema" className="flex flex-wrap gap-2">
                {EMBLEMS.map((em, i) => {
                  const on = emblem === em.id;
                  return (
                    <button
                      key={em.id} ref={(el) => { radios.current[i] = el; }}
                      type="button" role="radio" aria-checked={on} aria-label={em.name} tabIndex={on ? 0 : -1}
                      onClick={() => setEmblem(em.id)} onKeyDown={onRadioKey(i)}
                      className={cn(
                        'flex size-[52px] items-center justify-center rounded-2xl border-2 transition-[transform,border-color] duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]',
                        `${{ warning: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text', error: 'bg-error/[var(--lq-soft-alpha)] text-error-text', primary: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text', info: 'bg-info/[var(--lq-soft-alpha)] text-info-text', secondary: 'bg-secondary/[var(--lq-soft-alpha)] text-secondary-text', forest: 'bg-forest/[var(--lq-soft-alpha)] text-forest-text', success: 'bg-success/[var(--lq-soft-alpha)] text-success-text' }[em.tone]}`,
                        on ? 'scale-110 border-primary' : 'border-transparent',
                      )}
                    >
                      <em.icon aria-hidden className="size-6" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {/* Foto del gremio (opcional): sustituye al emblema en la cabecera y el banderín */}
            <div className="flex items-center gap-4">
              <GuildCrest photoUrl={photo} emblem={emblemOf(emblem).icon} tone={emblemOf(emblem).tone} name={name.trim() || 'tu gremio'} halo={false} className="size-14 rounded-2xl [&>svg]:size-7" />
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="text-label-lg text-on-surface">Foto del gremio <span className="font-normal text-on-surface-light">(opcional)</span></span>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPhotoOpen(true)}>{photo ? 'Cambiar foto' : 'Elegir foto'}</Button>
              </div>
            </div>
            <GuildPhotoDialog
              open={photoOpen} onClose={() => setPhotoOpen(false)} name={name.trim() || 'tu gremio'}
              photoUrl={photo} emblem={emblemOf(emblem).icon} tone={emblemOf(emblem).tone} onSave={(url) => setPhoto(url)}
            />
            <Button type="submit" block loading={busy === 'create'} disabled={busy === 'join'} className="mt-auto">{busy === 'create' ? 'Creando…' : 'Crear gremio'}</Button>
          </form>
        </SpotCard>

        <SpotCard aria-labelledby="g-join" padding="md" className="md:p-8">
          <form noValidate onSubmit={join} className="flex h-full flex-col gap-4">
            <IconChip icon={LogIn} tone="forest" />
            <h2 id="g-join" className="text-heading-md">Unirse con código</h2>
            <p className="text-body-md text-on-surface-light">Pide el código de 6 caracteres a quien lidera el gremio. Puedes pegarlo entero.</p>
            <OtpInput value={code} onChange={setCode} label="Código de invitación" invalid={Boolean(error.join)} disabled={busy === 'join'} />
            {error.join && <p role="alert" className="text-body-sm text-error-text">{error.join}</p>}
            <Button type="submit" variant="secondary" block loading={busy === 'join'} disabled={busy === 'create'} className="mt-auto">{busy === 'join' ? 'Verificando…' : 'Unirse'}</Button>
          </form>
        </SpotCard>
      </motion.div>
    </motion.div>
  );
}

/** Invitar a amigos que todavía no están en el gremio. */
function InviteFriends({ open, onClose, guild }: { open: boolean; onClose: () => void; guild: Guild }) {
  const toast = useToast();
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => { if (open) getNetwork().then(setFriends).catch(() => setFriends([])); }, [open]);
  const members = new Set(guild.members.map((m) => m.userId));
  const candidates = (friends ?? []).filter((f) => !members.has(f.friend.id));
  async function invite(f: FriendItem) {
    try { await inviteToGuild(guild.id, f.friend.id); setSent((s) => [...s, f.friend.id]); toast.success(`Invitación enviada a ${f.friend.displayName.split(' ')[0]}`); }
    catch (e) { toast.error(apiError(e, 'No se pudo invitar')); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Invitar a ${guild.name}`}>
      <p className="-mt-2 text-body-sm text-on-surface-light">Les llegará una notificación. También pueden entrar con el código {guild.inviteCode}.</p>
      {friends === null ? <PageLoader size="sm" /> : candidates.length === 0 ? (
        <p className="text-body-md text-on-surface-light">{friends.length ? 'Todos tus amigos ya están aquí.' : 'Agrega amigos en la zona de Amigos para invitarlos.'}</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
          {candidates.map((f) => (
            <li key={f.friendshipId} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2 last:border-0">
              <PresenceAvatar user={f.friend} online={f.friend.online} size={40} />
              <span className="min-w-0 flex-1 truncate text-label-lg">{f.friend.displayName}</span>
              {sent.includes(f.friend.id) ? <Badge variant="success" icon={Check}>Enviada</Badge> : <Button size="sm" variant="secondary" onClick={() => void invite(f)}><UserPlus aria-hidden className="size-4" />Invitar</Button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function InGuild({ guild, onLeft, onChanged }: { guild: Guild; onLeft: () => void; onChanged: () => void }) {
  const me = useAuthStore((s) => s.user);
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(guild.photoUrl ?? null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [snapOpen, setSnapOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const feedRef = useRef<HTMLUListElement>(null);
  const lastAt = useRef<string | undefined>(undefined);

  // Primero los últimos 50; después solo lo nuevo (las fotos pesan).
  useEffect(() => {
    lastAt.current = undefined;
    let alive = true;
    const pull = async () => {
      try {
        const d = (await getGuildMessagesAfter(guild.id, lastAt.current)) as Message[];
        if (!alive || !d.length) return;
        lastAt.current = d[d.length - 1].createdAt;
        setMessages((p) => {
          const known = new Set(p.map((m) => m.id));
          return [...p, ...d.filter((m) => !known.has(m.id))];
        });
        if (d.some((m) => m.kind === 'SNAP')) onChanged();
      } catch { /* sin conexión: se reintenta */ }
    };
    void pull();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, [guild.id, onChanged]);
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  const em = emblemOf(guild.emblem);
  const myId = String(me?.id);
  const myRole = guild.members.find((m) => m.userId === myId)?.role;
  const canEdit = guild.leaderId === myId || myRole === 'LEADER' || myRole === 'OFFICER';
  const snapped = new Set(guild.today.snappedUserIds);
  const mineToday = snapped.has(myId);
  const snapPct = guild.members.length ? Math.round((snapped.size / guild.members.length) * 100) : 0;
  const todaySnaps = messages.filter((m) => m.kind === 'SNAP' && m.photoUrl && m.dayKey === guild.today.day);

  async function savePhoto(url: string | null) {
    try {
      const res = await updateGuild(guild.id, { photoUrl: url });
      setPhoto(res.photoUrl);
      toast.success(url ? 'Foto del gremio actualizada' : 'Foto del gremio quitada');
    } catch (e) {
      toast.error(errMsg(e));
      throw e;
    }
  }
  const members = [...guild.members].sort((a, b) => Number(snapped.has(b.userId)) - Number(snapped.has(a.userId)) || (b.user.xp ?? 0) - (a.user.xp ?? 0));
  const maxXp = Math.max(1, ...members.map((m) => m.user.xp ?? 0));
  // El fuego crece con las fotos del día (desde lo que se vio la última vez).
  const [prevFire] = useState(() => readFire(guild.id));
  useEffect(() => {
    try { localStorage.setItem(FIRE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(FIRE_KEY) || '{}'), [guild.id]: snapPct })); } catch { /* sin almacenamiento */ }
  }, [guild.id, snapPct]);

  async function copy() {
    try { await navigator.clipboard.writeText(guild.inviteCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('No se pudo copiar'); }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    try { const m = (await postGuildMessage(guild.id, content)) as Message; lastAt.current = m.createdAt; setMessages((p) => [...p, m]); }
    catch { toast.error('No se pudo enviar'); setText(content); }
  }
  async function sendSnap(photoUrl: string, habitTitle: string | null, caption: string) {
    try {
      const r = await postGuildSnap(guild.id, photoUrl, [habitTitle, caption].filter(Boolean).join(' · '));
      toast.success(r.streakCompleted ? `¡${guild.today.enemy.name} cayó! La racha del gremio sigue.` : `Le quitaste ${ENEMY_HIT} HP a ${guild.today.enemy.name}`);
      onChanged();
    } catch (e) { throw new Error(apiError(e, 'No se pudo enviar la foto')); }
  }
  async function leave() {
    setLeaving(true);
    try { await leaveGuild(guild.id); onLeft(); }
    catch (e) { toast.error(errMsg(e)); setLeaving(false); }
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <motion.div variants={item} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-6 md:gap-8">
          <motion.span variants={pop3} initial="initial" animate="animate" className="relative">
            <GuildCrest photoUrl={photo} emblem={em.icon} tone={em.tone} name={guild.name} className="size-20 rounded-[28px] md:size-24 md:rounded-[32px]" />
            {canEdit && <CrestEditButton onClick={() => setPhotoOpen(true)} label={photo ? 'Cambiar la foto del gremio' : 'Poner una foto al gremio'} />}
          </motion.span>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            <span className="text-label-lg text-primary-text">Gremio · nivel {guild.level}</span>
            <h1 className="text-display-sm md:text-display-md"><Lettering text={guild.name} /></h1>
            {guild.description && <p className="text-body-md text-on-surface-light">{guild.description}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Badge size="lg" icon={Users}><span className="font-mono">{guild.members.length}/{MAX_MEMBERS}</span> aventureros</Badge>
              <Badge size="lg" variant="warning"><StreakFlame streak={guild.streak} size="sm" label={`Racha del gremio: ${guild.streak.count} días`} /> racha del gremio</Badge>
            </div>
          </div>
          <Card padding="sm" className="flex min-w-[240px] flex-col gap-2 bg-background">
            <span className="text-body-sm text-on-surface-light">Código de invitación</span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-heading-md tracking-[4px]">{guild.inviteCode}</span>
              <Button variant="secondary" size="md" onClick={copy} aria-live="polite">
                {copied ? <Check aria-hidden className="size-4" strokeWidth={2} /> : <Copy aria-hidden className="size-4" strokeWidth={1.75} />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setInviteOpen(true)} className="self-start"><UserPlus aria-hidden className="size-4" />Invitar amigos</Button>
          </Card>
        </div>
        {/* La fogata del gremio: crece con cada foto del día */}
        <Campfire
          campers={members.map((m) => ({
            id: m.id, name: m.user.displayName.split(' ')[0], lead: m.userId === guild.leaderId, you: m.userId === myId,
            avatar: (size: number) => <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} size={size} animate="none" className="rounded-full" />,
          }))}
          progress={snapPct} prevProgress={prevFire} emblem={em.icon} emblemTone={em.tone} photoUrl={photo}
        />
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
          <motion.div variants={item}>
            <Card padding="lg">
              <BossBar
                eyebrow="Enemigo del día" name={guild.today.enemy.name} icon={Swords} hp={guild.today.enemy.hp} maxHp={guild.today.enemy.maxHp}
                note={guild.today.enemy.defeated
                  ? 'Todos enviaron su foto: el enemigo cayó y la racha del gremio suma un día. Mañana llega otro.'
                  : `Cada foto del día de un miembro le quita ${ENEMY_HIT} HP. Si todos envían la suya, cae y la racha del gremio suma un día.`}
                aside={<Badge variant={guild.today.enemy.defeated ? 'success' : 'neutral'}><span className="font-mono">{snapped.size}/{guild.members.length}</span> fotos</Badge>}
                action={mineToday
                  ? <p className="flex items-center gap-2 text-label-lg text-success-text"><CheckCheck aria-hidden className="size-5" />Tu foto de hoy ya cuenta</p>
                  : <Button className="self-start" onClick={() => setSnapOpen(true)}><Camera aria-hidden className="size-4" strokeWidth={1.75} />Enviar mi foto del día</Button>}
              />
            </Card>
          </motion.div>

          {todaySnaps.length > 0 && (
            <motion.div variants={item}>
              <Card padding="lg" className="flex flex-col gap-4">
                <h2 className="text-heading-sm">Muro de hoy</h2>
                <ul className="flex gap-4 overflow-x-auto px-1 pb-2 pt-3">
                  {todaySnaps.map((m, i) => (
                    <li key={m.id} className="shrink-0">
                      <Polaroid src={m.photoUrl!} tilt={((i % 3) - 1) * 2.5} delay={i * 0.08} className="w-40" caption={<span className="block truncate"><b>{m.userId === myId ? 'Tú' : m.user.displayName.split(' ')[0]}</b>{m.content ? ` · ${m.content}` : ''}</span>} />
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col gap-2">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-heading-sm">Miembros</h2><span className="text-body-sm text-on-surface-light">Foto de hoy · XP</span></div>
              <motion.ol variants={stagger} initial="initial" animate="animate" className="flex flex-col">
                {members.map((m, i) => {
                  const lead = m.userId === guild.leaderId;
                  const you = m.userId === myId;
                  const did = snapped.has(m.userId);
                  return (
                    <motion.li key={m.id} variants={item} layout="position" className={cn('flex min-h-[60px] flex-wrap items-center gap-3 py-2 sm:flex-nowrap sm:gap-4', i < members.length - 1 && 'border-b border-border')}>
                      <Link to={`/u/${encodeURIComponent(m.user.username)}`} className="shrink-0" aria-label={`Perfil de ${m.user.displayName}`}>
                        <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} equippedAura={m.user.equippedAura} equippedFrame={m.user.equippedFrame} size={40} animate="none" className="overflow-hidden rounded-full" />
                      </Link>
                      <div className="min-w-0 flex-1 sm:flex-[0_0_200px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-label-lg">{m.user.displayName}</span>
                          {lead && <Badge variant="warning" icon={Crown}>Líder</Badge>}
                          {you && <Badge variant="primary">Tú</Badge>}
                        </div>
                        <div className="text-body-sm text-on-surface-light">Nivel {m.user.level} · <Flame aria-hidden className="inline size-3.5 text-warning-text" /> {(m.user.currentStreak ?? 0)} días</div>
                      </div>
                      <motion.span
                        animate={{ scale: did ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.4 }}
                        title={did ? 'Ya envió su foto de hoy' : 'Aún no envía su foto'}
                        className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', did ? 'bg-success/[var(--lq-soft-alpha)] text-success-text' : 'bg-background text-on-surface-light')}
                      >
                        {did ? <CheckCheck aria-hidden className="size-4" /> : <Camera aria-hidden className="size-4" />}
                        <span className="sr-only">{did ? 'Foto enviada hoy' : 'Sin foto hoy'}</span>
                      </motion.span>
                      <ProgressBar value={((m.user.xp ?? 0) / maxXp) * 100} className="order-last w-full sm:order-none sm:flex-1" label={`Aporte de ${m.user.displayName}`} />
                      <span className="w-20 text-right font-mono text-label-lg tabular-nums">{(m.user.xp ?? 0).toLocaleString('es-CO')}</span>
                    </motion.li>
                  );
                })}
              </motion.ol>
            </Card>
          </motion.div>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col items-center gap-3 text-center">
              <h2 className="self-start text-heading-sm">Fotos de hoy</h2>
              <ProgressRing value={snapPct} tone="success" size={168} stroke={9} label="Miembros que enviaron su foto hoy" valueText={`${snapPct}%`}>
                <span className="font-mono text-display-sm tabular-nums">{snapped.size}/{guild.members.length}</span>
                <span className="text-body-sm text-on-surface-light">enviadas</span>
              </ProgressRing>
              <p className="text-body-sm text-on-surface-light">
                {guild.streak.alive ? `Racha del gremio: ${guild.streak.count} ${guild.streak.count === 1 ? 'día' : 'días'} (mejor: ${guild.streak.best}).` : 'Cuando todos envíen su foto el mismo día, empieza la racha del gremio.'}
              </p>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col gap-3">
              <h2 className="text-heading-sm">Chat del gremio</h2>
              <ul ref={feedRef} aria-live="polite" className="flex max-h-96 flex-col gap-1 overflow-y-auto overscroll-contain">
                {messages.length === 0 && <li className="py-6 text-center text-body-sm text-on-surface-light">Aún no hay mensajes. ¡Saluda a tu gremio!</li>}
                {messages.map((m) => (
                  <motion.li key={m.id} variants={pop3} initial="initial" animate="animate" className="flex items-start gap-3 py-2.5">
                    <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} size={32} animate="none" className="shrink-0 overflow-hidden rounded-[10px]" />
                    <div className="min-w-0 flex-1">
                      {m.kind === 'SNAP' && m.photoUrl ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-body-sm"><b>{m.userId === myId ? 'Tú' : m.user.displayName}</b> envió su foto del día</p>
                          <Polaroid src={m.photoUrl} tilt={-1.5} className="w-36" caption={m.content || undefined} />
                        </div>
                      ) : (
                        <p className="break-words text-body-sm text-on-background"><b>{m.userId === myId ? 'Tú' : m.user.displayName}</b> {m.content}</p>
                      )}
                      <span className="text-body-sm text-on-surface-light">{new Date(m.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
              <form onSubmit={send} className="flex gap-2">
                <label htmlFor="g-msg" className="sr-only">Mensaje al gremio</label>
                <Input id="g-msg" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe al gremio…" maxLength={500} />
                <Button type="submit" variant="icon" aria-label="Enviar mensaje" disabled={!text.trim()} className="size-12 shrink-0 bg-primary-strong text-on-primary">
                  <Send aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </form>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}><LogOut aria-hidden className="size-4" strokeWidth={1.75} />Salir del gremio</Button>
          </motion.div>
        </div>
      </div>

      {canEdit && (
        <GuildPhotoDialog open={photoOpen} onClose={() => setPhotoOpen(false)} name={guild.name} photoUrl={photo} emblem={em.icon} tone={em.tone} onSave={savePhoto} />
      )}
      <SnapDialog
        open={snapOpen} onClose={() => setSnapOpen(false)} title={`Tu foto del día para ${guild.name}`}
        hint={`Muéstrale al gremio un hábito de hoy. Cada foto le quita ${ENEMY_HIT} HP a ${guild.today.enemy.name}.`}
        onSend={sendSnap}
      />
      <InviteFriends open={inviteOpen} onClose={() => setInviteOpen(false)} guild={guild} />
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="¿Salir del gremio?">
        <p className="text-body-md text-on-surface">Dejarás de aportar al enemigo del día y de ver la actividad de {guild.name}. Podrás volver con el código.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirmLeave(false)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={leaving} onClick={leave}>Salir</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

/** Tus gremios como pestañas con su foto, la racha y si ya enviaste tu foto hoy. */
function GuildSwitcher({ guilds, active, onPick }: { guilds: GuildSummary[]; active: string | null; onPick: (id: string | null) => void }) {
  return (
    <motion.nav variants={item} aria-label="Tus gremios" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2 pb-1">
        {guilds.map((g) => {
          const em = emblemOf(g.emblem);
          const on = g.id === active;
          return (
            <li key={g.id} className="shrink-0">
              <button
                type="button" onClick={() => onPick(g.id)} aria-current={on ? 'page' : undefined}
                className={cn('relative flex min-h-12 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 transition-colors',
                  on ? 'border-primary bg-primary/[var(--lq-soft-alpha)]' : 'border-border hover:border-primary/40')}
              >
                <GuildCrest photoUrl={g.photoUrl} emblem={em.icon} tone={em.tone} name={g.name} halo={false} className="size-9 rounded-full [&>svg]:size-4" />
                <span className="max-w-[160px] truncate text-label-lg">{g.name}</span>
                {g.streak.alive && <StreakFlame streak={g.streak} size="sm" />}
                {!g.mineToday && <span title="Falta tu foto de hoy" className="size-2 rounded-full bg-warning"><span className="sr-only">Falta tu foto de hoy</span></span>}
              </button>
            </li>
          );
        })}
        {guilds.length < MAX_GUILDS && (
          <li className="shrink-0">
            <button type="button" onClick={() => onPick(null)} aria-current={active === null ? 'page' : undefined}
              className={cn('flex min-h-12 items-center gap-2 rounded-full border border-dashed px-4 text-label-lg transition-colors', active === null ? 'border-primary text-primary-text' : 'border-border-strong text-on-surface hover:border-primary/40')}>
              <Plus aria-hidden className="size-4" />Nuevo o unirme
            </button>
          </li>
        )}
      </ul>
    </motion.nav>
  );
}

function InvitesBanner({ invites, onAnswered }: { invites: GuildInviteRow[]; onAnswered: (guildId: string | null) => void }) {
  const toast = useToast();
  const [gone, setGone] = useState<string[]>([]);
  async function answer(inv: GuildInviteRow, accept: boolean) {
    setGone((g) => [...g, inv.id]);
    try { const r = await respondGuildInvite(inv.id, accept); if (accept) toast.success(`Te uniste a ${inv.guild.name}`); onAnswered(accept ? r.guildId : null); }
    catch (e) { setGone((g) => g.filter((x) => x !== inv.id)); toast.error(apiError(e, 'No se pudo responder')); }
  }
  const list = invites.filter((i) => !gone.includes(i.id));
  return (
    <AnimatePresence initial={false}>
      {list.map((inv) => (
        <motion.div key={inv.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }} transition={springs.heavy}>
          <Card padding="md" className="flex flex-wrap items-center gap-3 border-warning/30">
            <GuildCrest photoUrl={inv.guild.photoUrl} emblem={emblemOf(inv.guild.emblem).icon} tone={emblemOf(inv.guild.emblem).tone} name={inv.guild.name} halo={false} className="size-12 rounded-2xl [&>svg]:size-6" />
            <p className="min-w-0 flex-[1_1_200px] text-body-md"><b>{inv.inviter.displayName}</b> te invitó a <b>{inv.guild.name}</b> · {inv.guild._count.members} miembros</p>
            <Button variant="ghost" size="sm" onClick={() => void answer(inv, false)}>Ahora no</Button>
            <Button size="sm" onClick={() => void answer(inv, true)}>Unirme</Button>
          </Card>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default function GuildPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [invites, setInvites] = useState<GuildInviteRow[]>([]);
  const [guild, setGuild] = useState<Guild | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const wanted = params.get('id');
  const [active, setActive] = useState<string | null | undefined>(wanted ?? undefined);
  const pickLast = useRef(false);

  const loadList = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [list, inv] = await Promise.all([getMyGuilds(), getGuildInvites().catch(() => [])]);
      setGuilds(list); setInvites(inv);
      setActive((cur) => {
        if (pickLast.current) { pickLast.current = false; return list[list.length - 1]?.id ?? null; }
        return cur === null ? null : cur && list.some((g) => g.id === cur) ? cur : list[0]?.id ?? null;
      });
      setState('ready');
    } catch { if (!silent) setState('error'); }
  }, []);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { if (wanted) setActive(wanted); }, [wanted]);

  const loadGuild = useCallback(async (id: string) => {
    try { setGuild((await getGuild(id)) as Guild); }
    catch { setGuild(null); }
  }, []);
  useEffect(() => { if (active) void loadGuild(active); else setGuild(null); }, [active, loadGuild]);
  const refresh = useCallback(() => { if (active) void loadGuild(active); void loadList(true); }, [active, loadGuild, loadList]);

  function pick(id: string | null) {
    setActive(id);
    const next = new URLSearchParams(params);
    if (id) next.set('id', id); else next.delete('id');
    setParams(next, { replace: true });
  }

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={() => void loadList()} />;

  return (
    <ZoneShell zone="guild" contentClassName="gap-8" ambience={<AmbientLight tone="warning" alpha={0.1} darkAlpha={0.07} d={6} className="lq-candle left-[20%] top-[18%] h-[30rem] w-[60%]" breathe={false} />}>
      {invites.length > 0 && <div className="flex flex-col gap-3"><InvitesBanner invites={invites} onAnswered={(id) => { void loadList(true); if (id) pick(id); }} /></div>}
      {guilds.length > 0 && <GuildSwitcher guilds={guilds} active={active ?? null} onPick={pick} />}
      <AnimatePresence mode="wait">
        {active && guild && guild.id === active ? (
          <motion.div key={guild.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={springs.natural}>
            <InGuild guild={guild} onChanged={refresh} onLeft={() => { toast.info('Saliste del gremio'); setActive(undefined); void loadList(true); }} />
          </motion.div>
        ) : active ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><PageLoader size="sm" /></motion.div>
        ) : (
          <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.natural}>
            <NoGuild hasGuilds={guilds.length > 0} onEntered={(msg) => { toast.success(msg); pickLast.current = true; void loadList(true); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </ZoneShell>
  );
}
