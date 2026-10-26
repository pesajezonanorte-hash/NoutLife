// Rachas apagadas hace poco (72 h): la llama queda en brasa y se puede volver a
// encender con oro. Al revivirla la brasa se aviva, saltan chispas y la llama
// sube de nuevo. Sale en el inicio (racha general y hábitos) y en Hábitos.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { Coins, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { refreshUser } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { apiError, getRevival, reviveActivity, reviveHabit, type Revival } from '@/services/network.service';
import { Button, Card } from '@/components/ui/lq';
import { INTL_LOCALE, useLocale, type Copy } from '@/lib/i18n';

const es = {
  back: (n: number) => `¡${n} días de vuelta!`,
  off: (n: number, hours: number) => `${n} días apagados · quedan ${hours} h para revivirla`,
  short: (n: number) => `Te faltan ${n} de oro`,
  revive: 'Revivir · ',
  label: 'Rachas que puedes revivir',
  title: 'Todavía puedes revivirlas',
  explain: 'Una racha que se apagó hace poco se puede encender otra vez con oro. Para la próxima, protegerla sale más barato:',
  shop: 'ver protectores de racha',
  activity: 'Tu racha general',
  activityRevived: (n: number) => `Racha de ${n} días encendida otra vez`,
  habitRevived: (title: string, n: number) => `"${title}" vuelve a tener ${n} días`,
  failed: 'No se pudo revivir la racha',
};

const en: typeof es = {
  back: (n) => `${n} days back!`,
  off: (n, hours) => `${n} days off · ${hours} h left to revive it`,
  short: (n) => `You need ${n} more gold`,
  revive: 'Revive · ',
  label: 'Streaks you can revive',
  title: 'You can still revive them',
  explain: 'A streak that went out recently can be relit with gold. Next time, protecting it costs less:',
  shop: 'see streak protectors',
  activity: 'Your overall streak',
  activityRevived: (n) => `${n}-day streak relit`,
  habitRevived: (title, n) => `“${title}” is back to ${n} days`,
  failed: "We couldn't revive the streak",
};

const COPY: Copy<typeof es> = { es, en };

const hoursLeft = (iso: string) => Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));

/** Brasa que respira; `lit` la convierte en llama con un estallido de chispas. */
function Ember({ lit, size = 56 }: { lit: boolean; size?: number }) {
  const reduce = useReducedMotionConfig();
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={{ backgroundColor: lit ? 'rgb(var(--lq-warning) / .22)' : 'rgb(var(--lq-on-surface-light) / .12)', scale: lit && !reduce ? [1, 1.25, 1.05] : 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.span
        className="relative inline-flex origin-bottom"
        animate={lit
          ? { color: 'rgb(var(--lq-warning))', scale: reduce ? 1 : [0.6, 1.35, 1], scaleY: 1 }
          : { color: 'rgb(var(--lq-on-surface-light))', scale: 0.8, scaleY: reduce ? 0.8 : [0.75, 0.85, 0.75] }}
        transition={lit ? springs.heavy : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Flame className={cn('size-7', lit && 'fill-warning/40')} strokeWidth={1.75} />
      </motion.span>
      <AnimatePresence>
        {lit && !reduce && Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              className="absolute size-1.5 rounded-full bg-warning"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(a) * size * 0.7, y: Math.sin(a) * size * 0.7 - 10, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </AnimatePresence>
    </span>
  );
}

function RevivalRow({ title, lost, cost, expiresAt, gold, onRevive }: { title: string; lost: number; cost: number; expiresAt: string; gold: number; onRevive: () => Promise<void> }) {
  const t = COPY[useLocale()];
  const [busy, setBusy] = useState(false);
  const [lit, setLit] = useState(false);
  const short = gold < cost;
  async function go() {
    setBusy(true);
    try { await onRevive(); setLit(true); }
    catch { /* el aviso ya se mostró */ }
    finally { setBusy(false); }
  }
  return (
    <motion.li layout exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }} className="flex flex-wrap items-center gap-4 py-3">
      <Ember lit={lit} />
      <div className="min-w-0 flex-[1_1_200px]">
        <p className="text-label-lg">{title}</p>
        <p className="text-body-sm text-on-surface-light">
          {lit ? t.back(lost) : t.off(lost, hoursLeft(expiresAt))}
        </p>
      </div>
      {!lit && (
        <Button size="sm" variant={short ? 'ghost' : 'primary'} disabled={short} loading={busy} onClick={() => void go()} title={short ? t.short(cost - gold) : undefined}>
          <Coins aria-hidden className="size-4" />{t.revive}<span className="font-mono tabular-nums">{cost}</span>
        </Button>
      )}
    </motion.li>
  );
}

export function StreakRevival({ scope = 'all', onRevived, className }: { scope?: 'all' | 'habits'; onRevived?: () => void; className?: string }) {
  const locale = useLocale();
  const t = COPY[locale];
  const toast = useToast();
  const [data, setData] = useState<Revival | null>(null);
  const [done, setDone] = useState<string[]>([]);

  const load = useCallback(() => { getRevival().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { load(); }, [load]);

  const finish = (key: string, msg: string) => {
    toast.success(msg);
    void refreshUser();
    onRevived?.();
    // La fila muestra la llama encendida un momento y luego se retira.
    window.setTimeout(() => setDone((d) => [...d, key]), 1800);
  };

  if (!data) return null;
  const activity = scope === 'all' && data.activity && !done.includes('activity') ? data.activity : null;
  const habits = data.habits.filter((h) => !done.includes(h.id));
  if (!activity && habits.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={springs.natural} className={className}>
      <Card as="section" padding="lg" aria-label={t.label} className="flex flex-col gap-1 border-warning/30">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-heading-sm">{t.title}</h2>
          <span className="inline-flex items-center gap-1 font-mono text-body-sm tabular-nums text-warning-text"><Coins aria-hidden className="size-4" />{data.gold.toLocaleString(INTL_LOCALE[locale])}</span>
        </div>
        <p className="text-body-sm text-on-surface-light">
          {t.explain}{' '}
          <Link to="/shop" className="font-semibold text-primary-text underline-offset-4 hover:underline">{t.shop}</Link>.
        </p>
        <ul className="flex flex-col divide-y divide-border">
          <AnimatePresence initial={false}>
            {activity && (
              <RevivalRow
                key="activity" title={t.activity} lost={activity.lost} cost={activity.cost} expiresAt={activity.expiresAt} gold={data.gold}
                onRevive={async () => {
                  try { const r = await reviveActivity(); setData((d) => (d ? { ...d, gold: r.gold } : d)); finish('activity', t.activityRevived(r.streak)); }
                  catch (e) { toast.error(apiError(e, t.failed)); throw e; }
                }}
              />
            )}
            {habits.map((h) => (
              <RevivalRow
                key={h.id} title={h.title} lost={h.lost} cost={h.cost} expiresAt={h.expiresAt} gold={data.gold}
                onRevive={async () => {
                  try { const r = await reviveHabit(h.id); setData((d) => (d ? { ...d, gold: r.gold } : d)); finish(h.id, t.habitRevived(h.title, r.streak)); }
                  catch (e) { toast.error(apiError(e, t.failed)); throw e; }
                }}
              />
            ))}
          </AnimatePresence>
        </ul>
      </Card>
    </motion.div>
  );
}
