// Compartir una lista: por enlace (quien lo abre se une) o por usuario/ID, con
// permiso de ver o de editar. Solo la persona dueña llega aquí; el servidor lo exige igual.
import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Link2, Trash2, UserPlus } from 'lucide-react';
import { Button, Field, Input, ResponsiveDialog, SegmentedControl, Select } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import * as svc from '@/services/checklist.service';
import type { Checklist, ChecklistShares, SharePermission } from '@/services/checklist.service';

const PERMISSIONS: { value: SharePermission; label: string }[] = [
  { value: 'VIEW', label: 'Puede ver' },
  { value: 'EDIT', label: 'Puede editar' },
];

const linkOf = (token: string) => `${window.location.origin}/checklists/join/${token}`;

export function ShareChecklistDialog({ list, onClose, onChanged }: { list: Checklist | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToastStore.getState();
  const [shares, setShares] = useState<ChecklistShares | null>(null);
  const [linkPermission, setLinkPermission] = useState<SharePermission>('EDIT');
  const [user, setUser] = useState('');
  const [userPermission, setUserPermission] = useState<SharePermission>('EDIT');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!list) return;
    setShares(null); setUser('');
    svc.fetchShares(list.id).then(setShares).catch((err) => toast.error(svc.checklistError(err, 'No se pudieron cargar los accesos')));
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(call: () => Promise<ChecklistShares>, ok?: string) {
    setBusy(true);
    try {
      setShares(await call());
      if (ok) toast.success(ok);
      onChanged();
      return true;
    } catch (err) {
      toast.error(svc.checklistError(err, 'No se pudo completar'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    const url = linkOf(token);
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: list?.name, text: `Únete a mi lista «${list?.name}» en NoutLife`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch { /* compartir cancelado */ }
  }

  async function addUser(e: FormEvent) {
    e.preventDefault();
    if (!list || !user.trim()) return;
    if (await run(() => svc.shareWithUser(list.id, user.trim(), userPermission), 'Lista compartida')) setUser('');
  }

  return (
    <ResponsiveDialog open={Boolean(list)} onClose={onClose} title={list ? `Compartir «${list.name}»` : 'Compartir'} className="md:max-w-[520px]">
      {list && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3" aria-labelledby="share-link">
            <h3 id="share-link" className="flex items-center gap-2 text-label-lg"><Link2 aria-hidden className="size-4" strokeWidth={1.75} />Con un enlace</h3>
            <p className="text-body-sm text-on-surface-light">Quien abra el enlace con su cuenta se une a la lista.</p>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl role="radiogroup" label="Permiso del enlace" value={linkPermission} onChange={setLinkPermission} options={PERMISSIONS} className="flex-1" />
              <Button variant="secondary" loading={busy} onClick={() => void run(() => svc.createShareLink(list.id, linkPermission), 'Enlace creado')}>Crear enlace</Button>
            </div>
            {shares?.links.length ? (
              <ul className="flex flex-col gap-2">
                {shares.links.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-body-sm">{linkOf(link.token)}</span>
                      <span className="text-label-md text-on-surface-light">{link.permission === 'EDIT' ? 'Puede editar' : 'Puede ver'}</span>
                    </span>
                    <Button variant="icon" aria-label="Copiar enlace" onClick={() => void copy(link.token)}><Copy aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                    <Button variant="icon" aria-label="Desactivar enlace" disabled={busy} onClick={() => void run(() => svc.revokeShare(list.id, link.id), 'Enlace desactivado')} className="hover:text-error-text">
                      <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="share-user">
            <h3 id="share-user" className="flex items-center gap-2 text-label-lg"><UserPlus aria-hidden className="size-4" strokeWidth={1.75} />Con una persona</h3>
            <form onSubmit={(e) => void addUser(e)} className="flex flex-col gap-3">
              <Field label="Usuario o ID">
                <Input value={user} maxLength={60} onChange={(e) => setUser(e.target.value)} placeholder="@usuario" autoCapitalize="none" autoCorrect="off" />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl role="radiogroup" label="Permiso" value={userPermission} onChange={setUserPermission} options={PERMISSIONS} className="flex-1" />
                <Button type="submit" loading={busy} disabled={!user.trim()}>Compartir</Button>
              </div>
            </form>
          </section>

          {shares && shares.members.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="share-members">
              <h3 id="share-members" className="text-label-lg">Tienen acceso</h3>
              <ul className="flex flex-col gap-2">
                {shares.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/[var(--lq-soft-alpha)] text-label-lg text-primary-text">
                      {m.user.displayName.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-lg">{m.user.displayName}</span>
                      <span className="block truncate text-body-sm text-on-surface-light">@{m.user.username}</span>
                    </span>
                    <Select
                      aria-label={`Permiso de ${m.user.displayName}`}
                      value={m.permission}
                      disabled={busy}
                      onChange={(e) => void run(() => svc.updateShare(list.id, m.id, e.target.value as SharePermission))}
                      className="w-auto"
                    >
                      {PERMISSIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </Select>
                    <Button variant="icon" aria-label={`Quitar a ${m.user.displayName}`} disabled={busy} onClick={() => void run(() => svc.revokeShare(list.id, m.id), 'Acceso quitado')} className="hover:text-error-text">
                      <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
