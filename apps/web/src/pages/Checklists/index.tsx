// Listas: checklists reutilizables por categoría (Compras, Tareas del hogar,
// Finanzas…), propias o compartidas. /checklists/join/:token abre la invitación.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { Button, ChipGroup, EmptyState, ErrorState, Field, Input, Modal, PageLoader, ResponsiveDialog, Textarea } from '@/components/ui/lq';
import { Lettering } from '@/components/layout/Lettering';
import { ChecklistCard } from '@/components/checklists/ChecklistCard';
import { ShareChecklistDialog } from '@/components/checklists/ShareChecklistDialog';
import { useToastStore } from '@/hooks/useToast';
import * as svc from '@/services/checklist.service';
import type { Checklist, ChecklistInvite } from '@/services/checklist.service';

const PRESETS = ['Compras', 'Tareas del hogar', 'Finanzas', 'General'];
const OTHER = '__other__';

function NewChecklistDialog({ open, onClose, onCreated, initialCategory }: {
  open: boolean; onClose: () => void; onCreated: (list: Checklist) => void; initialCategory: string;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Compras');
  const [custom, setCustom] = useState('');
  const [items, setItems] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(''); setItems(''); setTouched(false);
    if (PRESETS.includes(initialCategory)) { setCategory(initialCategory); setCustom(''); }
    else if (initialCategory) { setCategory(OTHER); setCustom(initialCategory); }
    else { setCategory('Compras'); setCustom(''); }
  }, [open, initialCategory]);

  const finalCategory = category === OTHER ? custom.trim() : category;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !finalCategory) return;
    setSaving(true);
    try {
      const list = await svc.createChecklist({
        name: name.trim(),
        category: finalCategory,
        items: items.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 300),
      });
      onCreated(list);
    } catch (err) {
      useToastStore.getState().error(svc.checklistError(err, 'No se pudo crear la lista'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Nueva lista" className="md:max-w-[520px]">
      <form className="flex flex-col gap-5" onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Nombre" error={touched && !name.trim() ? 'Ponle un nombre' : undefined}>
          <Input data-autofocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mercado del sábado" />
        </Field>
        <div className="flex flex-col gap-2">
          <ChipGroup label="Categoría" value={category} onChange={setCategory} options={[...PRESETS.map((p) => ({ value: p, label: p })), { value: OTHER, label: 'Otra' }]} />
          {category === OTHER && (
            <Field label="Nombre de la categoría" error={touched && !custom.trim() ? 'Escribe la categoría' : undefined}>
              <Input value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)} placeholder="Ej. Viaje" />
            </Field>
          )}
        </div>
        <Field label="Elementos" help="Opcional · uno por línea">
          <Textarea rows={4} value={items} onChange={(e) => setItems(e.target.value)} placeholder={'Leche\nPan\nHuevos'} />
        </Field>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Crear lista</Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

export default function ChecklistsPage() {
  const { token } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [lists, setLists] = useState<Checklist[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState('all');
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState<Checklist | null>(null);
  const [removing, setRemoving] = useState<Checklist | null>(null);
  const [invite, setInvite] = useState<ChecklistInvite | null>(null);
  const [joining, setJoining] = useState(false);
  const focus = params.get('list');

  const load = useCallback(async () => {
    setFailed(false);
    try { setLists(await svc.fetchChecklists()); } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Invitación por enlace: se muestra antes de unirse.
  useEffect(() => {
    if (!token) return;
    svc.previewInvite(token).then((inv) => {
      if (inv.alreadyMember) navigate(`/checklists?list=${inv.checklistId}`, { replace: true });
      else setInvite(inv);
    }).catch((err) => {
      useToastStore.getState().error(svc.checklistError(err, 'Este enlace ya no es válido'));
      navigate('/checklists', { replace: true });
    });
  }, [token, navigate]);

  // ?list=… (aviso, enlace): lleva a esa lista.
  useEffect(() => {
    if (!focus || !lists) return;
    const t = window.setTimeout(() => document.getElementById(`checklist-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    return () => window.clearTimeout(t);
  }, [focus, lists]);

  const categories = useMemo(() => [...new Set((lists ?? []).map((l) => l.category))].sort((a, b) => a.localeCompare(b, 'es')), [lists]);
  const shown = (lists ?? []).filter((l) => category === 'all' || l.category === category);

  const replace = (next: Checklist) => setLists((prev) => prev?.map((l) => (l.id === next.id ? next : l)) ?? prev);

  async function join() {
    if (!token) return;
    setJoining(true);
    try {
      const list = await svc.joinChecklist(token);
      useToastStore.getState().success('Te uniste a la lista', list.name);
      setInvite(null);
      await load();
      navigate(`/checklists?list=${list.id}`, { replace: true });
    } catch (err) {
      useToastStore.getState().error(svc.checklistError(err, 'No se pudo unir'));
    } finally {
      setJoining(false);
    }
  }

  async function confirmRemove() {
    const list = removing;
    if (!list) return;
    setRemoving(null);
    setLists((prev) => prev?.filter((l) => l.id !== list.id) ?? prev);
    try {
      if (list.role === 'OWNER') await svc.deleteChecklist(list.id);
      else await svc.leaveChecklist(list.id);
      useToastStore.getState().success(list.role === 'OWNER' ? 'Lista eliminada' : 'Saliste de la lista');
    } catch (err) {
      useToastStore.getState().error(svc.checklistError(err, 'No se pudo completar'));
      void load();
    }
  }

  let body;
  if (failed) body = <ErrorState title="No pudimos cargar tus listas" onRetry={() => void load()} />;
  else if (!lists) body = <PageLoader label="Abriendo tus listas…" />;
  else if (lists.length === 0) {
    body = (
      <EmptyState
        icon={ListChecks}
        title="Aún no tienes listas"
        description="Crea una para las compras, las tareas de casa o tus pendientes de dinero, y compártela si quieres."
        action={<Button onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Nueva lista</Button>}
        className="py-16"
      />
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {categories.length > 1 && (
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ChipGroup label="Categoría" value={category} onChange={setCategory} options={[{ value: 'all', label: 'Todas' }, ...categories.map((c) => ({ value: c, label: c }))]} />
          </div>
        )}
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((list) => (
            <ChecklistCard
              key={list.id}
              list={list}
              highlight={focus === list.id}
              onChange={replace}
              onShare={list.role === 'OWNER' ? () => setSharing(list) : undefined}
              onRemove={() => setRemoving(list)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1 md:gap-2">
          <span className="hidden text-label-lg text-primary-text md:block">Organiza y comparte</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Listas" /></h1>
          <p className="hidden max-w-[520px] text-body-lg text-on-surface-light md:block">Compras, tareas del hogar, finanzas… cada lista con su categoría, sola o en equipo.</p>
        </div>
        {lists && lists.length > 0 && (
          <Button onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Nueva lista</Button>
        )}
      </motion.section>

      <motion.div variants={item}>{body}</motion.div>

      <NewChecklistDialog
        open={creating}
        initialCategory={category === 'all' ? '' : category}
        onClose={() => setCreating(false)}
        onCreated={(list) => {
          setCreating(false);
          setLists((prev) => [list, ...(prev ?? [])]);
          setParams((p) => { p.set('list', list.id); return p; }, { replace: true });
          useToastStore.getState().success('Lista creada');
        }}
      />

      <ShareChecklistDialog list={sharing} onClose={() => setSharing(null)} onChanged={() => void load()} />

      <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} title={removing?.role === 'OWNER' ? `¿Eliminar «${removing?.name}»?` : `¿Salir de «${removing?.name}»?`}>
        <p className="text-body-md text-on-surface">
          {removing?.role === 'OWNER'
            ? 'Se borrará la lista para ti y para quienes la compartían. No se puede deshacer.'
            : 'Dejarás de ver esta lista. Quien la creó puede volver a invitarte.'}
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => void confirmRemove()}>{removing?.role === 'OWNER' ? 'Eliminar' : 'Salir'}</Button>
        </div>
      </Modal>

      <Modal open={Boolean(invite)} onClose={() => { setInvite(null); navigate('/checklists', { replace: true }); }} title="Te invitaron a una lista">
        {invite && (
          <>
            <p className="text-body-md text-on-surface">
              <b>{invite.owner.displayName}</b> te invita a «{invite.name}» ({invite.category}, {invite.itemCount} {invite.itemCount === 1 ? 'elemento' : 'elementos'}).
              {' '}{invite.permission === 'EDIT' ? 'Podrás añadir y marcar elementos.' : 'Podrás verla.'}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setInvite(null); navigate('/checklists', { replace: true }); }}>Ahora no</Button>
              <Button loading={joining} onClick={() => void join()}>Unirme</Button>
            </div>
          </>
        )}
      </Modal>
    </motion.div>
  );
}
