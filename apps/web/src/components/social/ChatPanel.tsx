// Conversación con un amigo: burbujas, fotos del día como polaroids, "Visto",
// presencia y la racha de los dos (cada uno envía su foto para que cuente).
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { ArrowLeft, Camera, CheckCheck, Coins, Send, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { refreshUser } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSocialStore } from '@/store/socialStore';
import {
  apiError, getConversation, reviveFriendStreak, sendMessage, timeAgo,
  type Conversation, type DM, type PublicUser,
} from '@/services/network.service';
import { Button, Input, Skeleton } from '@/components/ui/lq';
import { Polaroid, PresenceAvatar, SnapDialog, StreakFlame } from './SocialBits';

const POLL_MS = 4000;
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};
/** Inclinación estable por mensaje (las polaroids no se ven todas iguales). */
const tiltOf = (id: string) => ((id.charCodeAt(id.length - 1) % 5) - 2) * 1.2;

export function ChatPanel({ friend, onBack, onActivity, className }: {
  friend: PublicUser;
  onBack?: () => void;
  /** Avisa a la lista (último mensaje, racha) tras enviar o recibir. */
  onActivity?: () => void;
  className?: string;
}) {
  const toast = useToast();
  const reduce = useReducedMotionConfig();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [text, setText] = useState('');
  const [snapOpen, setSnapOpen] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [error, setError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | undefined>(undefined);

  const pull = useCallback(async (initial = false) => {
    try {
      const c = await getConversation(friend.id, initial ? undefined : lastAt.current);
      setConv(c);
      setError(false);
      if (initial) { setMessages(c.messages); void useSocialStore.getState().refresh(); }
      else if (c.messages.length) {
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          return [...prev.filter((m) => !m.pending), ...c.messages.filter((m) => !known.has(m.id))];
        });
        onActivity?.();
      }
      const newest = c.messages[c.messages.length - 1];
      if (newest) lastAt.current = newest.createdAt;
    } catch { if (initial) setError(true); }
  }, [friend.id, onActivity]);

  useEffect(() => {
    lastAt.current = undefined;
    setConv(null); setMessages([]);
    void pull(true);
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [pull]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [messages.length, reduce]);

  async function deliver(body: Parameters<typeof sendMessage>[1], optimistic: DM) {
    setMessages((p) => [...p, optimistic]);
    try {
      const r = await sendMessage(friend.id, body);
      lastAt.current = r.message.createdAt;
      setMessages((p) => p.map((m) => (m.id === optimistic.id ? r.message : m)));
      setConv((c) => (c ? { ...c, streak: { ...c.streak, ...r.streak, mineToday: c.streak.mineToday || body.kind === 'SNAP', theirsToday: c.streak.theirsToday } } : c));
      if (r.completed) toast.success(`¡Racha de ${r.streak.count} ${r.streak.count === 1 ? 'día' : 'días'} con ${friend.displayName.split(' ')[0]}!`);
      onActivity?.();
    } catch (e) {
      setMessages((p) => p.filter((m) => m.id !== optimistic.id));
      throw new Error(apiError(e, 'No se pudo enviar'));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      await deliver({ content }, { id: `tmp-${Date.now()}`, mine: true, kind: 'TEXT', content, photoUrl: null, habitTitle: null, createdAt: new Date().toISOString(), pending: true });
    } catch (err) { setText(content); toast.error((err as Error).message); }
  }

  async function sendSnap(photoUrl: string, habitTitle: string | null, caption: string) {
    await deliver(
      { kind: 'SNAP', photoUrl, habitTitle: habitTitle ?? undefined, content: caption || undefined },
      { id: `tmp-${Date.now()}`, mine: true, kind: 'SNAP', content: caption || null, photoUrl, habitTitle, createdAt: new Date().toISOString(), pending: true },
    );
  }

  async function revive() {
    if (!conv) return;
    setReviving(true);
    try {
      const r = await reviveFriendStreak(conv.friendshipId);
      setConv({ ...conv, streak: { ...conv.streak, ...r.streak } });
      toast.success('La racha volvió a encenderse');
      void refreshUser();
      onActivity?.();
    } catch (e) { toast.error(apiError(e, 'No se pudo revivir la racha')); }
    finally { setReviving(false); }
  }

  const presence = conv?.friend;
  const streak = conv?.streak;
  const first = friend.displayName.split(' ')[0];
  const seenUntil = conv?.seenUntil ? new Date(conv.seenUntil).getTime() : 0;
  const lastMine = [...messages].reverse().find((m) => m.mine && !m.pending);

  return (
    <section aria-label={`Conversación con ${friend.displayName}`} className={cn('flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-surface', className)}>
      <header className="flex items-center gap-3 border-b border-border px-3 py-3 md:px-5">
        {onBack && (
          <Button variant="icon" aria-label="Volver a tus amigos" onClick={onBack} className="-ml-1 md:hidden"><ArrowLeft aria-hidden className="size-5" /></Button>
        )}
        <PresenceAvatar user={friend} online={presence?.online} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-lg">{friend.displayName}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={presence ? `${presence.online}-${presence.zone}` : 'loading'}
              initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
              className={cn('truncate text-body-sm', presence?.online ? 'text-success-text' : 'text-on-surface-light')}
            >
              {!presence ? '…' : presence.online ? (presence.zone ? `En línea · en ${presence.zone}` : 'En línea') : presence.lastSeen ? `Activo ${timeAgo(presence.lastSeen)}` : `@${friend.username}`}
            </motion.p>
          </AnimatePresence>
        </div>
        {streak && <StreakFlame streak={streak} size="md" />}
        <Link to={`/u/${encodeURIComponent(friend.username)}`} aria-label={`Ver el perfil de ${friend.displayName}`} className="inline-flex size-11 items-center justify-center rounded-full text-on-surface hover:bg-background">
          <UserRound aria-hidden className="size-5" strokeWidth={1.75} />
        </Link>
      </header>

      {/* La racha de hoy: cada uno pone su foto y el día cuenta. */}
      {streak && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-warning/[var(--lq-soft-alpha)] px-4 py-2.5 text-body-sm md:px-5">
          {streak.revivable && !streak.alive ? (
            <>
              <span className="min-w-0 flex-1 text-on-surface">Su racha de <b className="font-mono">{streak.lost}</b> días se apagó hace poco. Todavía pueden recuperarla.</span>
              <Button size="sm" variant="secondary" loading={reviving} onClick={() => void revive()}><Coins aria-hidden className="size-4" />Revivir · {streak.reviveCost}</Button>
            </>
          ) : (
            <>
              <SnapCheck done={Boolean(streak.mineToday)} label="Tú" />
              <SnapCheck done={Boolean(streak.theirsToday)} label={first} />
              <span className="min-w-0 flex-1 text-on-surface-light">
                {streak.mineToday && streak.theirsToday ? 'Hoy ya cuenta. ¡Nos vemos mañana!' : streak.mineToday ? `Falta la foto de ${first}.` : 'Envía tu foto del día para la racha.'}
              </span>
            </>
          )}
        </div>
      )}

      <div ref={listRef} role="log" aria-live="polite" aria-label="Mensajes" className="flex min-h-[280px] flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 py-4 md:px-5">
        {error ? (
          <p className="m-auto text-body-sm text-on-surface-light">No pudimos cargar la conversación.</p>
        ) : !conv ? (
          <div className="flex flex-col gap-3"><Skeleton className="h-10 w-2/3 rounded-2xl" /><Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" /><Skeleton className="h-40 w-40 rounded-xl" /></div>
        ) : messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springs.gentle} className="m-auto flex max-w-[300px] flex-col items-center gap-2 text-center">
            <PresenceAvatar user={friend} size={64} />
            <p className="text-label-lg">Empieza la conversación</p>
            <p className="text-body-sm text-on-surface-light">Un saludo o tu primera foto del día. Si los dos envían una cada día, nace su racha.</p>
          </motion.div>
        ) : messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const seen = m.mine && !m.pending && new Date(m.createdAt).getTime() <= seenUntil;
          return (
            <div key={m.id} className="flex flex-col">
              {newDay && <p className="my-3 self-center rounded-full bg-background px-3 py-1 text-body-sm capitalize text-on-surface-light">{dayLabel(m.createdAt)}</p>}
              <motion.div
                layout="position"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: m.pending ? 0.6 : 1, y: 0, scale: 1 }}
                transition={springs.natural}
                className={cn('flex max-w-[82%] flex-col gap-1', m.mine ? 'items-end self-end' : 'items-start self-start')}
              >
                {m.kind === 'SNAP' && m.photoUrl ? (
                  <Polaroid src={m.photoUrl} tilt={tiltOf(m.id)} className="w-[min(230px,64vw)]">
                    <span className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 text-label-md text-warning-text"><Camera aria-hidden className="size-3.5" />Foto del día{m.habitTitle ? ` · ${m.habitTitle}` : ''}</span>
                      {m.content && <span>{m.content}</span>}
                    </span>
                  </Polaroid>
                ) : (
                  <p className={cn('whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-body-md',
                    m.mine ? 'rounded-br-md bg-primary-strong text-on-primary' : 'rounded-bl-md bg-background text-on-background')}
                  >
                    {m.photoUrl && <img src={m.photoUrl} alt="" className="mb-1.5 max-h-64 rounded-xl object-cover" />}
                    {m.content}
                  </p>
                )}
                <span className="flex items-center gap-1 px-1 text-[0.75rem] text-on-surface-light">
                  {time(m.createdAt)}
                  {m.id === lastMine?.id && (
                    <AnimatePresence>
                      {seen && (
                        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="inline-flex items-center gap-0.5 text-info-text">
                          <CheckCheck aria-hidden className="size-3.5" />Visto
                        </motion.span>
                      )}
                    </AnimatePresence>
                  )}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
        <Button
          type="button" variant={streak && !streak.mineToday ? 'primary' : 'secondary'} aria-label="Enviar tu foto del día"
          onClick={() => setSnapOpen(true)} className="size-12 shrink-0 rounded-full p-0"
        >
          <Camera aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
        <label htmlFor="dm-input" className="sr-only">Mensaje para {friend.displayName}</label>
        <Input id="dm-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Escribe a ${first}…`} maxLength={1000} autoComplete="off" />
        <Button type="submit" variant="icon" aria-label="Enviar mensaje" disabled={!text.trim()} className="size-12 shrink-0 bg-primary-strong text-on-primary">
          <Send aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      </form>

      <SnapDialog
        open={snapOpen} onClose={() => setSnapOpen(false)}
        hint={`Muéstrale a ${first} un hábito de hoy. Cuando los dos envían su foto, la racha suma un día.`}
        onSend={sendSnap}
      />
    </section>
  );
}

function SnapCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-label-md', done ? 'text-success-text' : 'text-on-surface-light')}>
      <motion.span
        aria-hidden
        animate={{ scale: done ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.4 }}
        className={cn('flex size-5 items-center justify-center rounded-full border-2', done ? 'border-success bg-success text-on-success' : 'border-border-strong')}
      >
        {done && <CheckCheck className="size-3" strokeWidth={2.5} />}
      </motion.span>
      {label}
      <span className="sr-only">{done ? 'ya envió su foto' : 'aún no envía su foto'}</span>
    </span>
  );
}
