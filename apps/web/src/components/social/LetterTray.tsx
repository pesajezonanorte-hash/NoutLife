// La bandeja de cartas: cada conversación (con un amigo o con un gremio) es un
// sobre de papel kraft con su estampilla (el muñequito o el emblema), el
// matasellos con la hora de lo último y, si hay cartas sin abrir, un lacre jade
// con el número. Al pasar el cursor la solapa se entreabre; al tocarlo se abre
// la carta. Ordenadas por lo más reciente.
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, NotebookTabs } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { timeAgo, type FriendItem, type GuildSummary } from '@/services/network.service';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { GuildCrest } from '@/components/guild/GuildCrest';
import { emblemOf } from '@/components/guild/emblems';
import { Lettering } from '@/components/layout/Lettering';
import { Button, Skeleton } from '@/components/ui/lq';
import { StreakFlame } from './SocialBits';

export type TrayItem =
  | { kind: 'dm'; key: string; at: string; unread: number; friend: FriendItem }
  | { kind: 'guild'; key: string; at: string; unread: number; guild: GuildSummary };

/** Hora del matasellos: la hora si es de hoy; si no, "ayer", "hace 3 días"… */
function stampTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : timeAgo(iso).replace('hace ', '');
}

export function trayItems(friends: FriendItem[] | null, guilds: GuildSummary[] | null): TrayItem[] {
  const dms: TrayItem[] = (friends ?? []).filter((f) => f.lastMessage || f.unread).map((f) => ({ kind: 'dm', key: `dm:${f.friend.id}`, at: f.lastMessage?.at ?? f.since, unread: f.unread, friend: f }));
  const gs: TrayItem[] = (guilds ?? []).map((g) => ({ kind: 'guild', key: `g:${g.id}`, at: g.lastMessage?.at ?? '', unread: g.unread, guild: g }));
  return [...dms, ...gs].sort((a, b) => b.at.localeCompare(a.at));
}

function Envelope({ item, active, index, onOpen }: { item: TrayItem; active: boolean; index: number; onOpen: () => void }) {
  const dm = item.kind === 'dm' ? item.friend : null;
  const g = item.kind === 'guild' ? item.guild : null;
  const name = dm ? dm.friend.displayName : g!.name;
  const last = dm ? dm.lastMessage : g!.lastMessage;
  const preview = last ? `${last.mine ? 'Tú: ' : g ? `${(last as GuildSummary['lastMessage'])!.author.split(' ')[0]}: ` : ''}${last.preview}` : g ? 'Todavía nadie escribió en la carta del gremio' : '';
  const em = g ? emblemOf(g.emblem) : null;
  return (
    <motion.li
      initial={{ opacity: 0, y: 14, rotate: index % 2 ? 0.8 : -0.8 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...springs.heavy, delay: Math.min(index, 8) * 0.05 }}
    >
      <button
        type="button" onClick={onOpen} aria-current={active ? 'true' : undefined}
        aria-label={`Abrir la carta ${g ? `del gremio ${name}` : `de ${name}`}${item.unread ? `, ${item.unread} sin leer` : ''}`}
        className="group block w-full text-left outline-none"
      >
        <span className="lq-envelope relative block overflow-hidden rounded-[8px]">
          <span aria-hidden="true" className="lq-envelope-folds absolute inset-0" />
          <span aria-hidden="true" className="lq-envelope-flap absolute inset-x-0 top-0 block h-[46%]" />
          <span className="relative flex min-h-[92px] items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 pt-3">
              <span className="flex items-center gap-2">
                <span className={cn('truncate text-label-lg text-on-background', item.unread > 0 && 'font-bold')}>{name}</span>
                {dm && <StreakFlame streak={dm.streak} size="sm" />}
                {g && <StreakFlame streak={g.streak} size="sm" />}
              </span>
              <span className={cn('mt-0.5 block truncate text-body-sm', item.unread ? 'text-on-background' : 'text-on-surface-light')}>{preview || 'Sin cartas todavía'}</span>
              <span className="mt-1.5 flex items-center gap-2 text-on-surface-light">
                <svg aria-hidden="true" viewBox="0 0 64 16" className="h-3.5 w-14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  {[4, 8, 12].map((y) => <path key={y} d={`M1 ${y}q4-3 8 0t8 0 8 0 8 0 8 0 8 0 8 0`} />)}
                </svg>
                {item.at && <span className="font-mono text-label-md">{stampTime(item.at)}</span>}
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
              {item.unread > 0 && (
                <motion.span
                  initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -8 }} transition={springs.snappy}
                  className="lq-wax absolute -bottom-2 -left-3 flex size-8 items-center justify-center font-mono text-label-md"
                >
                  {item.unread > 9 ? '9+' : item.unread}<span className="sr-only"> sin leer</span>
                </motion.span>
              )}
            </span>
          </span>
        </span>
      </button>
    </motion.li>
  );
}

export function LetterTray({ friends, guilds, active, onOpen, onGoNotebook }: {
  friends: FriendItem[] | null;
  guilds: GuildSummary[] | null;
  active: string | null;
  onOpen: (item: TrayItem) => void;
  onGoNotebook: () => void;
}) {
  const items = useMemo(() => trayItems(friends, guilds), [friends, guilds]);
  const unread = items.reduce((n, i) => n + i.unread, 0);
  return (
    <section aria-label="Bandeja de cartas" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading-md text-on-background"><Lettering text="buzón" /></h2>
        <span className="text-body-sm text-on-surface-light">{unread ? <><span className="font-mono">{unread}</span> sin abrir</> : 'Todo leído'}</span>
      </div>
      {friends === null || guilds === null ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[92px] rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <div className="lq-envelope flex flex-col items-start gap-3 rounded-[8px] p-5">
          <Mail aria-hidden className="size-7 text-on-surface-light" strokeWidth={1.5} />
          <p className="text-label-lg text-on-background">Tu buzón está vacío</p>
          <p className="text-body-sm text-on-surface-light">Elige a alguien de tu libreta y escríbele la primera carta.</p>
          <Button size="sm" variant="secondary" onClick={onGoNotebook}><NotebookTabs aria-hidden className="size-4" />Abrir la libreta</Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => <Envelope key={it.key} item={it} index={i} active={it.key === active} onOpen={() => onOpen(it)} />)}
        </ul>
      )}
    </section>
  );
}
