// Recordatorios dentro de la app. Con Noutlife abierta, los avisos de hábitos,
// agenda, agua, pausas activas, rutinas y misiones caen arriba como una nota con
// una campana suave, en lugar del aviso del sistema (ver lib/systemNotifications y
// sw.js). Desde la nota se completa el hábito, se suma el vaso de agua, se pospone
// 10 min (el servidor lo vuelve a enviar a su hora) o se va a la zona. Se van solas
// a los 12 s, salvo mientras las lees (cursor o foco dentro).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarDays, CheckCircle2, Coffee, Droplets, Flag, Scroll, Swords, X, type LucideIcon } from 'lucide-react';
import { springs } from '@/lib/motion/presets';
import { audio } from '@/lib/audio';
import { onInAppAlert, onServiceWorkerAlert, type InAppAlert } from '@/lib/systemNotifications';
import { useMotionStore } from '@/store/motionStore';
import { useToastStore } from '@/hooks/useToast';
import { logHabit } from '@/services/habit.service';
import { createMeal } from '@/services/meal.service';
import { snoozeReminder } from '@/services/notification.service';
import { Button } from './lq';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  habitDone: 'Hábito completado',
  streakAlive: 'Tu racha sigue viva.',
  water: '+250 ml de agua',
  logFail: 'No se pudo registrar. Inténtalo desde la zona.',
  done: 'Listo',
  snoozed: 'Te lo recuerdo en 10 min.',
  snoozeFail: 'No se pudo posponer el aviso',
  water250: '+250 ml',
  complete: 'Completar',
  snooze: 'Posponer 10 min',
  view: 'Ver',
  close: 'Cerrar aviso',
  listAria: 'Recordatorios',
};

const en: typeof es = {
  habitDone: 'Habit completed',
  streakAlive: 'Your streak stays alive.',
  water: '+250 ml of water',
  logFail: 'Could not log it. Try again from the zone.',
  done: 'Done',
  snoozed: 'I will remind you again in 10 min.',
  snoozeFail: 'Could not snooze the reminder',
  water250: '+250 ml',
  complete: 'Complete',
  snooze: 'Snooze 10 min',
  view: 'View',
  close: 'Close reminder',
  listAria: 'Reminders',
};

const COPY: Copy<typeof es> = { es, en };

const SHOW_MS = 12_000;
const MAX_PINGS = 3;
/** El mismo aviso (por etiqueta) no se repite en 10 min: push y aviso local llegan juntos. */
const REPEAT_MS = 10 * 60_000;
const seen = new Map<string, number>();

interface Ping extends InAppAlert { id: string }

function iconOf(a: InAppAlert): LucideIcon {
  if (a.quick === 'water_250') return Droplets;
  if (a.tag.startsWith('break-')) return Coffee;
  const zone = a.link?.split(/[/?]/)[1] ?? '';
  return ({ habits: CheckCircle2, agenda: CalendarDays, coliseo: Swords, wisdom: Scroll, quests: Flag } as Record<string, LucideIcon>)[zone] ?? Bell;
}

function PingCard({ ping, onClose }: { ping: Ping; onClose: () => void }) {
  const t = useText(COPY);
  const navigate = useNavigate();
  const reduce = useMotionStore((s) => s.reduce);
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = iconOf(ping);

  useEffect(() => {
    if (held || busy) return;
    const t = window.setTimeout(onClose, SHOW_MS);
    return () => window.clearTimeout(t);
  }, [held, busy, onClose]);

  async function quick() {
    setBusy(true);
    try {
      if (ping.quick === 'habit_done' && ping.quickRef) {
        await logHabit(ping.quickRef, 'completed', undefined, ping.day);
        useToastStore.getState().success(t.habitDone, t.streakAlive);
      } else if (ping.quick === 'water_250') {
        await createMeal({ name: 'Agua', mealType: 'WATER', waterMl: 250, date: ping.day });
        useToastStore.getState().success(t.water);
      }
      onClose();
    } catch {
      setBusy(false);
      useToastStore.getState().error(t.logFail);
    }
  }

  async function snooze() {
    setBusy(true);
    try {
      await snoozeReminder(ping);
      useToastStore.getState().success(t.done, t.snoozed);
      onClose();
    } catch {
      setBusy(false);
      useToastStore.getState().error(t.snoozeFail);
    }
  }

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.97, transition: { duration: 0.18 } }}
      transition={springs.natural}
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)} onBlurCapture={() => setHeld(false)}
      className="lq-ping pointer-events-auto relative flex flex-col gap-3 p-3 pr-11"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[var(--lq-soft-alpha)] text-primary-text">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-label-lg text-on-background">{ping.title}</span>
          {ping.body && <span className="line-clamp-3 block break-words text-body-md text-on-surface">{ping.body}</span>}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 pl-[3.25rem]">
        {ping.quick && (
          <Button size="sm" loading={busy} onClick={() => void quick()}>
            {ping.quick === 'water_250' ? t.water250 : t.complete}
          </Button>
        )}
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void snooze()}>{t.snooze}</Button>
        {ping.link && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { navigate(ping.link!); onClose(); }}>{t.view}</Button>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label={t.close} className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full text-on-surface-light hover:bg-background hover:text-on-background">
        <X aria-hidden className="size-4" />
      </button>
    </motion.li>
  );
}

export function ReminderPings() {
  const t = useText(COPY);
  const [pings, setPings] = useState<Ping[]>([]);

  useEffect(() => {
    const show = (a: InAppAlert) => {
      const now = Date.now();
      if ((seen.get(a.tag) ?? 0) > now - REPEAT_MS) return true;
      seen.set(a.tag, now);
      setPings((list) => [...list.filter((p) => p.tag !== a.tag), { ...a, id: `${a.tag}:${now}` }].slice(-MAX_PINGS));
      audio.chime(a.quiet);
      return true;
    };
    const offSink = onInAppAlert(show);
    const offWorker = onServiceWorkerAlert();
    return () => { offSink(); offWorker(); };
  }, []);

  const close = (id: string) => setPings((list) => list.filter((p) => p.id !== id));

  return (
    <ul
      aria-label={t.listAria} aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[87] flex flex-col gap-2 sm:inset-x-auto sm:left-1/2 sm:top-[4.5rem] sm:w-[380px] sm:-translate-x-1/2"
    >
      <AnimatePresence initial={false}>
        {pings.map((p) => <PingCard key={p.id} ping={p} onClose={() => close(p.id)} />)}
      </AnimatePresence>
    </ul>
  );
}
