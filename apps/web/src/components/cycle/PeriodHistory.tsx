// Tus ciclos: promedios, los últimos periodos (editar y borrar) y los largos
// típicos que se usan mientras no hay historial suficiente.
import { useId, useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, DatePicker, Field, Modal } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { apiError } from '@/services/network.service';
import {
  addCyclePeriod, deleteCyclePeriod, saveCycleSettings, updateCyclePeriod, type CycleOverview, type CyclePeriod,
} from '@/services/cycle.service';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { longDay } from './cycleMeta';

const es = {
  minus: (label: string): string => `Restar un día a ${label.toLowerCase()}`,
  plus: (label: string): string => `Sumar un día a ${label.toLowerCase()}`,
  unitDays: 'días',
  editTitle: 'Editar periodo',
  addTitle: 'Anotar un periodo pasado',
  firstDay: 'Primer día',
  lastDay: 'Último día',
  lastDayHelp: 'Déjalo vacío si aún no termina.',
  pickDay: 'Elige el día',
  cancel: 'Cancelar',
  save: 'Guardar',
  updated: 'Periodo actualizado',
  noted: 'Periodo anotado',
  periodSaveErr: 'No se pudo guardar el periodo',
  confirmDelete: (d: string): string => `¿Borrar el periodo del ${d}? Sus registros diarios se conservan.`,
  deleted: 'Periodo borrado',
  deleteErr: 'No se pudo borrar',
  settingsSaved: 'Ajustes del ciclo guardados',
  settingsErr: 'No se pudieron guardar los ajustes',
  avgCycle: 'Ciclo medio',
  avgPeriod: 'Periodo medio',
  measured: 'Ciclos medidos',
  twoPeriodsHint: 'Con dos periodos anotados, las predicciones pasan a usar tus propios promedios.',
  recentAria: 'Últimos periodos',
  ongoing: 'En curso',
  dayWord: (n: number): string => (n === 1 ? 'día' : 'días'),
  editPeriod: (d: string): string => `Editar el periodo del ${d}`,
  deletePeriod: (d: string): string => `Borrar el periodo del ${d}`,
  addPast: 'Anotar un periodo pasado',
  usualTitle: 'Tus largos de siempre',
  usualBody: 'Se usan mientras no hay historial suficiente. Luego mandan tus promedios.',
  cycleLabel: 'Ciclo',
  periodLabel: 'Periodo',
  saveBtn: 'Guardar',
};

const en: typeof es = {
  minus: (label: string): string => `Subtract one day from ${label.toLowerCase()}`,
  plus: (label: string): string => `Add one day to ${label.toLowerCase()}`,
  unitDays: 'days',
  editTitle: 'Edit period',
  addTitle: 'Log a past period',
  firstDay: 'First day',
  lastDay: 'Last day',
  lastDayHelp: 'Leave it empty if it has not ended yet.',
  pickDay: 'Pick the day',
  cancel: 'Cancel',
  save: 'Save',
  updated: 'Period updated',
  noted: 'Period logged',
  periodSaveErr: 'Could not save the period',
  confirmDelete: (d: string): string => `Delete the period from ${d}? Its daily logs are kept.`,
  deleted: 'Period deleted',
  deleteErr: 'Could not delete',
  settingsSaved: 'Cycle settings saved',
  settingsErr: 'Could not save the settings',
  avgCycle: 'Average cycle',
  avgPeriod: 'Average period',
  measured: 'Cycles measured',
  twoPeriodsHint: 'With two periods logged, predictions start using your own averages.',
  recentAria: 'Recent periods',
  ongoing: 'Ongoing',
  dayWord: (n: number): string => (n === 1 ? 'day' : 'days'),
  editPeriod: (d: string): string => `Edit the period from ${d}`,
  deletePeriod: (d: string): string => `Delete the period from ${d}`,
  addPast: 'Log a past period',
  usualTitle: 'Your usual lengths',
  usualBody: 'Used until there is enough history. After that, your averages take over.',
  cycleLabel: 'Cycle',
  periodLabel: 'Period',
  saveBtn: 'Save',
};

const COPY: Copy<typeof es> = { es, en };

/** − valor + con límites (botones de 44 px). */
export function Stepper({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: string }) {
  const t = useText(COPY);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-lg text-on-surface" id={id}>{label}</span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-2">
        <Button type="button" variant="icon" aria-label={t.minus(label)} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus aria-hidden className="size-4" /></Button>
        <output aria-live="polite" className="min-w-[5.5rem] text-center font-mono text-heading-sm tabular-nums">{value} {unit}</output>
        <Button type="button" variant="icon" aria-label={t.plus(label)} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus aria-hidden className="size-4" /></Button>
      </div>
    </div>
  );
}

function PeriodDialog({ open, period, today, onClose, onSaved }: { open: boolean; period: CyclePeriod | null; today: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useText(COPY);
  const toast = useToast();
  const [start, setStart] = useState(period?.startDate ?? '');
  const [end, setEnd] = useState(period?.endDate ?? '');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!start) return;
    setSaving(true);
    try {
      if (period) await updateCyclePeriod(period.id, { startDate: start, endDate: end || null });
      else await addCyclePeriod({ startDate: start, endDate: end || null });
      toast.success(period ? t.updated : t.noted);
      await onSaved();
      onClose();
    } catch (e) { toast.error(apiError(e, t.periodSaveErr)); }
    finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={period ? t.editTitle : t.addTitle}>
      <div className="flex flex-col gap-4">
        <Field label={t.firstDay}><DatePicker value={start} onChange={setStart} max={today} placeholder={t.pickDay} /></Field>
        <Field label={t.lastDay} help={t.lastDayHelp}><DatePicker clearable value={end} onChange={setEnd} max={today} placeholder={t.pickDay} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button loading={saving} disabled={!start} onClick={() => void save()}>{t.saveBtn}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function PeriodHistory({ data, onChanged }: { data: CycleOverview; onChanged: () => Promise<void> }) {
  const t = useText(COPY);
  const locale = useLocale();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; period: CyclePeriod | null; key: number }>({ open: false, period: null, key: 0 });
  const [cycleLength, setCycleLength] = useState(data.settings?.cycleLength ?? 28);
  const [periodLength, setPeriodLength] = useState(data.settings?.periodLength ?? 5);
  const [saving, setSaving] = useState(false);
  const avg = data.averages;
  const dirty = cycleLength !== (data.settings?.cycleLength ?? 28) || periodLength !== (data.settings?.periodLength ?? 5);

  async function remove(p: CyclePeriod) {
    if (!window.confirm(t.confirmDelete(longDay(p.startDate, locale)))) return;
    try { await deleteCyclePeriod(p.id); await onChanged(); toast.info(t.deleted); }
    catch (e) { toast.error(apiError(e, t.deleteErr)); }
  }
  async function saveSettings() {
    setSaving(true);
    try { await saveCycleSettings({ cycleLength, periodLength }); await onChanged(); toast.success(t.settingsSaved); }
    catch (e) { toast.error(apiError(e, t.settingsErr)); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-variant p-3"><dt className="text-body-sm text-on-surface-light">{t.avgCycle}</dt><dd className="font-mono text-heading-lg tabular-nums">{avg.cycleLength} {t.unitDays}</dd></div>
          <div className="rounded-xl bg-surface-variant p-3"><dt className="text-body-sm text-on-surface-light">{t.avgPeriod}</dt><dd className="font-mono text-heading-lg tabular-nums">{avg.periodLength} {t.unitDays}</dd></div>
          <div className="col-span-2 rounded-xl bg-surface-variant p-3 sm:col-span-1">
            <dt className="text-body-sm text-on-surface-light">{t.measured}</dt>
            <dd className="font-mono text-heading-lg tabular-nums">{avg.cyclesTracked}{avg.shortest != null && avg.longest != null && avg.shortest !== avg.longest ? <span className="ml-1 text-body-sm text-on-surface-light">({avg.shortest}–{avg.longest} d)</span> : null}</dd>
          </div>
        </dl>
        {avg.cyclesTracked === 0 && <p className="text-body-sm text-on-surface-light">{t.twoPeriodsHint}</p>}
        <ul aria-label={t.recentAria} className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {data.periods.slice(0, 6).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-body-md font-semibold">{longDay(p.startDate, locale)}{p.endDate ? ` – ${longDay(p.endDate, locale)}` : ''}</span>
                <span className="text-body-sm text-on-surface-light">{p.length ? `${p.length} ${t.dayWord(p.length)}` : t.ongoing}</span>
              </span>
              <Button variant="icon" aria-label={t.editPeriod(longDay(p.startDate, locale))} onClick={() => setDialog({ open: true, period: p, key: Date.now() })}><Pencil aria-hidden className="size-4" /></Button>
              <Button variant="icon" aria-label={t.deletePeriod(longDay(p.startDate, locale))} onClick={() => void remove(p)}><Trash2 aria-hidden className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="self-start" onClick={() => setDialog({ open: true, period: null, key: Date.now() })}><Plus aria-hidden className="size-4" />{t.addPast}</Button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 md:p-5">
        <h3 className="text-heading-sm">{t.usualTitle}</h3>
        <p className="text-body-sm text-on-surface-light">{t.usualBody}</p>
        <Stepper label={t.cycleLabel} value={cycleLength} min={18} max={60} onChange={setCycleLength} unit={t.unitDays} />
        <Stepper label={t.periodLabel} value={periodLength} min={2} max={10} onChange={setPeriodLength} unit={t.unitDays} />
        <Button className="self-start" disabled={!dirty} loading={saving} onClick={() => void saveSettings()}>{t.saveBtn}</Button>
      </div>

      <PeriodDialog key={dialog.key} open={dialog.open} period={dialog.period} today={data.today} onClose={() => setDialog((d) => ({ ...d, open: false }))} onSaved={onChanged} />
    </div>
  );
}
