// Bloque de checklists de una categoría para incrustar en cualquier zona:
// <CategoryChecklists category="Compras" /> en Comida, «Finanzas» en Finanzas…
// Muestra las listas de esa categoría y permite crear una nueva al momento.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { Button, Card, IconChip, Input } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import * as checklistService from '@/services/checklist.service';
import type { Checklist } from '@/services/checklist.service';
import { ChecklistCard } from './ChecklistCard';
import { sameCategory } from './categories';

export function CategoryChecklists({ category, title, description, max = 2 }: { category: string; title?: string; description?: string; max?: number }) {
  const toast = useToast();
  const [lists, setLists] = useState<Checklist[] | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setLists((await checklistService.listChecklists()).filter((list) => sameCategory(list.category, category) && !list.isTemplate)); }
    catch { setLists([]); }
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try { await checklistService.createChecklist({ title: name.trim(), category }); setName(''); await load(); }
    catch { toast.error('No se pudo crear la lista'); }
    finally { setSaving(false); }
  }

  const headingId = `checklists-${category.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <Card as="section" padding="lg" aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconChip icon={ListChecks} tone="primary" size="sm" />
          <div className="min-w-0">
            <h3 id={headingId} className="text-heading-sm">{title ?? category}</h3>
            {description && <p className="text-body-sm text-on-surface-light">{description}</p>}
          </div>
        </div>
        <Link to="/checklists" className="shrink-0 text-label-lg text-primary-text hover:underline">Ver todas</Link>
      </div>
      {lists === null ? null : lists.length === 0 ? (
        <p className="text-body-sm text-on-surface-light">Aún no tienes listas de {category.toLowerCase()}.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lists.slice(0, max).map((list) => <ChecklistCard key={list.id} checklist={list} onRefresh={load} compact />)}
          {lists.length > max && <Link to="/checklists" className="text-body-sm text-primary-text hover:underline">y {lists.length - max} más…</Link>}
        </div>
      )}
      <form onSubmit={create} className="flex gap-2">
        <Input aria-label={`Nueva lista de ${category}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder={`Nueva lista de ${category.toLowerCase()}…`} />
        <Button type="submit" variant="secondary" loading={saving} disabled={!name.trim()} className="shrink-0"><Plus aria-hidden className="size-4" />Crear</Button>
      </form>
    </Card>
  );
}
