// Libreta: una estantería de cuadernos. Cada libreta tiene su tapa (color del
// tema), su papel (rayado, cuadriculado, punteado o liso), una categoría y las
// páginas que elijas. Al abrirla, el cuaderno ocupa toda la pantalla
// (components/notebook/NotebookEditor) y la URL lleva ?n=<id>: el botón atrás la cierra.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MoreHorizontal, Notebook as NotebookIcon, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/useToast';
import {
  Button, ChipGroup, EmptyState, ErrorState, Field, Input, Modal, PageLoader, ResponsiveDialog,
} from '@/components/ui/lq';
import { NotebookEditor, clearNotebookDrafts } from '@/components/notebook/NotebookEditor';
import { LiteNotice } from '@/components/billing/LiteNotice';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { LITE_LIMITS } from '@/lib/plan';
import { CATEGORIES, COVERS, PAPERS, categoryLabel } from '@/components/notebook/paper';
import * as svc from '@/services/notebook.service';
import type { Notebook, NotebookCategory, NotebookColor, NotebookInput, NotebookPaper } from '@/services/notebook.service';

const PAGE_CHOICES = [10, 20, 40, 80, 120, 200];
type Filter = 'all' | NotebookCategory;

function errorText(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
}

/** Muestra del papel para el formulario. */
function PaperSwatch({ paper }: { paper: NotebookPaper }) {
  const ink = 'rgb(var(--lq-info) / .35)';
  const bg = paper === 'ruled' ? { backgroundImage: `linear-gradient(to bottom, transparent 7px, ${ink} 7px, ${ink} 8px)`, backgroundSize: '100% 8px' }
    : paper === 'grid' ? { backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: '8px 8px' }
    : paper === 'dots' ? { backgroundImage: 'radial-gradient(rgb(var(--lq-on-background) / .4) 1px, transparent 1.4px)', backgroundSize: '8px 8px' }
    : {};
  return <span aria-hidden className="lq-tex-paper block h-12 w-9 rounded-sm border border-border" style={bg} />;
}

/** Crear o ajustar una libreta (mismo formulario). En una libreta usada, las páginas solo aumentan. */
function NotebookDialog({ open, book, lite, onClose, onSaved, onDelete }: {
  open: boolean; book: Notebook | null; lite: boolean; onClose: () => void; onSaved: (b: Notebook) => void; onDelete: (b: Notebook) => void;
}) {
  const toast = useToast();
  const defaultPages = lite ? LITE_LIMITS.notebookPages : 20;
  const [form, setForm] = useState<NotebookInput>({ title: '', category: 'personal', color: 'jade', paper: 'ruled', pageCount: defaultPages });
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const key = open ? book?.id ?? 'new' : null;
  if (key !== seen) {
    setSeen(key);
    if (key) { setTried(false); setForm(book ? { title: book.title, category: book.category, color: book.color, paper: book.paper, pageCount: book.pageCount } : { title: '', category: 'personal', color: 'jade', paper: 'ruled', pageCount: defaultPages }); }
  }
  const choices = lite ? PAGE_CHOICES.filter((n) => n <= LITE_LIMITS.notebookPages) : PAGE_CHOICES;
  const pageChoices = choices.filter((n) => !book || n >= book.pageCount);
  if (book && !pageChoices.includes(book.pageCount)) pageChoices.unshift(book.pageCount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setTried(true); return; }
    setSaving(true);
    try {
      const body = { ...form, title: form.title.trim() };
      const saved = book ? await svc.updateNotebook(book.id, body) : await svc.createNotebook(body);
      toast.success(book ? 'Libreta guardada' : 'Libreta creada', book ? undefined : `${saved.pageCount} páginas en blanco te esperan.`);
      onSaved(saved);
    } catch (err) { toast.error(errorText(err, book ? 'No se pudo guardar la libreta' : 'No se pudo crear la libreta')); }
    finally { setSaving(false); }
  }

  const set = <K extends keyof NotebookInput>(k: K, v: NotebookInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ResponsiveDialog open={open} onClose={onClose} title={book ? 'Ajustes de la libreta' : 'Nueva libreta'}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Nombre" error={tried && !form.title.trim() ? 'Ponle un nombre a la libreta' : undefined}>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={60} placeholder="Ej. Ideas para el negocio" autoFocus={!book} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">Categoría</span>
          <ChipGroup label="Categoría" value={form.category} onChange={(v) => set('category', v)} options={CATEGORIES} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Tapa</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COVERS) as NotebookColor[]).map((c) => (
              <label key={c} className="relative cursor-pointer">
                <input type="radio" name="nb-color" value={c} checked={form.color === c} onChange={() => set('color', c)} className="peer sr-only" />
                <span className={cn('block size-11 rounded-l-sm rounded-r-lg ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-on-background peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary', COVERS[c].className)} />
                <span className="sr-only">{COVERS[c].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Papel</legend>
          <div className="grid grid-cols-4 gap-2">
            {PAPERS.map((p) => (
              <label key={p.value} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-border p-2 has-[:checked]:border-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-primary">
                <input type="radio" name="nb-paper" value={p.value} checked={form.paper === p.value} onChange={() => set('paper', p.value)} className="sr-only" />
                <PaperSwatch paper={p.value} />
                <span className="text-label-md">{p.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">Páginas</span>
          <ChipGroup label="Páginas" value={String(form.pageCount)} onChange={(v) => set('pageCount', Number(v))} options={pageChoices.map((n) => ({ value: String(n), label: String(n) }))} />
          {book && <p className="text-body-sm text-on-surface-light">Puedes añadir páginas en cualquier momento; las escritas no se quitan.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {book ? <Button variant="ghost" size="md" className="text-error-text" onClick={() => onDelete(book)}><Trash2 aria-hidden className="size-4" />Eliminar</Button> : <span />}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="md" loading={saving}>{book ? 'Guardar' : 'Crear libreta'}</Button>
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

/** Tapa en la estantería: lomo, goma elástica y etiqueta con el nombre. */
function Cover({ book, onOpen, onEdit }: { book: Notebook; onOpen: () => void; onEdit: () => void }) {
  return (
    <motion.li variants={item} className="relative">
      <button type="button" onClick={onOpen} className="group block w-full text-left outline-none" aria-label={`Abrir ${book.title}`}>
        <div
          className={cn(
            'relative aspect-[3/4] overflow-hidden rounded-l-md rounded-r-2xl text-background shadow-[0_14px_24px_-14px_rgb(0_0_0/.6),0_2px_4px_rgb(0_0_0/.12)]',
            'transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:-translate-y-1 group-hover:-rotate-1 group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:outline-offset-2 group-focus-visible:outline-primary',
            COVERS[book.color].className,
          )}
        >
          {/* Lomo y goma elástica */}
          <span aria-hidden className="absolute inset-y-0 left-0 w-[9%] bg-black/25 shadow-[inset_-2px_0_3px_rgb(0_0_0/.2)]" />
          <span aria-hidden className="absolute inset-y-0 right-[11%] w-[4.5%] bg-black/30 shadow-[1px_0_2px_rgb(0_0_0/.25)]" />
          {/* Grano de la tapa */}
          <span aria-hidden className="lq-tex-linen absolute inset-0 opacity-60" />
          <span className="absolute left-[17%] right-[21%] top-[16%] flex flex-col gap-1 rounded-md bg-background/95 px-3 py-2.5 text-on-background shadow-sm">
            <span className="line-clamp-3 break-words text-label-lg leading-snug">{book.title}</span>
            <span className="text-label-md text-on-surface-light">{categoryLabel(book.category)}</span>
          </span>
          <span className="absolute bottom-3 left-[17%] font-mono text-label-md tabular-nums opacity-90">{book.usedPages}/{book.pageCount} págs.</span>
        </div>
      </button>
      <Button variant="icon" aria-label={`Ajustes de ${book.title}`} onClick={onEdit} className="absolute right-0 top-0 text-background hover:bg-black/20">
        <MoreHorizontal aria-hidden className="size-5" />
      </Button>
    </motion.li>
  );
}

export default function NotebookPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get('n');
  const [books, setBooks] = useState<Notebook[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [dialog, setDialog] = useState<{ book: Notebook | null } | null>(null);
  const [deleting, setDeleting] = useState<Notebook | null>(null);
  const [busy, setBusy] = useState(false);
  /** Se abrió desde la estantería (atrás la cierra) o con un enlace directo (cerrar reemplaza). */
  const openedHere = useRef(false);
  const lite = useAuthStore((s) => s.user?.subscription?.plan === 'lite');
  const openUpgrade = usePlanStore((s) => s.openUpgrade);

  const load = useCallback(async () => {
    try { setBooks(await svc.listNotebooks()); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const book = books.find((b) => b.id === openId) ?? null;
  useEffect(() => {
    if (state === 'ready' && openId && !book) {
      toast.error('No encontramos esa libreta');
      setParams((p) => { p.delete('n'); return p; }, { replace: true });
    }
  }, [state, openId, book]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (id: string) => { openedHere.current = true; setParams((p) => { p.set('n', id); return p; }); };
  const close = () => {
    void load(); // páginas usadas y orden de la estantería
    if (openedHere.current) { openedHere.current = false; navigate(-1); }
    else setParams((p) => { p.delete('n'); return p; }, { replace: true });
  };

  function saved(b: Notebook) {
    setBooks((list) => (list.some((x) => x.id === b.id) ? list.map((x) => (x.id === b.id ? b : x)) : [b, ...list]));
    const created = !dialog?.book;
    setDialog(null);
    if (created) open(b.id);
  }

  async function addPage(): Promise<boolean> {
    if (!book) return false;
    try {
      const next = await svc.updateNotebook(book.id, { pageCount: book.pageCount + 1 });
      setBooks((list) => list.map((x) => (x.id === next.id ? next : x)));
      return true;
    } catch (err) { toast.error(errorText(err, 'No se pudo añadir la página')); return false; }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await svc.deleteNotebook(deleting.id);
      clearNotebookDrafts(deleting.id);
      setBooks((list) => list.filter((x) => x.id !== deleting.id));
      toast.success('Libreta eliminada');
      if (openId === deleting.id) close();
      setDeleting(null);
      setDialog(null);
    } catch (err) { toast.error(errorText(err, 'No se pudo eliminar la libreta')); }
    finally { setBusy(false); }
  }

  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.value, books.filter((b) => b.category === c.value).length]));
  const shown = books.filter((b) => filter === 'all' || b.category === filter);
  // Lite: dos libretas como máximo; la siguiente invita a Pro.
  const newBook = () => (lite && books.length >= LITE_LIMITS.notebooks ? openUpgrade('notebooks') : setDialog({ book: null }));

  let content;
  if (state === 'loading') content = <PageLoader label="Abriendo tu estantería…" />;
  else if (state === 'error') content = <ErrorState title="No pudimos cargar tus libretas" description="Tus libretas siguen guardadas." onRetry={() => void load()} />;
  else if (books.length === 0) {
    content = (
      <motion.div variants={item}>
        <EmptyState
          icon={NotebookIcon}
          title="Tu estantería está vacía"
          description="Crea tu primera libreta: elige la tapa, el papel y cuántas páginas quieres. Escribe, dibuja y pega notas o fotos; se guarda sola."
          action={<Button onClick={newBook}><Plus aria-hidden className="size-4" strokeWidth={2} />Nueva libreta</Button>}
        />
      </motion.div>
    );
  } else {
    content = (
      <>
        <motion.div variants={item} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <ChipGroup
            label="Categoría" value={filter} onChange={setFilter} className="flex-nowrap md:flex-wrap"
            options={[{ value: 'all', label: 'Todas', count: books.length }, ...CATEGORIES.filter((c) => counts[c.value]).map((c) => ({ ...c, count: counts[c.value] }))]}
          />
        </motion.div>
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          <motion.li variants={item}>
            <button
              type="button" onClick={newBook}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-l-md rounded-r-2xl border-2 border-dashed border-border-strong/60 text-on-surface transition-colors hover:border-primary hover:text-primary-text"
            >
              <Plus aria-hidden className="size-7" strokeWidth={1.75} />
              <span className="text-label-lg">Nueva libreta</span>
            </button>
          </motion.li>
          {shown.map((b) => <Cover key={b.id} book={b} onOpen={() => open(b.id)} onEdit={() => setDialog({ book: b })} />)}
        </motion.ul>
      </>
    );
  }

  return (
    <ZoneShell
      zone="notebook"
      contentClassName="gap-6 md:gap-10"
      ambience={<span className="lq-amb-breathe absolute -right-[10%] -top-[10%] block h-[60vh] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.07),transparent)] [--d:16s] [--hi:1] [--lo:.6] dark:bg-[radial-gradient(closest-side,rgb(var(--lq-jade-200)/.05),transparent)]" />}
    >
      <PageHeader
        title="Libreta"
        description="Cuadernos para escribir con formato, dibujar a mano y pegar notas y fotos. Cada página se guarda sola."
      />
      {lite && state === 'ready' && books.length > 0 && (
        <LiteNotice feature="notebooks">
          Tienes {books.length} de {LITE_LIMITS.notebooks} libretas de NoutLife Lite, con hasta {LITE_LIMITS.notebookPages} páginas cada una.
        </LiteNotice>
      )}
      {content}

      <NotebookDialog
        open={dialog !== null} book={dialog?.book ?? null} lite={lite} onClose={() => setDialog(null)} onSaved={saved}
        onDelete={(b) => setDeleting(b)}
      />
      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={`¿Eliminar «${deleting?.title ?? ''}»?`}>
        <div className="flex flex-col gap-5">
          <p className="text-body-md text-on-surface">Se borran sus {deleting?.usedPages ?? 0} páginas escritas, los dibujos y las imágenes. No se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" size="md" loading={busy} onClick={() => void remove()}><Trash2 aria-hidden className="size-4" />Eliminar libreta</Button>
          </div>
        </div>
      </Modal>

      {/* Sin AnimatePresence: al salir, el propio editor se desvanece y luego la página lo quita. */}
      {book && <NotebookEditor key={book.id} notebook={book} lite={lite} onClose={close} onEdit={() => setDialog({ book })} onAddPage={addPage} />}
    </ZoneShell>
  );
}
