// Bloque de checklists de una categoría para incrustar en cualquier zona:
// <CategoryChecklists category="Compras" /> en Comida, «Finanzas» en Finanzas…
// Muestra las listas de esa categoría y permite crear una nueva al momento.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import { Button, Card, IconChip, Input } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { useText, type Copy as CopyDict } from '@/lib/i18n';
import * as checklistService from '@/services/checklist.service';
import type { Checklist } from '@/services/checklist.service';
import { ChecklistCard } from './ChecklistCard';
import { sameCategory } from './categories';

const es = {
  createFail: 'No se pudo crear la lista',
  seeAll: 'Ver todas',
  none: (category: string): string => `Aún no tienes listas de ${category}.`,
  more: (n: number): string => `y ${n} más…`,
  newList: (category: string): string => `Nueva lista de ${category}`,
  newListPh: (category: string): string => `Nueva lista de ${category}…`,
  create: 'Crear',
};

const en: typeof es = {
  createFail: 'Could not create the list',
  seeAll: 'See all',
  none: (category: string): string => `You have no ${category} lists yet.`,
  more: (n: number): string => `and ${n} more…`,
  newList: (category: string): string => `New ${category} list`,
  newListPh: (category: string): string => `New ${category} list…`,
  create: 'Create',
};

const COPY: CopyDict<typeof es> = { es, en };

export function CategoryChecklists({ category, title, description, max = 2 }: { category: string; title?: string; description?: string; max?: number }) {
  const t = useText(COPY);
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
    catch { toast.error(t.createFail); }
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
        <Link to="/checklists" className="shrink-0 text-label-lg text-primary-text hover:underline">{t.seeAll}</Link>
      </div>
      {lists === null ? null : lists.length === 0 ? (
        <p className="text-body-sm text-on-surface-light">{t.none(category.toLowerCase())}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {lists.slice(0, max).map((list) => <ChecklistCard key={list.id} checklist={list} onRefresh={load} compact />)}
          {lists.length > max && <Link to="/checklists" className="text-body-sm text-primary-text hover:underline">{t.more(lists.length - max)}</Link>}
        </div>
      )}
      <form onSubmit={create} className="flex gap-2">
        <Input aria-label={t.newList(category)} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder={t.newListPh(category.toLowerCase())} />
        <Button type="submit" variant="secondary" loading={saving} disabled={!name.trim()} className="shrink-0"><Plus aria-hidden className="size-4" />{t.create}</Button>
      </form>
    </Card>
  );
}
