// Accesos a Social (amigos, cartas y gremios): el botón de la cabecera (móvil y
// escritorio) y el portal del inicio, una puerta circular que gira despacio con
// tus amigos en línea orbitando alrededor. Los dos llevan a donde hay algo
// pendiente: cartas sin abrir o palomas por responder.
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { ArrowRight, Flame, MessageCircle, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useSocialStore, type SocialPulse } from '@/store/socialStore';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';

/** El pulso llega en vivo (lib/live); al entrar en la app se pide una vez por si acaso. */
export function useSocialPulseSync() {
  const refresh = useSocialStore((s) => s.refresh);
  useEffect(() => { void refresh(); }, [refresh]);
}

/** Adónde ir según lo pendiente: cartas sin abrir, palomas recibidas o la sección. */
function socialTarget(pulse: SocialPulse | null) {
  if (pulse && pulse.unreadMessages + pulse.guildUnread > 0) return '/social?tab=cartas';
  if (pulse?.requests) return '/social?tab=directorio&view=requests';
  return '/social';
}

/** Icono de Social en la cabecera: número de pendientes o punto verde si hay gente en línea. */
export function SocialButton({ className }: { className?: string }) {
  const pulse = useSocialStore((s) => s.pulse);
  const { pathname } = useLocation();
  const reduce = useReducedMotionConfig();
  const letters = (pulse?.unreadMessages ?? 0) + (pulse?.guildUnread ?? 0);
  const count = letters + (pulse?.requests ?? 0);
  const online = (pulse?.onlineCount ?? 0) > 0;
  const active = pathname.startsWith('/social') || pathname.startsWith('/u/');
  const label = [
    'Social',
    letters ? `${letters} ${letters === 1 ? 'carta sin abrir' : 'cartas sin abrir'}` : null,
    pulse?.requests ? `${pulse.requests} ${pulse.requests === 1 ? 'paloma por responder' : 'palomas por responder'}` : null,
    online ? `${pulse!.onlineCount} en línea` : null,
  ].filter(Boolean).join(', ');
  return (
    <Link
      to={socialTarget(pulse)} aria-label={label} aria-current={active ? 'page' : undefined}
      className={cn('relative inline-flex size-11 items-center justify-center rounded-full transition-colors',
        active ? 'bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'text-on-surface hover:bg-surface-variant', className)}
    >
      <motion.span
        className="inline-flex"
        animate={count > 0 && !reduce ? { rotate: [0, -12, 10, -6, 0] } : { rotate: 0 }}
        transition={{ duration: 0.7, repeat: count > 0 && !reduce ? Infinity : 0, repeatDelay: 6 }}
      >
        <MessageCircle aria-hidden className="size-6" strokeWidth={1.75} />
      </motion.span>
      <AnimatePresence>
        {count > 0 ? (
          <motion.span
            key="count" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.snappy}
            className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error-text px-1 text-[0.6875rem] font-semibold tabular-nums text-background ring-2 ring-background"
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        ) : online ? (
          <motion.span key="online" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.snappy}
            className="absolute right-1.5 top-1.5 block size-2.5 rounded-full bg-success ring-2 ring-background">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60 [.reduce-motion_&]:hidden" style={{ animationDuration: '2.4s' }} />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Link>
  );
}

/** El portal del inicio: entrada grande y viva a Social. */
export function SocialPortal({ className }: { className?: string }) {
  const pulse = useSocialStore((s) => s.pulse);
  const reduce = useReducedMotionConfig();
  const online = pulse?.online ?? [];
  const letters = (pulse?.unreadMessages ?? 0) + (pulse?.guildUnread ?? 0);
  const lines = [
    letters ? { icon: MessageCircle, text: `${letters} ${letters === 1 ? 'carta sin abrir' : 'cartas sin abrir'}` } : null,
    pulse?.streaksWaiting ? { icon: Flame, text: `${pulse.streaksWaiting} ${pulse.streaksWaiting === 1 ? 'racha encendida espera' : 'rachas encendidas esperan'} que escribas hoy` } : null,
    pulse?.requests ? { icon: UserPlus, text: `${pulse.requests} ${pulse.requests === 1 ? 'paloma por responder' : 'palomas por responder'}` } : null,
  ].filter((x): x is { icon: typeof Users; text: string } => Boolean(x));
  const title = !pulse ? 'Tu gente' : pulse.friends === 0 ? 'Encuentra a tu gente' : pulse.onlineCount > 0 ? `${pulse.onlineCount} ${pulse.onlineCount === 1 ? 'amigo en línea' : 'amigos en línea'}` : 'Tu gente';
  const sub = !pulse ? 'Tu directorio, tus cartas y tus gremios.' : pulse.friends === 0 ? 'Envía una paloma a tus amigos y anótalos en tu directorio.' : lines.length ? null : 'Escríbeles una carta o envíales una foto.';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springs.gentle} className={className}>
      <Link
        to={socialTarget(pulse)}
        className="group relative flex items-center gap-5 overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md md:gap-6 md:p-5"
      >
        {/* La puerta: un anillo que gira y respira; los amigos en línea orbitan alrededor. */}
        <span aria-hidden className="relative flex size-24 shrink-0 items-center justify-center md:size-28">
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: 'conic-gradient(from 0deg, rgb(var(--lq-warning) / .9), rgb(var(--lq-error) / .7), rgb(var(--lq-info) / .75), rgb(var(--lq-success) / .8), rgb(var(--lq-warning) / .9))' }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          />
          <motion.span
            className="absolute inset-[5px] rounded-full bg-surface"
            animate={reduce ? undefined : { scale: [1, 0.96, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="absolute inset-[12px] rounded-full bg-[radial-gradient(circle_at_50%_40%,rgb(var(--lq-warning)/.28),transparent_70%)]" />
          <motion.span
            className="relative text-primary-text"
            animate={reduce ? undefined : { y: [0, -2, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Users className="size-8" strokeWidth={1.6} />
          </motion.span>
          {online.slice(0, 4).map((u, i, all) => {
            const a = (i / Math.max(all.length, 1)) * Math.PI * 2 - Math.PI / 2;
            return (
              <motion.span
                key={u.id}
                className="absolute left-1/2 top-1/2 -ml-3.5 -mt-3.5"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, x: Math.cos(a) * 46, y: Math.sin(a) * 46 }}
                transition={{ ...springs.heavy, delay: 0.3 + i * 0.12 }}
              >
                <AvatarDisplay avatarConfig={u.avatarConfig} avatarUrl={u.avatarUrl} size={28} animate="none" className="overflow-hidden rounded-full ring-2 ring-surface" />
              </motion.span>
            );
          })}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-label-lg text-primary-text">Social</span>
          <span className="text-heading-sm md:text-heading-md">{title}</span>
          {sub && <span className="text-body-sm text-on-surface-light">{sub}</span>}
          {lines.length > 0 && (
            <span className="flex flex-col gap-0.5">
              {lines.map(({ icon: Icon, text }, i) => (
                <motion.span key={text} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...springs.natural, delay: 0.2 + i * 0.08 }}
                  className="inline-flex items-center gap-1.5 text-body-sm text-on-surface">
                  <Icon aria-hidden className="size-4 text-warning-text" strokeWidth={1.75} />{text}
                </motion.span>
              ))}
            </span>
          )}
        </span>
        <span className="hidden items-center gap-1 text-label-lg text-primary-text sm:inline-flex">
          Entrar<ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
        <ArrowRight aria-hidden className="size-5 shrink-0 text-primary-text sm:hidden" />
      </Link>
    </motion.div>
  );
}
