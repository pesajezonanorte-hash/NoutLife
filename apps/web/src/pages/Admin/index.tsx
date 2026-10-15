// Zona de administración: una fila por cuenta con su plan, pagos, medio de pago
// y cuándo cobra o vence la prueba. Solo lectura. El servidor exige el correo.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, ChipGroup, ErrorState, Field, Input, Modal, PageLoader, type ChipOption } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { apiError } from '@/services/network.service';
import { isAdminEmail } from '@/utils/admin';
import * as adminService from '@/services/admin.service';
import type { AdminUser } from '@/services/admin.service';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const STATUS_LABEL: Record<AdminUser['status'], string> = { trialing: 'En prueba', active: 'Pro pagado', canceled: 'Cancelado', lite: 'Lite' };
const NEXT_LABEL: Record<AdminUser['nextEvent'], string> = { charge: 'Cobra', expire: 'Pasa a Lite', none: '—' };

type Filter = 'all' | 'paid' | 'trialing' | 'card' | 'lite' | 'complimentary';
const FILTERS: ChipOption<Filter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Han pagado' },
  { value: 'trialing', label: 'En prueba' },
  { value: 'card', label: 'Con medio de pago' },
  { value: 'lite', label: 'Lite' },
  { value: 'complimentary', label: 'Cortesía' },
];

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminService.deleteUser(toDelete.id);
      setUsers((list) => (list ?? []).filter((u) => u.id !== toDelete.id));
      toast.success(`Cuenta de ${toDelete.email} borrada`);
      setToDelete(null);
    } catch (e) {
      toast.error(apiError(e, 'No se pudo borrar la cuenta'));
    } finally { setDeleting(false); }
  };

  const load = () => {
    setError(false);
    adminService.listUsers().then(setUsers).catch(() => setError(true));
  };
  useEffect(load, []);

  const totals = useMemo(() => {
    const list = users ?? [];
    return {
      all: list.length,
      paid: list.filter((u) => u.hasPaid).length,
      trialing: list.filter((u) => u.status === 'trialing').length,
      card: list.filter((u) => u.hasPaymentMethod).length,
      cobrado: list.reduce((sum, u) => sum + u.paidTotalCop, 0),
    };
  }, [users]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (filter === 'paid' && !u.hasPaid) return false;
      if (filter === 'trialing' && u.status !== 'trialing') return false;
      if (filter === 'card' && !u.hasPaymentMethod) return false;
      if (filter === 'lite' && u.plan !== 'lite') return false;
      if (filter === 'complimentary' && !u.complimentary) return false;
      if (!q) return true;
      return [u.email, u.displayName, u.username].some((s) => s.toLowerCase().includes(q));
    });
  }, [users, query, filter]);

  if (error) return <ErrorState onRetry={load} />;
  if (!users) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader eyebrow="Administración" title="Cuentas y pagos" description="Solo lectura: lo que pagó cada persona, su medio de pago y cuándo cobra o vence su prueba." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([
          ['Cuentas', String(totals.all)], ['Han pagado', String(totals.paid)], ['En prueba', String(totals.trialing)],
          ['Con medio de pago', String(totals.card)], ['Total cobrado', cop(totals.cobrado)],
        ] as const).map(([label, value]) => (
          <Card key={label} padding="sm">
            <p className="text-body-sm text-on-surface-light">{label}</p>
            <p className="font-mono text-heading-md tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Field label="Buscar por correo, nombre o usuario" className="md:max-w-sm">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ana@correo.com" />
        </Field>
        <ChipGroup label="Filtro" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <p className="text-body-sm text-on-surface-light">{shown.length} de {users.length} cuentas</p>

      <ul className="flex flex-col gap-3">
        {shown.map((u) => (
          <li key={u.id}>
            <Card padding="sm" className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-label-lg">{u.displayName} <span className="font-normal text-on-surface-light">@{u.username}</span></p>
                <p className="truncate text-body-sm text-on-surface-light">{u.email}</p>
                <p className="text-body-sm text-on-surface-light">Alta {fmtDate(u.createdAt)} · Nivel {u.level}{u.lastSeenAt ? ` · Visto ${fmtDate(u.lastSeenAt)}` : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={u.plan === 'pro' ? 'success' : 'neutral'}>{STATUS_LABEL[u.status]}</Badge>
                {u.complimentary && <Badge variant="secondary">Cortesía</Badge>}
                {u.pendingPayments > 0 && <Badge variant="warning">{u.pendingPayments} en espera</Badge>}
              </div>
              <div className="text-body-sm">
                <p>{u.hasPaid ? <>Pagó <span className="font-mono">{cop(u.paidTotalCop)}</span> ({u.paidCount} {u.paidCount === 1 ? 'vez' : 'veces'})</> : 'Aún no ha pagado'}</p>
                <p className="text-on-surface-light">Último pago {fmtDate(u.lastPaidAt)}</p>
                {u.lastPaymentError && <p className="text-error-text">Error: {u.lastPaymentError}</p>}
              </div>
              <div className="text-body-sm">
                <p>{u.hasPaymentMethod ? u.paymentMethod : 'Sin medio de pago'}</p>
                {u.complimentary ? <p className="text-on-surface-light">Sin cobros</p> : (
                  <p><span className="font-semibold">{NEXT_LABEL[u.nextEvent]}</span>{u.nextEventAt ? ` ${fmtDate(u.nextEventAt)}` : ''}</p>
                )}
                {u.status === 'trialing' && <p className="text-on-surface-light">Prueba hasta {fmtDate(u.trialEndsAt)}</p>}
                {u.currentPeriodEnd && <p className="text-on-surface-light">Mes pagado hasta {fmtDate(u.currentPeriodEnd)}</p>}
              </div>
              {!isAdminEmail(u.email) && (
                <div className="md:col-span-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setTyped(''); setToDelete(u); }}>Borrar cuenta</Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {shown.length === 0 && <p className="text-body-md text-on-surface-light">Ninguna cuenta coincide con el filtro.</p>}
      <Modal open={Boolean(toDelete)} onClose={() => !deleting && setToDelete(null)} title="Borrar cuenta">
        {toDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-body-md">Se borran <strong>{toDelete.email}</strong>, su progreso, sus hábitos, sus pagos registrados y todo lo que tenga guardado. No se puede deshacer.</p>
            <Field label={`Escribe "${toDelete.email}" para confirmar`}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </Field>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>Cancelar</Button>
              <Button variant="danger" loading={deleting} disabled={typed.trim().toLowerCase() !== toDelete.email.toLowerCase()} onClick={() => void confirmDelete()}>Borrar para siempre</Button>
            </div>
          </div>
        )}
      </Modal>
      <Link to="/" className="self-start"><Button variant="ghost">Volver al inicio</Button></Link>
    </div>
  );
}
