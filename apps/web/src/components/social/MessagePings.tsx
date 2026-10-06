// Avisos de mensajes dentro de la app, en vivo. Una petición larga con la API
// responde en cuanto alguien te escribe (a ti o a un gremio) y el aviso cae como
// un sobre: se responde ahí mismo, sin abrir la carta, o se toca para entrar a
// ella de una. Si ya tienes abierta esa misma carta no sale nada (ya la estás
// viendo), y mientras la app está a la vista no llega además el aviso del sistema.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useToastStore } from '@/hooks/useToast';
import { useMotionStore } from '@/store/motionStore';
import { useAuthStore } from '@/store/authStore';
import { useChatFocus } from '@/store/chatFocusStore';
import { useSocialStore } from '@/store/socialStore';
import { apiError, getConversation, getInbox, postGuildText, sendMessage, socialLink, type InboxItem } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';

interface Ping {
  /** "dm:<amigo>" | "guild:<gremio>": avisos de la misma carta se juntan en uno. */
  key: string;
  /** El último mensaje recibido (a él se responde). */
  last: InboxItem;
  count: number;
}

const visible = () => document.visibilityState === 'visible';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_PINGS = 3;
const SHOW_MS = 10_000;

const keyOf = (i: InboxItem) => (i.type === 'guild' && i.guild ? `guild:${i.guild.id}` : `dm:${i.from.id}`);
const linkOf = (i: InboxItem) => (i.type === 'guild' && i.guild ? socialLink.guildLetter(i.guild.id) : socialLink.letter(i.from.username));

function PingCard({ ping, onClose, onOpen }: { ping: Ping; onClose: () => void; onOpen: () => void }) {
  const reduce = useMotionStore((s) => s.reduce);
  const { last } = ping;
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [held, setHeld] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const from = last.from.displayName.split(' ')[0];
  const title = last.type === 'guild' && last.guild ? `${from} · ${last.guild.name}` : last.from.displayName;

  // Se va solo a los 10 s, salvo que lo estés leyendo o escribiendo (cursor encima o foco dentro).
  useEffect(() => {
    if (held || state !== 'idle') return;
    const t = window.setTimeout(onClose, SHOW_MS);
    return () => window.clearTimeout(t);
  }, [held, state, onClose, ping.count, last.id]);

  async function reply(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || state !== 'idle') return;
    setState('sending');
    try {
      if (last.type === 'guild' && last.guild) await postGuildText(last.guild.id, content, last.id);
      else {
        await sendMessage(last.from.id, { content, replyToId: last.id });
        // Responder es haberla leído: se marca como leída sin abrirla.
        void getConversation(last.from.id, new Date().toISOString()).catch(() => undefined);
      }
      setState('sent');
      void useSocialStore.getState().refresh();
      window.setTimeout(onClose, 1300);
    } catch (err) {
      setState('idle');
      input.current?.focus();
      useToastStore.getState().error(apiError(err, 'No se pudo enviar'));
    }
  }

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -28, rotate: -2.5, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.18 } }}
      transition={springs.natural}
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)} onBlurCapture={() => setHeld(false)}
      className="lq-ping pointer-events-auto relative overflow-hidden"
    >
      <button type="button" onClick={onOpen} aria-label={`Abrir la carta de ${title}`} className="flex w-full items-start gap-3 p-3 pr-11 text-left">
        <span className="relative mt-0.5 inline-flex size-10 shrink-0">
          <AvatarDisplay avatarConfig={last.from.avatarConfig} avatarUrl={last.from.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
          {ping.count > 1 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error-text px-1 font-mono text-[0.65rem] text-background">{ping.count}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-lg text-on-background">{title}</span>
          <span className="line-clamp-2 block break-words text-body-md text-on-surface">{last.preview || 'Te escribió'}</span>
        </span>
      </button>
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full text-on-surface-light hover:bg-background hover:text-on-background">
        <X aria-hidden className="size-4" />
      </button>
      <form onSubmit={reply} className="flex items-center gap-2 border-t border-border/70 px-3 pb-2.5 pt-2">
        <label className="sr-only" htmlFor={`ping-${ping.key}`}>Responder a {from}</label>
        <input
          ref={input} id={`ping-${ping.key}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={last.type === 'guild' ? 500 : 1000}
          placeholder={`Responder a ${from}…`} autoComplete="off" enterKeyHint="send" disabled={state !== 'idle'}
          className="lq-pen-line min-h-10 min-w-0 flex-1 px-1 text-body-md text-on-background placeholder:text-on-surface-light/80"
        />
        <button
          type="submit" aria-label="Enviar respuesta" disabled={!text.trim() || state !== 'idle'}
          className={cn('lq-wax flex size-10 shrink-0 items-center justify-center transition-opacity disabled:cursor-not-allowed', state === 'idle' && 'disabled:opacity-40')}
        >
          {state === 'sent' ? <Check aria-hidden className="size-4" strokeWidth={2.2} /> : <Send aria-hidden className="size-4" strokeWidth={1.75} />}
        </button>
      </form>
    </motion.li>
  );
}

export function MessagePings() {
  const userId = useAuthStore((s) => s.user?.id);
  const navigate = useNavigate();
  const [pings, setPings] = useState<Ping[]>([]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const ctl = new AbortController();
    const seen = new Set<string>();
    let cursor: string | undefined;

    const arrive = (items: InboxItem[]) => {
      const fresh = items.filter((i) => !seen.has(i.id));
      fresh.forEach((i) => seen.add(i.id));
      if (!fresh.length) return;
      void useSocialStore.getState().refresh();
      const focused = useChatFocus.getState().key;
      const toShow = fresh.filter((i) => keyOf(i) !== focused);
      if (!toShow.length) return;
      setPings((list) => {
        let next = list;
        for (const i of toShow) {
          const key = keyOf(i);
          const found = next.find((p) => p.key === key);
          next = found
            ? next.map((p) => (p.key === key ? { ...p, last: i, count: p.count + 1 } : p))
            : [...next, { key, last: i, count: 1 }];
        }
        return next.slice(-MAX_PINGS);
      });
    };

    const run = async () => {
      while (alive) {
        if (!visible()) {
          await new Promise<void>((resolve) => {
            const done = () => { document.removeEventListener('visibilitychange', check); ctl.signal.removeEventListener('abort', done); resolve(); };
            const check = () => { if (visible()) done(); };
            document.addEventListener('visibilitychange', check);
            ctl.signal.addEventListener('abort', done);
          });
          continue;
        }
        try {
          const r = await getInbox(cursor, ctl.signal);
          if (!alive) return;
          cursor = r.cursor;
          if (r.items.length) arrive(r.items);
        } catch {
          if (!alive || ctl.signal.aborted) return;
          await sleep(4000);
        }
      }
    };
    void run();
    return () => { alive = false; ctl.abort(); };
  }, [userId]);

  // Si abres la carta de un aviso que sigue a la vista, el aviso sobra.
  const focused = useChatFocus((s) => s.key);
  useEffect(() => {
    if (focused) setPings((list) => (list.some((p) => p.key === focused) ? list.filter((p) => p.key !== focused) : list));
  }, [focused]);

  const close = (key: string) => setPings((list) => list.filter((p) => p.key !== key));

  return (
    <ul
      aria-label="Mensajes nuevos" aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[85] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-[4.5rem] sm:w-[360px]"
    >
      <AnimatePresence initial={false}>
        {pings.map((p) => (
          <PingCard
            key={p.key} ping={p} onClose={() => close(p.key)}
            onOpen={() => { navigate(linkOf(p.last)); close(p.key); }}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
