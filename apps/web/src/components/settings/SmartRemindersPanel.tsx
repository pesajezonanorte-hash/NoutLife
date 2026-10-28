// Avisos inteligentes en Ajustes: cada zona tiene su interruptor y sus horas. Lo que no se
// activa no envía nada. El bloque de Ciclo solo aparece a quien usa la zona Ciclo. El
// sonido dentro de la app es de este dispositivo (lib/audio). Hábitos, Sabiduría y Coliseo
// aprenden la hora de lo que haces en la app («Según tu costumbre») o usan la que fijes; una
// zona cuyos avisos no abres se pausa sola y aquí se puede reanudar.
import { useEffect, useState } from 'react';
import { PauseCircle, Plus, Sparkles, X } from 'lucide-react';
import { Button, Field, Input, SegmentedControl, Select, Switch, type SegmentOption } from '@/components/ui/lq';
import { audio } from '@/lib/audio';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import {
  fetchLearningInsights, resumeLearnZone, type LearnZone, type LearningInsights, type SmartReminderPatch, type SmartReminderSettings,
} from '@/services/notification.service';

const es = {
  intro: 'Elige qué te recordamos y a qué hora. Con la app abierta llegan como una nota con una campana suave; fuera de ella, como aviso del móvil (los de agua y la cita del día, sin sonido). Cada hábito con hora y cada evento de la Agenda con aviso te avisan solos.',
  learnIntro: 'Con «Según tu costumbre», la hora se ajusta sola a lo que haces en la app. Si dejas de abrir los avisos de algo, dejan de sonar hasta que vuelvas a abrir uno.',
  learnAuto: 'Según tu costumbre',
  and: 'y',
  learnFixed: 'Hora fija',
  modeAria: (zone: string): string => `Hora de ${zone}`,
  habitsLearned: (time: string): string => `Te avisamos a las ${time}, media hora antes de cuando sueles completarlos.`,
  wisdomLearned: (time: string): string => `Llega a las ${time}, cuando sueles empezar tu día en Noutlife.`,
  stillLearning: (time: string): string => `Aún aprendo tu horario: mientras tanto, a las ${time}.`,
  coliseoLearned: (days: string, time: string): string => `Sueles entrenar ${days}: te avisamos a las ${time} si aún no entrenaste.`,
  coliseoLearning: 'Aún aprendo tu horario: tras unas sesiones te aviso los días que sueles entrenar.',
  coliseoFixed: 'A esta hora, los días que sueles entrenar o te toca una rutina.',
  paused: 'En pausa: como no abriste sus últimos avisos, ya no suenan en el móvil (siguen en la campana).',
  resume: 'Reanudar',
  sectionAria: 'Avisos inteligentes',
  sectionTitle: 'Avisos inteligentes',
  soundTitle: 'Sonido dentro de la app',
  soundDesc: 'Una campana suave cuando llega un aviso con Noutlife abierta, también en segundo plano. Solo en este dispositivo.',
  hour: 'Hora',
  habitsTitle: 'Hábitos pendientes',
  habitsDesc: 'A esta hora, si te queda algún hábito de hoy sin marcar, te dice cuáles.',
  coliseoTitle: 'Entrenamiento',
  coliseoDesc: 'Te recuerda entrenar los días que sueles hacerlo (o los de tu rutina) si aún no has entrenado.',
  careTitle: 'Rutinas de cuidado y rituales',
  careDesc: 'Un recordatorio a la hora de tu rutina de mañana o de noche, si aún no la hiciste.',
  morning: 'Mañana',
  night: 'Noche',
  cycleTitle: 'Ciclo',
  cycleDesc: 'Avisos discretos: el registro del día y la siguiente regla. Nada en el aviso deja ver de qué se trata.',
  waterTitle: 'Agua',
  waterDesc: 'Un aviso cada cierto tiempo mientras no llegues a tu meta de agua del día. Tócalo para sumar un vaso.',
  everyLabel: 'Cada cuánto',
  waterEveryAria: 'Cada cuánto avisar de agua',
  from: 'Desde',
  to: 'Hasta',
  breaksTitle: 'Pausas activas',
  breaksDesc: 'Durante tu jornada, un aviso para levantarte, estirarte y respirar.',
  everyAfter: 'Cada cuánto',
  workdays: 'Solo de lunes a viernes',
  mealsTitle: 'Comidas',
  mealsDesc: 'Si hoy no has registrado ninguna comida, te avisa a estas horas.',
  mealN: (n: number): string => `Comida ${n}`,
  removeMeal: (n: number): string => `Quitar la hora de la comida ${n}`,
  addTime: 'Agregar hora',
  wisdomTitle: 'Sabiduría del día',
  wisdomDesc: 'Una cita escogida según en qué progresas esta semana.',
};

const en: typeof es = {
  intro: 'Pick what we remind you about and when. With the app open they arrive as a note with a soft chime; outside it, as a phone alert (water and the day’s appointment, without sound). Every habit with a time and every Agenda event with a reminder will alert you on its own.',
  learnIntro: 'With “Based on your routine”, the time adjusts itself to what you do in the app. If you stop opening the alerts about something, they go quiet until you open one again.',
  learnAuto: 'Based on your routine',
  and: 'and',
  learnFixed: 'Fixed time',
  modeAria: (zone: string): string => `Time for ${zone}`,
  habitsLearned: (time: string): string => `We remind you at ${time}, half an hour before you usually complete them.`,
  wisdomLearned: (time: string): string => `It arrives at ${time}, when you usually start your day in Noutlife.`,
  stillLearning: (time: string): string => `Still learning your schedule: meanwhile, at ${time}.`,
  coliseoLearned: (days: string, time: string): string => `You usually train on ${days}: we remind you at ${time} if you have not trained yet.`,
  coliseoLearning: 'Still learning your schedule: after a few sessions I will remind you on the days you usually train.',
  coliseoFixed: 'At this time, on the days you usually train or have a routine.',
  paused: 'Paused: since you did not open its last alerts, they no longer ring on your phone (they stay in the bell).',
  resume: 'Resume',
  sectionAria: 'Smart reminders',
  sectionTitle: 'Smart reminders',
  soundTitle: 'Sound inside the app',
  soundDesc: 'A soft chime when a reminder arrives while Noutlife is open, also in the background. Only on this device.',
  hour: 'Time',
  habitsTitle: 'Pending habits',
  habitsDesc: 'At this time, if any of today’s habits is still unmarked, it tells you which ones.',
  coliseoTitle: 'Training',
  coliseoDesc: 'Reminds you to train on the days you usually do (or your routine days) if you have not trained yet.',
  careTitle: 'Care routines and rituals',
  careDesc: 'A reminder at the time of your morning or night routine, if you have not done it yet.',
  morning: 'Morning',
  night: 'Night',
  cycleTitle: 'Cycle',
  cycleDesc: 'Discreet reminders: today’s log and the next period. Nothing in the alert reveals what it is about.',
  waterTitle: 'Water',
  waterDesc: 'A reminder every so often while you have not reached your water goal for the day. Tap it to add a glass.',
  everyLabel: 'How often',
  waterEveryAria: 'How often to remind about water',
  from: 'From',
  to: 'To',
  breaksTitle: 'Active breaks',
  breaksDesc: 'During your day, a reminder to get up, stretch and breathe.',
  everyAfter: 'How often',
  workdays: 'Weekdays only',
  mealsTitle: 'Meals',
  mealsDesc: 'If you have not logged any meal today, it reminds you at these times.',
  mealN: (n: number): string => `Meal ${n}`,
  removeMeal: (n: number): string => `Remove the time for meal ${n}`,
  addTime: 'Add time',
  wisdomTitle: 'Wisdom of the day',
  wisdomDesc: 'A quote chosen by what you are making progress on this week.',
};

const COPY: Copy<typeof es> = { es, en };

const MAX_MEAL_TIMES = 4;
const HOURS: SegmentOption<string>[] = [1, 2, 3, 4].map((h) => ({ value: String(h), label: `${h} h` }));
const BREAK_EVERY: SegmentOption<string>[] = [
  { value: '30', label: '30 min' }, { value: '45', label: '45 min' }, { value: '60', label: '1 h' }, { value: '90', label: '1 h 30 min' }, { value: '120', label: '2 h' },
];

interface Props {
  settings: SmartReminderSettings;
  isFemale: boolean;
  onChange: (patch: SmartReminderPatch) => void;
}

function Zone({ id, title, description, checked, onToggle, children }: {
  id: string; title: string; description: string; checked: boolean; onToggle: (on: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="text-label-lg md:text-body-md md:font-semibold">{title}</label>
          <p className="text-body-sm text-on-surface-light">{description}</p>
        </div>
        <Switch id={id} checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      </div>
      {checked && children && <div className="flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}

export function SmartRemindersPanel({ settings: s, isFemale, onChange }: Props) {
  const t = useText(COPY);
  const nf = INTL_LOCALE[useLocale()];
  const [sound, setSound] = useState(audio.alertSound);
  /** Lo aprendido de la persona (horas habituales y zonas en pausa); sin respuesta, solo lo manual. */
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  useEffect(() => { fetchLearningInsights().then(setInsights).catch(() => null); }, []);
  // Un campo de hora vacío no se guarda: el navegador lo deja vacío mientras se escribe.
  const time = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}><Input type="time" value={value} onChange={(e) => e.target.value && set(e.target.value)} /></Field>
  );
  /** Minutos del día → «7:40 a. m.» o «7:40 AM», según el idioma. */
  const clock = (m: number) => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString(nf, { hour: 'numeric', minute: '2-digit' });
  const clockOf = (hhmm: string) => clock(Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)));
  /** Días 0–6 (domingo primero) → «lunes, miércoles y viernes». */
  const days = (list: number[]) => {
    const names = list.map((d) => new Date(2023, 0, 1 + d).toLocaleDateString(nf, { weekday: 'long' }));
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t.and} ${names[names.length - 1]}` : names[0] ?? '';
  };
  const mode = (zone: string, manual: boolean, set: (manual: boolean) => void) => (
    <SegmentedControl
      label={t.modeAria(zone)} role="radiogroup" value={manual ? 'fixed' : 'auto'} onChange={(v) => set(v === 'fixed')}
      options={[{ value: 'auto', label: t.learnAuto }, { value: 'fixed', label: t.learnFixed }]}
    />
  );
  const note = (text: string) => (
    <p className="flex w-full items-start gap-2 text-body-sm text-on-surface-light">
      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" strokeWidth={1.75} />{text}
    </p>
  );
  /** Zona en pausa porque nadie abrió sus últimos avisos: se puede reanudar aquí. */
  const paused = (zone: LearnZone) => insights?.paused.includes(zone) && (
    <div role="status" className="flex w-full flex-wrap items-center gap-3 rounded-xl bg-warning/[var(--lq-soft-alpha)] p-3">
      <PauseCircle aria-hidden className="size-5 shrink-0 text-warning-text" strokeWidth={1.75} />
      <p className="min-w-0 flex-1 text-body-sm text-on-surface">{t.paused}</p>
      <Button size="sm" variant="secondary" onClick={() => void resumeLearnZone(zone).then(setInsights).catch(() => null)}>{t.resume}</Button>
    </div>
  );
  const coliseoOn = s.coliseo.time !== null || s.coliseo.learn !== false;

  return (
    <section aria-label={t.sectionAria} className="flex flex-col">
      <h3 className="text-heading-sm">{t.sectionTitle}</h3>
      <p className="max-w-prose text-body-sm text-on-surface-light">{t.intro}</p>
      <p className="mt-2 max-w-prose text-body-sm text-on-surface-light">{t.learnIntro}</p>

      <Zone
        id="sr-sound" title={t.soundTitle} checked={sound}
        description={t.soundDesc}
        onToggle={(on) => { setSound(on); audio.setAlertSound(on); }}
      />

      {s.habits && (
        <Zone
          id="sr-habits" title={t.habitsTitle} checked={s.habits.enabled}
          description={t.habitsDesc}
          onToggle={(on) => onChange({ habits: { enabled: on } })}
        >
          {mode(t.habitsTitle, Boolean(s.habits.manual), (manual) => onChange({ habits: { manual } }))}
          {s.habits.manual
            ? time(t.hour, s.habits.time, (v) => onChange({ habits: { time: v, manual: true } }))
            : note(insights?.habits.at != null ? t.habitsLearned(clock(insights.habits.at)) : t.stillLearning(clockOf(s.habits.time)))}
          {paused('habits')}
        </Zone>
      )}

      <Zone
        id="sr-coliseo" title={t.coliseoTitle} checked={coliseoOn}
        description={t.coliseoDesc}
        onToggle={(on) => onChange({ coliseo: on ? { learn: true, time: null } : { learn: false, time: null } })}
      >
        {mode(t.coliseoTitle, s.coliseo.time !== null, (fixed) => onChange({ coliseo: { learn: true, time: fixed ? '18:00' : null } }))}
        {s.coliseo.time !== null
          ? <>{time(t.hour, s.coliseo.time, (v) => onChange({ coliseo: { time: v } }))}{note(t.coliseoFixed)}</>
          : note(insights?.coliseo.at != null && insights.coliseo.weekdays.length
            ? t.coliseoLearned(days(insights.coliseo.weekdays), clock(insights.coliseo.at))
            : t.coliseoLearning)}
        {paused('coliseo')}
      </Zone>

      <Zone
        id="sr-care" title={t.careTitle} checked={s.care.enabled}
        description={t.careDesc}
        onToggle={(on) => onChange({ care: { enabled: on } })}
      >
        {time(t.morning, s.care.morning, (v) => onChange({ care: { morning: v } }))}
        {time(t.night, s.care.night, (v) => onChange({ care: { night: v } }))}
      </Zone>

      {isFemale && (
        <Zone
          id="sr-cycle" title={t.cycleTitle} checked={s.cycle.enabled}
          description={t.cycleDesc}
          onToggle={(on) => onChange({ cycle: { enabled: on } })}
        >
          {paused('cycle')}
        </Zone>
      )}

      <Zone
        id="sr-hydration" title={t.waterTitle} checked={s.hydration.enabled}
        description={t.waterDesc}
        onToggle={(on) => onChange({ hydration: { enabled: on } })}
      >
        <div className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface-light">{t.everyLabel}</span>
          <SegmentedControl
            label={t.waterEveryAria} options={HOURS} value={String(s.hydration.everyHours)}
            onChange={(v) => onChange({ hydration: { everyHours: Number(v) as 1 | 2 | 3 | 4 } })}
          />
        </div>
        {time(t.from, s.hydration.from, (v) => onChange({ hydration: { from: v } }))}
        {time(t.to, s.hydration.to, (v) => onChange({ hydration: { to: v } }))}
      </Zone>

      {s.breaks && (
        <Zone
          id="sr-breaks" title={t.breaksTitle} checked={s.breaks.enabled}
          description={t.breaksDesc}
          onToggle={(on) => onChange({ breaks: { enabled: on } })}
        >
          <Field label={t.everyAfter}>
            <Select value={String(s.breaks.everyMinutes)} onChange={(e) => onChange({ breaks: { everyMinutes: Number(e.target.value) as SmartReminderSettings['breaks']['everyMinutes'] } })}>
              {BREAK_EVERY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          {time(t.from, s.breaks.from, (v) => onChange({ breaks: { from: v } }))}
          {time(t.to, s.breaks.to, (v) => onChange({ breaks: { to: v } }))}
          <label className="flex min-h-11 items-center gap-3 text-body-md">
            <Switch checked={s.breaks.workdays} onChange={(e) => onChange({ breaks: { workdays: e.target.checked } })} aria-label={t.workdays} />
            {t.workdays}
          </label>
        </Zone>
      )}

      <Zone
        id="sr-meals" title={t.mealsTitle} checked={s.meals.enabled}
        description={t.mealsDesc}
        onToggle={(on) => onChange({ meals: { enabled: on } })}
      >
        {s.meals.times.map((mealTime, i) => (
          <div key={`${i}-${mealTime}`} className="flex items-end gap-2">
            {time(t.mealN(i + 1), mealTime, (v) => onChange({ meals: { times: s.meals.times.map((x, k) => (k === i ? v : x)) } }))}
            <Button variant="icon" aria-label={t.removeMeal(i + 1)} onClick={() => onChange({ meals: { times: s.meals.times.filter((_, k) => k !== i) } })}>
              <X aria-hidden className="size-5" />
            </Button>
          </div>
        ))}
        {s.meals.times.length < MAX_MEAL_TIMES && (
          <Button variant="secondary" size="md" onClick={() => onChange({ meals: { times: [...s.meals.times, '13:00'] } })}>
            <Plus aria-hidden className="size-4" />{t.addTime}
          </Button>
        )}
      </Zone>

      <Zone
        id="sr-wisdom" title={t.wisdomTitle} checked={s.wisdom.enabled}
        description={t.wisdomDesc}
        onToggle={(on) => onChange({ wisdom: { enabled: on } })}
      >
        {mode(t.wisdomTitle, Boolean(s.wisdom.manual), (manual) => onChange({ wisdom: { manual } }))}
        {s.wisdom.manual
          ? time(t.hour, s.wisdom.time, (v) => onChange({ wisdom: { time: v, manual: true } }))
          : note(insights?.wisdom.at != null ? t.wisdomLearned(clock(insights.wisdom.at)) : t.stillLearning(clockOf(s.wisdom.time)))}
        {paused('wisdom')}
      </Zone>
    </section>
  );
}
