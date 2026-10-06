// La bandeja de cartas: cada conversación (con un amigo o con un gremio) es un
// sobre de papel kraft con su estampilla (el muñequito o el emblema), el
// matasellos con la hora de lo último y su estado: «escribiendo…» en vivo, un
// lacre jade con las cartas sin abrir cuando te escribieron, o, si lo último es
// tuyo, enviado (✓) o visto (✓✓). Las archivadas se guardan al final. Mantener
// pulsado un sobre (o su botón ⋯) deja archivarla o eliminar el chat.
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArchiveRestore, Check, CheckCheck, ChevronDown, Eraser, Mail, MoreHorizontal, NotebookTabs } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useLive, typingIn } from '@/lib/live';
import { nameClass } from '@/lib/nameColors';
import { chatOf, timeAgo, type FriendItem, type GuildSummary } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { GuildCrest } from '@/components/guild/GuildCrest';
import { emblemOf } from '@/components/guild/emblems';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Skeleton } from '@/components/ui/lq';
import { StreakFlame } from './SocialBits';
import { TypingDots } from './letters/LetterView';

export type TrayItem =
  | { kind: 'dm'; key: string; chat: string; at: string; unread: number; archived: boolean; friend: FriendItem }
  | { kind: 'guild'; key: string; chat: string; at: string; unread: number; archived: boolean; guild: GuildSummary };

/** Hora del matasellos: la hora si es de hoy; si no, "ayer", "hace 3 días"… */
function stampTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : timeAgo(iso).replace('hace ', '');
}

export function trayItems(friends: FriendItem[] | null, guilds: GuildSummary[] | null): TrayItem[] {
  const dms: TrayItem[] = (friends ?? []).filter((f) => f.lastMessage || f.unread).map((f) => ({
    kind: 'dm', key: `dm:${f.friend.id}`, chat: chatOf.dm(f.friend.id), at: f.lastMessage?.at ?? f.since, unread: f.unread, archived: Boolean(f.archived), friend: f,
  }));
  const gs: TrayItem[] = (guilds ?? []).map((g) => ({
    kind: 'guild', key: `g:${g.id}`, chat: chatOf.guild(g.id), at: g.lastMessage?.at ?? '', unread: g.unread, archived: Boolean(g.archived), guild: g,
  }));
  return [...dms, ...gs].sort((a, b) => b.at.localeCompare(a.at));
}

function Envelope({ item, active, index, typingNames, onOpen, onMenu }: {
  item: TrayItem; active: boolean; index: number; typingNames: string[]; onOpen: () => void; onMenu: (el: HTMLElement) => void;
}) {
  const reduce = useMotionStore((s) => s.reduce);
  const timer = useRef(0);
  const dm = item.kind === 'dm' ? item.friend : null;
  const g = item.kind === 'guild' ? item.guild : null;
  const name = dm ? dm.friend.displayName : g!.name;
  const last = dm ? dm.lastMessage : g!.lastMessage;
  const em = g ? emblemOf(g.emblem) : null;
  const typing = typingNames.length > 0;
  const seen = Boolean(last?.mine && (dm ? last.seen : (g!.lastMessage?.seenBy ?? 0) > 0));
  const preview = last
    ? `${last.mine ? '' : g ? `${(last as GuildSummary['lastMessage'])!.author.split(' ')[0]}: ` : ''}${last.preview}`
    : g ? 'Todavía nadie escribió en la carta del gremio' : '';
  const status = typing ? null : item.unread > 0 ? null : last?.mine ? (seen ? 'Visto' : 'Enviado') : null;

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse') return;
    const el = e.currentTarget;
    timer.current = window.setTimeout(() => { navigator.vibrate?.(12); onMenu(el); }, 480);
  };
  const cancel = () => window.clearTimeout(timer.current);

  return (
    <motion.li
      layout={!reduce} initial={reduce ? false : { opacity: 0, y: 14, rotate: index % 2 ? 0.8 : -0.8 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
      transition={{ ...springs.heavy, delay: Math.min(index, 8) * 0.04 }}
      className="relative"
    >
      <button
        type="button" onClick={onOpen} aria-current={active ? 'true' : undefined}
        onPointerDown={down} onPointerUp={cancel} onPointerLeave={cancel} onPointerMove={(e) => { if (Math.abs(e.movementY) > 4) cancel(); }}
        onContextMenu={(e) => { e.preventDefault(); onMenu(e.currentTarget); }}
        aria-label={`Abrir la carta ${g ? `del gremio ${name}` : `de ${name}`}${item.unread ? `, ${item.unread} sin leer` : ''}${typing ? ', escribiendo' : ''}`}
        className="group block w-full text-left outline-none [-webkit-touch-callout:none]"
      >
        <span className="lq-envelope relative block overflow-hidden rounded-[8px]">
          <span aria-hidden="true" className="lq-envelope-folds absolute inset-0" />
          <span aria-hidden="true" className="lq-envelope-flap absolute inset-x-0 top-0 block h-[46%]" />
          <span className="relative flex min-h-[92px] items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 pt-3">
              <span className="flex items-center gap-2 pr-8">
                <span className={cn('truncate text-label-lg', item.unread > 0 && 'font-bold', dm ? nameClass(dm.friend.nameColor) || 'text-on-background' : 'text-on-background')}>{name}</span>
                {dm && <StreakFlame streak={dm.streak} size="sm" />}
                {g && <StreakFlame streak={g.streak} size="sm" />}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                {typing ? (
                  <motion.span key="typing" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className="mt-0.5 flex items-center gap-1.5 truncate text-body-sm text-primary-text">
                    <TypingDots />{g ? `${typingNames[0]}${typingNames.length > 1 ? ` y ${typingNames.length - 1} más` : ''} escribe…` : 'escribiendo…'}
                  </motion.span>
                ) : (
                  <motion.span key="preview" initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    className={cn('mt-0.5 flex items-center gap-1 truncate text-body-sm', item.unread ? 'font-medium text-on-background' : 'text-on-surface-light')}>
                    {last?.mine && (seen
                      ? <CheckCheck aria-hidden className="size-4 shrink-0 text-info-text" strokeWidth={2} />
                      : <Check aria-hidden className="size-4 shrink-0" strokeWidth={2} />)}
                    <span className="truncate">{preview || 'Sin cartas todavía'}</span>
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="mt-1.5 flex items-center gap-2 text-on-surface-light">
                <svg aria-hidden="true" viewBox="0 0 64 16" className="h-3.5 w-14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  {[4, 8, 12].map((y) => <path key={y} d={`M1 ${y}q4-3 8 0t8 0 8 0 8 0 8 0 8 0 8 0`} />)}
                </svg>
                {item.at && <span className="font-mono text-label-md">{stampTime(item.at)}</span>}
                {status && <span className={cn('text-label-md', seen ? 'text-info-text' : '')}>{status}{g && seen && g.lastMessage?.seenBy ? ` por ${g.lastMessage.seenBy}` : ''}</span>}
                {item.unread > 0 && <span className="text-label-md text-primary-text">{dm ? 'Te escribió' : 'Mensajes nuevos'}</span>}
              </span>
            </span>
            {/* Estampilla */}
            <span className="relative shrink-0" style={{ rotate: `${(index % 3) - 1}deg` }}>
              <span className="lq-stamp block p-[5px]">
                <span className="lq-stamp-face block">
                {dm ? (
                  <AvatarDisplay avatarConfig={dm.friend.avatarConfig} avatarUrl={dm.friend.avatarUrl} size={46} animate="none" className="[&>div]:!rounded-[2px]" />
                ) : (
                  <GuildCrest photoUrl={g!.photoUrl} emblem={em!.icon} tone={em!.tone} name={name} halo={false} className="size-[46px] rounded-[2px] [&>svg]:size-5" />
                )}
                </span>
              </span>
              {dm?.friend.online && <span className="absolute -right-1 -top-1 block size-3 rounded-full bg-success ring-2 ring-surface"><span className="sr-only">en línea</span></span>}
              <AnimatePresence>
                {item.unread > 0 && (
                  <motion.span
                    key="wax" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -8 }} exit={{ scale: 0 }} transition={springs.snappy}
                    className="lq-wax absolute -bottom-2 -left-3 flex size-8 items-center justify-center font-mono text-label-md"
                  >
                    {item.unread > 9 ? '9+' : item.unread}<span className="sr-only"> sin leer</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </span>
        </span>
      </button>
      <button
        type="button" aria-label={`Más opciones de la carta ${g ? `del gremio ${name}` : `de ${name}`}`} aria-haspopup="menu"
        onClick={(e) => onMenu(e.currentTarget)}
        className="absolute right-[4.6rem] top-2 flex size-9 items-center justify-center rounded-full text-on-surface-light opacity-70 transition-opacity hover:bg-on-background/5 hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </button>
    </motion.li>
  );
}

function TrayMenu({ item, rect, onArchive, onClear, onClose }: { item: TrayItem; rect: DOMRect; onArchive: () => void; onClear: () => void; onClose: () => void }) {
  const row = 'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-body-md hover:bg-background focus-visible:bg-background';
  const top = Math.min(rect.bottom + 4, window.innerHeight - 120);
  const left = Math.min(Math.max(8, rect.right - 232), window.innerWidth - 240);
  return (
    <>
      <div className="fixed inset-0 z-[70]" onPointerDown={onClose} aria-hidden="true" />
      <motion.div
        role="menu" initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={springs.natural}
        style={{ top, left }} className="fixed z-[71] flex w-[232px] flex-col rounded-2xl border border-border bg-surface p-1.5 shadow-lg"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <button type="button" role="menuitem" autoFocus onClick={onArchive} className={row}>
          {item.archived ? <ArchiveRestore aria-hidden className="size-4 text-on-surface-light" /> : <Archive aria-hidden className="size-4 text-on-surface-light" />}
          {item.archived ? 'Sacar del archivo' : 'Archivar carta'}
        </button>
        <button type="button" role="menuitem" onClick={onClear} className={cn(row, 'text-error-text')}>
          <Eraser aria-hidden className="size-4" />Eliminar chat
        </button>
      </motion.div>
    </>
  );
}

export function LetterTray({ friends, guilds, active, meId, onOpen, onGoDirectory, onArchive, onClear }: {
  friends: FriendItem[] | null;
  guilds: GuildSummary[] | null;
  active: string | null;
  meId: string;
  onOpen: (item: TrayItem) => void;
  onGoDirectory: () => void;
  onArchive: (item: TrayItem, archived: boolean) => void;
  onClear: (item: TrayItem) => void;
}) {
  const typing = useLive((s) => s.typing);
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<{ item: TrayItem; rect: DOMRect } | null>(null);
  const items = useMemo(() => trayItems(friends, guilds), [friends, guilds]);
  const inbox = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);
  const unread = inbox.reduce((n, i) => n + i.unread, 0);
  const archivedUnread = archived.reduce((n, i) => n + i.unread, 0);
  const namesTyping = (it: TrayItem) => typingIn(typing, it.chat)
    .filter((t) => t.userId !== meId)
    .map((t) => (it.kind === 'dm' ? it.friend.friend.displayName : t.name ?? 'Alguien').split(' ')[0]);

  const list = (rows: TrayItem[]) => (
    <ul className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {rows.map((it, i) => (
          <Envelope key={it.key} item={it} index={i} active={it.key === active} typingNames={namesTyping(it)}
            onOpen={() => onOpen(it)} onMenu={(el) => setMenu({ item: it, rect: el.getBoundingClientRect() })} />
        ))}
      </AnimatePresence>
    </ul>
  );

  return (
    <section aria-label="Bandeja de cartas" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading-md text-on-background"><Lettering text="buzón" /></h2>
        <span className="text-body-sm text-on-surface-light">{unread ? <><span className="font-mono">{unread}</span> sin abrir</> : 'Todo leído'}</span>
      </div>
      {friends === null || guilds === null ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[92px] rounded-lg" />)}</div>
      ) : inbox.length === 0 && archived.length === 0 ? (
        <div className="lq-envelope flex flex-col items-start gap-3 rounded-[8px] p-5">
          <Mail aria-hidden className="size-7 text-on-surface-light" strokeWidth={1.5} />
          <p className="text-label-lg text-on-background">Tu buzón está vacío</p>
          <p className="text-body-sm text-on-surface-light">Elige a alguien de tu directorio y escríbele la primera carta.</p>
          <Button size="sm" variant="secondary" onClick={onGoDirectory}><NotebookTabs aria-hidden className="size-4" />Abrir el directorio</Button>
        </div>
      ) : (
        <>
          {inbox.length ? list(inbox) : <p className="text-body-sm text-on-surface-light">No tienes cartas fuera del archivo.</p>}
          {archived.length > 0 && (
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}
                className="flex min-h-11 items-center gap-2 self-start rounded-full px-3 text-label-lg text-on-surface-light hover:bg-on-background/5">
                <Archive aria-hidden className="size-4" />Archivadas · <span className="font-mono">{archived.length}</span>
                {archivedUnread > 0 && <span className="rounded-full bg-primary/15 px-2 font-mono text-label-md text-primary-text">{archivedUnread}</span>}
                <ChevronDown aria-hidden className={cn('size-4 transition-transform', showArchived && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {showArchived && (
                  <motion.div key="archived" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springs.natural} className="overflow-hidden">
                    {list(archived)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
      <AnimatePresence>
        {menu && (
          <TrayMenu
            key={menu.item.key} item={menu.item} rect={menu.rect} onClose={() => setMenu(null)}
            onArchive={() => { onArchive(menu.item, !menu.item.archived); setMenu(null); }}
            onClear={() => { onClear(menu.item); setMenu(null); }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
