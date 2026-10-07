// Social: el directorio, las cartas y los gremios en un mismo sitio, para llegar
// rápido y moverse entre ellos sin salir. Tres pestañas, cada una con su ambiente:
//   Directorio · tus contactos y tus gremios anotados en una agenda de
//                direcciones, bajo la luz cálida de una lámpara de escritorio.
//   Cartas     · el buzón con todas las conversaciones (amigos y gremios) como
//                sobres, junto a una ventana. Aquí se lee y se escribe.
//   Gremios    · tus grupos alrededor de la fogata.
// Tocar un contacto o un gremio del directorio abre su carta en Cartas: al lado
// en escritorio y a pantalla completa en el móvil, pegada al teclado. Al entrar a
// Social (o cambiar de pestaña) no queda ninguna carta abierta: se abre al tocar.
// La URL guarda la pestaña y la carta abierta (?tab=…&chat=usuario | gchat=gremio |
// guild=gremio), así que atrás cierra la carta y los avisos llevan directo.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, PresenceContext, motion, useIsPresent } from 'framer-motion';
import { Mail, NotebookTabs, PenLine, Send, Tent, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { useAuthStore } from '@/store/authStore';
import { useSocialStore } from '@/store/socialStore';
import {
  apiError, getGuildInvites, getMyGuilds, getNetwork, getPendingRequests, setChatPref,
  type FriendItem, type GuildInvite, type GuildSummary, type PendingRequest,
} from '@/services/network.service';
import { AmbientLight, Particles, SketchUnderline, ZoneShell } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { Button, Modal } from '@/components/ui/lq';
import { Notebook } from '@/components/social/Notebook';
import { LetterTray, type TrayItem } from '@/components/social/LetterTray';
import { GuildRoom } from '@/components/social/GuildRoom';
import { DirectLetter, GuildLetter } from '@/components/social/letters/LetterView';
import { useViewportBox } from '@/components/social/letters/viewport';
import { useLive } from '@/lib/live';

type Tab = 'directorio' | 'cartas' | 'gremios';
const TABS: Array<{ id: Tab; label: string; title: string; icon: LucideIcon; sub: string }> = [
  { id: 'directorio', label: 'Directorio', title: 'directorio', icon: NotebookTabs, sub: 'Tus contactos y tus gremios. Toca a alguien para escribirle.' },
  { id: 'cartas', label: 'Cartas', title: 'cartas', icon: Mail, sub: 'Todas tus conversaciones, con amigos y con tus gremios.' },
  { id: 'gremios', label: 'Gremios', title: 'gremios', icon: Tent, sub: 'Tus grupos: su fogata, el enemigo del día y quién está en cada uno.' },
];
const toaster = () => useToastStore.getState();

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
        {tab === 'directorio' && (
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
function EmptyPane() {
  return (
    <div className="lq-stationery relative flex min-h-[460px] flex-col items-center justify-center gap-3 overflow-hidden rounded-[22px] border border-border p-8 text-center shadow-md">
      <motion.span initial={{ rotate: -16, y: -8, opacity: 0 }} animate={{ rotate: -6, y: 0, opacity: 1 }} transition={springs.heavy}
        className="flex size-16 items-center justify-center rounded-2xl bg-warning/[var(--lq-soft-alpha)] text-warning-text">
        <PenLine aria-hidden className="size-8" strokeWidth={1.5} />
      </motion.span>
      <h2 className="text-heading-md text-on-background"><Lettering text="papel en blanco" /></h2>
      <p className="max-w-[340px] text-body-md text-on-surface-light">Abre un sobre del buzón para leer y responder.</p>
    </div>
  );
}

/**
 * La carta a pantalla completa del móvil: exactamente lo visible sobre el teclado.
 * Entra como una hoja que se despliega desde abajo y sale igual. Al empezar a
 * salir se suelta el foco: así el teclado se cierra antes de devolver el scroll
 * a la página (si no, iOS dejaba la vista desplazada, la barra inferior oculta
 * y la lista sin poder desplazarse).
 */
function MobileLetter({ children }: { children: React.ReactNode }) {
  const box = useViewportBox();
  const present = useIsPresent();
  useEffect(() => {
    if (!present) (document.activeElement as HTMLElement | null)?.blur?.();
  }, [present]);
  return (
    // Capa opaca a pantalla completa (jamás se ve la bandeja detrás, ni mientras iOS acomoda el teclado)
    // y, dentro, la carta con exactamente el alto visible por encima del teclado.
    <motion.div
      key="mobile-letter" data-keyboard-managed
      initial={{ y: '100%', rotate: 2.5, scale: 0.98 }} animate={{ y: 0, rotate: 0, scale: 1 }}
      exit={{ y: '100%', rotate: -2, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
      transition={springs.natural} style={{ transformOrigin: '50% 100%' }}
      className="fixed inset-0 z-[60] overflow-hidden overscroll-none bg-background [will-change:transform]"
    >
      <ScrollLock />
      <div style={{ top: box.top, height: box.height }} className="absolute inset-x-0 flex flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
        {children}
      </div>
    </motion.div>
  );
}

export default function SocialPage() {
  const [params, setParams] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const pulse = useSocialStore((s) => s.pulse);
  const meId = String(useAuthStore((s) => s.user?.id) ?? '');

  const chat = params.get('chat');
  const gchat = params.get('gchat');
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'directorio' || tabParam === 'cartas' || tabParam === 'gremios'
    ? tabParam
    : tabParam === 'amigos' ? 'directorio'
      : chat || gchat ? 'cartas' : params.get('guild') ? 'gremios' : 'directorio';
  const guildParam = params.has('guild') ? params.get('guild') || null : undefined;
  const view = params.get('view');

  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [guilds, setGuilds] = useState<GuildSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [clearing, setClearing] = useState<TrayItem | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      const [f, p, inv, g] = await Promise.all([
        getNetwork(), getPendingRequests().catch(() => []), getGuildInvites().catch(() => []), getMyGuilds().catch(() => [] as GuildSummary[]),
      ]);
      setFriends(f); setPending(p); setInvites(inv); setGuilds(g); setError(false);
    } catch { if (!silent) setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // La bandeja se refresca sola cuando el chat en vivo trae algo (el pulso cambia):
  // cartas nuevas, vistos, solicitudes… Agrupado para no repintar a cada momento.
  const refreshTimer = useRef(0);
  const refreshQuiet = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => { void load(true); }, 350);
  }, [load]);
  const countsSig = pulse ? `${pulse.unreadMessages}|${pulse.guildUnread}|${pulse.requests}|${pulse.onlineCount}|${pulse.streaksWaiting}` : '';
  const seenSig = useLive((st) => st.seen);
  const letterBeat = useLive((st) => st.letters);
  useEffect(() => { if (countsSig || seenSig || letterBeat) refreshQuiet(); }, [countsSig, seenSig, letterBeat, refreshQuiet]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const setQuery = useCallback((patch: Record<string, string | null>, replace = true) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v); }
      return next;
    }, { replace });
  }, [setParams]);

  // Cambiar de pestaña cierra la carta abierta: al volver, se ve la pestaña tal cual.
  const goTab = (t: Tab) => setQuery({ tab: t, view: null, chat: null, gchat: null });
  const openDm = (username: string) => {
    setQuery({ tab: 'cartas', chat: username, gchat: null, view: null }, false);
    setFriends((list) => list?.map((f) => (f.friend.username === username ? { ...f, unread: 0 } : f)) ?? list);
  };
  const openGuildLetter = (id: string) => {
    setQuery({ tab: 'cartas', gchat: id, chat: null, view: null }, false);
    setGuilds((list) => list?.map((g) => (g.id === id ? { ...g, unread: 0 } : g)) ?? list);
  };
  const closeLetter = () => setQuery({ chat: null, gchat: null });
  const leaveLetter = () => { closeLetter(); refreshQuiet(); };
  const pickGuild = useCallback((id: string | null | undefined) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'gremios');
      next.delete('chat'); next.delete('gchat');
      if (id === undefined) next.delete('guild'); else next.set('guild', id ?? '');
      return next;
    }, { replace: true });
  }, [setParams]);

  async function archive(it: TrayItem, archived: boolean) {
    const mark = (v: boolean) => {
      if (it.kind === 'dm') setFriends((l) => l?.map((f) => (f.friendshipId === it.friend.friendshipId ? { ...f, archived: v } : f)) ?? l);
      else setGuilds((l) => l?.map((g) => (g.id === it.guild.id ? { ...g, archived: v } : g)) ?? l);
    };
    mark(archived);
    try { await setChatPref(it.chat, { archived }); toaster().info(archived ? 'Carta archivada' : 'Carta fuera del archivo'); }
    catch (e) { mark(!archived); toaster().error(apiError(e, 'No se pudo archivar')); }
  }
  async function clearChat(it: TrayItem) {
    setClearing(null);
    try {
      await setChatPref(it.chat, { clear: true });
      toaster().info('Chat eliminado', 'Se borró el historial solo para ti.');
      if ((it.kind === 'dm' && chat === it.friend.friend.username) || (it.kind === 'guild' && gchat === it.guild.id)) closeLetter();
      void load(true);
    } catch (e) { toaster().error(apiError(e, 'No se pudo eliminar el chat')); }
  }

  const chatFriend = useMemo(() => friends?.find((f) => f.friend.username === chat)?.friend ?? null, [friends, chat]);
  const online = friends?.filter((f) => f.friend.online).length ?? pulse?.onlineCount ?? 0;
  const dmUnread = friends?.reduce((n, f) => n + f.unread, 0) ?? pulse?.unreadMessages ?? 0;
  const guildUnread = guilds?.reduce((n, g) => n + g.unread, 0) ?? pulse?.guildUnread ?? 0;
  const badges: Record<Tab, number> = { directorio: pending.length + invites.length, cartas: dmUnread + guildUnread, gremios: invites.length };
  const meta = TABS.find((t) => t.id === tab)!;
  const letterOpen = tab === 'cartas' && Boolean(chatFriend || gchat);
  const activeKey = chatFriend ? `dm:${chatFriend.id}` : gchat ? `g:${gchat}` : null;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = TABS[(i + d + TABS.length) % TABS.length];
    goTab(next.id);
    document.getElementById(`social-tab-${next.id}`)?.focus();
  };

  const letterClass = isDesktop ? 'h-[max(540px,calc(100dvh-15rem))]' : 'min-h-0 flex-1 rounded-none border-0 shadow-none';
  const letter = !letterOpen ? null : chatFriend
    ? <DirectLetter key={chatFriend.id} friend={chatFriend} onActivity={refreshQuiet} onBack={isDesktop ? undefined : closeLetter} onLeave={leaveLetter} className={letterClass} />
    : gchat
      ? <GuildLetter key={gchat} guildId={gchat} onActivity={refreshQuiet} onBack={isDesktop ? undefined : closeLetter} onLeave={leaveLetter} className={letterClass} />
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
        {tab === 'directorio' && (
          <Button variant="secondary" onClick={() => { setQuery({ view: 'search' }); document.getElementById('notebook-search')?.focus(); }}>
            <Send aria-hidden className="size-4" />Enviar paloma
          </Button>
        )}
        {tab === 'cartas' && <Button variant="secondary" onClick={() => goTab('directorio')}><PenLine aria-hidden className="size-4" />Escribir carta</Button>}
      </motion.section>

      {/* Pestañas: siempre a mano al bajar. El indicador (layoutId) va aislado de la
          presencia de la página: si no, al salir de Social la zona de destino se quedaba en blanco. */}
      <motion.div variants={item} className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:top-16 md:mx-0 md:rounded-t-xl md:px-1">
        <PresenceContext.Provider value={null}>
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
        </PresenceContext.Provider>
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
                onPick={pickGuild} onListChanged={() => void load(true)} onOpenLetter={openGuildLetter} onRetry={() => void load()}
              />
            ) : tab === 'directorio' ? (
              <div className="max-w-[760px]">
                <Notebook
                  friends={friends} guilds={guilds} pending={pending} invites={invites} error={error && friends === null}
                  activeUsername={null} focus={view === 'requests' || view === 'search' ? view : null}
                  onOpen={openDm} onOpenGuild={openGuildLetter} onNewGuild={() => pickGuild(null)}
                  onChanged={() => void load(true)} onRetry={() => void load()}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-6">
                <div className="min-w-0 flex-[1_1_340px] lg:max-w-[460px]">
                  <LetterTray
                    friends={friends} guilds={guilds} active={activeKey} meId={meId}
                    onOpen={(it: TrayItem) => (it.kind === 'dm' ? openDm(it.friend.friend.username) : openGuildLetter(it.guild.id))}
                    onGoDirectory={() => goTab('directorio')}
                    onArchive={(it, v) => void archive(it, v)} onClear={(it) => setClearing(it)}
                  />
                </div>
                {isDesktop && (
                  <div className="sticky top-36 min-w-0 flex-[2_1_480px]">
                    {/* Solo anima al abrir o cerrar la carta; al pasar de una a otra se cambia al instante, sin parpadeo. */}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={letter ? 'letter' : 'empty'}
                        initial={{ opacity: 0, y: 18, rotate: 0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                        transition={springs.heavy}
                      >
                        {letter ?? <EmptyPane />}
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
          {!isDesktop && letter && <MobileLetter key="mobile-letter">{letter}</MobileLetter>}
        </AnimatePresence>,
        document.body,
      )}

      <Modal open={Boolean(clearing)} onClose={() => setClearing(null)} title="¿Eliminar este chat?">
        <p className="text-body-md text-on-surface">Se borra el historial solo para ti; {clearing?.kind === 'guild' ? 'los demás miembros' : 'tu amigo'} lo seguirán viendo. Lo que se escriba a partir de ahora sí te llega.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setClearing(null)}>Cancelar</Button>
          <Button variant="danger" size="md" onClick={() => clearing && void clearChat(clearing)}>Eliminar chat</Button>
        </div>
      </Modal>
    </ZoneShell>
  );
}
