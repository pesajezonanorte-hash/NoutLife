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
import { LOADING_COPY } from '@/lib/loadingCopy';
import * as recreationService from '@/services/recreation.service';
import type { RecreationEntry, RecreationResult, RecreationStatus } from '@/services/recreation.service';
import { Bulbs, Poster, Screen, Stars, Theater, Ticket } from '@/components/recreation/Cinema';
import { RecreationDialog } from '@/components/recreation/RecreationDialog';
import { kindBalance, kindOf, minutesLabel, weekSummary } from '@/components/recreation/recreationMeta';

const SHOWN = 12;
const DAY_MS = 86_400_000;
const time = (e: RecreationEntry) => new Date(e.date).getTime();

export default function RecreationPage() {
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
  const balance = kindBalance(entries);
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
        <span className="text-label-lg text-primary-text">Recreación</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Sala de cine" /></h1>
        <p className="max-w-[60ch] text-body-lg text-on-surface-light">Tu ocio también cuenta: lo que ves, juegas o vives para desconectar.</p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <SageContextButton
          label="¿Qué hago hoy?" className="flex-1 sm:flex-none"
          message="Con lo que sabes de mi semana (sueño, entrenos, hábitos y ánimo), ¿qué plan de ocio me recomiendas hoy para desconectar?"
        />
        <Button className="flex-1 sm:flex-none" onClick={() => setDialog({ entry: null, status: 'DONE' })}><Plus aria-hidden className="size-4" strokeWidth={2} />Registrar función</Button>
      </div>
    </motion.section>
  );

  const pills = [
    `${week.count} ${week.count === 1 ? 'función' : 'funciones'} esta semana`,
    week.minutes ? minutesLabel(week.minutes) : null,
    week.rating ? `${week.rating.toLocaleString('es-CO', { maximumFractionDigits: 1 })} de 5 estrellas` : null,
    week.xp ? `+${week.xp} XP` : null,
  ].filter((p): p is string => Boolean(p));

  const theater = (
    <motion.div variants={item}>
      <Theater>
        <Bulbs className="mx-auto w-[92%]" />
        <Screen>
          {featured ? (
            <button type="button" aria-haspopup="dialog" onClick={() => open(featured)} className="mx-auto flex max-w-full flex-col items-center gap-2 rounded-lg">
              <span className="text-label-lg opacity-70">{kindOf(featured.kind).label}</span>
              <span className="max-w-full text-display-sm [overflow-wrap:anywhere] [text-wrap:balance] md:text-display-md">{featured.title}</span>
              <Stars value={featured.rating} className="text-[rgb(var(--lq-warning-text))]" />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Clapperboard aria-hidden className="size-8 opacity-70" strokeWidth={1.5} />
              <p className="text-heading-md">La sala está lista</p>
              <p className="max-w-[40ch] text-body-md opacity-80">Registra lo que viste, jugaste o viviste para desconectar. La última función se proyecta aquí.</p>
            </div>
          )}
        </Screen>
        <Bulbs className="mx-auto w-[92%]" />
        <ul aria-label="Tu semana de ocio" className="flex flex-wrap justify-center gap-2">
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
        <h2 id="rec-planned" className="text-heading-sm">Cartelera</h2>
        <Button variant="ghost" size="sm" onClick={() => setDialog({ entry: null, status: 'PLANNED' })}><Plus aria-hidden className="size-4" strokeWidth={2} />Planear</Button>
      </div>
      {planned.length ? (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {planned.map((e, i) => <li key={e.id} className="shrink-0 snap-start"><Poster entry={e} index={i} onOpen={() => open(e)} /></li>)}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">
          Guarda aquí lo que quieres ver o hacer. Cuando lo vivas, márcalo y suma XP.
        </p>
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
      <h2 id="rec-done" className="text-heading-sm">Tus funciones</h2>
      {done.length ? (
        <>
          {thisWeek.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-label-lg text-on-surface-light">Esta semana</h3>
              {ticketList(thisWeek)}
            </div>
          )}
          {earlier.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-label-lg text-on-surface-light">Antes</h3>
              {ticketList(earlier)}
            </div>
          )}
          {done.length > SHOWN && !showAll && (
            <Button variant="ghost" onClick={() => setShowAll(true)} className="self-start">Ver todas ({done.length})</Button>
          )}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-border-strong p-4 text-body-md text-on-surface-light">
          Aún no hay funciones. Una película, una partida, una salida o un rato de tu hobby: todo cuenta.
        </p>
      )}
    </motion.section>
  );

  const balanceCard = (
    <Card as="section" padding="lg" aria-labelledby="rec-balance" className="flex flex-col gap-4">
      <div>
        <h2 id="rec-balance" className="text-heading-sm">Tu ocio en 30 días</h2>
        <p className="text-body-sm text-on-surface-light">Qué tanto de cada cosa, para que ningún tipo de descanso se quede fuera.</p>
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
        <p className="text-body-md text-on-surface-light">Cuando registres funciones, aquí verás el reparto entre películas, juegos, salidas y hobbies.</p>
      )}
      <p className="border-t border-border pt-3 text-body-sm text-on-surface">
        Cada función vivida suma 15 XP y oro, hasta 3 al día; al subir de nivel crece tu Carisma. El Sabio la tiene en cuenta junto con tu sueño, tus entrenos y tus hábitos.
      </p>
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
        <PageLoader label="Apagando las luces…" words={LOADING_COPY.recreation} />
      ) : state === 'error' ? (
        <ErrorState title="No pudimos abrir la sala" onRetry={() => void load()} />
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
