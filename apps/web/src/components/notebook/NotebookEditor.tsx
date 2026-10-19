// Libreta abierta: ocupa toda la pantalla, como un cuaderno sobre la mesa. Arriba,
// el título y el guardado; debajo, las herramientas (escribir con formato o dibujar
// con pluma, marcador y borrador; pegar notas adhesivas e imágenes); abajo, la barra
// de páginas. Cada página se guarda sola al dejar de escribir y al pasar de hoja.
// La hoja pasa con un giro corto y muelle (solo transform y opacidad: 60 fps); con
// «Reducir movimiento» o en Lite, un fundido. Ctrl+Z y Ctrl+Mayús+Z deshacen y
// rehacen los cambios de la libreta (texto, trazos, notas e imágenes).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent, type Variants } from 'framer-motion';
import {
  ArrowLeft, Bold, ChevronLeft, ChevronRight, Cloud, CloudOff, Eraser, FilePlus2, Heading, Highlighter, ImagePlus, Italic,
  List, ListOrdered, Loader2, PenLine, Redo2, Settings2, StickyNote, Strikethrough, Underline, Undo2, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressImageToBase64 } from '@/lib/imageCompress';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { Button, SegmentedControl, Spinner } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';
import { useMotionStore } from '@/store/motionStore';
import { usePlanStore } from '@/store/planStore';
import { LITE_LIMITS } from '@/lib/plan';
import {
  fetchPage, primeImage, savePage, uploadImage, type Notebook, type PageContent, type PageImage, type Sticky,
} from '@/services/notebook.service';
import { EMPTY_PAGE, INKS, PAGE_H, PAGE_W, SIZES, STICKY_COLORS, categoryLabel, sanitizeHtml, uid } from './paper';
import { PageSheet, type Mode, type Tool } from './PageSheet';
import { PageProgress } from './PageProgress';

type Status = 'saved' | 'saving' | 'error';
const SAVE_DELAY = 900;
const HIGHLIGHT = 'rgba(250, 204, 21, 0.45)';
const lastPageKey = (id: string) => `lq-nb-page:${id}`;

// ─── Paso de página ─────────────────────────────────────────────────────────────
/** Sentido del paso (1 adelante, −1 atrás) y si va sin movimiento (Reducir movimiento o Lite). */
type Turn = { dir: number; plain: boolean };
/** La hoja que sale se aleja hacia el lado contrario y se desvanece deprisa; la que entra llega con muelle desde el otro lado. */
const turn: Variants = {
  enter: ({ dir, plain }: Turn) => (plain ? { opacity: 0 } : { opacity: 0, x: dir * 56, rotateY: dir * -14, scale: 0.97 }),
  center: {
    opacity: 1, x: 0, rotateY: 0, scale: 1,
    transition: {
      x: { type: 'spring', stiffness: 260, damping: 26 },
      rotateY: { type: 'spring', stiffness: 260, damping: 26 },
      scale: { type: 'spring', stiffness: 260, damping: 26 },
      opacity: { duration: 0.3 },
    },
  },
  exit: ({ dir, plain }: Turn) => (plain
    ? { opacity: 0, transition: { duration: 0.16 } }
    : { opacity: 0, x: dir * -40, rotateY: dir * 12, scale: 0.97, transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }),
};

/** Una hoja del paso. AnimatePresence la conserva durante su salida (useIsPresent). */
function TurnPage({ turn: t, children }: { turn: Turn; children: (present: boolean) => ReactNode }) {
  const present = useIsPresent();
  return (
    <motion.div
      custom={t} variants={turn} initial="enter" animate="center" exit="exit"
      className={cn('absolute inset-0', !present && 'pointer-events-none')}
      style={{ transformOrigin: 'left center', transformPerspective: 1600, zIndex: present ? 2 : 1, willChange: 'transform, opacity' }}
    >
      {children(present)}
    </motion.div>
  );
}

// ─── Historial (Ctrl+Z) ─────────────────────────────────────────────────────────
/** Un cambio de una hoja: lo que había antes y lo que hay ahora. */
type Step = { index: number; before: PageContent; after: PageContent; kind: 'text' | 'note' | 'object'; at: number };
/** Lo que se escribe seguido (texto o notas) cuenta como un solo paso de deshacer. */
const GROUP_MS = 900;
const MAX_STEPS = 200;

/** Qué cambió: solo el texto de la hoja, solo el texto de una nota, o algo más (trazo, imagen, nota movida…). */
function kindOf(a: PageContent, b: PageContent): Step['kind'] {
  const sameStickyLayout = a.stickies.length === b.stickies.length && a.stickies.every((s, k) => {
    const t = b.stickies[k];
    return s.id === t.id && s.x === t.x && s.y === t.y && s.color === t.color && s.rot === t.rot;
  });
  if (a.strokes !== b.strokes || a.images !== b.images || !sameStickyLayout) return 'object';
  if (a.html !== b.html) return 'text';
  return a.stickies.some((s, k) => s.text !== b.stickies[k].text) ? 'note' : 'object';
}

/** Pone el cursor al final del texto (tras deshacer, para seguir escribiendo). */
function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// ─── Barra de herramientas ──────────────────────────────────────────────────────
function ToolButton({ icon: Icon, label, active, disabled, onClick, keepFocus, className }: {
  icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void; keepFocus?: boolean; className?: string;
}) {
  return (
    <button
      type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled}
      // Los botones de formato no se llevan el foco: la selección del texto sigue viva.
      onPointerDown={keepFocus ? (e) => e.preventDefault() : undefined}
      onClick={onClick}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl text-on-surface transition-colors hover:bg-surface-variant disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-primary/[var(--lq-soft-alpha)] text-primary-text',
        className,
      )}
    >
      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
    </button>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />;

function SaveState({ status, onRetry }: { status: Status; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <button type="button" onClick={onRetry} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-label-md text-error-text hover:bg-error/[var(--lq-soft-alpha)]">
        <CloudOff aria-hidden className="size-4" />Sin guardar · reintentar
      </button>
    );
  }
  return (
    <span role="status" className="flex items-center gap-1.5 px-2 text-label-md text-on-surface-light">
      {status === 'saving' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Cloud aria-hidden className="size-4" />}
      <span className="hidden sm:inline">{status === 'saving' ? 'Guardando…' : 'Guardado'}</span>
      <span className="sr-only sm:hidden">{status === 'saving' ? 'Guardando' : 'Guardado'}</span>
    </span>
  );
}

// ─── Editor ─────────────────────────────────────────────────────────────────────
export function NotebookEditor({ notebook, lite, onClose, onEdit, onAddPage }: {
  notebook: Notebook;
  /** Cuenta en NoutLife Lite: sin dibujo, imágenes ni notas de color; hasta 10 páginas. */
  lite: boolean;
  onClose: () => void;
  /** Abre los ajustes de la libreta (nombre, tapa, papel). */
  onEdit: () => void;
  /** Añade una página al final; devuelve false si no se pudo. */
  onAddPage: () => Promise<boolean>;
}) {
  const reduce = useMotionStore((s) => s.reduce);
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  /** Lite pasa las hojas con un fundido: el giro es de Pro. */
  const plain = reduce || lite;
  const keyboard = useKeyboardOpen();
  const toast = useToastStore.getState;
  const [index, setIndex] = useState(() => {
    let saved = 0;
    try { saved = Number(localStorage.getItem(lastPageKey(notebook.id))) || 0; } catch { /* sin storage */ }
    return Math.min(Math.max(0, saved), notebook.pageCount - 1);
  });
  const [dir, setDir] = useState(1);
  const [mode, setMode] = useState<Mode>('write');
  const [tool, setTool] = useState<Tool>({ t: 'pen', c: INKS[0], w: SIZES[1].w });
  const [status, setStatus] = useState<Status>('saved');
  const [, setVersion] = useState(0);
  const [failed, setFailed] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Historial de Ctrl+Z. La versión solo sirve para repintar los botones de deshacer y rehacer.
  const undoSteps = useRef<Step[]>([]);
  const redoSteps = useRef<Step[]>([]);
  const [, setHistoryVersion] = useState(0);
  const turnArg: Turn = { dir, plain };

  const pages = useRef(new Map<number, PageContent>());
  const loading = useRef(new Set<number>());
  const dirty = useRef(new Set<number>());
  const timers = useRef(new Map<number, number>());
  const stage = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const leaveArmed = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const bump = () => setVersion((v) => v + 1);
  /** El texto de la hoja que está a la vista (la que se va no cuenta). */
  const textEl = () => stage.current?.querySelector<HTMLDivElement>('[data-nb-current]') ?? null;

  // Fondo quieto mientras la libreta está abierta; el foco entra en ella (teclado y lectores de pantalla).
  useEffect(() => { lockScroll(); dialog.current?.focus(); return () => unlockScroll(); }, []);
  useEffect(() => { try { localStorage.setItem(lastPageKey(notebook.id), String(index)); } catch { /* sin storage */ } }, [notebook.id, index]);

  // ─── Carga ───
  const ensure = useCallback((i: number) => {
    if (i < 0 || i >= notebook.pageCount || pages.current.has(i) || loading.current.has(i)) return;
    loading.current.add(i);
    fetchPage(notebook.id, i)
      .then((page) => { pages.current.set(i, page ? { ...EMPTY_PAGE, ...page, html: sanitizeHtml(page.html) } : EMPTY_PAGE); setFailed((f) => (f === i ? null : f)); bump(); })
      .catch(() => setFailed(i))
      .finally(() => loading.current.delete(i));
  }, [notebook.id, notebook.pageCount]);
  useEffect(() => { ensure(index); ensure(index + 1); ensure(index - 1); }, [ensure, index]);

  // ─── Guardado ───
  const saveNow = useCallback(async (i: number): Promise<boolean> => {
    window.clearTimeout(timers.current.get(i));
    timers.current.delete(i);
    if (!dirty.current.has(i)) return true;
    const page = pages.current.get(i);
    if (!page) return true;
    dirty.current.delete(i);
    setStatus('saving');
    try {
      await savePage(notebook.id, i, { ...page, html: sanitizeHtml(page.html) });
      if (dirty.current.size === 0) setStatus('saved');
      return true;
    } catch {
      dirty.current.add(i);
      setStatus('error');
      return false;
    }
  }, [notebook.id]);
  const flushAll = useCallback(async () => (await Promise.all([...dirty.current].map((i) => saveNow(i)))).every(Boolean), [saveNow]);

  const schedule = useCallback((i: number) => {
    dirty.current.add(i);
    leaveArmed.current = false;
    setStatus('saving');
    window.clearTimeout(timers.current.get(i));
    timers.current.set(i, window.setTimeout(() => void saveNow(i), SAVE_DELAY));
  }, [saveNow]);

  // Se guarda también al ocultar la app, al recuperar la conexión y al cerrar la libreta.
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') void flushAll(); };
    const online = () => void flushAll();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', online);
    window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', online);
      window.removeEventListener('online', online);
      void flushAll();
    };
  }, [flushAll]);

  // ─── Cambios (con historial para Ctrl+Z) ───
  /** Guarda un cambio para deshacerlo; uno nuevo borra lo que se había deshecho. */
  const remember = (i: number, before: PageContent, after: PageContent, kind: Step['kind']) => {
    const counts = [undoSteps.current.length, redoSteps.current.length];
    const now = Date.now();
    const last = undoSteps.current[undoSteps.current.length - 1];
    if (last && last.index === i && last.kind === kind && kind !== 'object' && now - last.at < GROUP_MS) {
      last.after = after;
      last.at = now;
    } else {
      undoSteps.current.push({ index: i, before, after, kind, at: now });
      if (undoSteps.current.length > MAX_STEPS) undoSteps.current.shift();
    }
    redoSteps.current = [];
    if (counts[0] !== undoSteps.current.length || counts[1] !== 0) setHistoryVersion((v) => v + 1);
  };
  const update = useCallback((i: number, next: PageContent) => {
    const before = pages.current.get(i);
    if (before) remember(i, before, next, kindOf(before, next));
    pages.current.set(i, next); bump(); schedule(i);
  }, [schedule]);
  const updateHtml = useCallback((i: number, html: string) => {
    const page = pages.current.get(i);
    if (!page || page.html === html) return;
    const next = { ...page, html };
    remember(i, page, next, 'text');
    pages.current.set(i, next); // sin volver a pintar: el contentEditable ya lo muestra
    schedule(i);
  }, [schedule]);

  async function close() {
    if (await flushAll()) { onClose(); return; }
    if (leaveArmed.current) { onClose(); return; }
    leaveArmed.current = true;
    toast().error('No se pudo guardar', 'Revisa tu conexión. Pulsa volver otra vez para salir sin guardar.');
  }

  // ─── Páginas ───
  const go = useCallback((to: number) => {
    if (to === index || to < 0 || to >= notebook.pageCount) return;
    void saveNow(index);
    setDir(to > index ? 1 : -1);
    setIndex(to);
  }, [index, notebook.pageCount, saveNow]);

  async function addPage() {
    if (await onAddPage()) { setDir(1); void saveNow(index); setIndex(notebook.pageCount); }
  }

  /** Pone una versión de una hoja (al deshacer o rehacer). Si esa hoja no es la que se ve, la abre. */
  function restore(i: number, content: PageContent, kind: Step['kind']) {
    pages.current.set(i, content);
    schedule(i);
    if (i !== index) { setDir(i > index ? 1 : -1); setIndex(i); }
    else if (kind === 'text') {
      // El texto no es un estado de React: se repone en el DOM y el cursor queda al final.
      const el = textEl();
      if (el) {
        const focused = el.contains(document.activeElement);
        el.innerHTML = content.html;
        if (focused) placeCaretAtEnd(el);
      }
    }
    bump();
    setHistoryVersion((v) => v + 1);
  }
  function undo() {
    const step = undoSteps.current.pop();
    if (!step) return;
    redoSteps.current.push(step);
    restore(step.index, step.before, step.kind);
  }
  function redo() {
    const step = redoSteps.current.pop();
    if (!step) return;
    undoSteps.current.push(step);
    restore(step.index, step.after, step.kind);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Con un diálogo encima (ajustes de la libreta), las teclas son suyas.
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      // Ctrl+Z deshace y Ctrl+Mayús+Z (o Ctrl+Y) rehace, también escribiendo en el texto o en una nota.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.isComposing) {
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
      }
      const el = document.activeElement as HTMLElement | null;
      const typing = Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
      if (e.key === 'PageDown' || (!typing && e.key === 'ArrowRight')) { e.preventDefault(); go(index + 1); }
      else if (e.key === 'PageUp' || (!typing && e.key === 'ArrowLeft')) { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Escape' && !typing) void close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ─── Tamaño de la hoja: cabe entera en el hueco (con el teclado abierto no encoge) ───
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSize((prev) => {
      const pad = window.innerWidth < 640 ? 12 : 32;
      const w = Math.floor(Math.min(el.clientWidth - pad * 2 - 14, ((el.clientHeight - pad * 2) * PAGE_W) / PAGE_H));
      return keyboard && prev.w ? prev : { w: Math.max(200, w), h: Math.round(Math.max(200, w) * (PAGE_H / PAGE_W)) };
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [keyboard]);

  // ─── Insertar ───
  const current = pages.current.get(index);
  function addSticky() {
    if (!current) return;
    const colors = Object.keys(STICKY_COLORS) as Sticky['color'][];
    const n = current.stickies.length;
    const note: Sticky = { id: uid(), x: 330 + ((n * 70) % 280), y: 260 + ((n * 110) % 700), text: '', color: lite ? 'yellow' : colors[n % colors.length], rot: Math.round((Math.random() * 6 - 3) * 10) / 10 };
    setMode('write');
    update(index, { ...current, stickies: [...current.stickies, note] });
  }

  async function addImages(files: File[], at?: { x: number; y: number }) {
    if (lite) { openUpgrade('notebook-images'); return; }
    const i = index;
    if (!pages.current.get(i)) return;
    setUploading(true);
    try {
      for (const file of files.slice(0, 4)) {
        const data = await compressImageToBase64(file, { maxSide: 1400, maxBytes: 360 * 1024 });
        const url = `data:image/jpeg;base64,${data}`;
        const ratio = await new Promise<number>((resolve) => { const img = new Image(); img.onload = () => resolve(img.naturalHeight / Math.max(1, img.naturalWidth)); img.onerror = () => resolve(0.75); img.src = url; });
        const id = await uploadImage(notebook.id, { mime: 'image/jpeg', data });
        primeImage(id, url);
        const w = Math.min(520, ratio > 1.2 ? 380 : 520);
        const page = pages.current.get(i)!;
        const pos = at ?? { x: (PAGE_W - w) / 2, y: 300 };
        const img: PageImage = { id, w, ratio, x: Math.round(Math.min(PAGE_W - w, Math.max(0, pos.x - (at ? w / 2 : 0)))), y: Math.round(Math.min(PAGE_H - 80, Math.max(60, pos.y - (at ? (w * ratio) / 2 : 0)))) };
        update(i, { ...page, images: [...page.images, img] });
      }
    } catch (err) {
      toast().error('No se pudo pegar la imagen', err instanceof Error && /comprimir/.test(err.message) ? err.message : 'Inténtalo de nuevo.');
    } finally { setUploading(false); }
  }

  // ─── Formato del texto (sobre la selección de la hoja actual) ───
  function format(command: string, value?: string) {
    const el = textEl();
    if (el && document.activeElement !== el && !el.contains(document.activeElement)) el.focus();
    document.execCommand(command, false, value);
  }
  const toggleHeading = () => format('formatBlock', /h3/i.test(String(document.queryCommandValue('formatBlock'))) ? 'div' : 'h3');
  const toggleHighlight = () => {
    const on = /250,\s*204,\s*21/.test(String(document.queryCommandValue('hiliteColor') || document.queryCommandValue('backColor')));
    if (!document.execCommand('hiliteColor', false, on ? 'transparent' : HIGHLIGHT)) format('backColor', on ? 'transparent' : HIGHLIGHT);
  };

  const last = index === notebook.pageCount - 1;
  const pageCap = lite ? LITE_LIMITS.notebookPages : 200;
  const canGrow = notebook.pageCount < pageCap;
  const canUndo = undoSteps.current.length > 0;
  const canRedo = redoSteps.current.length > 0;

  return createPortal(
    <motion.div
      ref={dialog} tabIndex={-1}
      role="dialog" aria-modal="true" aria-label={`Libreta ${notebook.title}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="fixed inset-0 z-[60] flex flex-col bg-surface-variant text-on-background outline-none"
    >
      {/* Encabezado */}
      <header className="lq-bar-glass flex shrink-0 items-center gap-1 border-b border-border px-2 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-4">
        <Button variant="icon" aria-label="Volver a tus libretas" onClick={() => void close()}><ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} /></Button>
        <div className="min-w-0 flex-1 py-2">
          <h2 className="truncate text-label-lg">{notebook.title}</h2>
          <p className="truncate text-body-sm text-on-surface-light">{categoryLabel(notebook.category)} · página {index + 1} de {notebook.pageCount}</p>
        </div>
        <SaveState status={status} onRetry={() => void flushAll()} />
        <Button variant="icon" aria-label="Ajustes de la libreta" onClick={onEdit}><Settings2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </header>

      {/* Herramientas */}
      <div className="flex shrink-0 flex-col gap-1 border-b border-border bg-background/80 px-2 py-1.5 sm:px-4 md:flex-row md:items-center md:gap-3">
        <div className="flex items-center gap-2">
          <SegmentedControl
            label="Modo" value={mode} onChange={(m) => { if (m === 'draw' && lite) { openUpgrade('notebook-draw'); return; } setMode(m); if (m === 'draw') textEl()?.blur(); }} className="w-[11.5rem]"
            options={[{ value: 'write', label: 'Escribir' }, { value: 'draw', label: lite ? 'Dibujar · Pro' : 'Dibujar' }]}
          />
          <ToolButton icon={StickyNote} label="Pegar una nota adhesiva" onClick={addSticky} />
          <ToolButton icon={uploading ? Loader2 : ImagePlus} label="Pegar una imagen" onClick={() => (lite ? openUpgrade('notebook-images') : fileInput.current?.click())} className={cn(uploading && '[&_svg]:animate-spin')} />
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ''; if (files.length) void addImages(files); }} />
        </div>
        <div role="toolbar" aria-label={mode === 'write' ? 'Formato del texto' : 'Herramientas de dibujo'} className="-mx-2 flex items-center overflow-x-auto px-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {mode === 'write' ? (
            <>
              <ToolButton icon={Bold} label="Negrita" keepFocus onClick={() => format('bold')} />
              <ToolButton icon={Italic} label="Cursiva" keepFocus onClick={() => format('italic')} />
              <ToolButton icon={Underline} label="Subrayado" keepFocus onClick={() => format('underline')} />
              <ToolButton icon={Strikethrough} label="Tachado" keepFocus onClick={() => format('strikeThrough')} />
              <Divider />
              <ToolButton icon={Heading} label="Título" keepFocus onClick={toggleHeading} />
              <ToolButton icon={List} label="Lista" keepFocus onClick={() => format('insertUnorderedList')} />
              <ToolButton icon={ListOrdered} label="Lista numerada" keepFocus onClick={() => format('insertOrderedList')} />
              <ToolButton icon={Highlighter} label="Resaltar" keepFocus onClick={toggleHighlight} />
            </>
          ) : (
            <>
              <ToolButton icon={PenLine} label="Pluma" active={tool.t === 'pen'} onClick={() => setTool((t) => ({ ...t, t: 'pen' }))} />
              <ToolButton icon={Highlighter} label="Marcador" active={tool.t === 'marker'} onClick={() => setTool((t) => ({ ...t, t: 'marker' }))} />
              <ToolButton icon={Eraser} label="Borrador" active={tool.t === 'eraser'} onClick={() => setTool((t) => ({ ...t, t: 'eraser' }))} />
              <Divider />
              {INKS.map((c) => (
                <button
                  key={c} type="button" aria-label={`Tinta ${c}`} aria-pressed={tool.c === c}
                  onClick={() => setTool((t) => ({ ...t, c, t: t.t === 'eraser' ? 'pen' : t.t }))}
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface-variant"
                >
                  <span className={cn('block size-6 rounded-full border-2 transition-transform', tool.c === c && tool.t !== 'eraser' ? 'scale-110 border-on-background' : 'border-transparent')} style={{ background: c }} />
                </button>
              ))}
              <Divider />
              {SIZES.map((s) => (
                <button
                  key={s.w} type="button" aria-label={`Grosor ${s.label.toLowerCase()}`} aria-pressed={tool.w === s.w}
                  onClick={() => setTool((t) => ({ ...t, w: s.w }))}
                  className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-surface-variant', tool.w === s.w && 'bg-primary/[var(--lq-soft-alpha)]')}
                >
                  <span className="block rounded-full bg-on-background" style={{ width: 4 + s.w, height: 4 + s.w }} />
                </button>
              ))}
            </>
          )}
          <Divider />
          <ToolButton icon={Undo2} label="Deshacer (Ctrl+Z)" keepFocus disabled={!canUndo} onClick={undo} />
          <ToolButton icon={Redo2} label="Rehacer (Ctrl+Mayús+Z)" keepFocus disabled={!canRedo} onClick={redo} />
        </div>
      </div>

      {/* Mesa con la hoja */}
      <div ref={stage} className={cn('relative min-h-0 flex-1', keyboard ? 'overflow-y-auto' : 'overflow-hidden')}>
        {size.w > 0 && (
          <div className="flex min-h-full items-center justify-center p-3 sm:p-8">
            <div className="relative" style={{ width: size.w, height: size.h }}>
              <AnimatePresence initial={false} custom={turnArg}>
                <TurnPage key={index} turn={turnArg}>
                  {(present) => {
                    const page = pages.current.get(index);
                    if (!page) {
                      return (
                        <div className="lq-tex-paper flex size-full items-center justify-center rounded-r-[10px] shadow-lg">
                          {failed === index
                            ? <Button variant="secondary" onClick={() => { setFailed(null); ensure(index); }}>No se pudo abrir la página · reintentar</Button>
                            : <Spinner label="Abriendo la página" />}
                        </div>
                      );
                    }
                    return (
                      <PageSheet
                        notebookId={notebook.id} paper={notebook.paper} content={page} number={index + 1} width={size.w}
                        mode={mode} tool={tool} interactive={present} richStickies={!lite}
                        onHtml={(html) => updateHtml(index, html)}
                        onChange={(next) => update(index, next)}
                        onDropImages={(files, at) => void addImages(files, at)}
                        onNext={last ? (canGrow ? () => void addPage() : undefined) : () => go(index + 1)}
                      />
                    );
                  }}
                </TurnPage>
              </AnimatePresence>
              {/* Esquinas dobladas: tocar o arrastrar para pasar la hoja */}
              {mode === 'write' && (
                <>
                  {index > 0 && (
                    <motion.button
                      type="button" tabIndex={-1} aria-hidden onTap={() => go(index - 1)}
                      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.4} dragSnapToOrigin
                      onDragEnd={(_, info) => { if (info.offset.x > 40) go(index - 1); }}
                      className="absolute bottom-0 left-0 z-[5] size-10 touch-none rounded-bl-[3px] bg-[linear-gradient(45deg,rgb(var(--lq-surface-variant))_50%,rgb(var(--lq-border-strong)/.35)_50%,rgb(var(--lq-surface))_75%)] shadow-[2px_-2px_4px_rgb(0_0_0/.12)]"
                    />
                  )}
                  {!last && (
                    <motion.button
                      type="button" tabIndex={-1} aria-hidden onTap={() => go(index + 1)}
                      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.4} dragSnapToOrigin
                      onDragEnd={(_, info) => { if (info.offset.x < -40) go(index + 1); }}
                      className="absolute bottom-0 right-0 z-[5] size-10 touch-none rounded-br-[10px] bg-[linear-gradient(-45deg,rgb(var(--lq-surface-variant))_50%,rgb(var(--lq-border-strong)/.35)_50%,rgb(var(--lq-surface))_75%)] shadow-[-2px_-2px_4px_rgb(0_0_0/.12)]"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Barra de páginas: avanza con cada hoja */}
      <footer className="lq-bar-glass flex shrink-0 items-center gap-2 border-t border-border px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        <Button variant="icon" aria-label="Página anterior" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft aria-hidden className="size-6" strokeWidth={1.75} /></Button>
        <PageProgress value={index + 1} total={notebook.pageCount} onCommit={(n) => go(n - 1)} />
        {last && canGrow ? (
          <Button variant="secondary" size="sm" onClick={() => void addPage()}><FilePlus2 aria-hidden className="size-4" />Añadir página</Button>
        ) : last && lite ? (
          <Button variant="secondary" size="sm" onClick={() => openUpgrade('notebook-pages')}><FilePlus2 aria-hidden className="size-4" />Más páginas · Pro</Button>
        ) : (
          <Button variant="icon" aria-label="Página siguiente" disabled={last} onClick={() => go(index + 1)}><ChevronRight aria-hidden className="size-6" strokeWidth={1.75} /></Button>
        )}
      </footer>
    </motion.div>,
    document.body,
  );
}
