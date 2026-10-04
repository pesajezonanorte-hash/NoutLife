// Campaña (CampaignDesktop). Temporada activa: cuenta atrás en vivo, pase
// Gratis/Premium, capítulos (eventos), jefe comunitario y tu temporada.
// Sin temporada: cuenta atrás a la próxima + interruptor «Avísame cuando empiece».
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bell, Coins, Crown, Flag, Gift, Mountain, Skull, Sparkles, Swords, Zap } from 'lucide-react';
import api from '@/lib/api';
import { item, stagger } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import {
  Badge, BossBar, Button, Card, Countdown, ErrorState, IconChip, LeaderRow, PageLoader, SeasonPassTrack, SegmentedControl,
  SpotCard, Switch, type PassReward,
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
    <motion.div variants={stagger} initial="initial" animate="animate" className="mx-auto flex max-w-[820px] flex-col items-center gap-8 pt-6 text-center md:pt-16">
      <motion.span variants={item}>
        <IconChip icon={Mountain} tone="primary" size="lg" className="lq-halo size-24 animate-float rounded-[36px] [.reduce-motion_&]:animate-none md:size-28" />
      </motion.span>
      <motion.div variants={item} className="flex flex-col gap-2">
        <span className="text-label-lg text-primary-text">Campaña</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg">No hay temporada activa</h1>
        <p className="text-body-lg text-on-surface-light">Vuelve pronto para la próxima batalla. Mientras tanto, cada XP que ganes cuenta para tu nivel.</p>
      </motion.div>
      <motion.div variants={item}><Countdown to={nextSeasonDate()} accent={false} className="justify-center" /></motion.div>
      <motion.div variants={item} className="w-full">
        <Card padding="md" className="flex items-center gap-4 text-left">
          <IconChip icon={Bell} tone="info" />
          <div className="flex-1">
            <label htmlFor="season-notify" className="text-label-lg md:text-body-md md:font-semibold">Avísame cuando empiece</label>
            <div className="text-body-sm text-on-surface-light">Te enviaremos una notificación el primer día.</div>
          </div>
          <Switch id="season-notify" checked={notify} onChange={(e) => toggle(e.target.checked)} />
        </Card>
      </motion.div>
    </motion.div>
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
  const ranked = [...season.participants].sort((a, b) => b.damageDealt - a.damageDealt);
  const myRank = ranked.findIndex((p) => p.userId === String(me?.id)) + 1;
  const n = Math.max(1, season.rewards.length);

  const rewards: PassReward[] = useMemo(() => season.rewards.slice(0, 10).map((r, i) => {
    const threshold = ((i + 1) / n) * 100;
    const id = `${i}`;
    const state: PassReward['state'] = track === 'premium' ? 'premium' : claimed.includes(id) ? 'claimed' : lostPct >= threshold ? 'claimable' : 'locked';
    return {
      level: Math.round(threshold), name: rewardName(r),
      icon: r.type === 'xp' ? Zap : r.type === 'gold' ? Coins : i === n - 1 ? Crown : Gift,
      tone: r.type === 'xp' ? 'primary' : r.type === 'gold' ? 'warning' : 'secondary', state,
    };
  }), [season.rewards, n, track, claimed, lostPct]);
  const tier = rewards.filter((r) => lostPct >= r.level).length;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <motion.div variants={item}>
        <SpotCard className="flex flex-wrap items-center gap-8 md:gap-10">
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-lg text-primary-text">Temporada activa</span>
              <Badge variant="success" icon={Sparkles}>En curso</Badge>
            </div>
            <h1 className="text-display-sm md:text-display-md lg:text-display-lg">{season.name}</h1>
            <p className="max-w-[480px] text-body-lg text-on-surface-light">{season.description}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button onClick={() => navigate('/quests')}><Flag aria-hidden className="size-4" strokeWidth={1.75} />Ver misiones</Button>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3">
            <span className="text-label-lg text-on-surface">Termina en</span>
            <Countdown to={season.endDate} />
          </div>
        </SpotCard>
      </motion.div>

      {rewards.length > 0 && (
        <motion.section variants={item} aria-labelledby="pass-t">
          <Card padding="lg" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="pass-t" className="text-heading-lg">Pase de temporada</h2>
                <p className="text-body-sm text-on-surface-light">
                  <span className="font-mono">{tier}</span> de <span className="font-mono">{rewards.length}</span> recompensas liberadas · se liberan a medida que la comunidad daña al jefe
                </p>
              </div>
              <div className="w-full max-w-[300px]">
                <SegmentedControl label="Pista" value={track} onChange={setTrack} options={[{ value: 'free', label: 'Gratis' }, { value: 'premium', label: 'Premium' }]} />
              </div>
            </div>
            <SeasonPassTrack
              key={track}
              rewards={rewards}
              progress={lostPct}
              onClaim={(r) => { claim(String(rewards.indexOf(r))); toast.success(`Reclamaste: ${r.name}`); }}
            />
            {track === 'premium' && <p className="text-body-sm text-on-surface-light">La pista Premium todavía no está disponible.</p>}
          </Card>
        </motion.section>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <motion.section variants={item} aria-labelledby="ch-t" className="flex min-w-0 flex-[2_1_520px] flex-col">
          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="ch-t" className="text-heading-lg">Capítulos</h2>
              <Badge variant="primary"><span className="font-mono">{season.events.length}</span> eventos</Badge>
            </div>
            {season.events.length === 0 ? (
              <p className="text-body-md text-on-surface-light">Aún no hay eventos en esta temporada.</p>
            ) : (
              <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2">
                {season.events.map((ev) => {
                  const live = Date.now() >= new Date(ev.startDate).getTime() && Date.now() <= new Date(ev.endDate).getTime();
                  return (
                    <motion.li key={ev.id} variants={item} className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-variant">
                      <IconChip icon={Swords} tone={live ? 'primary' : 'muted'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-label-lg md:text-body-md md:font-semibold">{ev.name}</div>
                        <div className="text-body-sm text-on-surface-light">{ev.description}</div>
                      </div>
                      <span className="font-mono text-label-lg tabular-nums text-primary-text">×{ev.bonusXpMult} XP</span>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </Card>
        </motion.section>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <motion.div variants={item}>
            <Card padding="lg">
              <BossBar eyebrow="Jefe de temporada" name={season.bossName} icon={Skull} hp={season.currentHp} maxHp={season.bossHp}
                note={`${season.participants.length.toLocaleString('es-CO')} aventureros han dañado al jefe. Cada hábito y misión le quita vida.`} />
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card padding="lg" className="flex flex-col gap-3">
              <h2 className="text-heading-sm">Tu temporada</h2>
              <div className="grid grid-cols-2 gap-2">
                <Card padding="sm" className="bg-background"><div className="text-body-sm text-on-surface-light">Tu daño</div><div className="font-mono text-heading-sm tabular-nums">{fmt(userDamage)}</div></Card>
                <Card padding="sm" className="bg-background"><div className="text-body-sm text-on-surface-light">Puesto</div><div className="font-mono text-heading-sm tabular-nums">{myRank ? `#${myRank}` : '—'}</div></Card>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {ranked.length > 0 && (
        <motion.section variants={item} aria-labelledby="dmg-t">
          <Card padding="sm" className="flex flex-col gap-1">
            <h2 id="dmg-t" className="px-3 pb-2 pt-2 text-heading-sm">Más daño al jefe</h2>
            <ol className="flex flex-col">
              {ranked.slice(0, 10).map((p, i) => (
                <LeaderRow key={p.userId} id={p.userId} position={i + 1} name={p.user.displayName} initials={initials(p.user.displayName)}
                  subtitle={`@${p.user.username} · Nivel ${p.user.level}`} score={fmt(p.damageDealt)} isYou={p.userId === String(me?.id)} toneIndex={i} />
              ))}
            </ol>
          </Card>
        </motion.section>
      )}
    </motion.div>
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
  return data?.season?.isActive !== false && data?.season ? <Active data={data} /> : <Inactive />;
}
