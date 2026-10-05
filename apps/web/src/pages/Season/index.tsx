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
import { Bell, Coins, Crown, Flag, Gift, Mountain, Skull, Sparkles, Swords, Zap } from 'lucide-react';
import api from '@/lib/api';
import { item, stagger } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
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

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
const longDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\p{L}/u, (c) => c.toUpperCase());

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

function rewardName(r: Season['rewards'][number]) {
  if (r.type === 'xp') return `${fmt(r.amount ?? 0)} XP`;
  if (r.type === 'gold') return `${fmt(r.amount ?? 0)} Gold`;
  return r.itemId ? r.itemId.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Objeto';
}

function Inactive() {
  const toast = useToast();
  // TODO(api): sin suscripción a avisos de temporada; la preferencia vive en este dispositivo.
  const [notify, setNotify] = useState(() => { try { return localStorage.getItem('lq-season-notify') !== 'off'; } catch { return true; } });
  const toggle = (on: boolean) => {
    setNotify(on);
    try { localStorage.setItem('lq-season-notify', on ? 'on' : 'off'); } catch { /* sin storage */ }
    toast.info(on ? 'Te avisaremos cuando empiece' : 'Aviso desactivado');
  };
  return (
    <Sheet className="mx-auto w-full max-w-[860px]">
      <Masthead
        title="Crónica de temporada"
        left={<span>Edición especial</span>}
        right={<span>Próxima temporada</span>}
        dateline={<span>{longDate(new Date())}</span>}
      />
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col items-center gap-6 pt-8 text-center">
        <motion.span variants={item}><IconChip icon={Mountain} tone="primary" size="lg" className="size-20 rounded-[28px]" /></motion.span>
        <motion.div variants={item} className="flex flex-col gap-2">
          <Ink as="h1" d={900} delay={500} className="text-display-sm md:text-display-md">No hay temporada activa</Ink>
          <p className="mx-auto max-w-[60ch] text-body-lg text-on-surface">Vuelve pronto para la próxima batalla. Mientras tanto, cada XP que ganes cuenta para tu nivel.</p>
        </motion.div>
        <motion.div variants={item}><Countdown to={nextSeasonDate()} accent={false} className="justify-center" /></motion.div>
        <motion.div variants={item} className="lq-rule w-full" aria-hidden="true" />
        <motion.div variants={item} className="flex w-full items-center gap-4 text-left">
          <IconChip icon={Bell} tone="info" />
          <div className="flex-1">
            <label htmlFor="season-notify" className="text-label-lg md:text-body-md md:font-semibold">Avísame cuando empiece</label>
            <div className="text-body-sm text-on-surface">Te enviaremos una notificación el primer día.</div>
          </div>
          <Switch id="season-notify" checked={notify} onChange={(e) => toggle(e.target.checked)} />
        </motion.div>
      </motion.div>
    </Sheet>
  );
}

function Active({ data }: { data: SeasonData }) {
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
      level: Math.round(threshold), name: rewardName(r),
      icon: r.type === 'xp' ? Zap : r.type === 'gold' ? Coins : i === n - 1 ? Crown : Gift,
      tone: r.type === 'xp' || r.type === 'gold' ? 'secondary' : 'forest', state,
    };
  }), [season.rewards, n, track, claimed, lostPct]);
  const tier = rewards.filter((r) => lostPct >= r.level).length;

  // Número de edición: el día de la temporada.
  const edition = Math.max(1, Math.floor((Date.now() - new Date(season.startDate).getTime()) / 86400000) + 1);
  const [fresh, setFresh] = useState<string | null>(null);
  // Lo que falta, para la oreja de la cabecera (la página se actualiza cada 30 s).
  const ms = Math.max(0, new Date(season.endDate).getTime() - Date.now());
  const daysLeft = Math.floor(ms / 86400000);
  const left = daysLeft >= 1 ? `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : `${Math.floor(ms / 3600000)} h`;

  return (
    <Sheet>
      <Masthead
        title="Crónica de temporada"
        left={<span>Edición nº <span className="font-mono">{edition}</span></span>}
        right={<span>Termina en <span className="font-mono">{left}</span></span>}
        dateline={<><span>{longDate(new Date())}</span><span><span className="font-mono">{fmt(season.participants?.length ?? 0)}</span> aventureros en la campaña</span></>}
      />

      {/* Titular de portada */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3 py-6 text-center md:py-8">
        <motion.div variants={item} className="flex justify-center"><Badge variant="success" icon={Sparkles}>Temporada en curso</Badge></motion.div>
        <Ink as="h1" d={1100} delay={650} className="mx-auto max-w-[22ch] text-display-sm [text-wrap:balance] md:text-display-md lg:text-display-lg">{season.name}</Ink>
        <motion.p variants={item} className="mx-auto max-w-[62ch] text-body-lg text-on-surface">{season.description}</motion.p>
        <motion.div variants={item} className="flex justify-center"><Button onClick={() => navigate('/quests')}><Flag aria-hidden className="size-4" strokeWidth={1.75} />Ver misiones</Button></motion.div>
      </motion.div>
      <div className="lq-rule" aria-hidden="true" />

      <motion.div variants={stagger} initial="initial" animate="animate" className="grid gap-6 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-8">
        {/* Crónica principal: el jefe de la temporada */}
        <motion.section variants={item} aria-labelledby="boss-t" className="flex flex-col gap-3">
          <span className="text-label-md text-error-text">Crónica principal</span>
          <Ink as="h2" d={800} delay={900} className="text-heading-lg md:text-heading-xl">
            <span id="boss-t">{season.bossName} ya perdió el <span className="font-mono">{Math.round(lostPct)}%</span> de su vida</span>
          </Ink>
          <BossBar eyebrow="Jefe de temporada" name={season.bossName} icon={Skull} hp={season.currentHp} maxHp={season.bossHp}
            note={`${(season.participants?.length ?? 0).toLocaleString('es-CO')} aventureros han dañado al jefe. Cada hábito y misión le quita vida.`} />
        </motion.section>
        {/* Recuadro lateral: tu crónica */}
        <motion.aside variants={item} aria-labelledby="mine-t" className="lq-rule-v flex flex-col gap-3 md:pl-8">
          <span className="text-label-md text-on-surface">En primera persona</span>
          <h2 id="mine-t" className="text-heading-md">Tu temporada</h2>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-body-sm text-on-surface">Tu daño</dt><dd className="font-mono text-heading-md tabular-nums">{fmt(userDamage)}</dd></div>
            <div><dt className="text-body-sm text-on-surface">Puesto</dt><dd className="font-mono text-heading-md tabular-nums">{myRank ? `#${myRank}` : '—'}</dd></div>
          </dl>
        </motion.aside>
      </motion.div>

      {rewards.length > 0 && (
        <>
          <div className="lq-rule" aria-hidden="true" />
          <section aria-labelledby="pass-t" className="flex flex-col gap-4 py-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="pass-t" className="text-heading-lg">Objetivos de la temporada</h2>
                <p className="text-body-sm text-on-surface">
                  <span className="font-mono">{tier}</span> de <span className="font-mono">{rewards.length}</span> cumplidos: se logran a medida que la comunidad daña al jefe.
                </p>
              </div>
              <div className="w-full max-w-[300px]">
                <SegmentedControl label="Pista" value={track} onChange={setTrack} options={[{ value: 'free', label: 'Gratis' }, { value: 'premium', label: 'Premium' }]} />
              </div>
            </div>
            {track === 'premium' && <p className="text-body-sm text-on-surface">La pista Premium todavía no está disponible.</p>}
            {/* Noticias breves en columnas */}
            <motion.ol variants={stagger} initial="initial" animate="animate" className="lq-columns columns-1 sm:columns-2 lg:columns-3">
              {rewards.map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.li key={i} variants={item} className={cn('relative mb-5 flex break-inside-avoid flex-col gap-1.5 border-b border-on-background/15 pb-5', r.state === 'locked' && 'opacity-70')}>
                    <span className="flex items-center gap-2 text-label-md text-on-surface"><Icon aria-hidden className="size-4" strokeWidth={1.75} />Al <span className="font-mono">{r.level}%</span> de daño</span>
                    <h3 className="text-heading-sm">{r.name}</h3>
                    <p className="text-body-sm text-on-surface">
                      {r.state === 'claimed' ? 'Recompensa recibida.' : r.state === 'claimable' ? 'La comunidad lo logró: ya puedes reclamarla.' : r.state === 'premium' ? 'Solo en la pista Premium.' : 'Aún falta daño al jefe para liberarla.'}
                    </p>
                    {r.state === 'claimable' && (
                      <Button size="sm" className="mt-1 self-start" onClick={() => { claim(String(i)); setFresh(String(i)); toast.success(`Reclamaste: ${r.name}`); }}>Reclamar</Button>
                    )}
                    {r.state === 'claimed' && <Stamp animate={fresh === String(i)} className="absolute right-0 top-1">Noticia cumplida</Stamp>}
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
            <h2 id="ch-t" className="text-heading-lg">Capítulos</h2>
            <span className="text-body-sm text-on-surface"><span className="font-mono">{(season.events ?? []).length}</span> eventos</span>
          </div>
          {(season.events ?? []).length === 0 ? (
            <p className="text-body-md text-on-surface">Aún no hay eventos en esta temporada.</p>
          ) : (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="lq-columns columns-1 lg:columns-2">
              {(season.events ?? []).map((ev) => {
                const live = Date.now() >= new Date(ev.startDate).getTime() && Date.now() <= new Date(ev.endDate).getTime();
                return (
                  <motion.li key={ev.id} variants={item} className="mb-4 flex break-inside-avoid flex-col gap-1 border-b border-on-background/15 pb-4">
                    {live && <span className="text-label-md text-error-text">Última hora: en curso</span>}
                    <h3 className="text-heading-sm">{ev.name}</h3>
                    <p className="text-body-sm text-on-surface">{ev.description}</p>
                    <span className="font-mono text-label-lg tabular-nums text-primary-text">×{ev.bonusXpMult} XP</span>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </section>
        {/* Clasificación: la tabla de la página de deportes */}
        {ranked.length > 0 && (
          <section aria-labelledby="dmg-t" className="lq-rule-v flex flex-col gap-3 md:pl-8">
            <h2 id="dmg-t" className="text-heading-lg">Más daño al jefe</h2>
            <ol className="flex flex-col">
              {ranked.slice(0, 10).map((p, i) => {
                const you = p.userId === String(me?.id);
                return (
                  <li key={p.userId} aria-current={you || undefined} className={cn('flex items-baseline gap-3 border-b border-dotted border-on-background/25 py-2', you && 'font-semibold text-secondary-text')}>
                    <span className="w-6 font-mono text-label-lg tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-body-md">{p.user.displayName}{you && ' (tú)'}</span>
                    <span className="font-mono text-label-lg tabular-nums">{fmt(p.damageDealt)}</span>
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
