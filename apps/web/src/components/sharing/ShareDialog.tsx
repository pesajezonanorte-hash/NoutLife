import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Shield, Trash2, UserPlus, X } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Spinner } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { addShareMember, createShare, getOwnerShare, removeShareMember, revokeShare, shareUrl, type ResourceShare, type ShareMember, type SharePermission, type ShareResourceType } from '@/services/share.service';
import { useText, type Copy as CopyDict } from '@/lib/i18n';

const es = {
  title: (name: string) => `Compartir ${name}`,
  anyone: 'Cualquier persona con el enlace podrá acceder según el permiso que elijas. Puedes desactivarlo cuando quieras.',
  permission: 'Permiso',
  viewOnly: 'Solo ver',
  viewAndEdit: 'Ver y editar',
  viewHint: 'El enlace muestra el contenido sin permitir cambios.',
  editHint: 'El enlace permite a quien lo tenga marcar pasos o hitos como completados.',
  updateLink: 'Actualizar enlace',
  createLink: 'Crear enlace',
  withPeople: 'Compartir con personas',
  userOrId: 'Usuario o ID',
  userPlaceholder: '@usuario o ID',
  personPermission: 'Permiso de la persona',
  canEdit: 'Puede editar',
  invite: 'Invitar',
  removeAccess: (name: string) => `Quitar acceso a ${name}`,
  edits: 'Edita',
  views: 'Ve',
  sharedNote: 'Lo verán en «Compartido conmigo» dentro de Listas, aunque el enlace esté desactivado.',
  activeLink: 'Enlace activo',
  copyLink: 'Copiar enlace',
  deactivate: 'Desactivar',
  accessActive: (perm: string) => `Acceso activo: ${perm}.`,
  editAccess: 'ver y editar',
  viewAccess: 'solo ver',
  loadFail: 'No se pudo revisar el enlace existente',
  ready: 'Enlace listo para compartir',
  createFail: 'No se pudo crear el enlace',
  copied: 'Enlace copiado',
  selectToCopy: 'Selecciona y copia el enlace',
  shared: (username: string) => `Compartido con @${username}`,
  inviteFail: 'No se pudo invitar',
  removeFail: 'No se pudo quitar el acceso',
  revoked: 'Enlace desactivado',
  revokeFail: 'No se pudo desactivar el enlace',
};

const en: typeof es = {
  title: (name: string) => `Share ${name}`,
  anyone: 'Anyone with the link can access it with the permission you choose. You can turn it off whenever you like.',
  permission: 'Permission',
  viewOnly: 'View only',
  viewAndEdit: 'View and edit',
  viewHint: 'The link shows the content without allowing changes.',
  editHint: 'The link lets whoever has it mark steps or milestones as completed.',
  updateLink: 'Update link',
  createLink: 'Create link',
  withPeople: 'Share with people',
  userOrId: 'Username or ID',
  userPlaceholder: '@username or ID',
  personPermission: 'Person’s permission',
  canEdit: 'Can edit',
  invite: 'Invite',
  removeAccess: (name: string) => `Remove access for ${name}`,
  edits: 'Edits',
  views: 'Views',
  sharedNote: 'They will see it under “Shared with me” in Lists, even if the link is turned off.',
  activeLink: 'Active link',
  copyLink: 'Copy link',
  deactivate: 'Turn off',
  accessActive: (perm: string) => `Active access: ${perm}.`,
  editAccess: 'view and edit',
  viewAccess: 'view only',
  loadFail: 'Could not check the existing link',
  ready: 'Link ready to share',
  createFail: 'Could not create the link',
  copied: 'Link copied',
  selectToCopy: 'Select and copy the link',
  shared: (username: string) => `Shared with @${username}`,
  inviteFail: 'Could not invite',
  removeFail: 'Could not remove access',
  revoked: 'Link turned off',
  revokeFail: 'Could not turn off the link',
};

const COPY: CopyDict<typeof es> = { es, en };

export function ShareDialog({ open, onClose, resourceType, resourceId, title }: {
  open: boolean;
  onClose: () => void;
  resourceType: ShareResourceType;
  resourceId: string;
  title: string;
}) {
  const t = useText(COPY);
  const toast = useToast();
  const [permission, setPermission] = useState<SharePermission>('VIEW');
  const [share, setShare] = useState<ResourceShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [members, setMembers] = useState<ShareMember[]>([]);
  const [invitee, setInvitee] = useState('');
  const [inviteePermission, setInviteePermission] = useState<SharePermission>('EDIT');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    getOwnerShare(resourceType, resourceId).then((current) => {
      if (!active) return;
      setShare(current?.isActive ? current : null);
      setMembers(current?.members ?? []);
      if (current?.isActive) setPermission(current.permission);
    }).catch(() => {
      if (active) toast.error(t.loadFail);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, resourceId, resourceType]);

  async function save() {
    setSaving(true);
    try {
      const result = await createShare(resourceType, resourceId, permission);
      setShare(result);
      toast.success(t.ready);
    } catch {
      toast.error(t.createFail);
    } finally { setSaving(false); }
  }

  async function copy() {
    if (!share) return;
    const url = shareUrl(share.code);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.copied);
    } catch {
      const input = document.getElementById(`share-url-${resourceId}`) as HTMLInputElement | null;
      input?.focus(); input?.select();
      toast.info(t.selectToCopy);
    }
  }

  async function invite() {
    if (!invitee.trim()) return;
    setInviting(true);
    try {
      const member = await addShareMember(resourceType, resourceId, invitee.trim(), inviteePermission);
      setMembers((list) => [...list.filter((m) => m.id !== member.id), member]);
      setInvitee('');
      toast.success(t.shared(member.user.username));
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(t.inviteFail, message);
    } finally { setInviting(false); }
  }

  async function removeMember(member: ShareMember) {
    try { await removeShareMember(member.id); setMembers((list) => list.filter((m) => m.id !== member.id)); }
    catch { toast.error(t.removeFail); }
  }

  async function revoke() {
    setRevoking(true);
    try {
      await revokeShare(resourceType, resourceId);
      setShare(null);
      toast.success(t.revoked);
    } catch { toast.error(t.revokeFail); }
    finally { setRevoking(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Link2 aria-hidden className="size-5 text-primary-text" />{t.title(title)}</span>}>
      <p className="text-body-md text-on-surface-light">{t.anyone}</p>
      {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <>
          <Field label={t.permission}>
            <Select value={permission} onChange={(event) => setPermission(event.target.value as SharePermission)}>
              <option value="VIEW">{t.viewOnly}</option>
              <option value="EDIT">{t.viewAndEdit}</option>
            </Select>
          </Field>
          <div className="flex items-start gap-3 rounded-xl bg-surface-variant p-3 text-body-sm text-on-surface-light">
            <Shield aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
            <span>{permission === 'VIEW' ? t.viewHint : t.editHint}</span>
          </div>
          <Button onClick={() => void save()} loading={saving} block>
            <Link2 aria-hidden className="size-4" />{share ? t.updateLink : t.createLink}
          </Button>
          {/* Invitar a personas concretas por su @usuario o su ID (no necesitan el enlace). */}
          <section aria-labelledby={`share-people-${resourceId}`} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <h3 id={`share-people-${resourceId}`} className="flex items-center gap-2 text-label-lg"><UserPlus aria-hidden className="size-4 text-primary-text" />{t.withPeople}</h3>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void invite(); }}>
              <Input aria-label={t.userOrId} value={invitee} onChange={(event) => setInvitee(event.target.value)} maxLength={80} placeholder={t.userPlaceholder} className="min-w-0 flex-1" />
              <Select aria-label={t.personPermission} value={inviteePermission} onChange={(event) => setInviteePermission(event.target.value as SharePermission)} className="sm:w-36">
                <option value="EDIT">{t.canEdit}</option>
                <option value="VIEW">{t.viewOnly}</option>
              </Select>
              <Button type="submit" variant="secondary" loading={inviting} disabled={!invitee.trim()}>{t.invite}</Button>
            </form>
            {members.length > 0 && (
              <ul className="flex flex-col gap-1">
                {members.map((member) => (
                  <li key={member.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-variant/60">
                    <span className="min-w-0 flex-1 truncate text-body-md">{member.user.displayName} <span className="text-on-surface-light">@{member.user.username}</span></span>
                    <span className="text-body-sm text-on-surface-light">{member.permission === 'EDIT' ? t.edits : t.views}</span>
                    <Button variant="icon" aria-label={t.removeAccess(member.user.displayName)} onClick={() => void removeMember(member)} className="size-9"><X aria-hidden className="size-4" /></Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-body-sm text-on-surface-light">{t.sharedNote}</p>
          </section>
          {share && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <Field label={t.activeLink}>
                <Input id={`share-url-${resourceId}`} readOnly value={shareUrl(share.code)} onFocus={(event) => event.currentTarget.select()} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void copy()}><Copy aria-hidden className="size-4" />{t.copyLink}</Button>
                <Button variant="danger" size="sm" onClick={() => void revoke()} loading={revoking}><Trash2 aria-hidden className="size-4" />{t.deactivate}</Button>
              </div>
              <p className="flex items-center gap-1.5 text-body-sm text-success-text"><Check aria-hidden className="size-4" />{t.accessActive(share.permission === 'EDIT' ? t.editAccess : t.viewAccess)}</p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
