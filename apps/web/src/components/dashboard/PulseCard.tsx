// Pronóstico de tu semana: cuánto pesa cada uno de los próximos 7 días, como el pronóstico del tiempo
// (despejado, nublado, tormenta). Junta evaluaciones, entregas, agenda, hábitos, sueño atrasado y pagos;
// tocar un día muestra qué lo carga, y abajo va una sola sugerencia para aliviar el día más pesado.
// Es una estimación con reglas fijas (apps/api/src/lib/pulse.ts), y así se presenta.
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CloudLightning, CloudSun, Sun, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { heavy, useMotionReduced } from '@/lib/motion';
import { buttonClasses, Card } from '@/components/ui/lq';
import { useLifeChange } from '@/lib/lifeSync';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { fetchPulse, type Pulse, type PulseAdvice, type PulseFactor, type PulseLevel } from '@/services/pulse.service';

const es = {
  title: 'Pronóstico de tu semana',
  desc: 'Qué tan cargado viene cada día, según lo que ya tienes anotado.',
  levels: { clear: 'Despejado', cloudy: 'Nublado', storm: 'Tormenta' } as Record<PulseLevel, string>,
  today: 'Hoy',
  dayAria: (day: string, level: string, load: number): string => `${day}: ${level}, carga ${load} de 100`,
  nothing: 'Nada anotado para este día.',
  factor: {
    exam: (f: PulseFactor): string => (f.title ? `Evaluación: ${f.title}` : 'Evaluaciones cerca'),
    task: (f: PulseFactor): string => (f.count === 1 && f.title ? `Entrega: ${f.title}` : `${f.count} entregas`),
    agenda: (f: PulseFactor): string => `${f.count} ${f.count === 1 ? 'evento' : 'eventos'} en la agenda`,
    habits: (f: PulseFactor): string => `${f.count} ${f.count === 1 ? 'hábito' : 'hábitos'}`,
    sleep: (f: PulseFactor): string => `Sueño atrasado: ${f.count.toLocaleString('es-CO')} h por noche`,
    money: (f: PulseFactor): string => (f.count === 1 && f.title ? `Pago: ${f.title}` : `${f.count} pagos`),
  },
  advice: {
    study: (a: PulseAdvice, day: string, to: string | null): string => `${day} viene pesado por ${a.title}.${a.count ? ` Te quedan ${a.count} temas sin practicar:` : ''} ${to ? `repásalos ${to}, que es más ligero.` : 'empieza a repasar hoy.'}`,
    move: (a: PulseAdvice, day: string, to: string | null): string => `${day} se llena${a.title ? ` (${a.title})` : ''}. Adelanta algo ${to ?? 'antes'}, que va más ligero.`,
    today: (a: PulseAdvice): string => `Hoy es tu día más cargado.${a.title ? ` Empieza por ${a.title}.` : ''} Lo demás puede esperar a mañana.`,
    sleep: (a: PulseAdvice): string => `Llevas un sueño atrasado de ${(a.count ?? 0).toLocaleString('es-CO')} h por noche. Acostarte un poco antes hoy aliviana los próximos días.`,
    calm: (): string => 'Semana tranquila. Buen momento para adelantar algo o descansar de verdad.',
  },
  open: { study: 'Abrir Académico', move: 'Ver compromisos', today: 'Ver compromisos', sleep: 'Abrir Sueño', calm: '' } as Record<PulseAdvice['kind'], string>,
  estimate: 'Es una estimación: suma lo que tienes anotado en la app.',
};

const en: typeof es = {
  title: 'Your week’s forecast',
  desc: 'How busy each day looks, based on what you already have noted.',
  levels: { clear: 'Clear', cloudy: 'Cloudy', storm: 'Stormy' } as Record<PulseLevel, string>,
  today: 'Today',
  dayAria: (day: string, level: string, load: number): string => `${day}: ${level}, load ${load} of 100`,
  nothing: 'Nothing noted for this day.',
  factor: {
    exam: (f: PulseFactor): string => (f.title ? `Assessment: ${f.title}` : 'Assessments coming up'),
    task: (f: PulseFactor): string => (f.count === 1 && f.title ? `Hand-in: ${f.title}` : `${f.count} hand-ins`),
    agenda: (f: PulseFactor): string => `${f.count} ${f.count === 1 ? 'event' : 'events'} in your agenda`,
    habits: (f: PulseFactor): string => `${f.count} ${f.count === 1 ? 'habit' : 'habits'}`,
    sleep: (f: PulseFactor): string => `Sleep debt: ${f.count.toLocaleString('en-US')} h a night`,
    money: (f: PulseFactor): string => (f.count === 1 && f.title ? `Payment: ${f.title}` : `${f.count} payments`),
  },
  advice: {
    study: (a: PulseAdvice, day: string, to: string | null): string => `${day} looks heavy because of ${a.title}.${a.count ? ` You have ${a.count} topics left to practise:` : ''} ${to ? `review them ${to}, which is lighter.` : 'start reviewing today.'}`,
    move: (a: PulseAdvice, day: string, to: string | null): string => `${day} fills up${a.title ? ` (${a.title})` : ''}. Move something to ${to ?? 'earlier'}, which is lighter.`,
    today: (a: PulseAdvice): string => `Today is your busiest day.${a.title ? ` Start with ${a.title}.` : ''} The rest can wait until tomorrow.`,
    sleep: (a: PulseAdvice): string => `You are ${(a.count ?? 0).toLocaleString('en-US')} h a night short on sleep. Going to bed a little earlier tonight lightens the next few days.`,
    calm: (): string => 'A calm week. A good moment to get ahead or to truly rest.',
  },
  open: { study: 'Open Academic', move: 'See commitments', today: 'See commitments', sleep: 'Open Sleep', calm: '' } as Record<PulseAdvice['kind'], string>,
  estimate: 'It is an estimate: it adds up what you have noted in the app.',
};

const COPY: Copy<typeof es> = { es, en };

const LEVEL: Record<PulseLevel, { icon: LucideIcon; bar: string; text: string }> = {
  // Despejado va en el jade de la marca (el primario del tema es casi negro).
  clear: { icon: Sun, bar: 'from-[rgb(var(--lq-jade-300))] to-[rgb(var(--lq-jade-500))]', text: 'text-primary-text' },
  cloudy: { icon: CloudSun, bar: 'from-info/50 to-info', text: 'text-info-text' },
  storm: { icon: CloudLightning, bar: 'from-warning/60 to-warning', text: 'text-warning-text' },
};
const LINK: Record<PulseAdvice['kind'], string | null> = { study: '/learning?tab=academico', move: '/learning?tab=academico', today: '/learning?tab=academico', sleep: '/sleep', calm: null };

const asDate = (day: string) => new Date(`${day}T12:00:00`);

export function PulseCard() {
  const t = useText(COPY);
  const locale = useLocale();
  const reduce = useMotionReduced();
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [picked, setPicked] = useState(0);

  const load = useCallback(() => { void fetchPulse().then(setPulse).catch(() => undefined); }, []);
  useEffect(load, [load]);
  // Marcar un hábito o anotar algo en otra zona cambia el pronóstico.
  useLifeChange(load, 2000);

  if (!pulse) return null;
  const weekday = (day: string, i: number) => (i === 0 ? t.today : asDate(day).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'short' }).replace('.', ''));
  const longDay = (day: string | undefined) => {
    if (!day) return null;
    const i = pulse.days.findIndex((d) => d.day === day);
    return i === 0 ? t.today.toLowerCase() : asDate(day).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long' });
  };
  const cap = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const a = pulse.advice;
  const adviceText = a.kind === 'study' ? t.advice.study(a, cap(longDay(a.day)), longDay(a.to))
    : a.kind === 'move' ? t.advice.move(a, cap(longDay(a.day)), longDay(a.to))
    : a.kind === 'today' ? t.advice.today(a)
    : a.kind === 'sleep' ? t.advice.sleep(a)
    : t.advice.calm();
  const day = pulse.days[picked];
  const link = LINK[a.kind];

  return (
    <Card as="section" padding="lg" aria-labelledby="pulse-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="pulse-title" className="text-heading-sm md:text-heading-lg">{t.title}</h2>
        <p className="text-body-sm text-on-surface-light">{t.desc}</p>
      </div>

      {/* Siete columnas de vidrio: la altura es la carga del día. */}
      <div role="radiogroup" aria-label={t.title} className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {pulse.days.map((d, i) => {
          const meta = LEVEL[d.level];
          const on = picked === i;
          return (
            <button
              key={d.day} type="button" role="radio" aria-checked={on} aria-label={t.dayAria(weekday(d.day, i), t.levels[d.level], d.load)}
              onClick={() => setPicked(i)}
              className={cn('group flex flex-col items-center gap-2 rounded-xl px-0.5 py-2 transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary', on ? 'bg-[rgb(var(--lq-jade-400)/.18)]' : 'hover:bg-surface-variant')}
            >
              <span className={cn('text-label-md capitalize', on ? 'text-primary-text' : 'text-on-surface-light')}>{weekday(d.day, i)}</span>
              <meta.icon aria-hidden className={cn('size-5', meta.text)} strokeWidth={1.75} />
              <span className="lq-well relative flex h-24 w-full max-w-9 items-end overflow-hidden p-0.5">
                <motion.span
                  className={cn('block w-full rounded-[0.7rem] bg-gradient-to-t', meta.bar)}
                  style={{ height: `${Math.max(6, d.load)}%`, originY: 1 }}
                  initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...heavy, delay: reduce ? 0 : 0.1 + i * 0.05 }}
                />
              </span>
              <span className="font-mono text-label-md tabular-nums text-on-surface">{d.load}</span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="flex flex-col gap-1">
        <p className="text-label-lg">{cap(longDay(day.day))} · {t.levels[day.level]}</p>
        {day.factors.length === 0 ? (
          <p className="text-body-sm text-on-surface-light">{t.nothing}</p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {day.factors.map((f) => <li key={f.kind} className="text-body-sm text-on-surface">{t.factor[f.kind](f)}</li>)}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-surface-variant p-4 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-body-md text-on-surface">{adviceText}</p>
        {link && <Link to={link} className={buttonClasses('secondary', 'sm')}>{t.open[a.kind]}</Link>}
      </div>
      <p className="text-body-sm text-on-surface-light">{t.estimate}</p>
    </Card>
  );
}
