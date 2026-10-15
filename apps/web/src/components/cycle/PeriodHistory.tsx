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
import { longDay } from './cycleMeta';

/** − valor + con límites (botones de 44 px). */
export function Stepper({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; unit: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-lg text-on-surface" id={id}>{label}</span>
      <div role="group" aria-labelledby={id} className="flex items-center gap-2">
        <Button type="button" variant="icon" aria-label={`Restar un día a ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus aria-hidden className="size-4" /></Button>
        <output aria-live="polite" className="min-w-[5.5rem] text-center font-mono text-heading-sm tabular-nums">{value} {unit}</output>
        <Button type="button" variant="icon" aria-label={`Sumar un día a ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus aria-hidden className="size-4" /></Button>
      </div>
    </div>
  );
}

function PeriodDialog({ open, period, today, onClose, onSaved }: { open: boolean; period: CyclePeriod | null; today: string; onClose: () => void; onSaved: () => Promise<void> }) {
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
      toast.success(period ? 'Periodo actualizado' : 'Periodo anotado');
      await onSaved();
      onClose();
    } catch (e) { toast.error(apiError(e, 'No se pudo guardar el periodo')); }
    finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={period ? 'Editar periodo' : 'Anotar un periodo pasado'}>
      <div className="flex flex-col gap-4">
        <Field label="Primer día"><DatePicker value={start} onChange={setStart} max={today} placeholder="Elige el día" /></Field>
        <Field label="Último día" help="Déjalo vacío si aún no termina."><DatePicker clearable value={end} onChange={setEnd} max={today} placeholder="Elige el día" /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} disabled={!start} onClick={() => void save()}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

export function PeriodHistory({ data, onChanged }: { data: CycleOverview; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; period: CyclePeriod | null; key: number }>({ open: false, period: null, key: 0 });
  const [cycleLength, setCycleLength] = useState(data.settings?.cycleLength ?? 28);
  const [periodLength, setPeriodLength] = useState(data.settings?.periodLength ?? 5);
  const [saving, setSaving] = useState(false);
  const avg = data.averages;
  const dirty = cycleLength !== (data.settings?.cycleLength ?? 28) || periodLength !== (data.settings?.periodLength ?? 5);

  async function remove(p: CyclePeriod) {
    if (!window.confirm(`¿Borrar el periodo del ${longDay(p.startDate)}? Sus registros diarios se conservan.`)) return;
    try { await deleteCyclePeriod(p.id); await onChanged(); toast.info('Periodo borrado'); }
    catch (e) { toast.error(apiError(e, 'No se pudo borrar')); }
  }
  async function saveSettings() {
    setSaving(true);
    try { await saveCycleSettings({ cycleLength, periodLength }); await onChanged(); toast.success('Ajustes del ciclo guardados'); }
    catch (e) { toast.error(apiError(e, 'No se pudieron guardar los ajustes')); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-variant p-3"><dt className="text-body-sm text-on-surface-light">Ciclo medio</dt><dd className="font-mono text-heading-lg tabular-nums">{avg.cycleLength} días</dd></div>
          <div className="rounded-xl bg-surface-variant p-3"><dt className="text-body-sm text-on-surface-light">Periodo medio</dt><dd className="font-mono text-heading-lg tabular-nums">{avg.periodLength} días</dd></div>
          <div className="col-span-2 rounded-xl bg-surface-variant p-3 sm:col-span-1">
            <dt className="text-body-sm text-on-surface-light">Ciclos medidos</dt>
            <dd className="font-mono text-heading-lg tabular-nums">{avg.cyclesTracked}{avg.shortest != null && avg.longest != null && avg.shortest !== avg.longest ? <span className="ml-1 text-body-sm text-on-surface-light">({avg.shortest}–{avg.longest} d)</span> : null}</dd>
          </div>
        </dl>
        {avg.cyclesTracked === 0 && <p className="text-body-sm text-on-surface-light">Con dos periodos anotados, las predicciones pasan a usar tus propios promedios.</p>}
        <ul aria-label="Últimos periodos" className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
          {data.periods.slice(0, 6).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-body-md font-semibold">{longDay(p.startDate)}{p.endDate ? ` – ${longDay(p.endDate)}` : ''}</span>
                <span className="text-body-sm text-on-surface-light">{p.length ? `${p.length} ${p.length === 1 ? 'día' : 'días'}` : 'En curso'}</span>
              </span>
              <Button variant="icon" aria-label={`Editar el periodo del ${longDay(p.startDate)}`} onClick={() => setDialog({ open: true, period: p, key: Date.now() })}><Pencil aria-hidden className="size-4" /></Button>
              <Button variant="icon" aria-label={`Borrar el periodo del ${longDay(p.startDate)}`} onClick={() => void remove(p)}><Trash2 aria-hidden className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="self-start" onClick={() => setDialog({ open: true, period: null, key: Date.now() })}><Plus aria-hidden className="size-4" />Anotar un periodo pasado</Button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 md:p-5">
        <h3 className="text-heading-sm">Tus largos de siempre</h3>
        <p className="text-body-sm text-on-surface-light">Se usan mientras no hay historial suficiente. Luego mandan tus promedios.</p>
        <Stepper label="Ciclo" value={cycleLength} min={18} max={60} onChange={setCycleLength} unit="días" />
        <Stepper label="Periodo" value={periodLength} min={2} max={10} onChange={setPeriodLength} unit="días" />
        <Button className="self-start" disabled={!dirty} loading={saving} onClick={() => void saveSettings()}>Guardar</Button>
      </div>

      <PeriodDialog key={dialog.key} open={dialog.open} period={dialog.period} today={data.today} onClose={() => setDialog((d) => ({ ...d, open: false }))} onSaved={onChanged} />
    </div>
  );
}
