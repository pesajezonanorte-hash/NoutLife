import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ListChecks, Plus, Search, Target, Users, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Button, EmptyState, ErrorState, Field, Input, Modal, PageLoader, Select, Textarea } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { item } from '@/lib/motion';
import * as checklistService from '@/services/checklist.service';
import type { Checklist } from '@/services/checklist.service';
import { ChecklistCard } from '@/components/checklists/ChecklistCard';
import { CHECKLIST_CATEGORIES, sameCategory } from '@/components/checklists/categories';
import { ShareDialog } from '@/components/sharing/ShareDialog';
import { Link } from 'react-router-dom';
import { listSharedWithMe, removeShareMember, type SharedWithMe } from '@/services/share.service';

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
  const [newCategory, setNewCategory] = useState('Compras');
  const [itemsText, setItemsText] = useState('');
  const [template, setTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMe[]>([]);
  useEffect(() => { listSharedWithMe().then(setSharedWithMe).catch(() => setSharedWithMe([])); }, []);
  async function leaveShared(entry: SharedWithMe) {
    try { await removeShareMember(entry.memberId); setSharedWithMe((list) => list.filter((e) => e.memberId !== entry.memberId)); }
    catch { toast.error('No se pudo salir de la lista'); }
  }

  const load = useCallback(async () => {
    try { setChecklists(await checklistService.listChecklists()); setFailed(false); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Las categorías base (Compras, Tareas del hogar, Finanzas…) siempre aparecen; luego las propias.
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const value of [...CHECKLIST_CATEGORIES.slice(0, 3), ...checklists.map((list) => list.category)]) {
      if (!seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
    }
    return [...seen.values()];
  }, [checklists]);
  const visible = useMemo(() => checklists.filter((list) => (category === 'all' || sameCategory(list.category, category)) && `${list.title} ${list.description ?? ''} ${list.category}`.toLowerCase().includes(search.trim().toLowerCase())), [checklists, category, search]);

  function resetForm() {
    setTitle(''); setDescription(''); setNewCategory('Compras'); setItemsText(''); setTemplate(false);
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

      <motion.div variants={item} role="group" aria-label="Categorías rápidas" className="flex flex-wrap gap-2">
        {['all', ...categories].map((value) => (
          <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}
            className={`min-h-11 rounded-full border px-4 text-label-lg transition-colors ${category === value ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:bg-surface-variant'}`}>
            {value === 'all' ? 'Todas' : value}
            <span className="ml-1.5 font-mono text-body-sm tabular-nums opacity-70">{value === 'all' ? checklists.length : checklists.filter((list) => sameCategory(list.category, value)).length}</span>
          </button>
        ))}
      </motion.div>

      {loading ? <PageLoader label="Cargando tus listas…" /> : failed ? <ErrorState title="No pudimos cargar tus listas" description="Vuelve a intentarlo. Tus datos siguen guardados." onRetry={() => void load()} /> : visible.length === 0 ? (
        <EmptyState icon={ListChecks} title={checklists.length ? 'No hay listas con esos filtros' : 'Empieza con tu primera lista'} description={checklists.length ? 'Prueba con otra categoría o búsqueda.' : 'Crea una lista desde cero o conviértela en plantilla para reutilizarla.'} action={!checklists.length ? <Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />Crear lista</Button> : undefined} />
      ) : (
        <motion.div variants={item} className="grid items-start gap-5 lg:grid-cols-2">{visible.map((list) => <ChecklistCard key={list.id} checklist={list} onRefresh={load} onShare={() => setShareTarget(list)} />)}</motion.div>
      )}

      {sharedWithMe.length > 0 && (
        <motion.section variants={item} aria-labelledby="shared-with-me" className="flex flex-col gap-3">
          <h2 id="shared-with-me" className="flex items-center gap-2 text-heading-md"><Users aria-hidden className="size-5 text-primary-text" />Compartido conmigo</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sharedWithMe.map((entry) => (
              <li key={entry.memberId} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                {entry.resourceType === 'GOAL' ? <Target aria-hidden className="size-5 shrink-0 text-primary-text" /> : <ListChecks aria-hidden className="size-5 shrink-0 text-primary-text" />}
                <Link to={`/shared/${encodeURIComponent(entry.code)}`} className="min-w-0 flex-1">
                  <span className="block truncate text-label-lg text-on-surface">{entry.title}</span>
                  <span className="block truncate text-body-sm text-on-surface-light">De {entry.owner.displayName} · {entry.permission === 'EDIT' ? 'puedes editar' : 'solo ver'}</span>
                </Link>
                <Button variant="icon" aria-label={`Salir de ${entry.title}`} onClick={() => void leaveShared(entry)} className="size-9"><X aria-hidden className="size-4" /></Button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title="Nueva checklist">
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="Nombre"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Ej. Preparar la semana" required /></Field>
          <Field label="Descripción (opcional)"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="¿Para qué sirve esta lista?" /></Field>
          <Field label="Categoría"><Input list="checklist-category-options" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={40} placeholder="Compras, Tareas del hogar, Finanzas…" required /></Field>
          <datalist id="checklist-category-options">{CHECKLIST_CATEGORIES.map((value) => <option key={value} value={value} />)}</datalist>
          <Field label="Pasos iniciales (uno por línea)"><Textarea value={itemsText} onChange={(event) => setItemsText(event.target.value)} maxLength={8000} placeholder={'Definir prioridades\nPreparar materiales\nRevisar al final'} /></Field>
          <label className="flex min-h-11 items-center gap-3 text-body-md text-on-surface"><input type="checkbox" checked={template} onChange={(event) => setTemplate(event.target.checked)} className="size-5 accent-[rgb(var(--lq-primary))]" />Guardar también como plantilla reutilizable</label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button><Button type="submit" loading={saving} disabled={!title.trim()}><Check aria-hidden className="size-4" />Crear lista</Button></div>
        </form>
      </Modal>
      {shareTarget && <ShareDialog open onClose={() => setShareTarget(null)} resourceType="CHECKLIST" resourceId={shareTarget.id} title={shareTarget.title} />}
    </ZoneShell>
  );
}
