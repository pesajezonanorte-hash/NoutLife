// El libro abierto: en lugar de una pestaña nueva, el libro se abre en su lugar.
// La cubierta queda a la izquierda (datos y acciones) y las páginas a la derecha
// (notas y vocabulario). Se puede eliminar el libro con confirmación en la misma tarjeta.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Trash2 } from 'lucide-react';
import type { LearningItem } from '@noutlife/shared';
import { Button, Card, SegmentedControl } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';
import { useToastStore } from '../../hooks/useToast';
import * as learningService from '../../services/learning.service';
import { NotesPanel, VocabPanel } from './LearningExtras';

const es = {
  close: 'Cerrar libro',
  deleteBook: 'Eliminar libro',
  deleteAsk: '¿Eliminar este libro y todas sus notas?',
  yes: 'Sí, eliminar',
  no: 'No',
  deleted: 'Libro eliminado',
  deleteFail: 'No se pudo eliminar el libro',
  notes: 'Notas',
  vocab: 'Vocabulario',
  pages: 'Páginas',
  author: 'Autor',
  noGoal: 'Sin meta de progreso',
  progressOf: (c: number, t: number): string => `${c} de ${t}`,
  contents: 'Contenido del libro',
};

const en: typeof es = {
  close: 'Close book',
  deleteBook: 'Delete book',
  deleteAsk: 'Delete this book and all its notes?',
  yes: 'Yes, delete',
  no: 'No',
  deleted: 'Book deleted',
  deleteFail: 'Could not delete the book',
  notes: 'Notes',
  vocab: 'Vocabulary',
  pages: 'Pages',
  author: 'Author',
  noGoal: 'No progress goal',
  progressOf: (c: number, t: number): string => `${c} of ${t}`,
  contents: 'Book contents',
};

const COPY: Copy<typeof es> = { es, en };

export function OpenBook({ item, onClose, onDeleted }: { item: LearningItem; onClose: () => void; onDeleted: (id: string) => void }) {
  const t = useText(COPY);
  const [panel, setPanel] = useState<'notas' | 'vocab'>('notas');
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await learningService.deleteLearning(item.id);
      useToastStore.getState().success(t.deleted);
      onDeleted(item.id);
    } catch {
      useToastStore.getState().error(t.deleteFail);
    } finally { setDeleting(false); }
  }

  return (
    <motion.div
      // Se abre como un libro: la portada gira desde el lomo.
      initial={{ opacity: 0, rotateY: -60 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1400, transformOrigin: 'left center' }}
      className="grid gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]"
    >
      <Card className="flex flex-col gap-4 self-start">
        <div className="flex items-center gap-2 text-primary-text">
          <BookOpen aria-hidden className="size-5" />
          <span className="text-label-lg">{item.type}</span>
        </div>
        <h2 className="text-heading-md break-words">{item.title}</h2>
        {item.author && <p className="text-body-sm text-on-surface-light">{t.author}: {item.author}</p>}
        <p className="font-mono text-body-sm tabular-nums text-on-surface-light">
          {item.totalProgress > 0 ? t.progressOf(item.currentProgress, item.totalProgress) : t.noGoal}
        </p>

        <div className="mt-2 flex flex-col gap-2">
          <Button variant="secondary" onClick={onClose}><ArrowLeft aria-hidden className="size-4" />{t.close}</Button>
          {askDelete ? (
            <div className="flex flex-col gap-2 rounded-md border border-error-text/30 p-3">
              <span className="text-body-sm">{t.deleteAsk}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAskDelete(false)}>{t.no}</Button>
                <Button variant="secondary" size="sm" loading={deleting} onClick={() => void remove()}>{t.yes}</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setAskDelete(true)}><Trash2 aria-hidden className="size-4" />{t.deleteBook}</Button>
          )}
        </div>
      </Card>

      <Card className="flex min-w-0 flex-col gap-5">
        <SegmentedControl
          options={[{ value: 'notas', label: t.notes }, { value: 'vocab', label: t.vocab }]}
          value={panel}
          onChange={setPanel}
          label={t.contents}
          className="max-w-[320px]"
        />
        {panel === 'notas' ? <NotesPanel itemId={item.id} /> : <VocabPanel itemId={item.id} />}
      </Card>
    </motion.div>
  );
}
