// Oficina (vista de la Libreta): crear un documento, una hoja o una presentación, y la lista de archivos.
// Abrir uno pone ?f=<id> en la URL: el botón atrás lo cierra, como ?n= con las libretas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Presentation, Sheet as SheetIcon, Trash2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { Button, EmptyState, ErrorState, IconChip, Modal, PageLoader, type Tone } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { useLocale, useText } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import { newId } from '@/lib/office';
import * as office from '@/services/office.service';
import type { OfficeContent, OfficeKind, OfficeMeta } from '@/services/office.service';
import { OFFICE_COPY } from './copy';
import { OfficeEditor, clearOfficeDraft } from './OfficeEditor';

export const KIND_META: Record<OfficeKind, { icon: LucideIcon; tone: Exclude<Tone, 'muted'> }> = {
  doc: { icon: FileText, tone: 'info' },
  sheet: { icon: SheetIcon, tone: 'success' },
  slides: { icon: Presentation, tone: 'warning' },
};
const KINDS: OfficeKind[] = ['doc', 'sheet', 'slides'];
/** La presentación nace con una portada con id propio (el servidor pondría siempre el mismo). */
const starter = (kind: OfficeKind): OfficeContent | undefined =>
  kind === 'slides' ? { theme: 'jade', slides: [{ id: newId(), layout: 'title', title: '', body: '' }] } : undefined;

export function OfficeShelf() {
  const t = useText(OFFICE_COPY);
  const locale = useLocale();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get('f');
  const [files, setFiles] = useState<OfficeMeta[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [creating, setCreating] = useState<OfficeKind | null>(null);
  const [deleting, setDeleting] = useState<OfficeMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const openedHere = useRef(false);

  const load = useCallback(async () => {
    try { setFiles(await office.listFiles()); setState('ready'); }
    catch { setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = (id: string) => { openedHere.current = true; setParams((p) => { p.set('f', id); return p; }); };
  const close = () => {
    if (openedHere.current) { openedHere.current = false; navigate(-1); }
    else setParams((p) => { p.delete('f'); return p; }, { replace: true });
  };

  async function create(kind: OfficeKind) {
    setCreating(kind);
    try {
      const file = await office.createFile(kind, t.untitled[kind], starter(kind));
      setFiles((list) => [file, ...list]);
      open(file.id);
    } catch (err) {
      toast.error(office.officeMessage(err, t.createFail));
    } finally {
      setCreating(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await office.deleteFile(deleting.id);
      clearOfficeDraft(deleting.id);
      setFiles((list) => list.filter((f) => f.id !== deleting.id));
      toast.success(t.deleted);
      setDeleting(null);
    } catch (err) {
      toast.error(office.officeMessage(err, t.deleteFail));
    } finally {
      setBusy(false);
    }
  }

  const saved = (meta: OfficeMeta) => setFiles((list) => [meta, ...list.filter((f) => f.id !== meta.id)]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      <motion.p variants={item} className="max-w-[65ch] text-body-md text-on-surface-light">{t.desc}</motion.p>

      {/* Crear: tres hojas que se inclinan con el cursor o el dedo (lq-lift). */}
      <motion.ul variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {KINDS.map((kind) => {
          const meta = KIND_META[kind];
          return (
            <li key={kind}>
              <button
                type="button" onClick={() => void create(kind)} disabled={creating !== null}
                className="lq-card lq-lift flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition-opacity focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary disabled:opacity-60"
              >
                <IconChip icon={meta.icon} tone={meta.tone} size="lg" />
                <span className="flex flex-col">
                  <span className="text-heading-sm">{t.newOf[kind]}</span>
                  <span className="text-body-sm text-on-surface-light">{t.kinds[kind]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </motion.ul>

      <motion.section variants={item} aria-label={t.title} className="flex flex-col gap-3">
        {state === 'loading' ? (
          <PageLoader label={t.loading} size="sm" />
        ) : state === 'error' ? (
          <ErrorState title={t.loadFail} description={t.loadFailDesc} onRetry={() => void load()} />
        ) : files.length === 0 ? (
          <EmptyState icon={FileText} tone="info" title={t.emptyTitle} description={t.emptyDesc} className="py-8" />
        ) : (
          <ul className="flex flex-col rounded-2xl border border-border bg-surface">
            {files.map((f, i) => {
              const meta = KIND_META[f.kind];
              return (
                <li key={f.id} className={cn('relative flex min-h-16 items-center gap-3 px-4 py-2', i < files.length - 1 && 'border-b border-border')}>
                  <IconChip icon={meta.icon} tone={meta.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <button type="button" aria-label={t.open(f.title)} onClick={() => open(f.id)} className="block max-w-full truncate text-left text-body-md font-semibold after:absolute after:inset-0 after:content-['']">{f.title}</button>
                    <p className="truncate text-body-sm text-on-surface-light">{t.kinds[f.kind]} · {t.edited(relativeTime(f.updatedAt, locale))}</p>
                  </div>
                  <Button variant="icon" aria-label={t.deleteOf(f.title)} className="relative z-[1] hover:text-error-text" onClick={() => setDeleting(f)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t.confirmDelete(deleting?.title ?? '')}>
        <div className="flex flex-col gap-5">
          <p className="text-body-md text-on-surface">{t.confirmBody}</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setDeleting(null)}>{t.cancel}</Button>
            <Button variant="danger" size="md" loading={busy} onClick={() => void remove()}><Trash2 aria-hidden className="size-4" />{t.delete}</Button>
          </div>
        </div>
      </Modal>

      {openId && <OfficeEditor key={openId} id={openId} onClose={() => { close(); void load(); }} onSaved={saved} />}
    </motion.div>
  );
}
