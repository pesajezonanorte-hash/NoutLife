// Libreta: un escritorio de cuadernos en 3D que se mueven a mano (NotebookDesk).
// Cada libreta tiene su tapa (color del tema), su papel (rayado, cuadriculado,
// punteado o liso), una categoría y las páginas que elijas. Al abrirla, el cuaderno
// ocupa toda la pantalla (components/notebook/NotebookEditor) y la URL lleva ?n=<id>:
// el botón atrás la cierra.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Notebook as NotebookIcon, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/hooks/useToast';
import {
  Button, ChipGroup, EmptyState, ErrorState, Field, Input, Modal, PageLoader, ResponsiveDialog,
} from '@/components/ui/lq';
import { NotebookEditor, clearNotebookDrafts } from '@/components/notebook/NotebookEditor';
import { NotebookDesk } from '@/components/notebook/NotebookDesk';
import { LiteNotice } from '@/components/billing/LiteNotice';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { LITE_LIMITS } from '@/lib/plan';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import { categoriesFor, coversFor, papersFor } from '@/components/notebook/paper';
import * as svc from '@/services/notebook.service';
import type { Notebook, NotebookCategory, NotebookColor, NotebookInput, NotebookPaper } from '@/services/notebook.service';

const es = {
  title: 'Libreta',
  description: 'Cuadernos para escribir con formato, dibujar a mano y pegar notas y fotos. Cada página se guarda sola.',
  created: 'Libreta creada',
  createdBody: (n: number): string => `${n} páginas en blanco te esperan.`,
  saved: 'Libreta guardada',
  saveFail: 'No se pudo guardar la libreta',
  createFail: 'No se pudo crear la libreta',
  settingsTitle: 'Ajustes de la libreta',
  newTitle: 'Nueva libreta',
  name: 'Nombre',
  nameErr: 'Ponle un nombre a la libreta',
  namePh: 'Ej. Ideas para el negocio',
  category: 'Categoría',
  cover: 'Tapa',
  paper: 'Papel',
  pages: 'Páginas',
  pagesHelp: 'Puedes añadir páginas en cualquier momento; las escritas no se quitan.',
  delete: 'Eliminar',
  cancel: 'Cancelar',
  save: 'Guardar',
  create: 'Crear libreta',
  openAria: (title: string): string => `Abrir ${title}`,
  settingsAria: (title: string): string => `Ajustes de ${title}`,
  pagesUsed: (used: number, total: number): string => `${used}/${total} págs.`,
  notFound: 'No encontramos esa libreta',
  addPageFail: 'No se pudo añadir la página',
  deleted: 'Libreta eliminada',
  deleteFail: 'No se pudo eliminar la libreta',
  all: 'Todas',
  loading: 'Abriendo tu estantería…',
  errorTitle: 'No pudimos cargar tus libretas',
  errorDesc: 'Tus libretas siguen guardadas.',
  emptyTitle: 'Tu estantería está vacía',
  emptyDesc: 'Crea tu primera libreta: elige la tapa, el papel y cuántas páginas quieres. Escribe, dibuja y pega notas o fotos; se guarda sola.',
  newNotebook: 'Nueva libreta',
  liteNotice: (n: number, max: number, pages: number): string => `Tienes ${n} de ${max} libretas de NoutLife Lite, con hasta ${pages} páginas cada una.`,
  deleteTitle: (title: string): string => `¿Eliminar «${title}»?`,
  deleteBody: (n: number): string => `Se borran sus ${n} páginas escritas, los dibujos y las imágenes. No se puede deshacer.`,
  deleteBtn: 'Eliminar libreta',
};

const en: typeof es = {
  title: 'Notebook',
  description: 'Notebooks to write with formatting, draw by hand and paste notes and photos. Each page saves itself.',
  created: 'Notebook created',
  createdBody: (n: number): string => `${n} blank pages are waiting for you.`,
  saved: 'Notebook saved',
  saveFail: 'Could not save the notebook',
  createFail: 'Could not create the notebook',
  settingsTitle: 'Notebook settings',
  newTitle: 'New notebook',
  name: 'Name',
  nameErr: 'Give the notebook a name',
  namePh: 'E.g. Business ideas',
  category: 'Category',
  cover: 'Cover',
  paper: 'Paper',
  pages: 'Pages',
  pagesHelp: 'You can add pages at any time; written ones are never removed.',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  create: 'Create notebook',
  openAria: (title: string): string => `Open ${title}`,
  settingsAria: (title: string): string => `${title} settings`,
  pagesUsed: (used: number, total: number): string => `${used}/${total} pp.`,
  notFound: 'We could not find that notebook',
  addPageFail: 'Could not add a page',
  deleted: 'Notebook deleted',
  deleteFail: 'Could not delete the notebook',
  all: 'All',
  loading: 'Opening your shelf…',
  errorTitle: 'We could not load your notebooks',
  errorDesc: 'Your notebooks are still saved.',
  emptyTitle: 'Your shelf is empty',
  emptyDesc: 'Create your first notebook: pick the cover, the paper and how many pages you want. Write, draw and paste notes or photos; it saves itself.',
  newNotebook: 'New notebook',
  liteNotice: (n: number, max: number, pages: number): string => `You have ${n} of ${max} notebooks on NoutLife Lite, with up to ${pages} pages each.`,
  deleteTitle: (title: string): string => `Delete “${title}”?`,
  deleteBody: (n: number): string => `Its ${n} written pages, drawings and images will be erased. This cannot be undone.`,
  deleteBtn: 'Delete notebook',
};

const COPY: Copy<typeof es> = { es, en };

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
  const t = useText(COPY);
  const locale = useLocale();
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
  const covers = coversFor(locale);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setTried(true); return; }
    setSaving(true);
    try {
      const body = { ...form, title: form.title.trim() };
      const saved = book ? await svc.updateNotebook(book.id, body) : await svc.createNotebook(body);
      toast.success(book ? t.saved : t.created, book ? undefined : t.createdBody(saved.pageCount));
      onSaved(saved);
    } catch (err) { toast.error(errorText(err, book ? t.saveFail : t.createFail)); }
    finally { setSaving(false); }
  }

  const set = <K extends keyof NotebookInput>(k: K, v: NotebookInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ResponsiveDialog open={open} onClose={onClose} title={book ? t.settingsTitle : t.newTitle}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t.name} error={tried && !form.title.trim() ? t.nameErr : undefined}>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={60} placeholder={t.namePh} autoFocus={!book} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.category}</span>
          <ChipGroup label={t.category} value={form.category} onChange={(v) => set('category', v)} options={categoriesFor(locale)} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.cover}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(covers) as NotebookColor[]).map((c) => (
              <label key={c} className="relative cursor-pointer">
                <input type="radio" name="nb-color" value={c} checked={form.color === c} onChange={() => set('color', c)} className="peer sr-only" />
                <span className={cn('block size-11 rounded-l-sm rounded-r-lg ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-on-background peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-primary', covers[c].className)} />
                <span className="sr-only">{covers[c].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">{t.paper}</legend>
          <div className="grid grid-cols-4 gap-2">
            {papersFor(locale).map((p) => (
              <label key={p.value} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-border p-2 has-[:checked]:border-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-primary">
                <input type="radio" name="nb-paper" value={p.value} checked={form.paper === p.value} onChange={() => set('paper', p.value)} className="sr-only" />
                <PaperSwatch paper={p.value} />
                <span className="text-label-md">{p.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.pages}</span>
          <ChipGroup label={t.pages} value={String(form.pageCount)} onChange={(v) => set('pageCount', Number(v))} options={pageChoices.map((n) => ({ value: String(n), label: String(n) }))} />
          {book && <p className="text-body-sm text-on-surface-light">{t.pagesHelp}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {book ? <Button variant="ghost" size="md" className="text-error-text" onClick={() => onDelete(book)}><Trash2 aria-hidden className="size-4" />{t.delete}</Button> : <span />}
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" size="md" loading={saving}>{book ? t.save : t.create}</Button>
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

export default function NotebookPage() {
  const t = useText(COPY);
  const locale = useLocale();
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
  const userId = useAuthStore((s) => s.user?.id) ?? 'anon';
  const openUpgrade = usePlanStore((s) => s.openUpgrade);

  const load = useCallback(async () => {
    try { setBooks(await svc.listNotebooks()); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const book = books.find((b) => b.id === openId) ?? null;
  useEffect(() => {
    if (state === 'ready' && openId && !book) {
      toast.error(t.notFound);
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
    } catch (err) { toast.error(errorText(err, t.addPageFail)); return false; }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await svc.deleteNotebook(deleting.id);
      clearNotebookDrafts(deleting.id);
      setBooks((list) => list.filter((x) => x.id !== deleting.id));
      toast.success(t.deleted);
      if (openId === deleting.id) close();
      setDeleting(null);
      setDialog(null);
    } catch (err) { toast.error(errorText(err, t.deleteFail)); }
    finally { setBusy(false); }
  }

  const categories = categoriesFor(locale);
  const counts = Object.fromEntries(categories.map((c) => [c.value, books.filter((b) => b.category === c.value).length]));
  const shown = books.filter((b) => filter === 'all' || b.category === filter);
  // Lite: dos libretas como máximo; la siguiente invita a Pro.
  const newBook = () => (lite && books.length >= LITE_LIMITS.notebooks ? openUpgrade('notebooks') : setDialog({ book: null }));

  let content;
  if (state === 'loading') content = <PageLoader label={t.loading} />;
  else if (state === 'error') content = <ErrorState title={t.errorTitle} description={t.errorDesc} onRetry={() => void load()} />;
  else if (books.length === 0) {
    content = (
      <motion.div variants={item}>
        <EmptyState
          icon={NotebookIcon}
          title={t.emptyTitle}
          description={t.emptyDesc}
          action={<Button onClick={newBook}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.newNotebook}</Button>}
        />
      </motion.div>
    );
  } else {
    content = (
      <>
        <motion.div variants={item} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <ChipGroup
            label={t.category} value={filter} onChange={setFilter} className="flex-nowrap md:flex-wrap"
            options={[{ value: 'all', label: t.all, count: books.length }, ...categories.filter((c) => counts[c.value]).map((c) => ({ ...c, count: counts[c.value] }))]}
          />
        </motion.div>
        <motion.div variants={item}>
          <NotebookDesk books={shown} userId={userId} onOpen={open} onEdit={(b) => setDialog({ book: b })} />
        </motion.div>
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
        title={t.title}
        description={t.description}
        aside={state === 'ready' && books.length > 0 ? <Button onClick={newBook}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.newNotebook}</Button> : undefined}
      />
      {lite && state === 'ready' && books.length > 0 && (
        <LiteNotice feature="notebooks">
          {t.liteNotice(books.length, LITE_LIMITS.notebooks, LITE_LIMITS.notebookPages)}
        </LiteNotice>
      )}
      {content}

      <NotebookDialog
        open={dialog !== null} book={dialog?.book ?? null} lite={lite} onClose={() => setDialog(null)} onSaved={saved}
        onDelete={(b) => setDeleting(b)}
      />
      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t.deleteTitle(deleting?.title ?? '')}>
        <div className="flex flex-col gap-5">
          <p className="text-body-md text-on-surface">{t.deleteBody(deleting?.usedPages ?? 0)}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setDeleting(null)}>{t.cancel}</Button>
            <Button variant="danger" size="md" loading={busy} onClick={() => void remove()}><Trash2 aria-hidden className="size-4" />{t.deleteBtn}</Button>
          </div>
        </div>
      </Modal>

      {/* Sin AnimatePresence: al salir, el propio editor se desvanece y luego la página lo quita. */}
      {book && <NotebookEditor key={book.id} notebook={book} lite={lite} onClose={close} onEdit={() => setDialog({ book })} onAddPage={addPage} />}
    </ZoneShell>
  );
}
