import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Shield, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Spinner } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { createShare, getOwnerShare, revokeShare, shareUrl, type ResourceShare, type SharePermission, type ShareResourceType } from '@/services/share.service';

export function ShareDialog({ open, onClose, resourceType, resourceId, title }: {
  open: boolean;
  onClose: () => void;
  resourceType: ShareResourceType;
  resourceId: string;
  title: string;
}) {
  const toast = useToast();
  const [permission, setPermission] = useState<SharePermission>('VIEW');
  const [share, setShare] = useState<ResourceShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    getOwnerShare(resourceType, resourceId).then((current) => {
      if (!active) return;
      setShare(current?.isActive ? current : null);
      if (current?.isActive) setPermission(current.permission);
    }).catch(() => {
      if (active) toast.error('No se pudo revisar el enlace existente');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, resourceId, resourceType]);

  async function save() {
    setSaving(true);
    try {
      const result = await createShare(resourceType, resourceId, permission);
      setShare(result);
      toast.success('Enlace listo para compartir');
    } catch {
      toast.error('No se pudo crear el enlace');
    } finally { setSaving(false); }
  }

  async function copy() {
    if (!share) return;
    const url = shareUrl(share.code);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado');
    } catch {
      const input = document.getElementById(`share-url-${resourceId}`) as HTMLInputElement | null;
      input?.focus(); input?.select();
      toast.info('Selecciona y copia el enlace');
    }
  }

  async function revoke() {
    setRevoking(true);
    try {
      await revokeShare(resourceType, resourceId);
      setShare(null);
      toast.success('Enlace desactivado');
    } catch { toast.error('No se pudo desactivar el enlace'); }
    finally { setRevoking(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Link2 aria-hidden className="size-5 text-primary-text" />Compartir {title}</span>}>
      <p className="text-body-md text-on-surface-light">Cualquier persona con el enlace podrá acceder según el permiso que elijas. Puedes desactivarlo cuando quieras.</p>
      {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <>
          <Field label="Permiso">
            <Select value={permission} onChange={(event) => setPermission(event.target.value as SharePermission)}>
              <option value="VIEW">Solo ver</option>
              <option value="EDIT">Ver y editar</option>
            </Select>
          </Field>
          <div className="flex items-start gap-3 rounded-xl bg-surface-variant p-3 text-body-sm text-on-surface-light">
            <Shield aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />
            <span>{permission === 'VIEW' ? 'El enlace muestra el contenido sin permitir cambios.' : 'El enlace permite a quien lo tenga marcar pasos o hitos como completados.'}</span>
          </div>
          <Button onClick={() => void save()} loading={saving} block>
            <Link2 aria-hidden className="size-4" />{share ? 'Actualizar enlace' : 'Crear enlace'}
          </Button>
          {share && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <Field label="Enlace activo">
                <Input id={`share-url-${resourceId}`} readOnly value={shareUrl(share.code)} onFocus={(event) => event.currentTarget.select()} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void copy()}><Copy aria-hidden className="size-4" />Copiar enlace</Button>
                <Button variant="danger" size="sm" onClick={() => void revoke()} loading={revoking}><Trash2 aria-hidden className="size-4" />Desactivar</Button>
              </div>
              <p className="flex items-center gap-1.5 text-body-sm text-success-text"><Check aria-hidden className="size-4" />Acceso activo: {share.permission === 'EDIT' ? 'ver y editar' : 'solo ver'}.</p>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
