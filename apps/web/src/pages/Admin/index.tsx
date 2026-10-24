// Zona de administración: una fila por cuenta con su plan, pagos, medio de pago
// y cuándo cobra o vence la prueba. Solo lectura. El servidor exige el correo.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, ChipGroup, ErrorState, Field, Input, Modal, PageLoader, type ChipOption } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { apiError } from '@/services/network.service';
import { isAdminEmail } from '@/utils/admin';
import * as adminService from '@/services/admin.service';
import type { AdminMetrics, AdminUser, PushStats } from '@/services/admin.service';
import { ACTIVITY_SEGMENT_LABEL, PLAN_SEGMENT_LABEL, segmentUsers, type ActivitySegment, type PlanSegment } from '@/lib/admin-segments';
import { emailsToClipboardText, uniqueEmails } from '@/lib/admin-emails';
import { copyText } from '@/lib/clipboard';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

/** Fila de cifras: etiqueta arriba, número abajo. */
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

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-heading-sm">{title}</h2>
        {note && <p className="text-body-sm text-on-surface-light">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const STATUS_LABEL: Record<AdminUser['status'], string> = { trialing: 'En prueba', active: 'Pro pagado', canceled: 'Cancelado', lite: 'Lite' };
const NEXT_LABEL: Record<AdminUser['nextEvent'], string> = { charge: 'Cobra', expire: 'Pasa a Lite', none: '—' };

type Filter = 'all' | 'paid' | 'trialing' | 'gift' | 'card' | 'lite' | 'complimentary';
const FILTERS: ChipOption<Filter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Han pagado' },
  { value: 'trialing', label: 'En prueba' },
  { value: 'gift', label: 'Regalo' },
  { value: 'card', label: 'Con medio de pago' },
  { value: 'lite', label: 'Lite' },
  { value: 'complimentary', label: 'Cortesía' },
];

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [push, setPush] = useState<PushStats | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedList, setCopiedList] = useState(false);
  const toast = useToast();

  const copyEmail = async (email: string) => {
    if (await copyText(email)) {
      setCopiedEmail(email);
      toast.success('Correo copiado', email);
      window.setTimeout(() => setCopiedEmail((current) => (current === email ? null : current)), 1800);
    } else {
      toast.error('No se pudo copiar el correo');
    }
  };

  const copyShownEmails = async (list: AdminUser[]) => {
    const emails = uniqueEmails(list.map((u) => u.email));
    if (emails.length === 0) return;
    if (await copyText(emailsToClipboardText(emails))) {
      setCopiedList(true);
      toast.success(emails.length === 1 ? '1 correo copiado' : `${emails.length} correos copiados`, 'Son los de la lista, separados por comas');
      window.setTimeout(() => setCopiedList(false), 1800);
    } else {
      toast.error('No se pudieron copiar los correos');
    }
  };

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

  const [rechecking, setRechecking] = useState<string | null>(null);
  const recheck = async (u: AdminUser) => {
    setRechecking(u.id);
    try {
      const { checked, approved } = await adminService.recheckBilling(u.id);
      if (approved > 0) toast.success(`Wompi aprobó ${approved === 1 ? 'el cobro' : `${approved} cobros`}: ${u.email} queda en Pro pagado`);
      else toast.success(checked ? 'Wompi no tiene cobros aprobados de esta cuenta' : 'No hay cobros vencidos por tiempo para revisar');
      load();
    } catch (e) {
      toast.error(apiError(e, 'No se pudo revisar el cobro'));
    } finally { setRechecking(null); }
  };

  const load = () => {
    setError(false);
    adminService.listUsers().then(setUsers).catch(() => setError(true));
    // Las métricas no bloquean la lista: si fallan, su sección no aparece.
    adminService.getMetrics().then(setMetrics).catch(() => setMetrics(null));
    adminService.getPushStats().then(setPush).catch(() => setPush(null));
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
  const segments = useMemo(() => segmentUsers(users ?? []), [users]);
  const pushRows = useMemo(
    () => Object.entries(push?.byCategory ?? {}).sort(([, a], [, b]) => b.sent - a.sent),
    [push],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => {
      if (filter === 'paid' && !u.hasPaid) return false;
      if (filter === 'trialing' && u.status !== 'trialing') return false;
      if (filter === 'gift' && !(u.giftTrial && u.status === 'trialing')) return false;
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

      <Stats items={[
        ['Cuentas', String(totals.all)], ['Han pagado', String(totals.paid)], ['En prueba', String(totals.trialing)],
        ['Con medio de pago', String(totals.card)], ['Total cobrado', cop(totals.cobrado)],
      ]} />

      {metrics && (
        <Section title="Regalo de 7 días Pro" note="Cuentas Lite e invitaciones. Convertidas: con un cobro aprobado después del regalo.">
          <Stats items={[
            ['Disponibles sin activar', String(metrics.gift.available)], ['Regalos vigentes', String(metrics.gift.active)],
            ['Recibieron regalo', String(metrics.gift.received)],
            ['Pasaron a Pro pagado', String(metrics.gift.converted)], ['Conversión', pct(metrics.gift.conversionRate)],
            ['Volvieron a Lite', String(metrics.gift.backToLite)],
          ]} />
        </Section>
      )}

      {metrics && (
        <Section
          title="Invitaciones"
          note={`Mes UTC desde ${fmtDate(metrics.referrals.monthStart)} · tope ${metrics.referrals.capDays} días de Pro por persona`}
        >
          <Stats items={[
            ['Invitaciones', String(metrics.referrals.total)], ['Pendientes', String(metrics.referrals.pending)],
            ['Activadas (total)', String(metrics.referrals.activated)], ['Activadas este mes', String(metrics.referrals.activatedThisMonth)],
            ['Días dados este mes', String(metrics.referrals.daysGrantedThisMonth)], ['En el tope', String(metrics.referrals.atCap)],
            ['Auto-referidos', String(metrics.referrals.flagged)],
          ]} />
        </Section>
      )}

      {push && (
        <Section title="Avisos web push" note={`Últimos 30 días, desde ${fmtDate(push.since)}`}>
          {pushRows.length === 0 ? <p className="text-body-sm text-on-surface-light">Aún no hay avisos registrados.</p> : (
            <Card padding="sm" className="overflow-x-auto">
              <table className="w-full text-body-sm tabular-nums">
                <thead className="text-on-surface-light">
                  <tr className="text-left">
                    <th className="py-1 pr-3 font-normal">Categoría</th>
                    <th className="py-1 pr-3 text-right font-normal">Envíos</th>
                    <th className="py-1 pr-3 text-right font-normal">Clics</th>
                    <th className="py-1 pr-3 text-right font-normal">Tasa clic</th>
                    <th className="py-1 pr-3 text-right font-normal">Bajas</th>
                    <th className="py-1 text-right font-normal">Tasa baja</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {pushRows.map(([category, s]) => (
                    <tr key={category} className="border-t border-border">
                      <td className="py-1 pr-3 font-sans">{category}</td>
                      <td className="py-1 pr-3 text-right">{s.sent}</td>
                      <td className="py-1 pr-3 text-right">{s.clicked}</td>
                      <td className="py-1 pr-3 text-right">{pct(s.clickRate)}</td>
                      <td className="py-1 pr-3 text-right">{s.disabled}</td>
                      <td className="py-1 text-right">{pct(s.disableRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </Section>
      )}

      <Section title="Segmentos" note={`${segments.newThisWeek} cuentas nuevas en los últimos 7 días`}>
        <Stats items={(Object.keys(PLAN_SEGMENT_LABEL) as PlanSegment[]).map((k) => [PLAN_SEGMENT_LABEL[k], String(segments.plan[k])] as const)} />
        <Stats items={(Object.keys(ACTIVITY_SEGMENT_LABEL) as ActivitySegment[]).map((k) => [ACTIVITY_SEGMENT_LABEL[k], String(segments.activity[k])] as const)} />
      </Section>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Field label="Buscar por correo, nombre o usuario" className="md:max-w-sm">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ana@correo.com" />
        </Field>
        <ChipGroup label="Filtro" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-on-surface-light">{shown.length} de {users.length} cuentas</p>
        <Button variant="secondary" size="sm" disabled={shown.length === 0} onClick={() => void copyShownEmails(shown)}>
          {copiedList
            ? <><Check aria-hidden className="size-4" strokeWidth={1.75} />¡Copiados!</>
            : <><Copy aria-hidden className="size-4" strokeWidth={1.75} />Copiar correos de la lista ({shown.length})</>}
        </Button>
      </div>

      <ul className="flex flex-col gap-3">
        {shown.map((u) => (
          <li key={u.id}>
            <Card padding="sm" className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-label-lg">{u.displayName} <span className="font-normal text-on-surface-light">@{u.username}</span></p>
                <div className="flex items-center gap-1">
                  {/* lq-selectable: permite seleccionar el correo a mano (la app bloquea la selección global). */}
                  <p className="lq-selectable min-w-0 truncate text-body-sm text-on-surface-light" title={u.email}>{u.email}</p>
                  <Button variant="ghost" size="sm" className="shrink-0" aria-label={`Copiar el correo de ${u.displayName}`} onClick={() => void copyEmail(u.email)}>
                    {copiedEmail === u.email
                      ? <><Check aria-hidden className="size-4" strokeWidth={1.75} />Copiado</>
                      : <><Copy aria-hidden className="size-4" strokeWidth={1.75} />Copiar</>}
                  </Button>
                </div>
                <p className="text-body-sm text-on-surface-light">Alta {fmtDate(u.createdAt)} · Nivel {u.level}{u.lastSeenAt ? ` · Visto ${fmtDate(u.lastSeenAt)}` : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={u.plan === 'pro' ? 'success' : 'neutral'}>{STATUS_LABEL[u.status]}</Badge>
                {u.complimentary && <Badge variant="secondary">Cortesía</Badge>}
                {u.giftTrial && u.status === 'trialing' && <Badge variant="primary">Regalo</Badge>}
                {u.giftAvailable && <Badge variant="info">Regalo al entrar</Badge>}
                {u.pendingPayments > 0 && <Badge variant="warning">{u.pendingPayments} en espera</Badge>}
              </div>
              <div className="text-body-sm">
                <p>{u.hasPaid ? <>Pagó <span className="font-mono">{cop(u.paidTotalCop)}</span> ({u.paidCount} {u.paidCount === 1 ? 'vez' : 'veces'})</> : 'Aún no ha pagado'}</p>
                <p className="text-on-surface-light">Último pago {fmtDate(u.lastPaidAt)}</p>
                {u.lastPaymentError && <p className="text-error-text">Error: {u.lastPaymentError}</p>}
                {u.lastPaymentError && (
                  <Button variant="ghost" size="sm" loading={rechecking === u.id} onClick={() => void recheck(u)}>Revisar cobro en Wompi</Button>
                )}
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
            <p className="text-body-md">Se borran <strong className="lq-selectable">{toDelete.email}</strong>, su progreso, sus hábitos, sus pagos registrados y todo lo que tenga guardado. No se puede deshacer.</p>
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
