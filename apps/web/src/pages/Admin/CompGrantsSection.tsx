// Pro de cortesía directo a una cuenta (correo o @usuario): días o indefinido, con nota interna.
// Antes de conceder pide confirmación; después muestra el resumen y deja cada concesión en el
// historial. Los días se suman al Pro vigente (nunca lo acortan); indefinido no tiene fecha.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Crown } from 'lucide-react';
import { Badge, Button, Card, ChipGroup, ErrorState, Field, Input, Modal, PageLoader, type ChipOption } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { apiError } from '@/services/network.service';
import * as adminService from '@/services/admin.service';
import type { CompGrantRecord, CompGrantRow } from '@/services/admin.service';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');

/** Límite del servidor (COMP_MAX_DAYS): diez años. */
const MAX_DAYS = 3650;

type Duration = '7' | '30' | '90' | '365' | 'custom' | 'permanent';
const DURATION: ChipOption<Duration>[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '1 año' },
  { value: 'custom', label: 'Personalizado' },
  { value: 'permanent', label: 'Indefinido' },
];

const OUTCOME: Record<CompGrantRecord['outcome'], string> = {
  activated: 'Pro desde hoy',
  extended: 'Sumados al final de su Pro',
  permanent: 'Pro indefinido',
};

const daysLabel = (days: number | null) => (days === null ? 'Indefinido' : `${days} ${days === 1 ? 'día' : 'días'}`);

/** Frase del resumen que ve el admin tras conceder. */
function summaryOf(grant: CompGrantRecord): string {
  if (grant.outcome === 'permanent') return `Pro de cortesía indefinido para @${grant.targetUsername}.`;
  return `Se otorgaron ${daysLabel(grant.days)} Pro a @${grant.targetUsername} hasta el ${fmtDate(grant.accessEndsAt)}.`;
}

export function CompGrantsSection() {
  const toast = useToast();
  const [grants, setGrants] = useState<CompGrantRow[] | null>(null);
  const [error, setError] = useState(false);

  const [target, setTarget] = useState('');
  const [duration, setDuration] = useState<Duration>('30');
  const [customDays, setCustomDays] = useState('30');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState<CompGrantRecord | null>(null);

  const load = useCallback(() => {
    setError(false);
    adminService.listCompGrants().then(setGrants).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  const customValid = /^\d+$/.test(customDays.trim()) && Number(customDays) >= 1 && Number(customDays) <= MAX_DAYS;
  const customError = duration === 'custom' && !customValid ? `Entre 1 y ${MAX_DAYS} días.` : undefined;
  const days: number | null = duration === 'permanent' ? null : duration === 'custom' ? Number(customDays) : Number(duration);
  const canSubmit = target.trim().length > 0 && !customError;

  function review(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) setConfirming(true);
  }

  async function grant() {
    setSaving(true);
    try {
      const made = await adminService.grantComp({ target: target.trim(), days, note: note.trim() || undefined });
      setLast(made);
      setConfirming(false);
      setTarget('');
      setNote('');
      toast.success(summaryOf(made));
      load();
    } catch (err) {
      setConfirming(false);
      toast.error(apiError(err, 'No se pudo otorgar el Pro de cortesía'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="comp-grants-title">
      <div className="flex flex-col gap-1">
        <h2 id="comp-grants-title" className="text-heading-md">Pro de cortesía</h2>
        <p className="text-body-sm text-on-surface-light">
          Para una cuenta concreta, por correo o @usuario. Los días se suman al Pro que ya tenga; el indefinido no vence.
        </p>
      </div>

      <Card padding="md">
        <form onSubmit={review} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Correo o @usuario">
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="correo@ejemplo.com o @usuario" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field label="Nota interna (opcional)" help="Por qué se concede. Solo se ve aquí.">
              <Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Ganador de reto Instagram" />
            </Field>
          </div>
          <ChipGroup label="Duración" options={DURATION} value={duration} onChange={setDuration} />
          {duration === 'custom' && (
            <Field label="Días" error={customError} className="md:max-w-[200px]">
              <Input inputMode="numeric" value={customDays} onChange={(e) => setCustomDays(e.target.value)} invalid={Boolean(customError)} />
            </Field>
          )}
          <Button type="submit" disabled={!canSubmit || saving} className="self-start">
            <Crown aria-hidden className="size-4" strokeWidth={1.75} />Otorgar Pro de cortesía
          </Button>
        </form>
      </Card>

      {last && (
        <Card padding="md" className="flex flex-col gap-2 border-primary/40">
          <p className="flex items-center gap-2 text-heading-sm"><Check aria-hidden className="size-4" />Pro de cortesía otorgado</p>
          <p className="text-body-md" role="status">{summaryOf(last)}</p>
          <p className="text-body-sm text-on-surface-light">{OUTCOME[last.outcome]}{last.note ? ` · ${last.note}` : ''}</p>
        </Card>
      )}

      <Modal open={confirming} onClose={() => !saving && setConfirming(false)} title="Confirmar Pro de cortesía">
        <div className="flex flex-col gap-4">
          <p className="text-body-md">
            {days === null
              ? <>Se dará Pro de cortesía <strong className="lq-selectable">indefinido</strong> a <strong className="lq-selectable">{target.trim()}</strong>.</>
              : <>Se sumarán <strong>{daysLabel(days)}</strong> de Pro a <strong className="lq-selectable">{target.trim()}</strong>.</>}
          </p>
          <p className="text-body-sm text-on-surface-light">Queda registrado en el historial. Desde aquí no se puede quitar.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={grant} disabled={saving}>{saving ? 'Otorgando…' : 'Confirmar'}</Button>
          </div>
        </div>
      </Modal>

      {error ? <ErrorState onRetry={load} /> : !grants ? <PageLoader /> : (
        <Card padding="md" className="flex flex-col gap-4">
          <p className="text-heading-sm">Historial de cortesías</p>
          {grants.length === 0 ? <p className="text-body-md text-on-surface-light">Todavía no se ha concedido ninguna.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-body-sm">
                <thead className="text-on-surface-light">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Usuario</th>
                    <th className="py-2 pr-3 font-medium">Concesión</th>
                    <th className="py-2 pr-3 font-medium">Hasta</th>
                    <th className="py-2 pr-3 font-medium">Nota</th>
                    <th className="py-2 font-medium">Por</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pr-3 tabular-nums">{fmtDate(row.createdAt)}</td>
                      <td className="py-2.5 pr-3">@{row.targetUsername}</td>
                      <td className="py-2.5 pr-3">
                        <span className="flex flex-col">
                          <span>{daysLabel(row.days)}</span>
                          <Badge variant={row.outcome === 'permanent' ? 'primary' : 'neutral'}>{OUTCOME[row.outcome]}</Badge>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{row.accessEndsAt ? fmtDate(row.accessEndsAt) : 'Sin fecha'}</td>
                      <td className="py-2.5 pr-3">{row.note ?? '—'}</td>
                      <td className="py-2.5">{row.grantedBy ? `@${row.grantedBy}` : 'Cuenta borrada'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
