// Gremio (GuildDesktop). Sin gremio: crear (nombre + emblema en radiogroup) o
// unirse con un código OTP de 6 casillas. En gremio: código copiable, jefe semanal,
// miembros con aporte, meta semanal y actividad (chat del gremio).
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Check, Copy, Crown, Flame, LogIn, LogOut, PawPrint, Plus, Send, Shield, Star, Swords, Users, type LucideIcon,
} from 'lucide-react';
import { item, pop3, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { getMyGuild, createGuild, joinGuild, getGuildMessages, postGuildMessage, leaveGuild } from '@/services/social.service';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import {
  Badge, BossBar, Button, Card, ErrorState, Field, IconChip, Input, Modal, OtpInput, PageLoader, ProgressBar, ProgressRing, SpotCard, type Tone,
} from '@/components/ui/lq';

interface MemberUser {
  id: string; username: string; displayName: string; level: number; currentStreak: number; xp: number;
  avatarConfig?: unknown; avatarUrl?: string | null; equippedAura?: string | null; equippedFrame?: string | null;
}
interface Message { id: string; content: string; createdAt: string; userId: string; user: { displayName: string; avatarConfig?: unknown; avatarUrl?: string | null } }
interface Guild {
  id: string; name: string; description?: string; emblem: string; leaderId: string; level: number; xp: number; inviteCode: string;
  members: Array<{ id: string; userId: string; role: string; user: MemberUser }>;
}

const EMBLEMS: Array<{ id: string; name: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = [
  { id: 'shield', name: 'Escudo', icon: Shield, tone: 'warning' },
  { id: 'sword', name: 'Espadas', icon: Swords, tone: 'error' },
  { id: 'crown', name: 'Corona', icon: Crown, tone: 'primary' },
  { id: 'star', name: 'Estrella', icon: Star, tone: 'info' },
  { id: 'dragon', name: 'Llama', icon: Flame, tone: 'secondary' },
  { id: 'wolf', name: 'Lobo', icon: PawPrint, tone: 'success' },
];
const emblemOf = (id: string) => EMBLEMS.find((e) => e.id === id) ?? EMBLEMS[0];
const MAX_MEMBERS = 10;
const BOSS_HP = 5000;
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (e as Error)?.message ?? 'Algo salió mal';

function NoGuild({ onEntered }: { onEntered: (msg: string) => void }) {
  const [name, setName] = useState('');
  const [emblem, setEmblem] = useState('shield');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<{ create?: string; join?: string }>({});
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError({ create: 'Ponle un nombre a tu gremio' }); return; }
    setBusy('create'); setError({});
    try { await createGuild({ name: name.trim(), emblem }); onEntered('Gremio creado · eres el líder'); }
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
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Aún no tienes gremio</h1>
        <p className="max-w-[520px] text-body-lg text-on-surface-light">Crea un espacio con tu grupo o únete con un código. Juntos derrotan jefes semanales y comparten el progreso. Hasta {MAX_MEMBERS} aventureros.</p>
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
                        `${{ warning: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text', error: 'bg-error/[var(--lq-soft-alpha)] text-error-text', primary: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text', info: 'bg-info/[var(--lq-soft-alpha)] text-info-text', secondary: 'bg-secondary/[var(--lq-soft-alpha)] text-secondary-text', success: 'bg-success/[var(--lq-soft-alpha)] text-success-text' }[em.tone]}`,
                        on ? 'scale-110 border-primary' : 'border-transparent',
                      )}
                    >
                      <em.icon aria-hidden className="size-6" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Button type="submit" block loading={busy === 'create'} disabled={busy === 'join'} className="mt-auto">{busy === 'create' ? 'Creando…' : 'Crear gremio'}</Button>
          </form>
        </SpotCard>

        <SpotCard aria-labelledby="g-join" padding="md" className="md:p-8">
          <form noValidate onSubmit={join} className="flex h-full flex-col gap-4">
            <IconChip icon={LogIn} tone="secondary" />
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

function InGuild({ guild, onLeft }: { guild: Guild; onLeft: () => void }) {
  const me = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const feedRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const pull = () => getGuildMessages(guild.id).then((d) => setMessages(d as Message[])).catch(() => null);
    void pull();
    const id = window.setInterval(pull, 5000);
    return () => window.clearInterval(id);
  }, [guild.id]);
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length]);

  const em = emblemOf(guild.emblem);
  const members = [...guild.members].sort((a, b) => b.user.xp - a.user.xp);
  const maxXp = Math.max(1, ...members.map((m) => m.user.xp));
  // TODO(api): no hay jefe semanal ni XP semanal del gremio. Fallback con datos reales:
  // cada día de racha activa de un miembro le quita 50 HP al jefe.
  const damage = guild.members.reduce((s, m) => s + m.user.currentStreak * 50, 0);
  const bossHp = Math.max(0, BOSS_HP - damage);
  // TODO(api): sin meta semanal; fallback = miembros con racha activa.
  const active = guild.members.filter((m) => m.user.currentStreak > 0).length;
  const goalPct = guild.members.length ? Math.round((active / guild.members.length) * 100) : 0;

  async function copy() {
    try { await navigator.clipboard.writeText(guild.inviteCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { toast.error('No se pudo copiar'); }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    try { const m = await postGuildMessage(guild.id, content); setMessages((p) => [...p, m as Message]); }
    catch { toast.error('No se pudo enviar'); setText(content); }
  }
  async function leave() {
    setLeaving(true);
    try { await leaveGuild(guild.id); onLeft(); }
    catch (e) { toast.error(errMsg(e)); setLeaving(false); }
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <motion.div variants={item}>
        <SpotCard className="flex flex-wrap items-center gap-6 md:gap-8">
          <motion.span variants={pop3} initial="initial" animate="animate">
            <IconChip icon={em.icon} tone={em.tone} size="lg" className="lq-halo size-24 rounded-[32px] md:size-[120px] md:rounded-[36px] [&>svg]:size-12" />
          </motion.span>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            <span className="text-label-lg text-primary-text">Tu gremio · nivel {guild.level}</span>
            <h1 className="text-display-sm md:text-display-md">{guild.name}</h1>
            {guild.description && <p className="text-body-md text-on-surface-light">{guild.description}</p>}
            <div className="flex flex-wrap gap-2">
              <Badge size="lg" icon={Users}><span className="font-mono">{guild.members.length}/{MAX_MEMBERS}</span> aventureros</Badge>
              <Badge size="lg" variant="primary"><span className="font-mono">{guild.xp.toLocaleString('es-CO')}</span> XP de gremio</Badge>
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
          </Card>
        </SpotCard>
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
          <motion.div variants={item}>
            <Card padding="lg">
              <BossBar
                eyebrow="Jefe semanal" name="Titán del Sofá" icon={Swords} hp={bossHp} maxHp={BOSS_HP}
                note="Cada día de racha activa de un miembro le quita 50 HP. Mantén tus hábitos para debilitarlo."
                action={<Button className="self-start" onClick={() => navigate('/habits')}><Swords aria-hidden className="size-4" strokeWidth={1.75} />Atacar con tus hábitos de hoy</Button>}
              />
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col gap-2">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-heading-sm">Miembros</h2><span className="text-body-sm text-on-surface-light">XP total</span></div>
              <motion.ol variants={stagger} initial="initial" animate="animate" className="flex flex-col">
                {members.map((m, i) => {
                  const lead = m.userId === guild.leaderId;
                  const you = m.userId === String(me?.id);
                  return (
                    <motion.li key={m.id} variants={item} className={cn('flex min-h-[60px] flex-wrap items-center gap-3 py-2 sm:flex-nowrap sm:gap-4', i < members.length - 1 && 'border-b border-border')}>
                      <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} equippedAura={m.user.equippedAura} equippedFrame={m.user.equippedFrame} size={40} animate="none" className="shrink-0 overflow-hidden rounded-full" />
                      <div className="min-w-0 flex-1 sm:flex-[0_0_200px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-label-lg">{m.user.displayName}</span>
                          {lead && <Badge variant="warning" icon={Crown}>Líder</Badge>}
                          {you && <Badge variant="primary">Tú</Badge>}
                        </div>
                        <div className="text-body-sm text-on-surface-light">Nivel {m.user.level} · <Flame aria-hidden className="inline size-3.5 text-warning-text" /> {m.user.currentStreak} días</div>
                      </div>
                      <ProgressBar value={(m.user.xp / maxXp) * 100} className="order-last w-full sm:order-none sm:flex-1" label={`Aporte de ${m.user.displayName}`} />
                      <span className="w-20 text-right font-mono text-label-lg tabular-nums">{m.user.xp.toLocaleString('es-CO')}</span>
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
              <h2 className="self-start text-heading-sm">Meta semanal</h2>
              <ProgressRing value={goalPct} tone="success" size={168} stroke={9} label="Miembros con racha activa" valueText={`${goalPct}%`}>
                <span className="font-mono text-display-sm tabular-nums">{goalPct}%</span>
                <span className="text-body-sm text-on-surface-light">con racha</span>
              </ProgressRing>
              <p className="text-body-sm text-on-surface-light"><span className="font-mono">{active}</span> de <span className="font-mono">{guild.members.length}</span> miembros mantienen su racha.</p>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col gap-3">
              <h2 className="text-heading-sm">Actividad</h2>
              <ul ref={feedRef} aria-live="polite" className="flex max-h-80 flex-col gap-1 overflow-y-auto overscroll-contain">
                {messages.length === 0 && <li className="py-6 text-center text-body-sm text-on-surface-light">Aún no hay mensajes. ¡Saluda a tu gremio!</li>}
                {messages.map((m) => (
                  <motion.li key={m.id} variants={pop3} initial="initial" animate="animate" className="flex items-start gap-3 py-2.5">
                    <AvatarDisplay avatarConfig={m.user.avatarConfig} avatarUrl={m.user.avatarUrl} size={32} animate="none" className="shrink-0 overflow-hidden rounded-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-body-sm text-on-background"><b>{m.userId === String(me?.id) ? 'Tú' : m.user.displayName}</b> {m.content}</p>
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

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="¿Salir del gremio?">
        <p className="text-body-md text-on-surface">Dejarás de aportar al jefe semanal y de ver la actividad de {guild.name}. Podrás volver con el código.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirmLeave(false)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={leaving} onClick={leave}>Salir</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

export default function GuildPage() {
  const toast = useToast();
  const [guild, setGuild] = useState<Guild | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try { setGuild((await getMyGuild()) as Guild | null); setState('ready'); }
    catch { if (!silent) setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={() => void load()} />;

  return (
    <div className="flex flex-col gap-8">
      {guild
        ? <InGuild key={guild.id} guild={guild} onLeft={() => { toast.info('Saliste del gremio'); setGuild(null); }} />
        : <NoGuild onEntered={(msg) => { toast.success(msg); void load(true); }} />}
    </div>
  );
}

