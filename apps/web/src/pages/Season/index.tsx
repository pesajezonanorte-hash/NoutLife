// Campaña (CampaignDesktop). Temporada activa: cuenta atrás en vivo, pase
// Gratis/Premium, capítulos (eventos), jefe comunitario y tu temporada.
// Sin temporada: cuenta atrás a la próxima + interruptor «Avísame cuando empiece».
// Zona ambientada: un periódico. La hoja se despliega al llegar: cabecera con la
// fecha y el número de edición (el día de la temporada), el titular de la
// temporada que se entinta, la crónica del jefe, los objetivos como noticias
// breves en columnas (al reclamar uno cae el sello «Noticia cumplida»), los
// capítulos como artículos y la clasificación como tabla deportiva.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ink, Masthead, Sheet, Stamp } from '@/components/season/Newspaper';
import { ZoneShell } from '@/components/ambience';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, Coins, Crown, Flag, Gift, Mountain, Skull, Sparkles, Zap } from 'lucide-react';
import api from '@/lib/api';
import { item, stagger } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';
import {
  Badge, BossBar, Button, Countdown, ErrorState, IconChip, PageLoader, SegmentedControl,
  Switch, type PassReward,
} from '@/components/ui/lq';

interface Participant { userId: string; damageDealt: number; user: { displayName: string; username: string; level: number } }
interface SeasonEvent { id: string; name: string; description: string; bonusXpMult: number; category?: string; startDate: string; endDate: string }
interface Season {
  id: string; name: string; description: string; bossName: string; bossHp: number; currentHp: number;
  startDate: string; endDate: string; isActive: boolean;
  rewards: Array<{ type: string; amount?: number; itemId?: string }>;
  participants: Participant[]; events: SeasonEvent[];
}
interface SeasonData { season: Season; userDamage: number }

const es = {
  chronicle: 'Crónica de temporada',
  specialEdition: 'Edición especial',
  nextSeason: 'Próxima temporada',
  noSeason: 'No hay temporada activa',
  noSeasonDesc: 'Vuelve pronto para la próxima batalla. Mientras tanto, cada XP que ganes cuenta para tu nivel.',
  notifyLabel: 'Avísame cuando empiece',
  notifyBody: 'Te enviaremos una notificación el primer día.',
  notifyOn: 'Te avisaremos cuando empiece',
  notifyOff: 'Aviso desactivado',
  edition: 'Edición nº',
  endsIn: 'Termina en',
  hours: (n: number): string => `${n} h`,
  dayCount: (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`,
  adventurers: 'aventureros en la campaña',
  xp: (n: string): string => `${n} XP`,
  gold: (n: string): string => `${n} Gold`,
  item: 'Objeto',
  xpTag: (n: number): string => `×${n} XP`,
  inProgress: 'Temporada en curso',
  seeQuests: 'Ver misiones',
  mainChronicle: 'Crónica principal',
  bossLost: (name: string, pct: number): string => `${name} ya perdió el ${pct}% de su vida`,
  bossEyebrow: 'Jefe de temporada',
  bossNote: (n: string): string => `${n} aventureros han dañado al jefe. Cada hábito y misión le quita vida.`,
  firstPerson: 'En primera persona',
  yourSeason: 'Tu temporada',
  yourDamage: 'Tu daño',
  rank: 'Puesto',
  goals: 'Objetivos de la temporada',
  goalsDesc: (done: number, total: number): string => `${done} de ${total} cumplidos: se logran a medida que la comunidad daña al jefe.`,
  track: 'Pista',
  free: 'Gratis',
  premium: 'Premium',
  premiumSoon: 'La pista Premium todavía no está disponible.',
  atDamage: (pct: number): string => `Al ${pct}% de daño`,
  received: 'Recompensa recibida.',
  claimable: 'La comunidad lo logró: ya puedes reclamarla.',
  premiumOnly: 'Solo en la pista Premium.',
  locked: 'Aún falta daño al jefe para liberarla.',
  claim: 'Reclamar',
  claimed: (name: string): string => `Reclamaste: ${name}`,
  goalMet: 'Noticia cumplida',
  chapters: 'Capítulos',
  eventsWord: (n: number): string => (n === 1 ? 'evento' : 'eventos'),
  noEvents: 'Aún no hay eventos en esta temporada.',
  live: 'Última hora: en curso',
  topDamage: 'Más daño al jefe',
  you: ' (tú)',
};

const en: typeof es = {
  chronicle: 'Season chronicle',
  specialEdition: 'Special edition',
  nextSeason: 'Next season',
  noSeason: 'No active season',
  noSeasonDesc: 'Come back soon for the next battle. In the meantime, every XP you earn counts toward your level.',
  notifyLabel: 'Remind me when it starts',
  notifyBody: 'We will send you a notification on the first day.',
  notifyOn: 'We will let you know when it starts',
  notifyOff: 'Reminder turned off',
  edition: 'Edition no.',
  endsIn: 'Ends in',
  hours: (n: number): string => `${n} h`,
  dayCount: (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`,
  adventurers: 'adventurers in the campaign',
  xp: (n: string): string => `${n} XP`,
  gold: (n: string): string => `${n} Gold`,
  item: 'Item',
  xpTag: (n: number): string => `×${n} XP`,
  inProgress: 'Season in progress',
  seeQuests: 'See quests',
  mainChronicle: 'Main chronicle',
  bossLost: (name: string, pct: number): string => `${name} has lost ${pct}% of its life`,
  bossEyebrow: 'Season boss',
  bossNote: (n: string): string => `${n} adventurers have hurt the boss. Every habit and quest takes some of its life.`,
  firstPerson: 'First person',
  yourSeason: 'Your season',
  yourDamage: 'Your damage',
  rank: 'Rank',
  goals: 'Season goals',
  goalsDesc: (done: number, total: number): string => `${done} of ${total} met: they are unlocked as the community damages the boss.`,
  track: 'Track',
  free: 'Free',
  premium: 'Premium',
  premiumSoon: 'The Premium track is not available yet.',
  atDamage: (pct: number): string => `At ${pct}% damage`,
  received: 'Reward received.',
  claimable: 'The community did it: you can claim it now.',
  premiumOnly: 'Premium track only.',
  locked: 'More damage to the boss is needed to unlock it.',
  claim: 'Claim',
  claimed: (name: string): string => `You claimed: ${name}`,
  goalMet: 'Goal met',
  chapters: 'Chapters',
  eventsWord: (n: number): string => (n === 1 ? 'event' : 'events'),
  noEvents: 'There are no events in this season yet.',
  live: 'Live now: in progress',
  topDamage: 'Most damage to the boss',
  you: ' (you)',
};

const COPY: Copy<typeof es> = { es, en };

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const fmt = (n: number, locale: Locale) => Math.round(n).toLocaleString(INTL_LOCALE[locale]);
const longDate = (d: Date, locale: Locale) => d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\p{L}/u, (c) => c.toUpperCase());

/** Primer día del mes siguiente: fecha de referencia cuando no hay temporada. */
function nextSeasonDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

// TODO(api): sin pase de temporada ni reclamo de recompensas. El pase se construye con
// las recompensas reales de la temporada: cada una se libera al quitarle al jefe su
// tramo de vida, y lo reclamado se guarda en este dispositivo.
function useClaimed(seasonId: string | undefined) {
  const key = `lq-season-claimed-${seasonId}`;
  const [claimed, setClaimed] = useState<string[]>([]);
  useEffect(() => {
    try { setClaimed(JSON.parse(localStorage.getItem(key) ?? '[]')); } catch { setClaimed([]); }
  }, [key]);
  const claim = (id: string) => setClaimed((c) => {
    const next = [...new Set([...c, id])];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* sin storage */ }
    return next;
  });
  return { claimed, claim };
}

function rewardName(r: Season['rewards'][number], t: typeof es, locale: Locale) {
  if (r.type === 'xp') return t.xp(fmt(r.amount ?? 0, locale));
  if (r.type === 'gold') return t.gold(fmt(r.amount ?? 0, locale));
  return r.itemId ? r.itemId.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : t.item;
}

function Inactive() {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToast();
  // TODO(api): sin suscripción a avisos de temporada; la preferencia vive en este dispositivo.
  const [notify, setNotify] = useState(() => { try { return localStorage.getItem('lq-season-notify') !== 'off'; } catch { return true; } });
  const toggle = (on: boolean) => {
    setNotify(on);
    try { localStorage.setItem('lq-season-notify', on ? 'on' : 'off'); } catch { /* sin storage */ }
    toast.info(on ? t.notifyOn : t.notifyOff);
  };
  return (
    <Sheet className="mx-auto w-full max-w-[860px]">
      <Masthead
        title={t.chronicle}
        left={<span>{t.specialEdition}</span>}
        right={<span>{t.nextSeason}</span>}
        dateline={<span>{longDate(new Date(), locale)}</span>}
      />
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col items-center gap-6 pt-8 text-center">
        <motion.span variants={item}><IconChip icon={Mountain} tone="primary" size="lg" className="size-20 rounded-[28px]" /></motion.span>
        <motion.div variants={item} className="flex flex-col gap-2">
          <Ink as="h1" d={900} delay={500} className="text-display-sm md:text-display-md">{t.noSeason}</Ink>
          <p className="mx-auto max-w-[60ch] text-body-lg text-on-surface">{t.noSeasonDesc}</p>
        </motion.div>
        <motion.div variants={item}><Countdown to={nextSeasonDate()} accent={false} className="justify-center" /></motion.div>
        <motion.div variants={item} className="lq-rule w-full" aria-hidden="true" />
        <motion.div variants={item} className="flex w-full items-center gap-4 text-left">
          <IconChip icon={Bell} tone="info" />
          <div className="flex-1">
            <label htmlFor="season-notify" className="text-label-lg md:text-body-md md:font-semibold">{t.notifyLabel}</label>
            <div className="text-body-sm text-on-surface">{t.notifyBody}</div>
          </div>
          <Switch id="season-notify" checked={notify} onChange={(e) => toggle(e.target.checked)} />
        </motion.div>
      </motion.div>
    </Sheet>
  );
}

function Active({ data }: { data: SeasonData }) {
  const t = useText(COPY);
  const locale = useLocale();
  const { season, userDamage } = data;
  const me = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const toast = useToast();
  const [track, setTrack] = useState<'free' | 'premium'>('free');
  const { claimed, claim } = useClaimed(season.id);

  const lost = Math.max(0, season.bossHp - season.currentHp);
  const lostPct = season.bossHp ? (lost / season.bossHp) * 100 : 0;
  const ranked = [...(season.participants ?? [])].sort((a, b) => b.damageDealt - a.damageDealt);
  const myRank = ranked.findIndex((p) => p.userId === String(me?.id)) + 1;
  const n = Math.max(1, season.rewards?.length ?? 0);

  const rewards: PassReward[] = useMemo(() => (season.rewards ?? []).slice(0, 10).map((r, i) => {
    const threshold = ((i + 1) / n) * 100;
    const id = `${i}`;
    const state: PassReward['state'] = track === 'premium' ? 'premium' : claimed.includes(id) ? 'claimed' : lostPct >= threshold ? 'claimable' : 'locked';
    return {
      level: Math.round(threshold), name: rewardName(r, t, locale),
      icon: r.type === 'xp' ? Zap : r.type === 'gold' ? Coins : i === n - 1 ? Crown : Gift,
      tone: r.type === 'xp' || r.type === 'gold' ? 'secondary' : 'forest', state,
    };
  }), [season.rewards, n, track, claimed, lostPct, t, locale]);
  const tier = rewards.filter((r) => lostPct >= r.level).length;

  // Número de edición: el día de la temporada.
  const edition = Math.max(1, Math.floor((Date.now() - new Date(season.startDate).getTime()) / 86400000) + 1);
  const [fresh, setFresh] = useState<string | null>(null);
  // Lo que falta, para la oreja de la cabecera (la página se actualiza cada 30 s).
  const ms = Math.max(0, new Date(season.endDate).getTime() - Date.now());
  const daysLeft = Math.floor(ms / 86400000);
  const left = daysLeft >= 1 ? t.dayCount(daysLeft) : t.hours(Math.floor(ms / 3600000));

  return (
    <Sheet>
      <Masthead
        title={t.chronicle}
        left={<span>{t.edition} <span className="font-mono">{edition}</span></span>}
        right={<span>{t.endsIn} <span className="font-mono">{left}</span></span>}
        dateline={<><span>{longDate(new Date(), locale)}</span><span><span className="font-mono">{fmt(season.participants?.length ?? 0, locale)}</span> {t.adventurers}</span></>}
      />

      {/* Titular de portada */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3 py-6 text-center md:py-8">
        <motion.div variants={item} className="flex justify-center"><Badge variant="success" icon={Sparkles}>{t.inProgress}</Badge></motion.div>
        <Ink as="h1" d={1100} delay={650} className="mx-auto max-w-[22ch] text-display-sm [text-wrap:balance] md:text-display-md lg:text-display-lg">{season.name}</Ink>
        <motion.p variants={item} className="mx-auto max-w-[62ch] text-body-lg text-on-surface">{season.description}</motion.p>
        <motion.div variants={item} className="flex justify-center"><Button onClick={() => navigate('/quests')}><Flag aria-hidden className="size-4" strokeWidth={1.75} />{t.seeQuests}</Button></motion.div>
      </motion.div>
      <div className="lq-rule" aria-hidden="true" />

      <motion.div variants={stagger} initial="initial" animate="animate" className="grid gap-6 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-8">
        {/* Crónica principal: el jefe de la temporada */}
        <motion.section variants={item} aria-labelledby="boss-t" className="flex flex-col gap-3">
          <span className="text-label-md text-error-text">{t.mainChronicle}</span>
          <Ink as="h2" d={800} delay={900} className="text-heading-lg md:text-heading-xl">
            <span id="boss-t">{t.bossLost(season.bossName, Math.round(lostPct))}</span>
          </Ink>
          <BossBar eyebrow={t.bossEyebrow} name={season.bossName} icon={Skull} hp={season.currentHp} maxHp={season.bossHp}
            note={t.bossNote(fmt(season.participants?.length ?? 0, locale))} />
        </motion.section>
        {/* Recuadro lateral: tu crónica */}
        <motion.aside variants={item} aria-labelledby="mine-t" className="lq-rule-v flex flex-col gap-3 md:pl-8">
          <span className="text-label-md text-on-surface">{t.firstPerson}</span>
          <h2 id="mine-t" className="text-heading-md">{t.yourSeason}</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-body-sm text-on-surface">{t.yourDamage}</dt><dd className="font-mono text-heading-md tabular-nums">{fmt(userDamage, locale)}</dd></div>
            <div><dt className="text-body-sm text-on-surface">{t.rank}</dt><dd className="font-mono text-heading-md tabular-nums">{myRank ? `#${myRank}` : '—'}</dd></div>
          </dl>
        </motion.aside>
      </motion.div>

      {rewards.length > 0 && (
        <>
          <div className="lq-rule" aria-hidden="true" />
          <section aria-labelledby="pass-t" className="flex flex-col gap-4 py-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="pass-t" className="text-heading-lg">{t.goals}</h2>
                <p className="text-body-sm text-on-surface">{t.goalsDesc(tier, rewards.length)}</p>
              </div>
              <div className="w-full max-w-[300px]">
                <SegmentedControl label={t.track} value={track} onChange={setTrack} options={[{ value: 'free', label: t.free }, { value: 'premium', label: t.premium }]} />
              </div>
            </div>
            {track === 'premium' && <p className="text-body-sm text-on-surface">{t.premiumSoon}</p>}
            {/* Noticias breves en columnas */}
            <motion.ol variants={stagger} initial="initial" animate="animate" className="lq-columns columns-1 sm:columns-2 lg:columns-3">
              {rewards.map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.li key={i} variants={item} className={cn('relative mb-5 flex break-inside-avoid flex-col gap-1.5 border-b border-on-background/15 pb-5', r.state === 'locked' && 'opacity-70')}>
                    <span className="flex items-center gap-2 text-label-md text-on-surface"><Icon aria-hidden className="size-4" strokeWidth={1.75} />{t.atDamage(r.level)}</span>
                    <h3 className="text-heading-sm">{r.name}</h3>
                    <p className="text-body-sm text-on-surface">
                      {r.state === 'claimed' ? t.received : r.state === 'claimable' ? t.claimable : r.state === 'premium' ? t.premiumOnly : t.locked}
                    </p>
                    {r.state === 'claimable' && (
                      <Button size="sm" className="mt-1 self-start" onClick={() => { claim(String(i)); setFresh(String(i)); toast.success(t.claimed(r.name)); }}>{t.claim}</Button>
                    )}
                    {r.state === 'claimed' && <Stamp animate={fresh === String(i)} className="absolute right-0 top-1">{t.goalMet}</Stamp>}
                  </motion.li>
                );
              })}
            </motion.ol>
          </section>
        </>
      )}

      <div className="lq-rule" aria-hidden="true" />
      <div className="grid gap-6 pt-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-8">
        {/* Capítulos: artículos de la edición */}
        <section aria-labelledby="ch-t" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="ch-t" className="text-heading-lg">{t.chapters}</h2>
            <span className="text-body-sm text-on-surface"><span className="font-mono">{(season.events ?? []).length}</span> {t.eventsWord((season.events ?? []).length)}</span>
          </div>
          {(season.events ?? []).length === 0 ? (
            <p className="text-body-md text-on-surface">{t.noEvents}</p>
          ) : (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="lq-columns columns-1 lg:columns-2">
              {(season.events ?? []).map((ev) => {
                const live = Date.now() >= new Date(ev.startDate).getTime() && Date.now() <= new Date(ev.endDate).getTime();
                return (
                  <motion.li key={ev.id} variants={item} className="mb-4 flex break-inside-avoid flex-col gap-1 border-b border-on-background/15 pb-4">
                    {live && <span className="text-label-md text-error-text">{t.live}</span>}
                    <h3 className="text-heading-sm">{ev.name}</h3>
                    <p className="text-body-sm text-on-surface">{ev.description}</p>
                    <span className="font-mono text-label-lg tabular-nums text-primary-text">{t.xpTag(ev.bonusXpMult)}</span>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </section>
        {/* Clasificación: la tabla de la página de deportes */}
        {ranked.length > 0 && (
          <section aria-labelledby="dmg-t" className="lq-rule-v flex flex-col gap-3 md:pl-8">
            <h2 id="dmg-t" className="text-heading-lg">{t.topDamage}</h2>
            <ol className="flex flex-col">
              {ranked.slice(0, 10).map((p, i) => {
                const you = p.userId === String(me?.id);
                return (
                  <li key={p.userId} aria-current={you || undefined} className={cn('flex items-baseline gap-3 border-b border-dotted border-on-background/25 py-2', you && 'font-semibold text-secondary-text')}>
                    <span className="w-6 font-mono text-label-lg tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-body-md">{p.user.displayName}{you && t.you}</span>
                    <span className="font-mono text-label-lg tabular-nums">{fmt(p.damageDealt, locale)}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </Sheet>
  );
}

export default function SeasonPage() {
  const [data, setData] = useState<SeasonData | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const res = await api.get<SeasonData>('/seasons/active');
      setData(res.data);
      setState('ready');
    } catch (e) {
      // 404 = sin temporada activa.
      if ((e as { response?: { status?: number } })?.response?.status === 404) { setData(null); setState('ready'); }
      else if (!silent) setState('error');
    }
  }, []);
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (state === 'loading') return <PageLoader />;
  if (state === 'error') return <ErrorState onRetry={() => void load()} />;
  return (
    <ZoneShell zone="season" ambience={<span className="lq-tex-newsprint absolute inset-0 block opacity-60 [mask-image:radial-gradient(120%_80%_at_50%_10%,#000_30%,transparent_75%)]" />}>
      {data?.season?.isActive !== false && data?.season ? <Active data={data} /> : <Inactive />}
    </ZoneShell>
  );
}
