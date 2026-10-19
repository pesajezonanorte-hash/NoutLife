// Avisos inteligentes en Ajustes: cada zona tiene su interruptor y sus horas. Lo que no se
// activa no envía nada. El bloque de Ciclo solo aparece a quien usa la zona Ciclo. El
// sonido dentro de la app es de este dispositivo (lib/audio).
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Field, Input, SegmentedControl, Select, Switch, type SegmentOption } from '@/components/ui/lq';
import { audio } from '@/lib/audio';
import type { SmartReminderPatch, SmartReminderSettings } from '@/services/notification.service';

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
  const [sound, setSound] = useState(audio.alertSound);
  // Un campo de hora vacío no se guarda: el navegador lo deja vacío mientras se escribe.
  const time = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}><Input type="time" value={value} onChange={(e) => e.target.value && set(e.target.value)} /></Field>
  );

  return (
    <section aria-label="Avisos inteligentes" className="flex flex-col">
      <h3 className="text-heading-sm">Avisos inteligentes</h3>
      <p className="max-w-prose text-body-sm text-on-surface-light">
        Elige qué te recordamos y a qué hora. Con la app abierta llegan como una nota con una campana suave; fuera de ella, como aviso del móvil (los de agua y la cita del día, sin sonido). Cada hábito con hora y cada evento de la Agenda con aviso te avisan solos.
      </p>

      <Zone
        id="sr-sound" title="Sonido dentro de la app" checked={sound}
        description="Una campana suave cuando llega un aviso con Noutlife abierta, también en segundo plano. Solo en este dispositivo."
        onToggle={(on) => { setSound(on); audio.setAlertSound(on); }}
      />

      {s.habits && (
        <Zone
          id="sr-habits" title="Hábitos pendientes" checked={s.habits.enabled}
          description="A esta hora, si te queda algún hábito de hoy sin marcar, te dice cuáles."
          onToggle={(on) => onChange({ habits: { enabled: on } })}
        >
          {time('Hora', s.habits.time, (t) => onChange({ habits: { time: t } }))}
        </Zone>
      )}

      <Zone
        id="sr-coliseo" title="Entreno programado" checked={s.coliseo.time !== null}
        description="Te avisa a la hora que elijas si hoy te toca una rutina y aún no has entrenado."
        onToggle={(on) => onChange({ coliseo: { time: on ? '18:00' : null } })}
      >
        {s.coliseo.time && time('Hora', s.coliseo.time, (t) => onChange({ coliseo: { time: t } }))}
      </Zone>

      <Zone
        id="sr-care" title="Rutinas de cuidado y rituales" checked={s.care.enabled}
        description="Un recordatorio a la hora de tu rutina de mañana o de noche, si aún no la hiciste."
        onToggle={(on) => onChange({ care: { enabled: on } })}
      >
        {time('Mañana', s.care.morning, (t) => onChange({ care: { morning: t } }))}
        {time('Noche', s.care.night, (t) => onChange({ care: { night: t } }))}
      </Zone>

      {isFemale && (
        <Zone
          id="sr-cycle" title="Ciclo" checked={s.cycle.enabled}
          description="Avisos discretos: el registro del día y la siguiente regla. Nada en el aviso deja ver de qué se trata."
          onToggle={(on) => onChange({ cycle: { enabled: on } })}
        />
      )}

      <Zone
        id="sr-hydration" title="Agua" checked={s.hydration.enabled}
        description="Un aviso cada cierto tiempo mientras no llegues a tu meta de agua del día. Tócalo para sumar un vaso."
        onToggle={(on) => onChange({ hydration: { enabled: on } })}
      >
        <div className="flex flex-col gap-2">
          <span className="text-label-md text-on-surface-light">Cada cuánto</span>
          <SegmentedControl
            label="Cada cuánto avisar de agua" options={HOURS} value={String(s.hydration.everyHours)}
            onChange={(v) => onChange({ hydration: { everyHours: Number(v) as 1 | 2 | 3 | 4 } })}
          />
        </div>
        {time('Desde', s.hydration.from, (t) => onChange({ hydration: { from: t } }))}
        {time('Hasta', s.hydration.to, (t) => onChange({ hydration: { to: t } }))}
      </Zone>

      {s.breaks && (
        <Zone
          id="sr-breaks" title="Pausas activas" checked={s.breaks.enabled}
          description="Durante tu jornada, un aviso para levantarte, estirarte y respirar."
          onToggle={(on) => onChange({ breaks: { enabled: on } })}
        >
          <Field label="Cada cuánto">
            <Select value={String(s.breaks.everyMinutes)} onChange={(e) => onChange({ breaks: { everyMinutes: Number(e.target.value) as SmartReminderSettings['breaks']['everyMinutes'] } })}>
              {BREAK_EVERY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          {time('Desde', s.breaks.from, (t) => onChange({ breaks: { from: t } }))}
          {time('Hasta', s.breaks.to, (t) => onChange({ breaks: { to: t } }))}
          <label className="flex min-h-11 items-center gap-3 text-body-md">
            <Switch checked={s.breaks.workdays} onChange={(e) => onChange({ breaks: { workdays: e.target.checked } })} aria-label="Solo de lunes a viernes" />
            Solo de lunes a viernes
          </label>
        </Zone>
      )}

      <Zone
        id="sr-meals" title="Comidas" checked={s.meals.enabled}
        description="Si hoy no has registrado ninguna comida, te avisa a estas horas."
        onToggle={(on) => onChange({ meals: { enabled: on } })}
      >
        {s.meals.times.map((t, i) => (
          <div key={`${i}-${t}`} className="flex items-end gap-2">
            {time(`Comida ${i + 1}`, t, (v) => onChange({ meals: { times: s.meals.times.map((x, k) => (k === i ? v : x)) } }))}
            <Button variant="icon" aria-label={`Quitar la hora de la comida ${i + 1}`} onClick={() => onChange({ meals: { times: s.meals.times.filter((_, k) => k !== i) } })}>
              <X aria-hidden className="size-5" />
            </Button>
          </div>
        ))}
        {s.meals.times.length < MAX_MEAL_TIMES && (
          <Button variant="secondary" size="md" onClick={() => onChange({ meals: { times: [...s.meals.times, '13:00'] } })}>
            <Plus aria-hidden className="size-4" />Agregar hora
          </Button>
        )}
      </Zone>

      <Zone
        id="sr-wisdom" title="Sabiduría del día" checked={s.wisdom.enabled}
        description="Una cita a la hora que elijas, escogida según en qué progresas esta semana."
        onToggle={(on) => onChange({ wisdom: { enabled: on } })}
      >
        {time('Hora', s.wisdom.time, (t) => onChange({ wisdom: { time: t } }))}
      </Zone>
    </section>
  );
}
