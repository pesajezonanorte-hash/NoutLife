// Marco de un archivo de la oficina a pantalla completa: nombre editable, estado del guardado y el copiloto.
// Se guarda solo 900 ms después del último cambio. Sin conexión, lo pendiente queda como borrador en este
// dispositivo y se sube al volver a abrirlo. Cerrar nunca espera a la red (como la Libreta: sin
// AnimatePresence, se desvanece y la página lo quita).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, CloudOff, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ErrorState, Input, PageLoader } from '@/components/ui/lq';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { useToastStore } from '@/hooks/useToast';
import { useText } from '@/lib/i18n';
import { sanitizeHtml } from '@/components/notebook/paper';
import * as office from '@/services/office.service';
import type { DocContent, OfficeContent, OfficeFile, OfficeMeta, SheetContent, SlidesContent } from '@/services/office.service';
import { OFFICE_COPY } from './copy';
import { DocEditor } from './DocEditor';
import { SheetEditor } from './SheetEditor';
import { SlidesEditor } from './SlidesEditor';

const SAVE_MS = 900;
const FADE_MS = 160;
const draftKey = (id: string) => `lq-office-draft:${id}`;
type Draft = { title: string; content: OfficeContent; at: number };

function readDraft(id: string): Draft | null {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null') as Draft | null; } catch { return null; }
}
function writeDraft(id: string, draft: Draft) {
  try { localStorage.setItem(draftKey(id), JSON.stringify(draft)); } catch { /* sin espacio o modo privado */ }
}
function clearDraft(id: string) {
  try { localStorage.removeItem(draftKey(id)); } catch { /* */ }
}
export const clearOfficeDraft = clearDraft;

/** El documento se guarda saneado con la lista blanca de la Libreta. */
const prepare = (file: OfficeFile, content: OfficeContent): OfficeContent =>
  file.kind === 'doc' ? { html: sanitizeHtml((content as DocContent).html) } : content;

export function OfficeEditor({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (meta: OfficeMeta) => void }) {
  const t = useText(OFFICE_COPY);
  const [file, setFile] = useState<OfficeFile | null>(null);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'saved' | 'saving' | 'device'>('saved');
  const [copilot, setCopilot] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const latest = useRef<{ title: string; content: OfficeContent } | null>(null);
  const dirty = useRef(false);
  const timer = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const savedRef = useRef(onSaved);
  savedRef.current = onSaved;

  useEffect(() => { lockScroll(); root.current?.focus(); return unlockScroll; }, []);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const fresh = await office.getFile(id);
      // Un borrador más nuevo que lo guardado (se editó sin conexión) gana y se sube enseguida.
      const draft = readDraft(id);
      const useDraft = draft && draft.at > Date.parse(fresh.updatedAt);
      const opened = useDraft ? { ...fresh, title: draft.title, content: draft.content } : fresh;
      if (!useDraft) clearDraft(id);
      latest.current = { title: opened.title, content: opened.content };
      dirty.current = Boolean(useDraft);
      setFile(opened);
      setTitle(opened.title);
      setState('ready');
      if (useDraft) timer.current = window.setTimeout(() => void flush(), 50);
    } catch {
      setState('error');
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);

  /** Sube lo pendiente. true: quedó en el servidor; false: quedó como borrador en el dispositivo. */
  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (!dirty.current || !latest.current || !file) return true;
    const snapshot = latest.current;
    dirty.current = false;
    setStatus('saving');
    try {
      const meta = await office.saveFile(id, { title: snapshot.title.trim() || t.untitled[file.kind], content: prepare(file, snapshot.content) });
      if (!dirty.current) { clearDraft(id); setStatus('saved'); }
      savedRef.current(meta);
      return true;
    } catch {
      dirty.current = true;
      writeDraft(id, { ...snapshot, at: Date.now() });
      setStatus('device');
      return false;
    }
  }, [file, id, t]);

  const schedule = useCallback((next: Partial<{ title: string; content: OfficeContent }>) => {
    if (!latest.current) return;
    latest.current = { ...latest.current, ...next };
    dirty.current = true;
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_MS);
  }, [flush]);

  const onContent = useCallback((content: OfficeContent) => schedule({ content }), [schedule]);

  function close() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onClose, FADE_MS);
    void flush().then((ok) => { if (!ok) useToastStore.getState().info(t.savedDevice, t.savedDeviceBody); });
  }

  // Escape cierra el copiloto (nunca el archivo: se perdería el foco a media escritura).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && copilot) { e.stopPropagation(); setCopilot(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [copilot]);
  // Si la pestaña se oculta o se cierra, lo pendiente se guarda (o queda en el dispositivo).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || !dirty.current || !latest.current) return;
      writeDraft(id, { ...latest.current, at: Date.now() });
      void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.clearTimeout(timer.current); };
  }, [flush, id]);

  const statusView = status === 'saving'
    ? <span className="text-body-sm text-on-surface-light">{t.saving}</span>
    : status === 'device'
      ? <span className="flex items-center gap-1 text-body-sm text-warning-text"><CloudOff aria-hidden className="size-4" strokeWidth={1.75} />{t.saveFail}</span>
      : <span className="flex items-center gap-1 text-body-sm text-on-surface-light"><Check aria-hidden className="size-4" strokeWidth={2} />{t.saved}</span>;

  const editorProps = file && { title: title || t.untitled[file.kind], copilotOpen: copilot, onCloseCopilot: () => setCopilot(false) };

  return createPortal(
    <motion.div
      ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title || (file ? t.untitled[file.kind] : t.title)}
      initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ duration: FADE_MS / 1000 }}
      className={cn('fixed inset-0 z-[60] flex flex-col bg-surface-variant text-on-background outline-none', leaving && 'pointer-events-none')}
    >
      <header className="lq-bar-glass flex shrink-0 items-center gap-2 border-b border-border px-2 pt-[env(safe-area-inset-top)] sm:px-4">
        <Button variant="icon" aria-label={t.back} onClick={close}><ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} /></Button>
        <div className="flex min-w-0 flex-1 flex-col py-1.5 sm:flex-row sm:items-center sm:gap-3">
          {file && (
            <>
              <Input
                aria-label={t.fileTitle} value={title} maxLength={80} placeholder={t.untitled[file.kind]}
                onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="min-h-10 max-w-md border-transparent bg-transparent px-2 py-1 text-heading-sm hover:border-border-strong focus:bg-surface"
              />
              <span className="px-2 sm:px-0" aria-live="polite">{statusView}</span>
            </>
          )}
        </div>
        {file && (
          <Button variant={copilot ? 'primary' : 'secondary'} size="md" aria-pressed={copilot} aria-label={copilot ? t.closeCopilot : t.openCopilot} onClick={() => setCopilot((v) => !v)}>
            <Sparkles aria-hidden className="size-4" strokeWidth={1.75} /><span className="hidden sm:inline">{t.copilot}</span>
          </Button>
        )}
      </header>

      {state === 'loading' ? (
        <div className="flex flex-1 items-center justify-center"><PageLoader label={t.loading} /></div>
      ) : state === 'error' || !file || !editorProps ? (
        <div className="flex flex-1 items-center justify-center p-6"><ErrorState title={t.notFound} description={t.loadFailDesc} onRetry={() => void load()} autoRetrySeconds={0} /></div>
      ) : file.kind === 'doc' ? (
        <DocEditor {...editorProps} content={file.content as DocContent} onChange={onContent} />
      ) : file.kind === 'sheet' ? (
        <SheetEditor {...editorProps} content={file.content as SheetContent} onChange={onContent} />
      ) : (
        <SlidesEditor {...editorProps} content={file.content as SlidesContent} onChange={onContent} />
      )}
    </motion.div>,
    document.body,
  );
}
