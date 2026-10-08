import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Copy, ListChecks, Plus, Search, Share2, Trash2, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Select, Textarea } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { item } from '@/lib/motion';
import * as checklistService from '@/services/checklist.service';
import type { Checklist, ChecklistItem } from '@/services/checklist.service';
import { ShareDialog } from '@/components/sharing/ShareDialog';

const CATEGORIES = ['personal', 'rutina', 'gimnasio', 'alimentación', 'estudio', 'hogar', 'viaje'];

function ChecklistCard({ checklist, onRefresh, onShare }: { checklist: Checklist; onRefresh: () => void; onShare: () => void }) {
  const toast = useToast();
  const [newStep, setNewStep] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const done = checklist.items.filter((step) => step.isDone).length;
  const pct = checklist.items.length ? Math.round(done * 100 / checklist.items.length) : 0;

  async function toggle(step: ChecklistItem) {
    setBusyId(step.id);
    try { await checklistService.updateItem(step.id, { isDone: !step.isDone }); await onRefresh(); }
    catch { toast.error('No se pudo actualizar el paso'); }
    finally { setBusyId(null); }
  }
  async function addStep(event: FormEvent) {
    event.preventDefault();
    if (!newStep.trim()) return;
    setSavingStep(true);
    try { await checklistService.addItem(checklist.id, newStep.trim()); setNewStep(''); await onRefresh(); }
    catch { toast.error('No se pudo añadir el paso'); }
    finally { setSavingStep(false); }
  }
  async function removeStep(step: ChecklistItem) {
    try { await checklistService.deleteItem(step.id); await onRefresh(); }
    catch { toast.error('No se pudo eliminar el paso'); }
  }
  async function duplicate() {
    try { await checklistService.duplicateChecklist(checklist.id); await onRefresh(); toast.success('Lista duplicada'); }
    catch { toast.error('No se pudo duplicar la lista'); }
  }
  async function remove() {
    if (!window.confirm(`¿Eliminar “${checklist.title}” y sus pasos?`)) return;
    try { await checklistService.deleteChecklist(checklist.id); await onRefresh(); toast.success('Lista eliminada'); }
    catch { toast.error('No se pudo eliminar la lista'); }
  }

  return (
    <Card as="article" padding="lg" className="flex min-w-0 flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/[var(--lq-soft-alpha)] text-primary-text"><ListChecks aria-hidden className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-heading-sm">{checklist.title}</h2>
            {checklist.isTemplate && <Badge variant="warning">Plantilla</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-on-surface-light"><span className="rounded-full bg-surface-variant px-2 py-0.5 capitalize">{checklist.category}</span><span>· {done}/{checklist.items.length} pasos</span></p>
          {checklist.description && <p className="mt-2 text-body-md text-on-surface-light">{checklist.description}</p>}
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-variant" role="progressbar" aria-label={`Progreso de ${checklist.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>

      <ul className="flex flex-col gap-1" aria-label={`Pasos de ${checklist.title}`}>
        {checklist.items.map((step) => (
          <li key={step.id} className="group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-variant/60">
            <button type="button" aria-pressed={step.isDone} aria-label={`${step.isDone ? 'Desmarcar' : 'Completar'} ${step.title}`} disabled={busyId === step.id} onClick={() => void toggle(step)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              {step.isDone ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" /> : <Circle aria-hidden className="size-5 shrink-0 text-on-surface-light" />}
              <span className={step.isDone ? 'text-body-md text-on-surface-light line-through' : 'text-body-md text-on-background'}>{step.title}</span>
            </button>
            <Button variant="icon" size="sm" aria-label={`Eliminar paso ${step.title}`} onClick={() => void removeStep(step)} className="size-9 text-on-surface-light opacity-70 hover:text-error-text"><Trash2 aria-hidden className="size-4" /></Button>
          </li>
        ))}
        {checklist.items.length === 0 && <li className="py-2 text-body-sm text-on-surface-light">Añade el primer paso para empezar.</li>}
      </ul>

      <form onSubmit={addStep} className="flex gap-2">
        <Input aria-label={`Nuevo paso para ${checklist.title}`} value={newStep} onChange={(event) => setNewStep(event.target.value)} maxLength={160} placeholder="Añadir un paso…" />
        <Button type="submit" variant="secondary" aria-label="Añadir paso" disabled={!newStep.trim()} loading={savingStep} className="shrink-0"><Plus aria-hidden className="size-4" />Añadir</Button>
      </form>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={onShare}><Share2 aria-hidden className="size-4" />Compartir</Button>
        <Button variant="ghost" size="sm" onClick={() => void duplicate()}><Copy aria-hidden className="size-4" />Duplicar</Button>
        <Button variant="ghost" size="sm" onClick={() => void remove()} className="text-error-text"><Trash2 aria-hidden className="size-4" />Eliminar</Button>
      </div>
    </Card>
  );
}

export default function ChecklistsPage() {
  const toast = useToast();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<Checklist | null>(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newCategory, setNewCategory] = useState('personal');
  const [itemsText, setItemsText] = useState('');
  const [template, setTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setChecklists(await checklistService.listChecklists()); setFailed(false); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => [...new Set(checklists.map((list) => list.category))].sort((a, b) => a.localeCompare(b)), [checklists]);
  const visible = useMemo(() => checklists.filter((list) => (category === 'all' || list.category === category) && `${list.title} ${list.description ?? ''} ${list.category}`.toLowerCase().includes(search.trim().toLowerCase())), [checklists, category, search]);

  function resetForm() {
    setTitle(''); setDescription(''); setNewCategory('personal'); setItemsText(''); setTemplate(false);
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await checklistService.createChecklist({
        title: title.trim(), description: description.trim() || undefined, category: newCategory.trim() || 'personal', isTemplate: template,
        items: itemsText.split('\n').map((value) => value.trim()).filter(Boolean).slice(0, 100).map((itemTitle) => ({ title: itemTitle })),
      });
      setCreateOpen(false); resetForm(); await load(); toast.success('Lista creada');
    } catch { toast.error('No se pudo crear la lista'); }
    finally { setSaving(false); }
  }

  return (
    <ZoneShell zone="custom" contentClassName="gap-6 md:gap-10" ambience={<AmbientLight tone="primary" alpha={0.09} darkAlpha={0.06} d={16} className="right-[8%] top-[8%] h-[34rem] w-[70%]" />}>
      <PageHeader eyebrow="Organización personal" title="Listas y checklists" description="Crea listas por categoría, reutiliza plantillas y comparte pasos con quien te acompaña." aside={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />Nueva lista</Button>} />

      <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1"><Search aria-hidden className="pointer-events-none absolute left-4 top-3 size-5 text-on-surface-light" /><Input aria-label="Buscar listas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o categoría…" className="pl-11" /></div>
        <Select aria-label="Filtrar categoría" value={category} onChange={(event) => setCategory(event.target.value)} className="sm:w-56"><option value="all">Todas las categorías</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
      </motion.div>

      {loading ? <PageLoader label="Cargando tus listas…" /> : failed ? <ErrorState title="No pudimos cargar tus listas" description="Vuelve a intentarlo. Tus datos siguen guardados." onRetry={() => void load()} /> : visible.length === 0 ? (
        <EmptyState icon={ListChecks} title={checklists.length ? 'No hay listas con esos filtros' : 'Empieza con tu primera lista'} description={checklists.length ? 'Prueba con otra categoría o búsqueda.' : 'Crea una lista desde cero o conviértela en plantilla para reutilizarla.'} action={!checklists.length ? <Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />Crear lista</Button> : undefined} />
      ) : (
        <motion.div variants={item} className="grid items-start gap-5 lg:grid-cols-2">{visible.map((list) => <ChecklistCard key={list.id} checklist={list} onRefresh={load} onShare={() => setShareTarget(list)} />)}</motion.div>
      )}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title="Nueva checklist">
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="Nombre"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Ej. Preparar la semana" required /></Field>
          <Field label="Descripción (opcional)"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="¿Para qué sirve esta lista?" /></Field>
          <Field label="Categoría"><Input list="checklist-category-options" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={40} placeholder="personal, gimnasio…" required /></Field>
          <datalist id="checklist-category-options">{CATEGORIES.map((value) => <option key={value} value={value} />)}</datalist>
          <Field label="Pasos iniciales (uno por línea)"><Textarea value={itemsText} onChange={(event) => setItemsText(event.target.value)} maxLength={8000} placeholder={'Definir prioridades\nPreparar materiales\nRevisar al final'} /></Field>
          <label className="flex min-h-11 items-center gap-3 text-body-md text-on-surface"><input type="checkbox" checked={template} onChange={(event) => setTemplate(event.target.checked)} className="size-5 accent-[rgb(var(--lq-primary))]" />Guardar también como plantilla reutilizable</label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button><Button type="submit" loading={saving} disabled={!title.trim()}><Check aria-hidden className="size-4" />Crear lista</Button></div>
        </form>
      </Modal>
      {shareTarget && <ShareDialog open onClose={() => setShareTarget(null)} resourceType="CHECKLIST" resourceId={shareTarget.id} title={shareTarget.title} />}
    </ZoneShell>
  );
}
