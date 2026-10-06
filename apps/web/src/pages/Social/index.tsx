// Social: amigos, cartas y gremios en un mismo sitio, para llegar rápido y
// moverse entre ellos sin salir. Tres pestañas, cada una con su ambiente:
//   Libreta  · tus amigos anotados en una agenda de direcciones, bajo la luz
//              cálida de una lámpara de escritorio.
//   Cartas   · el buzón con todas las conversaciones (amigos y gremios) como
//              sobres, junto a una ventana.
//   Gremios  · tus grupos alrededor de la fogata.
// Al tocar a alguien (o un sobre) se abre su carta: al lado en escritorio y a
// pantalla completa en el móvil, como una carta que se saca del sobre. La URL
// guarda la pestaña y la carta abierta (?tab=…&chat=usuario | gchat=gremio |
// guild=gremio), así que atrás cierra la carta y los avisos llevan directo.
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, NotebookTabs, PenLine, Send, Tent, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useSocialStore } from '@/store/socialStore';
import {
  getGuildInvites, getMyGuilds, getNetwork, getPendingRequests,
  type FriendItem, type GuildInvite, type GuildSummary, type PendingRequest,
} from '@/services/network.service';
import { AmbientLight, Particles, SketchUnderline, ZoneShell } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { Button } from '@/components/ui/lq';
import { Notebook } from '@/components/social/Notebook';
import { LetterTray, type TrayItem } from '@/components/social/LetterTray';
import { GuildRoom } from '@/components/social/GuildRoom';
import { DirectLetter, GuildLetter } from '@/components/social/letters/LetterView';

type Tab = 'amigos' | 'cartas' | 'gremios';
const TABS: Array<{ id: Tab; label: string; title: string; icon: LucideIcon; sub: string }> = [
  { id: 'amigos', label: 'Libreta', title: 'libreta', icon: NotebookTabs, sub: 'Tus amigos anotados a mano. Toca a alguien para escribirle.' },
  { id: 'cartas', label: 'Cartas', title: 'cartas', icon: Mail, sub: 'Todas tus conversaciones, con amigos y con tus gremios.' },
  { id: 'gremios', label: 'Gremios', title: 'gremios', icon: Tent, sub: 'Tus grupos: su carta, su fogata y el enemigo del día.' },
];
const LAST_TAB = 'lq-social-tab';
const readLastTab = (): Tab | null => { try { const t = localStorage.getItem(LAST_TAB); return t === 'amigos' || t === 'cartas' || t === 'gremios' ? t : null; } catch { return null; } };

/** Mientras está montado, la página de atrás no se desplaza. */
function ScrollLock() {
  useEffect(() => { lockScroll(); return unlockScroll; }, []);
  return null;
}

/** El ambiente de cada pestaña: lámpara de escritorio, ventana del buzón o fogata. */
function SocialAmbience({ tab }: { tab: Tab }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.6 } }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
        {tab === 'amigos' && (
          <>
            {/* La lámpara de escritorio: luz cálida desde arriba a la izquierda, con polvo flotando en ella */}
            <AmbientLight tone="warning" alpha={0.13} darkAlpha={0.08} d={12} className="left-[-12%] top-[-8%] h-[34rem] w-[64%]" />
            <Particles count={12} kind="drift" seed={11} x={[4, 46]} y={[4, 40]} size={[1.5, 3]} alpha={[0.25, 0.55]} duration={[14, 22]}
              render={(s) => <span className="block rounded-full bg-warning/70" style={{ width: s, height: s }} />} />
          </>
        )}
        {tab === 'cartas' && (
          <>
            {/* La ventana junto al buzón: luz fría que entra por la derecha */}
            <AmbientLight tone="info" alpha={0.1} darkAlpha={0.06} d={16} className="right-[-14%] top-[-6%] h-[32rem] w-[62%]" />
            <svg aria-hidden="true" viewBox="0 0 200 200" className="absolute right-[4%] top-[6%] size-48 -rotate-12 text-on-surface opacity-[.05] md:size-64">
              <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="4" />
              <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
              {[70, 100, 130].map((y) => <path key={y} d={`M-40 ${y}q12-9 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0 24 0`} fill="none" stroke="currentColor" strokeWidth="3" />)}
            </svg>
          </>
        )}
        {tab === 'gremios' && (
          <AmbientLight tone="warning" alpha={0.1} darkAlpha={0.07} d={6} className="lq-candle left-[20%] top-[18%] h-[30rem] w-[60%]" breathe={false} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Panel vacío de la carta (escritorio): papel en blanco con la pluma. */
function EmptyPane({ tab }: { tab: Tab }) {
  return (
    <div className="lq-stationery relative flex min-h-[460px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[22px] border border-border p-8 text-center shadow-md">
      <motion.span initial={{ rotate: -16, y: -8, opacity: 0 }} animate={{ rotate: -6, y: 0, opacity: 1 }} transition={springs.heavy}
        className="flex size-16 items-center justify-center rounded-2xl bg-warning/[var(--lq-soft-alpha)] text-warning-text">
        <PenLine aria-hidden className="size-8" strokeWidth={1.5} />
      </motion.span>
      <h2 className="text-heading-md text-on-background"><Lettering text="papel en blanco" /></h2>
      <p className="max-w-[340px] text-body-md text-on-surface-light">
        {tab === 'amigos' ? 'Elige a alguien de tu libreta para escribirle una carta.' : 'Abre un sobre del buzón para leer y responder.'}
      </p>
    </div>
  );
}

export default function SocialPage() {
  const [params, setParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const pulse = useSocialStore((s) => s.pulse);

  const chat = params.get('chat');
  const gchat = params.get('gchat');
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'amigos' || tabParam === 'cartas' || tabParam === 'gremios'
    ? tabParam
    : chat || gchat ? 'cartas' : params.get('guild') ? 'gremios' : readLastTab() ?? 'amigos';
  const guildParam = params.has('guild') ? params.get('guild') || null : undefined;
  const view = params.get('view');

  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      const [f, p, inv, g] = await Promise.all([
        getNetwork(), getPendingRequests().catch(() => []), getGuildInvites().catch(() => []), getMyGuilds().catch(() => [] as GuildSummary[]),
      ]);
      setFriends(f); setPending(p); setInvites(inv); setGuilds(g); setError(false);
    } catch { if (!silent) setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // La sección se refresca sola: presencia, rachas y cartas nuevas.
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, 20_000);
    return () => window.clearInterval(id);
  }, [load]);
  const refreshQuiet = useCallback(() => { void load(true); void useSocialStore.getState().refresh(); }, [load]);

  useEffect(() => { try { localStorage.setItem(LAST_TAB, tab); } catch { /* sin almacenamiento */ } }, [tab]);

  const setQuery = useCallback((patch: Record<string, string | null>, replace = true) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
      return next;
    }, { replace });
  }, [setParams]);

  const goTab = (t: Tab) => setQuery({ tab: t, view: null, ...(t === 'gremios' ? { chat: null, gchat: null } : {}) });
  const openDm = (username: string) => {
    setQuery({ chat: username, gchat: null }, false);
    setFriends((list) => list?.map((f) => (f.friend.username === username ? { ...f, unread: 0 } : f)) ?? list);
  };
  const openGuildLetter = (id: string) => {
    setQuery({ gchat: id, chat: null }, false);
    setGuilds((list) => list?.map((g) => (g.id === id ? { ...g, unread: 0 } : g)) ?? list);
  };
  const closeLetter = () => setQuery({ chat: null, gchat: null });
  const pickGuild = useCallback((id: string | null | undefined) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'gremios');
      if (id === undefined) next.delete('guild'); else next.set('guild', id ?? '');
      return next;
    }, { replace: true });
  }, [setParams]);

  const chatFriend = useMemo(() => friends?.find((f) => f.friend.username === chat)?.friend ?? null, [friends, chat]);
  const online = friends?.filter((f) => f.friend.online).length ?? pulse?.onlineCount ?? 0;
  const dmUnread = friends?.reduce((n, f) => n + f.unread, 0) ?? pulse?.unreadMessages ?? 0;
  const guildUnread = guilds?.reduce((n, g) => n + g.unread, 0) ?? pulse?.guildUnread ?? 0;
  const badges: Record<Tab, number> = { amigos: pending.length + invites.length, cartas: dmUnread + guildUnread, gremios: invites.length + guildUnread };
  const meta = TABS.find((t) => t.id === tab)!;
  const letterOpen = Boolean(chatFriend || gchat);
  const activeKey = chatFriend ? `dm:${chatFriend.id}` : gchat ? `g:${gchat}` : null;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length];
    goTab(next.id);
    document.getElementById(`social-tab-${next.id}`)?.focus();
  };

  const letter = chatFriend
    ? <DirectLetter key={chatFriend.id} friend={chatFriend} onActivity={refreshQuiet} onBack={isDesktop ? undefined : closeLetter} className={isDesktop ? 'h-[max(540px,calc(100dvh-15rem))]' : 'h-full rounded-none border-0 shadow-none'} />
    : gchat
      ? <GuildLetter key={gchat} guildId={gchat} onActivity={refreshQuiet} onBack={isDesktop ? undefined : closeLetter} className={isDesktop ? 'h-[max(540px,calc(100dvh-15rem))]' : 'h-full rounded-none border-0 shadow-none'} />
      : null;

  return (
    <ZoneShell zone="social" contentClassName="gap-5 md:gap-8" ambience={<SocialAmbience tab={tab} />}>
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4 pt-6 md:pt-10">
        <div className="flex min-w-0 flex-col gap-2">
          <span className={cn('text-label-lg', online ? 'text-success-text' : 'text-primary-text')}>
            {online ? `${online} ${online === 1 ? 'amigo en línea' : 'amigos en línea'}` : 'Social'}
          </span>
          <h1 className="text-display-sm md:text-display-md"><Lettering key={tab} text={meta.title} /></h1>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="max-w-[56ch] text-body-lg text-on-surface-light">
              {meta.sub}
            </motion.p>
          </AnimatePresence>
        </div>
        {tab === 'amigos' && (
          <Button variant="secondary" onClick={() => { setQuery({ view: 'search' }); document.getElementById('notebook-search')?.focus(); }}>
            <Send aria-hidden className="size-4" />Enviar paloma
          </Button>
        )}
        {tab === 'cartas' && <Button variant="secondary" onClick={() => goTab('amigos')}><PenLine aria-hidden className="size-4" />Escribir carta</Button>}
      </motion.section>

      {/* Pestañas: siempre a mano al bajar */}
      <motion.div variants={item} className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:top-16 md:mx-0 md:rounded-t-xl md:px-1">
        <div role="tablist" aria-label="Secciones de Social" className="flex">
          {TABS.map((t, i) => {
            const on = t.id === tab;
            const n = badges[t.id];
            return (
              <button
                key={t.id} id={`social-tab-${t.id}`} type="button" role="tab" aria-selected={on} aria-controls="social-panel" tabIndex={on ? 0 : -1}
                onClick={() => goTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}
                className={cn('relative flex min-h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 px-1 text-label-md transition-colors sm:gap-2 sm:px-2 sm:text-label-lg md:flex-none md:px-6',
                  on ? 'text-on-background' : 'text-on-surface-light hover:text-on-surface')}
              >
                <motion.span animate={on ? { rotate: [0, -10, 6, 0] } : { rotate: 0 }} transition={{ duration: 0.45 }} className="inline-flex shrink-0">
                  <t.icon aria-hidden className="size-5" strokeWidth={1.75} />
                </motion.span>
                <span className="truncate">{t.label}</span>
                <AnimatePresence>
                  {n > 0 && (
                    <motion.span key="n" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.snappy}
                      className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-error-text px-1 font-mono text-[0.65rem] text-background sm:h-5 sm:min-w-5">
                      {n > 9 ? '9+' : n}<span className="sr-only"> pendientes</span>
                    </motion.span>
                  )}
                </AnimatePresence>
                {on && (
                  <motion.span layoutId="social-tab-ink" aria-hidden="true" className="absolute inset-x-3 -bottom-[5px] text-primary" transition={springs.natural}>
                    <SketchUnderline delay={0.05} duration={0.4} strokeWidth={2.4} />
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      <div id="social-panel" role="tabpanel" aria-labelledby={`social-tab-${tab}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
            transition={springs.natural}
          >
            {tab === 'gremios' ? (
              <GuildRoom
                guilds={guilds} invites={invites} error={error && guilds === null} activeId={guildParam}
                onPick={pickGuild} onListChanged={refreshQuiet} onOpenLetter={openGuildLetter} onRetry={() => void load()}
              />
            ) : (
              <div className="flex flex-wrap items-start gap-6">
                <div className="min-w-0 flex-[1_1_340px] lg:max-w-[460px]">
                  {tab === 'amigos' ? (
                    <Notebook
                      friends={friends} pending={pending} invites={invites} error={error && friends === null}
                      activeUsername={chatFriend?.username ?? null} focus={view === 'requests' || view === 'search' ? view : null}
                      onOpen={openDm} onChanged={refreshQuiet} onRetry={() => void load()}
                    />
                  ) : (
                    <LetterTray
                      friends={friends} guilds={guilds} active={activeKey}
                      onOpen={(it: TrayItem) => (it.kind === 'dm' ? openDm(it.friend.friend.username) : openGuildLetter(it.guild.id))}
                      onGoNotebook={() => goTab('amigos')}
                    />
                  )}
                </div>
                {isDesktop && (
                  <div className="sticky top-36 min-w-0 flex-[2_1_480px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeKey ?? 'empty'}
                        initial={{ opacity: 0, y: 18, rotate: 0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                        transition={springs.heavy}
                      >
                        {letter ?? <EmptyPane tab={tab} />}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* En el móvil la carta sale del sobre y ocupa la pantalla (en el body, con el fondo quieto). */}
      {createPortal(
        <AnimatePresence>
          {!isDesktop && letterOpen && letter && (
            <motion.div
              key="mobile-letter"
              initial={{ y: '100%', rotate: 2 }} animate={{ y: 0, rotate: 0 }} exit={{ y: '100%', transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
              transition={springs.natural}
              className="fixed inset-0 z-[60] flex origin-bottom flex-col bg-background pt-[env(safe-area-inset-top)]"
            >
              <ScrollLock />
              {letter}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </ZoneShell>
  );
}
