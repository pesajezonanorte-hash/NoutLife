// Gremios dentro de Social. Cada persona puede estar en varios (como grupos):
// arriba se elige cuál ver y llegan las invitaciones (traídas por paloma). Crear
// (nombre, emblema y foto opcional) o unirse con un código OTP de 6 casillas.
// En cada gremio: su foto, el código e invitar amigos (sale una paloma por cada
// invitación), la fogata, el enemigo del día (la primera foto de hoy de cada
// miembro, tomada con la cámara, le quita vida; cae cuando todos envían la suya),
// el muro de fotos de hoy, los miembros y la carta del gremio: en escritorio va
// al lado; en el móvil se abre desde su sobre. La racha del gremio suma cuando
// todos escriben y solo se muestra encendida (tres días seguidos).
// Zona ambientada: una fogata al anochecer (Campfire).
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, Check, CheckCheck, Copy, Crown, Flame, LogIn, LogOut, Mail, Pencil, Plus, Shield, Swords, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, pop3, stagger } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  apiError, getGuild, getNetwork, inviteToGuild, peekGuildMessages, postGuildSnap, respondGuildInvite, thumbOf,
  type FriendItem, type GuildDetail, type GuildInvite, type GuildMessage, type GuildSummary,
} from '@/services/network.service';
import { useMedia, useNearScreen } from '@/lib/media';
import { GuildEditDialog } from './GuildEditDialog';
import { createGuild, joinGuild, leaveGuild, updateGuild } from '@/services/social.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { Campfire } from '@/components/guild/Campfire';
import { CrestEditButton, GuildCrest, GuildPhotoDialog } from '@/components/guild/GuildCrest';
import { EMBLEMS, emblemOf } from '@/components/guild/emblems';
import { Lettering } from '@/components/layout/Lettering';
import {
  Badge, BossBar, Button, Card, ErrorState, Field, IconChip, Input, Modal, OtpInput, PageLoader, ProgressBar, ProgressRing, SpotCard,
} from '@/components/ui/lq';
import { Pigeon, sendPigeon } from './CarrierPigeon';
import { PresenceAvatar, StreakFlame, isLit } from './SocialBits';
import { InstantCamera } from './letters/InstantCamera';
import { InstantPhoto } from './letters/InstantPhoto';
import { GuildLetter } from './letters/LetterView';

const MAX_MEMBERS = 10;
const MAX_GUILDS = 5;
/** Vida que le quita al enemigo del día la primera foto de cada miembro (igual que en la API). */
const ENEMY_HIT = 100;
/** Tamaño del fuego visto la última vez por gremio (para que crezca si el gremio avanzó). */
const FIRE_KEY = 'lq-guild-fire';
const readFire = (id: string): number | null => { try { const v = JSON.parse(localStorage.getItem(FIRE_KEY) || '{}')[id]; return typeof v === 'number' ? v : null; } catch { return null; } };
const toaster = () => useToastStore.getState();
const errMsg = (e: unknown) => apiError(e, (e as Error)?.message || 'Algo salió mal');

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
    <motion.div variants={stagger} initial="initial" animate="animate" className="mx-auto flex w-full max-w-[920px] flex-col gap-8 md:gap-10">
      <motion.section variants={item} className="flex flex-col items-center gap-3 pt-2 text-center">
        <IconChip icon={Shield} tone="warning" size="lg" className="lq-halo size-20 animate-float rounded-[28px] [.reduce-motion_&]:animate-none md:size-24" />
        <h2 className="text-display-sm"><Lettering text={hasGuilds ? 'otro gremio' : 'tu primer gremio'} /></h2>
        <p className="max-w-[540px] text-body-lg text-on-surface-light">Un gremio es un grupo con su propia carta. Cada día envían una foto con la cámara para vencer al enemigo del día; si todos escriben tres días seguidos, se enciende su racha. Hasta {MAX_MEMBERS} aventureros por gremio y {MAX_GUILDS} gremios por persona.</p>
      </motion.section>

      <motion.div variants={item} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <SpotCard aria-labelledby="g-create" padding="md" className="md:p-8">
          <form noValidate onSubmit={create} className="flex h-full flex-col gap-4">
            <IconChip icon={Plus} tone="primary" />
            <h3 id="g-create" className="text-heading-md">Crear gremio</h3>
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
            <h3 id="g-join" className="text-heading-md">Unirse con código</h3>
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

/** Invitar a amigos que todavía no están en el gremio: cada invitación sale con su paloma. */
function InviteFriends({ open, onClose, guild }: { open: boolean; onClose: () => void; guild: GuildDetail }) {
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => { if (open) getNetwork().then(setFriends).catch(() => setFriends([])); }, [open]);
  const members = new Set(guild.members.map((m) => m.userId));
  const candidates = (friends ?? []).filter((f) => !members.has(f.friend.id));
  async function invite(f: FriendItem, from: HTMLElement) {
    sendPigeon(from);
    try { await inviteToGuild(guild.id, f.friend.id); setSent((s) => [...s, f.friend.id]); toaster().success(`Paloma enviada a ${f.friend.displayName.split(' ')[0]}`); }
    catch (e) { toaster().error(apiError(e, 'La paloma no pudo salir')); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Invitar a ${guild.name}`}>
      <p className="-mt-2 text-body-sm text-on-surface-light">Les llegará una paloma con la invitación. También pueden entrar con el código <span className="font-mono">{guild.inviteCode}</span>.</p>
      {friends === null ? <PageLoader size="sm" /> : candidates.length === 0 ? (
        <p className="text-body-md text-on-surface-light">{friends.length ? 'Todos tus amigos ya están aquí.' : 'Anota amigos en tu directorio para invitarlos.'}</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
          {candidates.map((f) => (
            <li key={f.friendshipId} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2 last:border-0">
              <PresenceAvatar user={f.friend} online={f.friend.online} size={40} />
              <span className="min-w-0 flex-1 truncate text-label-lg">{f.friend.displayName}</span>
              {sent.includes(f.friend.id)
                ? <Badge variant="success" icon={Check}>Paloma enviada</Badge>
                : <Button size="sm" variant="secondary" onClick={(e) => void invite(f, e.currentTarget)}><UserPlus aria-hidden className="size-4" />Invitar</Button>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Una foto del muro de hoy (se pide al acercarse a la pantalla). */
function WallPhoto({ m, tilt, mine }: { m: GuildMessage; tilt: number; mine: boolean }) {
  const { ref, near } = useNearScreen<HTMLDivElement>();
  const media = useMedia('guild', m.id, { enabled: near, hasThumb: Boolean(m.meta?.thumb) });
  return (
    <div ref={ref}>
      <InstantPhoto src={media.photoUrl} thumb={m.meta?.thumb} alt={`Foto de ${mine ? 'ti' : m.user.displayName}`} tilt={tilt} caption={m.content || null} className="w-full" />
    </div>
  );
}

/** El sobre de la carta del gremio (móvil): lo último y las cartas sin abrir. */
function GuildLetterEnvelope({ summary, onOpen }: { summary?: GuildSummary; onOpen: () => void }) {
  const last = summary?.lastMessage;
  return (
    <button type="button" onClick={onOpen} aria-label={`Abrir la carta del gremio${summary?.unread ? `, ${summary.unread} sin leer` : ''}`} className="group block w-full text-left">
      <span className="lq-envelope relative block overflow-hidden rounded-[8px]">
        <span aria-hidden="true" className="lq-envelope-folds absolute inset-0" />
        <span aria-hidden="true" className="lq-envelope-flap absolute inset-x-0 top-0 block h-[46%]" />
        <span className="relative flex min-h-[84px] items-center gap-3 px-4 py-3">
          <Mail aria-hidden className="size-6 shrink-0 text-on-surface-light" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 pt-2">
            <span className="block text-label-lg text-on-background">Carta del gremio</span>
            <span className="block truncate text-body-sm text-on-surface-light">{last ? `${last.mine ? 'Tú' : last.author.split(' ')[0]}: ${last.preview}` : 'Escribe la primera línea para todos'}</span>
          </span>
          {summary?.unread ? (
            <span className="lq-wax flex size-9 shrink-0 items-center justify-center font-mono text-label-md">{summary.unread > 9 ? '9+' : summary.unread}<span className="sr-only"> sin leer</span></span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function InGuild({ guild, summary, onLeft, onChanged, onOpenLetter }: {
  guild: GuildDetail; summary?: GuildSummary; onLeft: () => void; onChanged: () => void; onOpenLetter: () => void;
}) {
  const me = useAuthStore((s) => s.user);
  const wide = useMediaQuery('(min-width: 1024px)');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(guild.photoUrl ?? null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [wall, setWall] = useState<GuildMessage[]>([]);

  const em = emblemOf(guild.emblem);
  const myId = String(me?.id);
  // Cualquiera del gremio puede cambiar su nombre, descripción, emblema y foto.
  const canEdit = guild.members.some((m) => m.userId === myId);
  useEffect(() => { setPhoto(guild.photoUrl ?? null); }, [guild.photoUrl]);
  const snapped = new Set(guild.today.snappedUserIds);
  const mineToday = snapped.has(myId);
  const snapPct = guild.members.length ? Math.round((snapped.size / guild.members.length) * 100) : 0;

  // Muro de hoy: solo se mira la carta (no se da por leída) cuando cambian las fotos de hoy.
  useEffect(() => {
    let alive = true;
    peekGuildMessages(guild.id)
      .then((list) => { if (alive) setWall(list.filter((m) => m.kind === 'SNAP' && m.media.photo && m.dayKey === guild.today.day)); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [guild.id, guild.today.day, snapped.size]);

  async function savePhoto(url: string | null) {
    try {
      const res = await updateGuild(guild.id, { photoUrl: url });
      setPhoto(res.photoUrl);
      onChanged();
      toaster().success(url ? 'Foto del gremio actualizada' : 'Foto del gremio quitada');
    } catch (e) {
      toaster().error(errMsg(e));
      throw e;
    }
  }
  const members = [...guild.members].sort((a, b) => Number(snapped.has(b.userId)) - Number(snapped.has(a.userId)) || (b.user.xp ?? 0) - (a.user.xp ?? 0));
  const maxXp = Math.max(1, ...members.map((m) => m.user.xp ?? 0));
  const [prevFire] = useState(() => readFire(guild.id));
  useEffect(() => {
    try { localStorage.setItem(FIRE_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(FIRE_KEY) || '{}'), [guild.id]: snapPct })); } catch { /* sin almacenamiento */ }
  }, [guild.id, snapPct]);

  async function copy() {
    try { await navigator.clipboard.writeText(guild.inviteCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { toaster().error('No se pudo copiar'); }
  }
  async function sendSnap(photoUrl: string, caption: string) {
    try {
      const thumb = await thumbOf(photoUrl);
      const r = await postGuildSnap(guild.id, photoUrl, caption, thumb ? { thumb } : undefined);
      toaster().success(r.enemyDefeated ? `¡${guild.today.enemy.name} cayó!` : mineToday ? 'Foto pegada en la carta del gremio' : `Le quitaste ${ENEMY_HIT} HP a ${guild.today.enemy.name}`);
      onChanged();
    } catch (e) { toaster().error(apiError(e, 'No se pudo enviar la foto')); }
  }
  async function leave() {
    setLeaving(true);
    try { await leaveGuild(guild.id); onLeft(); }
    catch (e) { toaster().error(errMsg(e)); setLeaving(false); }
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-10">
      <motion.div variants={item} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-6 md:gap-8">
          <motion.span variants={pop3} initial="initial" animate="animate" className="relative">
            <GuildCrest photoUrl={photo} emblem={em.icon} tone={em.tone} name={guild.name} className="size-20 rounded-[28px] md:size-24 md:rounded-[32px]" />
            {canEdit && <CrestEditButton onClick={() => setPhotoOpen(true)} label={photo ? 'Cambiar la foto del gremio' : 'Poner una foto al gremio'} />}
          </motion.span>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            <span className="text-label-lg text-primary-text">Gremio · nivel <span className="font-mono">{guild.level}</span></span>
            <h2 className="text-display-sm md:text-display-md"><Lettering text={guild.name} /></h2>
            {guild.description && <p className="text-body-md text-on-surface-light">{guild.description}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Badge size="lg" icon={Users}><span className="font-mono">{guild.members.length}/{MAX_MEMBERS}</span> aventureros</Badge>
              {canEdit && <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}><Pencil aria-hidden className="size-4" />Editar gremio</Button>}
              {isLit(guild.streak) && <Badge size="lg" variant="warning"><StreakFlame streak={guild.streak} size="sm" label={`Racha del gremio: ${guild.streak.count} días`} /> racha del gremio</Badge>}
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
        <Campfire
          campers={members.map((m) => ({
            id: m.id, name: m.user.displayName.split(' ')[0], lead: m.userId === guild.leaderId, you: m.userId === myId,
            avatar: (size: number) => <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} size={size} animate="none" className="rounded-full" />,
          }))}
          progress={snapPct} prevProgress={prevFire} emblem={em.icon} emblemTone={em.tone} photoUrl={photo}
        />
        {!wide && <GuildLetterEnvelope summary={summary} onOpen={onOpenLetter} />}
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-6">
          <motion.div variants={item}>
            <Card padding="lg">
              <BossBar
                eyebrow="Enemigo del día" name={guild.today.enemy.name} icon={Swords} hp={guild.today.enemy.hp} maxHp={guild.today.enemy.maxHp}
                note={guild.today.enemy.defeated
                  ? 'Todos enviaron una foto hoy: el enemigo cayó y el gremio ganó experiencia. Mañana llega otro.'
                  : `La primera foto de hoy de cada miembro, tomada con la cámara, le quita ${ENEMY_HIT} HP. Si todos envían la suya, cae.`}
                aside={<Badge variant={guild.today.enemy.defeated ? 'success' : 'neutral'}><span className="font-mono">{snapped.size}/{guild.members.length}</span> fotos</Badge>}
                action={mineToday
                  ? <p className="flex items-center gap-2 text-label-lg text-success-text"><CheckCheck aria-hidden className="size-5" />Tu foto de hoy ya golpeó</p>
                  : <Button className="self-start" onClick={() => setCamera(true)}><Camera aria-hidden className="size-4" strokeWidth={1.75} />Tomar foto y atacar</Button>}
              />
            </Card>
          </motion.div>

          {wall.length > 0 && (
            <motion.div variants={item}>
              <Card padding="lg" className="flex flex-col gap-4">
                <h3 className="text-heading-sm">Muro de hoy</h3>
                <ul className="flex gap-5 overflow-x-auto px-1 pb-3 pt-4">
                  {wall.map((m, i) => (
                    <motion.li key={m.id} className="w-40 shrink-0" initial={{ opacity: 0, y: -20, rotate: 0 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springs.heavy, delay: i * 0.08 }}>
                      <WallPhoto m={m} tilt={((i % 3) - 1) * 2.5} mine={m.userId === myId} />
                      <p className="mt-2 truncate text-center text-body-sm text-on-surface-light">{m.userId === myId ? 'Tú' : m.user.displayName.split(' ')[0]}</p>
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col gap-2">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-heading-sm">Miembros</h3><span className="text-body-sm text-on-surface-light">Foto de hoy · XP</span></div>
              <motion.ol variants={stagger} initial="initial" animate="animate" className="flex flex-col">
                {members.map((m, i) => {
                  const lead = m.userId === guild.leaderId;
                  const you = m.userId === myId;
                  const did = snapped.has(m.userId);
                  return (
                    <motion.li key={m.id} variants={item} layout="position" className={cn('flex min-h-[60px] flex-wrap items-center gap-3 py-2 sm:flex-nowrap sm:gap-4', i < members.length - 1 && 'border-b border-border')}>
                      <Link to={`/u/${encodeURIComponent(m.user.username)}`} className="shrink-0" aria-label={`Ver el DNI de ${m.user.displayName}`}>
                        <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} equippedAura={m.user.equippedAura} equippedFrame={m.user.equippedFrame} size={40} animate="none" className="overflow-hidden rounded-full" />
                      </Link>
                      <div className="min-w-0 flex-1 sm:flex-[0_0_200px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-label-lg">{m.user.displayName}</span>
                          {lead && <Badge variant="warning" icon={Crown}>Líder</Badge>}
                          {you && <Badge variant="primary">Tú</Badge>}
                        </div>
                        <div className="text-body-sm text-on-surface-light">Nivel <span className="font-mono">{m.user.level}</span> · <Flame aria-hidden className="inline size-3.5 text-warning-text" /> <span className="font-mono">{m.user.currentStreak ?? 0}</span> días</div>
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

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          {wide && (
            <motion.div variants={item}>
              <GuildLetter guildId={guild.id} guild={guild} reloadGuild={onChanged} onActivity={onChanged} showGuildLink={false} className="h-[600px]" />
            </motion.div>
          )}
          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col items-center gap-3 text-center">
              <h3 className="self-start text-heading-sm">Fotos de hoy</h3>
              <ProgressRing value={snapPct} tone="success" size={160} stroke={9} label="Miembros que enviaron una foto hoy" valueText={`${snapPct}%`}>
                <span className="font-mono text-display-sm tabular-nums">{snapped.size}/{guild.members.length}</span>
                <span className="text-body-sm text-on-surface-light">enviadas</span>
              </ProgressRing>
              <p className="text-body-sm text-on-surface-light">
                {isLit(guild.streak)
                  ? `Racha del gremio: ${guild.streak.count} días (mejor: ${guild.streak.best}).`
                  : 'Si todos escriben en la carta tres días seguidos, se enciende la racha del gremio.'}
              </p>
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
      <InstantCamera open={camera} onClose={() => setCamera(false)} to={guild.name} cameraOnly onSend={(p, c) => void sendSnap(p, c)} />
      <GuildEditDialog open={editOpen} guild={{ ...guild, photoUrl: photo }} onClose={() => setEditOpen(false)} onSaved={(g) => { setPhoto(g.photoUrl ?? null); onChanged(); }} />
      <InviteFriends open={inviteOpen} onClose={() => setInviteOpen(false)} guild={guild} />
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="¿Salir del gremio?">
        <p className="text-body-md text-on-surface">Dejarás de ver su carta y de aportar al enemigo del día de {guild.name}. Podrás volver con el código.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirmLeave(false)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={leaving} onClick={leave}>Salir</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

/** Tus gremios como pestañas: su foto, la racha encendida y las cartas sin leer. */
function GuildSwitcher({ guilds, active, onPick }: { guilds: GuildSummary[]; active: string | null; onPick: (id: string | null) => void }) {
  return (
    <nav aria-label="Tus gremios" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2 pb-1 pt-2">
        {guilds.map((g) => {
          const em = emblemOf(g.emblem);
          const on = g.id === active;
          return (
            <li key={g.id} className="shrink-0">
              <button
                type="button" onClick={() => onPick(g.id)} aria-current={on ? 'page' : undefined}
                className={cn('relative flex min-h-12 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 transition-colors',
                  on ? 'border-primary bg-primary/[var(--lq-soft-alpha)]' : 'border-border bg-surface hover:border-primary/40')}
              >
                <GuildCrest photoUrl={g.photoUrl} emblem={em.icon} tone={em.tone} name={g.name} halo={false} className="size-9 rounded-full [&>svg]:size-4" />
                <span className="max-w-[160px] truncate text-label-lg">{g.name}</span>
                <StreakFlame streak={g.streak} size="sm" />
                {g.unread > 0 && (
                  <span className="lq-wax absolute -right-1.5 -top-2 flex size-6 items-center justify-center font-mono text-[0.68rem]">{g.unread > 9 ? '9+' : g.unread}<span className="sr-only"> sin leer</span></span>
                )}
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
    </nav>
  );
}

/** Invitaciones a gremios que trajo la paloma. */
function InvitesBanner({ invites, onAnswered }: { invites: GuildInvite[]; onAnswered: (guildId: string | null) => void }) {
  const [gone, setGone] = useState<string[]>([]);
  async function answer(inv: GuildInvite, accept: boolean) {
    setGone((g) => [...g, inv.id]);
    try { const r = await respondGuildInvite(inv.id, accept); if (accept) toaster().success(`Te uniste a ${inv.guild.name}`); onAnswered(accept ? r.guildId : null); }
    catch (e) { setGone((g) => g.filter((x) => x !== inv.id)); toaster().error(apiError(e, 'No se pudo responder')); }
  }
  const list = invites.filter((i) => !gone.includes(i.id));
  return (
    <AnimatePresence initial={false}>
      {list.map((inv) => (
        <motion.div key={inv.id} layout initial={{ opacity: 0, y: -14, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, x: 40, rotate: 4, transition: { duration: 0.2 } }} transition={springs.heavy}
          className="lq-pigeon-note relative mt-6 flex flex-wrap items-center gap-3 p-3 md:p-4">
          <Pigeon className="pointer-events-none absolute -top-8 right-12 h-10 w-14" />
          <GuildCrest photoUrl={inv.guild.photoUrl} emblem={emblemOf(inv.guild.emblem).icon} tone={emblemOf(inv.guild.emblem).tone} name={inv.guild.name} halo={false} className="size-12 rounded-2xl [&>svg]:size-6" />
          <p className="min-w-0 flex-[1_1_200px] text-body-md"><b>{inv.inviter.displayName}</b> te envió una paloma: te invita a <b>{inv.guild.name}</b> · <span className="font-mono">{inv.guild._count.members}</span> miembros</p>
          <Button variant="ghost" size="sm" onClick={() => void answer(inv, false)}>Ahora no</Button>
          <Button size="sm" onClick={() => void answer(inv, true)}>Unirme</Button>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export interface GuildRoomProps {
  guilds: GuildSummary[] | null;
  invites: GuildInvite[];
  error?: boolean;
  /** Gremio elegido (URL); null = crear o unirse; undefined = el primero. */
  activeId: string | null | undefined;
  /** null = crear o unirse · undefined = el primero de la lista. */
  onPick: (id: string | null | undefined) => void;
  onListChanged: () => void;
  onOpenLetter: (guildId: string) => void;
  onRetry: () => void;
}

export function GuildRoom({ guilds, invites, error, activeId, onPick, onListChanged, onOpenLetter, onRetry }: GuildRoomProps) {
  const [guild, setGuild] = useState<GuildDetail | null>(null);
  const active = activeId === undefined ? guilds?.[0]?.id ?? null : activeId && guilds?.some((g) => g.id === activeId) ? activeId : activeId === null ? null : guilds?.[0]?.id ?? null;
  const pickLast = useRef(false);

  const loadGuild = useCallback(async (id: string) => {
    try { setGuild(await getGuild(id)); }
    catch { setGuild(null); }
  }, []);
  useEffect(() => { if (active) void loadGuild(active); else setGuild(null); }, [active, loadGuild]);
  // Si se entró a un gremio nuevo, se abre ese.
  useEffect(() => {
    if (pickLast.current && guilds?.length) { pickLast.current = false; onPick(guilds[guilds.length - 1].id); }
  }, [guilds, onPick]);
  const refresh = useCallback(() => { if (active) void loadGuild(active); onListChanged(); }, [active, loadGuild, onListChanged]);

  if (error) return <ErrorState onRetry={onRetry} />;
  if (guilds === null) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      {invites.length > 0 && <div className="flex flex-col gap-3"><InvitesBanner invites={invites} onAnswered={(id) => { onListChanged(); if (id) onPick(id); }} /></div>}
      {guilds.length > 0 && <GuildSwitcher guilds={guilds} active={active} onPick={onPick} />}
      <AnimatePresence mode="wait">
        {active && guild && guild.id === active ? (
          <motion.div key={guild.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={springs.natural}>
            <InGuild
              guild={guild} summary={guilds.find((g) => g.id === guild.id)} onChanged={refresh} onOpenLetter={() => onOpenLetter(guild.id)}
              onLeft={() => { toaster().info('Saliste del gremio'); onPick(undefined); onListChanged(); }}
            />
          </motion.div>
        ) : active ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><PageLoader size="sm" /></motion.div>
        ) : (
          <motion.div key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.natural}>
            <NoGuild hasGuilds={guilds.length > 0} onEntered={(msg) => { toaster().success(msg); pickLast.current = true; onListChanged(); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
