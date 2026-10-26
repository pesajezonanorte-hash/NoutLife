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
import { useText, type Copy } from '@/lib/i18n';

const COPY: Copy<{
  eyebrow: string; title: string; description: string; newList: string; searchLabel: string; searchPh: string; filterLabel: string;
  allCategories: string; quickGroup: string; all: string; loading: string; loadFailed: string; loadFailedBody: string;
  noFilter: string; startTitle: string; noFilterBody: string; startBody: string; createList: string;
  sharedTitle: string; from: string; canEdit: string; viewOnly: string; leave: (t: string) => string; leaveFailed: string;
  modalTitle: string; nameLabel: string; namePh: string; descLabel: string; descPh: string; categoryLabel: string; categoryPh: string;
  stepsLabel: string; stepsPh: string; templateLabel: string; cancel: string; create: string; created: string; createFailed: string;
  categoryNames: Record<string, string>;
}> = {
  es: {
    eyebrow: 'Organización personal', title: 'Listas y checklists',
    description: 'Crea listas por categoría, reutiliza plantillas y comparte pasos con quien te acompaña.', newList: 'Nueva lista',
    searchLabel: 'Buscar listas', searchPh: 'Buscar por nombre o categoría…', filterLabel: 'Filtrar categoría', allCategories: 'Todas las categorías',
    quickGroup: 'Categorías rápidas', all: 'Todas', loading: 'Cargando tus listas…',
    loadFailed: 'No pudimos cargar tus listas', loadFailedBody: 'Vuelve a intentarlo. Tus datos siguen guardados.',
    noFilter: 'No hay listas con esos filtros', startTitle: 'Empieza con tu primera lista',
    noFilterBody: 'Prueba con otra categoría o búsqueda.', startBody: 'Crea una lista desde cero o conviértela en plantilla para reutilizarla.', createList: 'Crear lista',
    sharedTitle: 'Compartido conmigo', from: 'De', canEdit: 'puedes editar', viewOnly: 'solo ver', leave: (t) => `Salir de ${t}`, leaveFailed: 'No se pudo salir de la lista',
    modalTitle: 'Nueva checklist', nameLabel: 'Nombre', namePh: 'Ej. Preparar la semana', descLabel: 'Descripción (opcional)', descPh: '¿Para qué sirve esta lista?',
    categoryLabel: 'Categoría', categoryPh: 'Compras, Tareas del hogar, Finanzas…', stepsLabel: 'Pasos iniciales (uno por línea)',
    stepsPh: 'Definir prioridades\nPreparar materiales\nRevisar al final', templateLabel: 'Guardar también como plantilla reutilizable',
    cancel: 'Cancelar', create: 'Crear lista', created: 'Lista creada', createFailed: 'No se pudo crear la lista',
    categoryNames: {},
  },
  en: {
    eyebrow: 'Personal organization', title: 'Lists & checklists',
    description: 'Make lists by category, reuse templates and share steps with the people who support you.', newList: 'New list',
    searchLabel: 'Search lists', searchPh: 'Search by name or category…', filterLabel: 'Filter by category', allCategories: 'All categories',
    quickGroup: 'Quick categories', all: 'All', loading: 'Loading your lists…',
    loadFailed: "We couldn't load your lists", loadFailedBody: 'Try again. Your data is still saved.',
    noFilter: 'No lists match these filters', startTitle: 'Start with your first list',
    noFilterBody: 'Try another category or search.', startBody: 'Create a list from scratch or turn it into a template to reuse it.', createList: 'Create list',
    sharedTitle: 'Shared with me', from: 'From', canEdit: 'you can edit', viewOnly: 'view only', leave: (t) => `Leave ${t}`, leaveFailed: "We couldn't leave the list",
    modalTitle: 'New checklist', nameLabel: 'Name', namePh: 'E.g. Plan the week', descLabel: 'Description (optional)', descPh: 'What is this list for?',
    categoryLabel: 'Category', categoryPh: 'Groceries, Household, Finances…', stepsLabel: 'Starting steps (one per line)',
    stepsPh: 'Set priorities\nGet materials ready\nReview at the end', templateLabel: 'Also save as a reusable template',
    cancel: 'Cancel', create: 'Create list', created: 'List created', createFailed: "We couldn't create the list",
    categoryNames: { Compras: 'Groceries', 'Tareas del hogar': 'Household', Finanzas: 'Finances', personal: 'Personal', rutina: 'Routine', gimnasio: 'Gym', 'alimentación': 'Food', estudio: 'Study', viaje: 'Travel' },
  },
};

export default function ChecklistsPage() {
  const t = useText(COPY);
  const toast = useToast();
  const label = (value: string) => t.categoryNames[value] ?? value;
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
    catch { toast.error(t.leaveFailed); }
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
      setCreateOpen(false); resetForm(); await load(); toast.success(t.created);
    } catch { toast.error(t.createFailed); }
    finally { setSaving(false); }
  }

  return (
    <ZoneShell zone="custom" contentClassName="gap-6 md:gap-10" ambience={<AmbientLight tone="primary" alpha={0.09} darkAlpha={0.06} d={16} className="right-[8%] top-[8%] h-[34rem] w-[70%]" />}>
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} aside={<Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />{t.newList}</Button>} />

      <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1"><Search aria-hidden className="pointer-events-none absolute left-4 top-3 size-5 text-on-surface-light" /><Input aria-label={t.searchLabel} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPh} className="pl-11" /></div>
        <Select aria-label={t.filterLabel} value={category} onChange={(event) => setCategory(event.target.value)} className="sm:w-56"><option value="all">{t.allCategories}</option>{categories.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select>
      </motion.div>

      <motion.div variants={item} role="group" aria-label={t.quickGroup} className="flex flex-wrap gap-2">
        {['all', ...categories].map((value) => (
          <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}
            className={`min-h-11 rounded-full border px-4 text-label-lg transition-colors ${category === value ? 'border-primary bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:bg-surface-variant'}`}>
            {value === 'all' ? t.all : label(value)}
            <span className="ml-1.5 font-mono text-body-sm tabular-nums opacity-70">{value === 'all' ? checklists.length : checklists.filter((list) => sameCategory(list.category, value)).length}</span>
          </button>
        ))}
      </motion.div>

      {loading ? <PageLoader label={t.loading} /> : failed ? <ErrorState title={t.loadFailed} description={t.loadFailedBody} onRetry={() => void load()} /> : visible.length === 0 ? (
        <EmptyState icon={ListChecks} title={checklists.length ? t.noFilter : t.startTitle} description={checklists.length ? t.noFilterBody : t.startBody} action={!checklists.length ? <Button onClick={() => setCreateOpen(true)}><Plus aria-hidden className="size-4" />{t.createList}</Button> : undefined} />
      ) : (
        <motion.div variants={item} className="grid items-start gap-5 lg:grid-cols-2">{visible.map((list) => <ChecklistCard key={list.id} checklist={list} onRefresh={load} onShare={() => setShareTarget(list)} />)}</motion.div>
      )}

      {sharedWithMe.length > 0 && (
        <motion.section variants={item} aria-labelledby="shared-with-me" className="flex flex-col gap-3">
          <h2 id="shared-with-me" className="flex items-center gap-2 text-heading-md"><Users aria-hidden className="size-5 text-primary-text" />{t.sharedTitle}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sharedWithMe.map((entry) => (
              <li key={entry.memberId} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                {entry.resourceType === 'GOAL' ? <Target aria-hidden className="size-5 shrink-0 text-primary-text" /> : <ListChecks aria-hidden className="size-5 shrink-0 text-primary-text" />}
                <Link to={`/shared/${encodeURIComponent(entry.code)}`} className="min-w-0 flex-1">
                  <span className="block truncate text-label-lg text-on-surface">{entry.title}</span>
                  <span className="block truncate text-body-sm text-on-surface-light">{t.from} {entry.owner.displayName} · {entry.permission === 'EDIT' ? t.canEdit : t.viewOnly}</span>
                </Link>
                <Button variant="icon" aria-label={t.leave(entry.title)} onClick={() => void leaveShared(entry)} className="size-9"><X aria-hidden className="size-4" /></Button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title={t.modalTitle}>
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label={t.nameLabel}><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder={t.namePh} required /></Field>
          <Field label={t.descLabel}><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder={t.descPh} /></Field>
          <Field label={t.categoryLabel}><Input list="checklist-category-options" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={40} placeholder={t.categoryPh} required /></Field>
          <datalist id="checklist-category-options">{CHECKLIST_CATEGORIES.map((value) => <option key={value} value={value} />)}</datalist>
          <Field label={t.stepsLabel}><Textarea value={itemsText} onChange={(event) => setItemsText(event.target.value)} maxLength={8000} placeholder={t.stepsPh} /></Field>
          <label className="flex min-h-11 items-center gap-3 text-body-md text-on-surface"><input type="checkbox" checked={template} onChange={(event) => setTemplate(event.target.checked)} className="size-5 accent-[rgb(var(--lq-primary))]" />{t.templateLabel}</label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { setCreateOpen(false); resetForm(); }}>{t.cancel}</Button><Button type="submit" loading={saving} disabled={!title.trim()}><Check aria-hidden className="size-4" />{t.create}</Button></div>
        </form>
      </Modal>
      {shareTarget && <ShareDialog open onClose={() => setShareTarget(null)} resourceType="CHECKLIST" resourceId={shareTarget.id} title={shareTarget.title} />}
    </ZoneShell>
  );
}
