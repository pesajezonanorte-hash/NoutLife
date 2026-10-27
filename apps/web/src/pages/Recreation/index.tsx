// Recreación — la sala de cine. Lo que viste, jugaste o viviste para desconectar:
// la pantalla proyecta tu última función, la cartelera guarda lo que quieres ver y
// cada boleta es una función vivida (XP y oro; Carisma al subir de nivel). El Sabio
// ve esta zona junto con las demás y puede proponerte un plan para hoy.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clapperboard, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, item, useMotionReduced } from '@/lib/motion';
import { Button, Card, ErrorState, PageLoader } from '@/components/ui/lq';
import { solidBg } from '@/components/ui/lq/tones';
import { AmbientLight, Particles, ZoneShell, useParticleBudget } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { SageContextButton } from '@/components/sage/SageContextButton';
import { useLoadingCopy } from '@/lib/loadingCopy';
import * as recreationService from '@/services/recreation.service';
import type { RecreationEntry, RecreationResult, RecreationStatus } from '@/services/recreation.service';
import { Bulbs, Poster, Screen, Stars, Theater, Ticket } from '@/components/recreation/Cinema';
import { RecreationDialog } from '@/components/recreation/RecreationDialog';
import { kindBalance, kindOf, minutesLabel, weekSummary } from '@/components/recreation/recreationMeta';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const COPY: Copy<{
  eyebrow: string; headline: string; intro: string; whatToday: string; whatTodayMsg: string; register: string;
  loading: string; loadFailed: string; plural: (n: number) => string; stars: (r: string) => string;
  emptyTitle: string; emptyBody: string; weekAria: string;
  billboard: string; plan: string; billboardEmpty: string; functions: string; thisWeek: string; earlier: string;
  seeAll: (n: number) => string; noFunctions: string; balanceTitle: string; balanceDesc: string; balanceEmpty: string;
  balanceFoot: string; add: string; fromLastWeek: string; weekSuffix: string;
}> = {
  es: {
    eyebrow: 'Recreación', headline: 'Sala de cine', intro: 'Tu ocio también cuenta: lo que ves, juegas o vives para desconectar.',
    whatToday: '¿Qué hago hoy?',
    whatTodayMsg: 'Con lo que sabes de mi semana (sueño, entrenos, hábitos y ánimo), ¿qué plan de ocio me recomiendas hoy para desconectar?',
    register: 'Registrar función', loading: 'Apagando las luces…', loadFailed: 'No pudimos abrir la sala',
    plural: (n) => (n === 1 ? 'función' : 'funciones'), stars: (r) => `${r} de 5 estrellas`,
    emptyTitle: 'La sala está lista', emptyBody: 'Registra lo que viste, jugaste o viviste para desconectar. La última función se proyecta aquí.',
    weekAria: 'Tu semana de ocio',
    billboard: 'Cartelera', plan: 'Planear',
    billboardEmpty: 'Guarda aquí lo que quieres ver o hacer. Cuando lo vivas, márcalo y suma XP.',
    functions: 'Tus funciones', thisWeek: 'Esta semana', earlier: 'Antes', seeAll: (n) => `Ver todas (${n})`,
    noFunctions: 'Aún no hay funciones. Una película, una partida, una salida o un rato de tu hobby: todo cuenta.',
    balanceTitle: 'Tu ocio en 30 días', balanceDesc: 'Qué tanto de cada cosa, para que ningún tipo de descanso se quede fuera.',
    balanceEmpty: 'Cuando registres funciones, aquí verás el reparto entre películas, juegos, salidas y hobbies.',
    balanceFoot: 'Cada función vivida suma 15 XP y oro, hasta 3 al día; al subir de nivel crece tu Carisma. El Sabio la tiene en cuenta junto con tu sueño, tus entrenos y tus hábitos.',
    add: "Añadir", fromLastWeek: "Tu semana", weekSuffix: "esta semana",
  },
  en: {
    eyebrow: 'Recreation', headline: 'Cinema room', intro: 'Your downtime counts too: what you watch, play or do to switch off.',
    whatToday: 'What should I do today?',
    whatTodayMsg: 'Based on what you know about my week (sleep, workouts, habits and mood), what leisure plan would you recommend today to unwind?',
    register: 'Log an outing', loading: 'Dimming the lights…', loadFailed: "We couldn't open the room",
    plural: (n) => (n === 1 ? 'outing' : 'outings'), stars: (r) => `${r} of 5 stars`,
    emptyTitle: 'The room is ready', emptyBody: 'Log what you watched, played or did to switch off. Your latest outing is shown here.',
    weekAria: 'Your leisure week',
    billboard: 'Listings', plan: 'Plan',
    billboardEmpty: 'Keep what you want to watch or do here. When you do it, mark it and earn XP.',
    functions: 'Your outings', thisWeek: 'This week', earlier: 'Earlier', seeAll: (n) => `See all (${n})`,
    noFunctions: 'No outings yet. A movie, a game, a day out or a bit of your hobby: everything counts.',
    balanceTitle: 'Your downtime in 30 days', balanceDesc: 'How much of each kind, so no type of rest gets left out.',
    balanceEmpty: 'Once you log outings, you will see the split between movies, games, outings and hobbies here.',
    balanceFoot: 'Each outing adds 15 XP and gold, up to 3 a day; leveling up grows your Charisma. The Sage takes it into account along with your sleep, workouts and habits.',
    add: "Add", fromLastWeek: "Your week", weekSuffix: "this week",
  },
};

const SHOWN = 12;
const DAY_MS = 86_400_000;
const time = (e: RecreationEntry) => new Date(e.date).getTime();

export default function RecreationPage() {
  const t = useText(COPY);
  const locale: Locale = useLocale();
  const loadingCopy = useLoadingCopy();
  const [entries, setEntries] = useState<RecreationEntry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [dialog, setDialog] = useState<{ entry: RecreationEntry | null; status: RecreationStatus } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const budget = useParticleBudget();
  const reduce = useMotionReduced();

  const load = useCallback(async () => {
    setState('loading');
    try {
      setEntries(await recreationService.fetchRecreation());
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const done = useMemo(() => entries.filter((e) => e.status === 'DONE').sort((a, b) => time(b) - time(a)), [entries]);
  const planned = useMemo(() => entries.filter((e) => e.status === 'PLANNED').sort((a, b) => time(a) - time(b)), [entries]);
  const week = weekSummary(entries);
  const balance = kindBalance(entries, Date.now(), locale);
  const balanceTotal = balance.reduce((sum, k) => sum + k.count, 0);
  const featured = done[0];
  const now = Date.now();
  const shown = showAll ? done : done.slice(0, SHOWN);
  const thisWeek = shown.filter((e) => now - time(e) < 7 * DAY_MS);
  const earlier = shown.filter((e) => now - time(e) >= 7 * DAY_MS);

  const saved = ({ entry }: RecreationResult) => {
    setEntries((list) => [entry, ...list.filter((e) => e.id !== entry.id)]);
    setDialog(null);
  };
  const replaceEntry = (entry: RecreationEntry) => setEntries((list) => list.map((e) => (e.id === entry.id ? entry : e)));
  const deleted = (id: string) => {
    setEntries((list) => list.filter((e) => e.id !== id));
    setDialog(null);
  };
  const open = (entry: RecreationEntry) => setDialog({ entry, status: entry.status });

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
        <span className="text-label-lg text-primary-text">{t.eyebrow}</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.headline} /></h1>
        <p className="max-w-[60ch] text-body-lg text-on-surface-light">{t.intro}</p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <SageContextButton label={t.whatToday} className="flex-1 sm:flex-none" message={t.whatTodayMsg} />
        <Button className="flex-1 sm:flex-none" onClick={() => setDialog({ entry: null, status: 'DONE' })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.register}</Button>
      </div>
    </motion.section>
  );

  const pills = [
    `${week.count} ${t.plural(week.count)} ${t.weekSuffix}`,
    week.minutes ? minutesLabel(week.minutes, locale) : null,
    week.rating ? t.stars(week.rating.toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 1 })) : null,
    week.xp ? `+${week.xp} XP` : null,
  ].filter((p): p is string => Boolean(p));

  const theater = (
    <motion.div variants={item}>
      <Theater>
        <Bulbs className="mx-auto w-[92%]" />
        <Screen>
          {featured ? (
            <button type="button" aria-haspopup="dialog" onClick={() => open(featured)} className="mx-auto flex max-w-full flex-col items-center gap-2 rounded-lg">
              <span className="text-label-lg opacity-70">{kindOf(featured.kind, locale).label}</span>
              <span className="max-w-full text-display-sm [overflow-wrap:anywhere] [text-wrap:balance] md:text-display-md">{featured.title}</span>
              <Stars value={featured.rating} className="text-[rgb(var(--lq-warning-text))]" />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Clapperboard aria-hidden className="size-8 opacity-70" strokeWidth={1.5} />
              <p className="text-heading-md">{t.emptyTitle}</p>
              <p className="max-w-[40ch] text-body-md opacity-80">{t.emptyBody}</p>
            </div>
          )}
        </Screen>
        <Bulbs className="mx-auto w-[92%]" />
        <ul aria-label={t.weekAria} className="flex flex-wrap justify-center gap-2">
          {pills.map((p) => (
            <li key={p} className="rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 font-mono text-label-lg tabular-nums">{p}</li>
          ))}
        </ul>
      </Theater>
    </motion.div>
  );

  const billboard = (
    <motion.section variants={item} aria-labelledby="rec-planned" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="rec-planned" className="text-heading-sm">{t.billboard}</h2>
        <Button variant="ghost" size="sm" onClick={() => setDialog({ entry: null, status: 'PLANNED' })}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.plan}</Button>
      </div>
      {planned.length ? (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {planned.map((e, i) => <li key={e.id} className="shrink-0 snap-start"><Poster entry={e} index={i} onOpen={() => open(e)} /></li>)}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">{t.billboardEmpty}</p>
      )}
    </motion.section>
  );

  const ticketList = (list: RecreationEntry[]) => (
    <ul className="flex flex-col gap-2">
      {list.map((e) => <li key={e.id}><Ticket entry={e} onOpen={() => open(e)} onUpdated={replaceEntry} /></li>)}
    </ul>
  );

  const functions = (
    <motion.section variants={item} aria-labelledby="rec-done" className="flex flex-col gap-3">
      <h2 id="rec-done" className="text-heading-sm">{t.functions}</h2>
      {done.length ? (
        <>
          {thisWeek.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-label-lg text-on-surface-light">{t.thisWeek}</h3>
              {ticketList(thisWeek)}
            </div>
          )}
          {earlier.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-label-lg text-on-surface-light">{t.earlier}</h3>
              {ticketList(earlier)}
            </div>
          )}
          {done.length > SHOWN && !showAll && (
            <Button variant="ghost" onClick={() => setShowAll(true)} className="self-start">{t.seeAll(done.length)}</Button>
          )}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">{t.noFunctions}</p>
      )}
    </motion.section>
  );

  const balanceCard = (
    <Card as="section" padding="lg" aria-labelledby="rec-balance" className="flex flex-col gap-4">
      <div>
        <h2 id="rec-balance" className="text-heading-sm">{t.balanceTitle}</h2>
        <p className="text-body-sm text-on-surface-light">{t.balanceDesc}</p>
      </div>
      {balanceTotal > 0 ? (
        <>
          <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={balance.map((k) => `${k.label}: ${k.count}`).join(', ')}>
            {balance.map((k, i) => (
              <motion.span
                key={k.value} className={cn('block h-full origin-left', solidBg[k.tone])} style={{ flexGrow: k.count }}
                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: expo, delay: reduce ? 0 : 0.15 + i * 0.06 }}
              />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {balance.map((k) => (
              <li key={k.value} className="flex items-center gap-1.5 text-body-sm">
                <span aria-hidden className={cn('size-2.5 rounded-full', solidBg[k.tone])} />
                {k.label}<span className="font-mono text-on-surface-light tabular-nums">{k.count}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-body-md text-on-surface-light">{t.balanceEmpty}</p>
      )}
      <p className="border-t border-border pt-3 text-body-sm text-on-surface">{t.balanceFoot}</p>
    </Card>
  );

  return (
    <ZoneShell
      zone="recreation"
      contentClassName="gap-6 md:gap-8"
      ambience={<AmbientLight tone="error" alpha={0.07} darkAlpha={0.05} d={16} className="left-[8%] top-[-10%] h-[40vh] w-[84%]" />}
      view={(
        // Polvo que flota en el haz del proyector.
        <Particles
          count={budget(10)} kind="drift" seed={41} x={[20, 80]} y={[6, 46]} duration={[16, 26]} alpha={[0.15, 0.35]} size={[1.5, 2.5]} sx={[-18, 18]} sy={[-22, 12]}
          render={(sz) => <span className="block rounded-full bg-secondary" style={{ width: sz, height: sz }} />}
        />
      )}
    >
      {header}
      {state === 'loading' ? (
        <PageLoader label={t.loading} words={loadingCopy.recreation} />
      ) : state === 'error' ? (
        <ErrorState title={t.loadFailed} onRetry={() => void load()} />
      ) : (
        <>
          {theater}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
            <div className="flex min-w-0 flex-col gap-6">
              {billboard}
              {functions}
            </div>
            <motion.div variants={item} className="flex min-w-0 flex-col gap-6">{balanceCard}</motion.div>
          </div>
        </>
      )}
      <RecreationDialog
        open={dialog !== null} onClose={() => setDialog(null)}
        entry={dialog?.entry ?? null} initialStatus={dialog?.status ?? 'DONE'}
        onSaved={saved} onDeleted={deleted}
      />
    </ZoneShell>
  );
}
