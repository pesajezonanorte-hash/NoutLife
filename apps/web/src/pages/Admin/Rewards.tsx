// Enlaces de recompensa (/admin/recompensas): se crean aquí y se envían por Instagram. Cada uno se
// canjea una sola vez: 7 días de Pro (o se suman al plan vigente) y el tema exclusivo Calma. El
// enlace completo solo se ve al crearlo: la base guarda su huella, no el token.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Copy, Gift, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, ChipGroup, ErrorState, Field, Input, PageLoader, buttonClasses, type BadgeVariant, type ChipOption } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { apiError } from '@/services/network.service';
import * as adminService from '@/services/admin.service';
import type { NewRewardLink, RewardLinkRow } from '@/services/admin.service';
import { copyText } from '@/lib/clipboard';

const dateFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');

type Expiry = '7' | '30' | '90' | 'never';
const EXPIRY: ChipOption<Expiry>[] = [
  { value: '7', label: '7 días' }, { value: '30', label: '30 días' }, { value: '90', label: '90 días' }, { value: 'never', label: 'No vence' },
];

const STATUS: Record<RewardLinkRow['status'], { label: string; variant: BadgeVariant; icon: typeof Check }> = {
  available: { label: 'Disponible', variant: 'primary', icon: Gift },
  claimed: { label: 'Canjeado', variant: 'success', icon: Check },
  expired: { label: 'Vencido', variant: 'neutral', icon: Clock },
};

const OUTCOME: Record<NonNullable<RewardLinkRow['outcome']>, string> = {
  activated: 'Pro activado',
  extended: 'Pro extendido',
  complimentary: 'Cortesía (solo tema)',
};

export default function AdminRewardsPage() {
  const toast = useToast();
  const [links, setLinks] = useState<RewardLinkRow[] | null>(null);
  const [error, setError] = useState(false);
  const [count, setCount] = useState('1');
  const [note, setNote] = useState('');
  const [expiry, setExpiry] = useState<Expiry>('30');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<NewRewardLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(false);
    adminService.listRewardLinks().then(setLinks).catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  const amount = Number(count);
  const countError = /^\d+$/.test(count.trim()) && amount >= 1 && amount <= 50 ? undefined : 'Entre 1 y 50.';

  async function create(event: FormEvent) {
    event.preventDefault();
    if (countError) return;
    setSaving(true);
    try {
      const made = await adminService.createRewardLinks({ count: amount, note: note.trim() || undefined, expiresInDays: expiry === 'never' ? null : Number(expiry) });
      setCreated(made);
      setNote('');
      toast.success(made.length === 1 ? 'Enlace creado' : `${made.length} enlaces creados`);
      load();
    } catch (err) {
      toast.error(apiError(err, 'No se pudieron crear los enlaces'));
    } finally {
      setSaving(false);
    }
  }

  async function copy(key: string, text: string) {
    if (await copyText(text)) { setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800); }
    else toast.error('No se pudo copiar');
  }

  async function revoke(link: RewardLinkRow) {
    setRevoking(link.id);
    try {
      await adminService.revokeRewardLink(link.id);
      toast.success('Enlace anulado: ya no se puede canjear');
      load();
    } catch (err) {
      toast.error(apiError(err, 'No se pudo anular'));
    } finally {
      setRevoking(null);
    }
  }

  const urls = created.map((link) => adminService.rewardLinkUrl(link.token));
  const totals = links ? {
    available: links.filter((l) => l.status === 'available').length,
    claimed: links.filter((l) => l.status === 'claimed').length,
  } : null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <Link to="/admin" className={buttonClasses('ghost', 'md', false) + ' self-start'}>
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />Administración
      </Link>
      <PageHeader
        eyebrow="Administración"
        title="Enlaces de recompensa"
        description="Para enviar por Instagram. Cada enlace se canjea una sola vez: 7 días de Pro (si ya tiene Pro, se suman al final) y el tema exclusivo Calma."
      />

      <Card padding="md">
        <form onSubmit={create} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <Field label="Cantidad" error={countError}>
              <Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} invalid={Boolean(countError)} />
            </Field>
            <Field label="Nota interna (opcional)" help="A quién se envía, por ejemplo la cuenta de Instagram. Solo se ve aquí.">
              <Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="@cuenta" />
            </Field>
          </div>
          <ChipGroup label="Vence en" options={EXPIRY} value={expiry} onChange={setExpiry} />
          <Button type="submit" disabled={saving || Boolean(countError)} className="self-start">
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />{saving ? 'Creando…' : 'Crear enlaces'}
          </Button>
        </form>
      </Card>

      {urls.length > 0 && (
        <Card padding="md" className="flex flex-col gap-3 border-primary/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-heading-sm">Copia los enlaces ahora</p>
            {urls.length > 1 && (
              <Button variant="secondary" size="sm" onClick={() => copy('all', urls.join('\n'))}>
                {copied === 'all' ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}Copiar todos
              </Button>
            )}
          </div>
          <p className="text-body-sm text-on-surface-light">Por seguridad no se guardan completos: al salir de esta página ya no se pueden volver a ver.</p>
          <ul className="flex flex-col gap-2">
            {urls.map((url, i) => (
              <li key={created[i].id} className="flex items-center gap-2 rounded-md border border-border bg-surface-variant/50 px-3 py-2">
                <code className="lq-selectable min-w-0 flex-1 truncate font-mono text-body-sm">{url}</code>
                <Button variant="ghost" size="sm" onClick={() => copy(created[i].id, url)} aria-label="Copiar enlace">
                  {copied === created[i].id ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {error ? <ErrorState onRetry={load} /> : !links ? <PageLoader /> : (
        <Card padding="md" className="flex flex-col gap-4">
          <p className="text-body-sm text-on-surface-light">
            {links.length} enlaces · {totals!.available} disponibles · {totals!.claimed} canjeados
          </p>
          {links.length === 0 ? <p className="text-body-md text-on-surface-light">Todavía no hay enlaces.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-body-sm">
                <thead className="text-on-surface-light">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Nota</th>
                    <th className="py-2 pr-3 font-medium">Creado</th>
                    <th className="py-2 pr-3 font-medium">Vence</th>
                    <th className="py-2 pr-3 font-medium">Canje</th>
                    <th className="py-2 font-medium"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => {
                    const s = STATUS[link.status];
                    const who = link.claimedBy ? (link.claimedBy.username ? `@${link.claimedBy.username}` : 'Cuenta borrada') : null;
                    return (
                      <tr key={link.id} className="border-b border-border/60 align-top">
                        <td className="py-2.5 pr-3"><Badge variant={s.variant} icon={s.icon}>{s.label}</Badge></td>
                        <td className="py-2.5 pr-3">{link.note ?? '—'}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{fmtDate(link.createdAt)}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{link.expiresAt ? fmtDate(link.expiresAt) : 'No vence'}</td>
                        <td className="py-2.5 pr-3">
                          {link.claimedAt ? (
                            <span className="flex flex-col">
                              <span>{who} · {fmtDate(link.claimedAt)}</span>
                              {link.outcome && <span className="text-on-surface-light">{OUTCOME[link.outcome]}</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          {link.status === 'available' && (
                            <Button variant="ghost" size="sm" disabled={revoking === link.id} onClick={() => revoke(link)}>Anular</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
