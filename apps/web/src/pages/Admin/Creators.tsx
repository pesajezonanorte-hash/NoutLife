// Creadores y socios (/admin/creadores): los códigos de creador, quién los usó, en qué plan
// (mensual o anual), cuánto se cobró y la comisión que le corresponde a cada creador. Alta y
// edición de códigos; nunca se borran. El servidor exige el correo de administración.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Download, Link2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, ChipGroup, ErrorState, Field, Input, Modal, PageLoader, buttonClasses, type ChipOption } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { apiError } from '@/services/network.service';
import * as adminService from '@/services/admin.service';
import type { CreatorCodeStats, CreatorReport } from '@/services/admin.service';
import { RANGE_LABEL, creatorCsv, creatorLink, rangeFor, shareLabel, type RangePreset } from '@/lib/creator-admin';
import { copyText } from '@/lib/clipboard';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const RANGES: ChipOption<RangePreset>[] = (Object.keys(RANGE_LABEL) as RangePreset[]).map((value) => ({ value, label: RANGE_LABEL[value] }));

/** Fila de cifras: etiqueta arriba, número abajo (igual que /admin). */
function Stats({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map(([label, value]) => (
        <Card key={label} padding="sm">
          <p className="text-body-sm text-on-surface-light">{label}</p>
          <p className="font-mono text-heading-md tabular-nums">{value}</p>
        </Card>
      ))}
    </div>
  );
}

interface FormState {
  code: string;
  creatorName: string;
  discountPercent: string;
  sharePercent: string;
  shareMonths: string;
  unlimited: boolean;
}

const EMPTY_FORM: FormState = { code: '', creatorName: '', discountPercent: '0', sharePercent: '30', shareMonths: '6', unlimited: false };
const CODE_FORMAT = /^[A-Z0-9][A-Z0-9_-]{2,19}$/;

type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState, creating: boolean): FormErrors {
  const errors: FormErrors = {};
  const int = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : NaN);
  if (creating && !CODE_FORMAT.test(form.code)) errors.code = 'De 3 a 20 letras sin tilde, números, guion o guion bajo.';
  if (!form.creatorName.trim()) errors.creatorName = 'Escribe el nombre del creador.';
  const discount = int(form.discountPercent);
  if (!(discount >= 0 && discount <= 50)) errors.discountPercent = 'Entre 0 y 50.';
  const share = int(form.sharePercent);
  if (!(share >= 0 && share <= 100)) errors.sharePercent = 'Entre 0 y 100.';
  const months = int(form.shareMonths);
  if (!form.unlimited && !(months >= 1 && months <= 120)) errors.shareMonths = 'Entre 1 y 120 meses.';
  return errors;
}

export default function AdminCreatorsPage() {
  const toast = useToast();
  const [preset, setPreset] = useState<RangePreset>('month');
  const [report, setReport] = useState<CreatorReport | null>(null);
  const [error, setError] = useState(false);
  const [codeFilter, setCodeFilter] = useState('all');
  const [editing, setEditing] = useState<CreatorCodeStats | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    adminService.getCreatorReport(rangeFor(preset)).then(setReport).catch(() => setError(true));
  }, [preset]);
  useEffect(load, [load]);

  const lines = useMemo(
    () => (report?.lines ?? []).filter((line) => codeFilter === 'all' || line.creatorCodeId === codeFilter),
    [report, codeFilter],
  );
  const codeChips = useMemo<ChipOption<string>[]>(
    () => [{ value: 'all', label: 'Todos' }, ...(report?.codes ?? []).map((c) => ({ value: c.id, label: c.code }))],
    [report],
  );

  const openNew = () => { setForm(EMPTY_FORM); setFormErrors({}); setEditing('new'); };
  const openEdit = (code: CreatorCodeStats) => {
    setForm({
      code: code.code, creatorName: code.creatorName, discountPercent: String(code.discountPercent), sharePercent: String(code.sharePercent),
      shareMonths: String(code.shareMonths ?? 6), unlimited: code.shareMonths === null,
    });
    setFormErrors({});
    setEditing(code);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const creating = editing === 'new';
    const found = validate(form, creating);
    setFormErrors(found);
    if (Object.keys(found).length || !editing) return;
    const body = {
      creatorName: form.creatorName.trim(),
      discountPercent: Number(form.discountPercent),
      sharePercent: Number(form.sharePercent),
      shareMonths: form.unlimited ? null : Number(form.shareMonths),
    };
    setSaving(true);
    try {
      if (editing === 'new') await adminService.createCreatorCode({ code: form.code, ...body });
      else await adminService.updateCreatorCode(editing.id, body);
      toast.success(creating ? `Código ${form.code} creado` : `Código ${form.code} actualizado`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'No se pudo guardar el código'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (code: CreatorCodeStats) => {
    setToggling(code.id);
    try {
      await adminService.updateCreatorCode(code.id, { active: !code.active });
      toast.success(code.active ? `${code.code} desactivado: nadie más puede aplicarlo` : `${code.code} activo de nuevo`);
      load();
    } catch (err) {
      toast.error(apiError(err, 'No se pudo cambiar el código'));
    } finally {
      setToggling(null);
    }
  };

  const copyLink = async (code: string) => {
    if (await copyText(creatorLink(code, window.location.origin))) {
      setCopied(code);
      toast.success('Enlace copiado', 'Con este enlace el checkout sugiere el código.');
      window.setTimeout(() => setCopied((current) => (current === code ? null : current)), 1800);
    } else {
      toast.error('No se pudo copiar el enlace');
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([creatorCsv(lines)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creadores-${preset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) return <ErrorState onRetry={load} />;
  if (!report) return <PageLoader />;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader
        eyebrow="Administración"
        title="Creadores y socios"
        description="Códigos de creador: quién los usó, en qué plan, cuánto se cobró y la comisión de cada creador."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin" className={buttonClasses('ghost', 'md')}><ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />Cuentas y pagos</Link>
        <Button size="md" onClick={openNew}><Plus aria-hidden className="size-4" strokeWidth={2} />Nuevo código</Button>
      </div>

      <ChipGroup label="Periodo" options={RANGES} value={preset} onChange={(next) => { setPreset(next); setReport(null); }} />

      <Stats items={[
        ['Conversiones', String(report.totals.conversions)],
        ['Cobros', String(report.totals.payments)],
        ['Ingreso', cop(report.totals.revenueCop)],
        ['Comisión', cop(report.totals.commissionCop)],
        ['Cuentas con código', String(report.totals.applied)],
      ]} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-heading-sm">Códigos</h2>
          <p className="text-body-sm text-on-surface-light">
            Usos y comisión del periodo. «Con el código» son las cuentas que lo tienen puesto hoy, hayan pagado o no.
          </p>
        </div>
        {report.codes.length === 0 ? (
          <Card padding="md"><p className="text-body-md text-on-surface-light">Aún no hay códigos. Crea el primero con «Nuevo código».</p></Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {report.codes.map((c) => (
              <li key={c.id}>
                <Card padding="sm" className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="lq-selectable font-mono text-heading-sm">{c.code}</span>
                      <Badge variant={c.active ? 'success' : 'neutral'}>{c.active ? 'Activo' : 'Inactivo'}</Badge>
                    </p>
                    <p className="truncate text-body-sm text-on-surface-light">{c.creatorName} · desde {fmtDate(c.createdAt)}</p>
                    <p className="text-body-sm text-on-surface-light">
                      {c.discountPercent > 0 ? `${c.discountPercent} % de descuento en el primer pago` : 'Sin descuento'} · comisión {shareLabel(c.sharePercent, c.shareMonths)}
                    </p>
                  </div>
                  <div className="text-body-sm">
                    <p><span className="font-mono font-semibold">{c.conversions}</span> {c.conversions === 1 ? 'conversión' : 'conversiones'} · <span className="font-mono">{c.monthlyConversions}</span> mensual · <span className="font-mono">{c.annualConversions}</span> anual</p>
                    <p className="text-on-surface-light"><span className="font-mono">{c.applied}</span> con el código · <span className="font-mono">{c.payments}</span> {c.payments === 1 ? 'cobro' : 'cobros'}</p>
                  </div>
                  <div className="text-body-sm">
                    <p>Ingreso <span className="font-mono">{cop(c.revenueCop)}</span></p>
                    <p className="font-semibold">Comisión <span className="font-mono">{cop(c.commissionCop)}</span></p>
                    <p className="text-on-surface-light">Último cobro {fmtDate(c.lastPaidAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 md:flex-col md:items-end">
                    <Button variant="ghost" size="sm" onClick={() => void copyLink(c.code)} aria-label={`Copiar el enlace de ${c.code}`}>
                      {copied === c.code ? <Check aria-hidden className="size-4" strokeWidth={1.75} /> : <Link2 aria-hidden className="size-4" strokeWidth={1.75} />}
                      {copied === c.code ? 'Copiado' : 'Enlace'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                    <Button variant="ghost" size="sm" loading={toggling === c.id} onClick={() => void toggleActive(c)}>{c.active ? 'Desactivar' : 'Activar'}</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-heading-sm">Historial de cobros</h2>
          <p className="text-body-sm text-on-surface-light">
            Cada cobro aprobado con código en el periodo: fecha, quién pagó, plan y monto. La comisión, con la configuración actual de cada código, cuenta los cobros hechos dentro de sus meses de comisión desde la primera compra de cada persona.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {codeChips.length > 2 && <ChipGroup label="Código" options={codeChips} value={codeFilter} onChange={setCodeFilter} />}
          <Button variant="secondary" size="sm" disabled={lines.length === 0} onClick={downloadCsv} className="md:ml-auto">
            <Download aria-hidden className="size-4" strokeWidth={1.75} />Descargar CSV ({lines.length})
          </Button>
        </div>
        {lines.length === 0 ? (
          <p className="text-body-md text-on-surface-light">Sin cobros con código en este periodo.</p>
        ) : (
          <Card padding="sm" className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-body-sm tabular-nums">
              <caption className="sr-only">Cobros con código de creador</caption>
              <thead className="text-on-surface-light">
                <tr className="text-left">
                  <th scope="col" className="py-1.5 pr-3 font-normal">Fecha</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">Código</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">Cuenta</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">Plan</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">Tipo</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-normal">Monto</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-normal">Descuento</th>
                  <th scope="col" className="py-1.5 text-right font-normal">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className={line.status === 'APPROVED' ? 'border-t border-border' : 'border-t border-border text-on-surface-light line-through'}>
                    <td className="py-1.5 pr-3 font-mono">{fmtDate(line.paidAt)}</td>
                    <td className="py-1.5 pr-3 font-mono">{line.code}</td>
                    <td className="max-w-[220px] py-1.5 pr-3">
                      {line.email
                        ? <span className="lq-selectable block truncate" title={line.email}>{line.email}</span>
                        : <span className="text-on-surface-light">Cuenta borrada</span>}
                    </td>
                    <td className="py-1.5 pr-3">{line.interval === 'year' ? <Badge variant="secondary">Anual</Badge> : <Badge variant="neutral">Mensual</Badge>}</td>
                    <td className="py-1.5 pr-3">{line.status !== 'APPROVED' ? 'Anulado' : line.kind === 'first' ? 'Alta' : 'Renovación'}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{cop(line.amountCop)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{line.discountCop ? cop(line.discountCop) : '—'}</td>
                    <td className="py-1.5 text-right font-mono" title={line.inWindow ? undefined : 'Fuera de los meses de comisión'}>
                      {line.inWindow || line.status !== 'APPROVED' ? cop(line.commissionCop) : <span className="text-on-surface-light">$0 · fuera</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => !saving && setEditing(null)} title={editing === 'new' ? 'Nuevo código de creador' : `Editar ${form.code}`}>
        <form noValidate onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
          {editing === 'new' ? (
            <Field label="Código" error={formErrors.code} help="Lo escribe quien paga. No se puede cambiar después.">
              <Input
                value={form.code}
                onChange={(e) => setField('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
                maxLength={20} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="MIGUEL" className="font-mono uppercase"
              />
            </Field>
          ) : (
            <p className="text-body-sm text-on-surface-light">El código no cambia porque ya circula en el contenido del creador. Para otro texto, crea un código nuevo.</p>
          )}
          <Field label="Nombre del creador" error={formErrors.creatorName} help="Se muestra en el checkout: «Gracias por apoyar a…».">
            <Input value={form.creatorName} onChange={(e) => setField('creatorName', e.target.value)} maxLength={60} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Descuento en el primer pago (%)" error={formErrors.discountPercent}>
              <Input value={form.discountPercent} onChange={(e) => setField('discountPercent', e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" />
            </Field>
            <Field label="Comisión (%)" error={formErrors.sharePercent}>
              <Input value={form.sharePercent} onChange={(e) => setField('sharePercent', e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Meses con comisión desde la primera compra" error={formErrors.shareMonths} help="Cada cobro de la persona dentro de esos meses suma comisión, incluido un anual completo.">
            <Input
              value={form.unlimited ? '' : form.shareMonths}
              onChange={(e) => setField('shareMonths', e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric" disabled={form.unlimited} placeholder={form.unlimited ? 'Sin límite' : undefined}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2.5 text-body-md">
            <input type="checkbox" checked={form.unlimited} onChange={(e) => setField('unlimited', e.target.checked)} className="size-4 accent-[rgb(var(--lq-primary))]" />
            Comisión sin límite de meses
          </label>
          {editing !== 'new' && (
            <p className="text-body-sm text-on-surface-light">
              El descuento rige los próximos cobros (lo ya cobrado no cambia). La comisión del historial se recalcula con estos valores: descarga el CSV antes si ya liquidaste un periodo.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>{editing === 'new' ? 'Crear código' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
