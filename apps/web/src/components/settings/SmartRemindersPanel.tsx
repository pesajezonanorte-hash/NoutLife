// Avisos inteligentes en Ajustes: cada zona tiene su interruptor y sus horas. Lo que no se
// activa no envía nada. El bloque de Ciclo solo aparece a quien usa la zona Ciclo. El
// sonido dentro de la app es de este dispositivo (lib/audio).
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, SegmentedControl, Select, Switch, type SegmentOption } from '@/components/ui/lq';
import { audio } from '@/lib/audio';
import { useText, type Copy } from '@/lib/i18n';
import type { SmartReminderPatch, SmartReminderSettings } from '@/services/notification.service';

const es = {
  intro: 'Elige qué te recordamos y a qué hora. Con la app abierta llegan como una nota con una campana suave; fuera de ella, como aviso del móvil (los de agua y la cita del día, sin sonido). Cada hábito con hora y cada evento de la Agenda con aviso te avisan solos.',
  sectionAria: 'Avisos inteligentes',
  sectionTitle: 'Avisos inteligentes',
  soundTitle: 'Sonido dentro de la app',
  soundDesc: 'Una campana suave cuando llega un aviso con Noutlife abierta, también en segundo plano. Solo en este dispositivo.',
  hour: 'Hora',
  habitsTitle: 'Hábitos pendientes',
  habitsDesc: 'A esta hora, si te queda algún hábito de hoy sin marcar, te dice cuáles.',
  coliseoTitle: 'Entreno programado',
  coliseoDesc: 'Te avisa a la hora que elijas si hoy te toca una rutina y aún no has entrenado.',
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
  wisdomDesc: 'Una cita a la hora que elijas, escogida según en qué progresas esta semana.',
};

const en: typeof es = {
  intro: 'Pick what we remind you about and when. With the app open they arrive as a note with a soft chime; outside it, as a phone alert (water and the day’s appointment, without sound). Every habit with a time and every Agenda event with a reminder will alert you on its own.',
  sectionAria: 'Smart reminders',
  sectionTitle: 'Smart reminders',
  soundTitle: 'Sound inside the app',
  soundDesc: 'A soft chime when a reminder arrives while Noutlife is open, also in the background. Only on this device.',
  hour: 'Time',
  habitsTitle: 'Pending habits',
  habitsDesc: 'At this time, if any of today’s habits is still unmarked, it tells you which ones.',
  coliseoTitle: 'Scheduled training',
  coliseoDesc: 'Reminds you at the time you pick if today is a routine day and you have not trained yet.',
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
  wisdomDesc: 'A quote at the time you pick, chosen by what you are making progress on this week.',
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
  const [sound, setSound] = useState(audio.alertSound);
  // Un campo de hora vacío no se guarda: el navegador lo deja vacío mientras se escribe.
  const time = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}><Input type="time" value={value} onChange={(e) => e.target.value && set(e.target.value)} /></Field>
  );

  return (
    <section aria-label={t.sectionAria} className="flex flex-col">
      <h3 className="text-heading-sm">{t.sectionTitle}</h3>
      <p className="max-w-prose text-body-sm text-on-surface-light">{t.intro}</p>

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
          {time(t.hour, s.habits.time, (v) => onChange({ habits: { time: v } }))}
        </Zone>
      )}

      <Zone
        id="sr-coliseo" title={t.coliseoTitle} checked={s.coliseo.time !== null}
        description={t.coliseoDesc}
        onToggle={(on) => onChange({ coliseo: { time: on ? '18:00' : null } })}
      >
        {s.coliseo.time && time(t.hour, s.coliseo.time, (v) => onChange({ coliseo: { time: v } }))}
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
        />
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
        {time(t.hour, s.wisdom.time, (v) => onChange({ wisdom: { time: v } }))}
      </Zone>
    </section>
  );
}
