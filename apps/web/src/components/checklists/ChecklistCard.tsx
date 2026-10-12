// Lista reutilizable (compras, tareas del hogar, finanzas…): marcar, añadir, editar y
// borrar elementos con cambios optimistas; la respuesta del servidor manda al final.
// Respeta el rol: quien solo puede ver no edita nada.
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Eraser, LogOut, Plus, Share2, Trash2, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import { Badge, Button, Card, Input, ProgressBar } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import * as svc from '@/services/checklist.service';
import type { Checklist, ChecklistItem } from '@/services/checklist.service';

export interface ChecklistCardProps {
  list: Checklist;
  onChange: (next: Checklist) => void;
  onShare?: () => void;
  /** Dueña: eliminar la lista. Invitada: salir de ella. */
  onRemove?: () => void;
  highlight?: boolean;
}

let tempId = 0;

export function ChecklistCard({ list, onChange, onShare, onRemove, highlight }: ChecklistCardProps) {
  const canEdit = list.role !== 'VIEW';
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const latest = useRef(list);
  latest.current = list;
  /** Solo la última petición actualiza la lista: respuestas viejas no deshacen toques nuevos. */
  const seq = useRef(0);

  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;

  async function mutate(next: Checklist, call: () => Promise<Checklist>, error: string) {
    const prev = latest.current;
    const mine = ++seq.current;
    onChange(next);
    try {
      const server = await call();
      if (mine === seq.current) onChange(server);
    } catch (err) {
      if (mine === seq.current) onChange(prev);
      useToastStore.getState().error(svc.checklistError(err, error));
    }
  }

  const withItems = (items: ChecklistItem[]) => ({ ...latest.current, items });

  function toggle(item: ChecklistItem) {
    if (!canEdit) return;
    void mutate(
      withItems(latest.current.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))),
      () => svc.updateItem(list.id, item.id, { done: !item.done }),
      'No se pudo marcar',
    );
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const position = (latest.current.items.at(-1)?.position ?? -1) + 1;
    void mutate(
      withItems([...latest.current.items, { id: `tmp-${++tempId}`, text, done: false, position }]),
      () => svc.addItem(list.id, text),
      'No se pudo añadir',
    );
  }

  function remove(item: ChecklistItem) {
    void mutate(
      withItems(latest.current.items.filter((i) => i.id !== item.id)),
      () => svc.deleteItem(list.id, item.id),
      'No se pudo borrar',
    );
  }

  function saveEdit(item: ChecklistItem) {
    const text = editText.trim();
    setEditing(null);
    if (!text || text === item.text) return;
    void mutate(
      withItems(latest.current.items.map((i) => (i.id === item.id ? { ...i, text } : i))),
      () => svc.updateItem(list.id, item.id, { text }),
      'No se pudo guardar',
    );
  }

  function clearDone() {
    void mutate(withItems(latest.current.items.filter((i) => !i.done)), () => svc.clearDone(list.id), 'No se pudo limpiar');
  }

  const onEditKey = (e: KeyboardEvent<HTMLInputElement>, item: ChecklistItem) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(item); }
    if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
  };

  const shared = list.role !== 'OWNER';

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby={`list-${list.id}`}
      id={`checklist-${list.id}`}
      className={cn('flex flex-col gap-4 p-4 md:p-5 transition-shadow', highlight && 'ring-2 ring-primary')}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={`list-${list.id}`} className="truncate text-heading-sm">{list.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-light">
            <Badge variant="neutral">{list.category}</Badge>
            {shared ? (
              <span>De {list.owner.displayName} · {list.role === 'EDIT' ? 'puedes editar' : 'solo lectura'}</span>
            ) : list.memberCount > 0 ? (
              <span className="flex items-center gap-1"><Users aria-hidden className="size-4" strokeWidth={1.75} />Compartida con {list.memberCount}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          {onShare && (
            <Button variant="icon" aria-label={`Compartir ${list.name}`} onClick={onShare}>
              <Share2 aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          )}
          {onRemove && (
            <Button variant="icon" aria-label={shared ? `Salir de ${list.name}` : `Eliminar ${list.name}`} onClick={onRemove} className="hover:text-error-text">
              {shared ? <LogOut aria-hidden className="size-5" strokeWidth={1.75} /> : <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />}
            </Button>
          )}
        </div>
      </header>

      {total > 0 && (
        <div className="flex items-center gap-3">
          <ProgressBar value={(done / total) * 100} tone="success" className="flex-1" label={`Progreso de ${list.name}`} valueText={`${done} de ${total}`} />
          <span className="text-label-md text-on-surface-light font-mono tabular-nums">{done}/{total}</span>
        </div>
      )}

      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {list.items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
              transition={springSoft}
              className="group flex min-h-11 items-center gap-3 border-b border-border/60 last:border-b-0"
            >
              <button
                type="button"
                aria-pressed={item.done}
                aria-label={`${item.done ? 'Desmarcar' : 'Marcar'} ${item.text}`}
                disabled={!canEdit}
                onClick={() => toggle(item)}
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors disabled:cursor-default',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  item.done ? 'border-success bg-success text-on-primary' : 'border-border-strong hover:border-primary',
                )}
              >
                {item.done && <Check aria-hidden className="size-4" strokeWidth={3} />}
              </button>
              {editing === item.id ? (
                <Input
                  autoFocus
                  aria-label="Editar elemento"
                  value={editText}
                  maxLength={200}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => saveEdit(item)}
                  onKeyDown={(e) => onEditKey(e, item)}
                  className="min-h-10 flex-1 py-1"
                />
              ) : (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => { setEditing(item.id); setEditText(item.text); }}
                  className={cn(
                    'min-w-0 flex-1 py-2 text-left text-body-md break-words disabled:cursor-default',
                    item.done ? 'text-on-surface-light line-through' : 'text-on-background',
                  )}
                >
                  {item.text}
                </button>
              )}
              {canEdit && editing !== item.id && (
                <Button variant="icon" aria-label={`Borrar ${item.text}`} onClick={() => remove(item)} className="-mr-2 opacity-60 hover:text-error-text group-hover:opacity-100">
                  <X aria-hidden className="size-4" strokeWidth={2} />
                </Button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {total === 0 && <p className="text-body-sm text-on-surface-light">{canEdit ? 'Aún está vacía. Añade el primer elemento.' : 'Esta lista aún está vacía.'}</p>}

      {canEdit && (
        <form onSubmit={add} className="flex items-center gap-2">
          <Input aria-label={`Añadir a ${list.name}`} value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)} placeholder="Añadir…" className="flex-1" />
          <Button type="submit" variant="secondary" aria-label="Añadir elemento" disabled={!draft.trim()}>
            <Plus aria-hidden className="size-5" strokeWidth={2} />
          </Button>
        </form>
      )}

      {canEdit && done > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={clearDone}>
          <Eraser aria-hidden className="size-4" strokeWidth={1.75} />Quitar los hechos
        </Button>
      )}
    </Card>
  );
}
