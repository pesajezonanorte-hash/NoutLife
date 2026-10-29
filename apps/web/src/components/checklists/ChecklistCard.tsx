// Checklist reutilizable con forma de libreta de espiral: papel con grano, renglones
// azules, margen rojo con la casilla de cada paso, espiral arriba y la categoría en
// una cinta de papel. Marcar un paso es inmediato (se guarda detrás): la casilla
// recibe un check de tinta y el texto se tacha a mano, renglón por renglón. La usan
// la zona de Listas y los bloques por categoría de otras zonas (Compras en Comida…).
import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Plus, Share2, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo } from '@/lib/motion';
import { Badge, Button } from '@/components/ui/lq';
import { InkPath, SketchCheck, SketchCircle } from '@/components/ambience';
import { useToast } from '@/hooks/useToast';
import { useMotionStore } from '@/store/motionStore';
import { useText, type Copy as CopyDict } from '@/lib/i18n';
import * as checklistService from '@/services/checklist.service';
import type { Checklist, ChecklistItem } from '@/services/checklist.service';

const es = {
  updateFail: 'No se pudo actualizar el paso',
  addFail: 'No se pudo añadir el paso',
  removeFail: 'No se pudo eliminar el paso',
  duplicated: 'Lista duplicada',
  duplicateFail: 'No se pudo duplicar la lista',
  confirmDelete: (title: string): string => `¿Eliminar “${title}” y sus pasos?`,
  deleted: 'Lista eliminada',
  deleteFail: 'No se pudo eliminar la lista',
  template: 'Plantilla',
  steps: 'pasos',
  progressOf: (title: string): string => `Progreso de ${title}`,
  stepsOf: (title: string): string => `Pasos de ${title}`,
  uncheck: 'Desmarcar',
  check: 'Completar',
  removeStep: (title: string): string => `Eliminar paso ${title}`,
  emptySteps: 'Añade el primer paso para empezar.',
  newStepFor: (title: string): string => `Nuevo paso para ${title}`,
  addPh: 'Añadir un paso…',
  addStep: 'Añadir paso',
  share: 'Compartir',
  duplicate: 'Duplicar',
  remove: 'Eliminar',
  allDone: '¡Lista completa!',
};

const en: typeof es = {
  updateFail: 'Could not update the step',
  addFail: 'Could not add the step',
  removeFail: 'Could not delete the step',
  duplicated: 'List duplicated',
  duplicateFail: 'Could not duplicate the list',
  confirmDelete: (title: string): string => `Delete “${title}” and its steps?`,
  deleted: 'List deleted',
  deleteFail: 'Could not delete the list',
  template: 'Template',
  steps: 'steps',
  progressOf: (title: string): string => `Progress of ${title}`,
  stepsOf: (title: string): string => `Steps of ${title}`,
  uncheck: 'Uncheck',
  check: 'Complete',
  removeStep: (title: string): string => `Delete step ${title}`,
  emptySteps: 'Add the first step to get started.',
  newStepFor: (title: string): string => `New step for ${title}`,
  addPh: 'Add a step…',
  addStep: 'Add step',
  share: 'Share',
  duplicate: 'Duplicate',
  remove: 'Delete',
  allDone: 'All done!',
};

const COPY: CopyDict<typeof es> = { es, en };

/** Pseudoaleatorio estable (0–1) por semilla: cada trazo tiembla distinto pero igual en cada render. */
const jitter = (seed: number, k: number) => {
  const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 10007, 7);

interface Row { x: number; y: number; w: number; h: number }

/** Trazo de tachado de un renglón: entra un poco antes, ondula y sale un poco después del texto. */
function strike({ x, y, w, h }: Row, seed: number) {
  const y0 = y + h * 0.56 + (jitter(seed, 1) - 0.5) * 2.4;
  const y1 = y + h * 0.5 + (jitter(seed, 2) - 0.5) * 2.4;
  const x0 = x - 3;
  const x1 = x + w + 4;
  return `M${x0} ${y0}C${x0 + w * 0.32} ${y0 - 2 - jitter(seed, 3) * 1.6} ${x0 + w * 0.64} ${y1 + 2.2 - jitter(seed, 4) * 1.6} ${x1} ${y1}`;
}

/**
 * Texto que se tacha a mano renglón por renglón: mide cada línea (getClientRects) y le
 * traza su propio trazo de tinta, uno detrás de otro. Si cambia el ancho, se vuelve a medir.
 */
function InkStrike({ done, seed, children }: { done: boolean; seed: number; children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  useLayoutEffect(() => {
    const el = text.current;
    const host = box.current;
    if (!el || !host) return undefined;
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const origin = host.getBoundingClientRect();
      const next: Row[] = [];
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1) continue;
        const y = r.top - origin.top;
        const row = next.find((l) => Math.abs(l.y - y) < r.height / 2);
        if (row) {
          const right = Math.max(row.x + row.w, r.left - origin.left + r.width);
          row.x = Math.min(row.x, r.left - origin.left);
          row.w = right - row.x;
        } else next.push({ x: r.left - origin.left, y, w: r.width, h: r.height });
      }
      setRows(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [children]);
  return (
    <span ref={box} className="relative block">
      <span ref={text}>{children}</span>
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-primary-text">
        {rows.map((r, i) => <InkPath key={i} d={strike(r, seed + i)} drawn={done} delay={done ? 0.08 + i * 0.16 : 0} duration={0.32} strokeWidth={2.1} />)}
      </svg>
    </span>
  );
}

/** Casilla dibujada a mano en el margen; al completar, el check de tinta se sale un poco, como en papel. */
function InkBox({ done, seed }: { done: boolean; seed: number }) {
  const w = (k: number) => (jitter(seed, k) - 0.5) * 1.4;
  return (
    <span aria-hidden className="relative block size-6 shrink-0">
      <svg viewBox="0 0 24 24" className="absolute inset-0 overflow-visible text-on-surface-light">
        <path
          className="lq-ink" strokeWidth={1.6}
          d={`M${3 + w(1)} ${4 + w(2)}C9 ${3.4 + w(3)} 15 ${3.6 + w(4)} ${20.6 + w(5)} ${4 + w(6)}C${21 + w(7)} 9.5 ${21.2 + w(8)} 15 ${20.7 + w(9)} ${20.4 + w(10)}C15 ${20.9 + w(11)} 8.6 ${21 + w(12)} ${3.4 + w(13)} ${20.5 + w(14)}C${2.9 + w(15)} 15 ${2.8 + w(16)} 9.2 ${3 + w(1)} ${4 + w(2)}`}
        />
      </svg>
      <SketchCheck drawn={done} duration={0.24} className="absolute -left-0.5 -top-1.5 size-7 text-primary-text" strokeWidth={2.6} />
    </span>
  );
}

/** Espiral de alambre sobre el borde superior: un aro por cada perforación. */
function Spiral() {
  const id = useId();
  return (
    <svg aria-hidden className="lq-spiral pointer-events-none absolute inset-x-4 -top-2 h-6 w-[calc(100%-2rem)]" preserveAspectRatio="none">
      <defs>
        <pattern id={id} width="22" height="24" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="15" r="3.1" className="lq-spiral-hole" />
          <path d="M8.4 15.5C7.2 9.5 8.8 3.6 11.6 2.6 14.2 1.8 15 6.8 13.2 14.2" className="lq-spiral-wire" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function ChecklistCard({ checklist, onRefresh, onShare, compact = false }: { checklist: Checklist; onRefresh: () => void | Promise<void>; onShare?: () => void; compact?: boolean }) {
  const t = useText(COPY);
  const toast = useToast();
  const reduce = useMotionStore((s) => s.reduce);
  const [newStep, setNewStep] = useState('');
  const [savingStep, setSavingStep] = useState(false);
  /** Marcas puestas en este dispositivo que el servidor aún no confirmó (se ven al instante). */
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  /** Pasos que se están borrando: salen de la hoja antes de que el servidor responda. */
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const steps = checklist.items.filter((s) => !gone.has(s.id)).map((s) => (s.id in marks ? { ...s, isDone: marks[s.id] } : s));
  const done = steps.filter((step) => step.isDone).length;
  const pct = steps.length ? done / steps.length : 0;
  const complete = steps.length > 0 && done === steps.length;

  async function toggle(step: ChecklistItem) {
    const next = !step.isDone;
    setMarks((m) => ({ ...m, [step.id]: next }));
    try {
      await checklistService.updateItem(step.id, { isDone: next });
      await onRefresh();
    } catch {
      toast.error(t.updateFail);
    } finally {
      setMarks((m) => {
        const rest = { ...m };
        if (rest[step.id] === next) delete rest[step.id];
        return rest;
      });
    }
  }
  async function addStep(event: FormEvent) {
    event.preventDefault();
    if (!newStep.trim()) return;
    setSavingStep(true);
    try { await checklistService.addItem(checklist.id, newStep.trim()); setNewStep(''); await onRefresh(); }
    catch { toast.error(t.addFail); }
    finally { setSavingStep(false); }
  }
  async function removeStep(step: ChecklistItem) {
    setGone((g) => new Set(g).add(step.id));
    try { await checklistService.deleteItem(step.id); await onRefresh(); }
    catch { toast.error(t.removeFail); }
    finally { setGone((g) => { const n = new Set(g); n.delete(step.id); return n; }); }
  }
  async function duplicate() {
    try { await checklistService.duplicateChecklist(checklist.id); await onRefresh(); toast.success(t.duplicated); }
    catch { toast.error(t.duplicateFail); }
  }
  async function remove() {
    if (!window.confirm(t.confirmDelete(checklist.title))) return;
    try { await checklistService.deleteChecklist(checklist.id); await onRefresh(); toast.success(t.deleted); }
    catch { toast.error(t.deleteFail); }
  }

  return (
    <article className={cn('lq-checklist lq-tex-paper relative min-w-0 rounded-[0.5rem_1.25rem_1.25rem_0.5rem] pt-7 shadow-md', compact ? 'pb-3' : 'pb-4')}>
      <Spiral />
      {/* Cinta de papel con la categoría, pegada un poco torcida. */}
      <span className="lq-washi absolute right-5 top-3 rotate-[3deg] px-3 py-1 text-label-md capitalize text-on-background">{checklist.category}</span>

      <header className="flex items-start gap-3 pl-[calc(var(--lq-margin)+0.75rem)] pr-5">
        <div className="min-w-0 flex-1 pt-2">
          <h2 className="min-w-0 break-words font-serif text-[1.5rem] font-medium italic leading-tight text-on-background">{checklist.title}</h2>
          {checklist.description && <p className="mt-1 text-body-md text-on-surface-light">{checklist.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {checklist.isTemplate && <Badge variant="warning">{t.template}</Badge>}
            {/* Avance como se anota en una libreta: la cuenta y una raya de lápiz que se alarga. */}
            <span className="relative inline-flex items-center gap-2 font-mono text-body-sm tabular-nums text-on-surface">
              <span className="relative px-1">
                {done}/{steps.length} {t.steps}
                <AnimatePresence>
                  {complete && (
                    <motion.span key="ok" className="absolute -inset-x-2 -inset-y-1.5 text-success-text" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                      <SketchCircle className="h-full w-full" delay={0.4} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <svg
                role="progressbar" aria-label={t.progressOf(checklist.title)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}
                viewBox="0 0 120 8" className="h-2 w-24 overflow-visible text-primary-text" preserveAspectRatio="none"
              >
                <path d="M2 4.6C30 3.4 62 5.4 90 4.2 102 3.8 112 4.4 118 4.8" className="lq-ink lq-ink-stretch text-border-strong" strokeWidth={1.2} />
                <motion.path
                  d="M2 4.6C30 3.4 62 5.4 90 4.2 102 3.8 112 4.4 118 4.8" className="lq-ink lq-ink-stretch" strokeWidth={2.4}
                  initial={false} animate={{ pathLength: Math.max(0.001, pct) }} transition={reduce ? { duration: 0 } : { duration: 0.6, ease: expo }}
                />
              </svg>
            </span>
            {complete && <span className="sr-only">{t.allDone}</span>}
          </div>
        </div>
      </header>

      {/* Renglones: cada paso ocupa los suyos; la casilla vive en el margen, como en una libreta. */}
      <ul className="lq-checklist-lines relative mt-3 pl-[var(--lq-margin)]" aria-label={t.stepsOf(checklist.title)}>
        <AnimatePresence initial={false}>
          {steps.map((step) => {
            const s = seedOf(step.id);
            return (
              <motion.li
                key={step.id}
                className="group relative -ml-[var(--lq-margin)] flex items-start pr-2"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: expo } }}
                transition={{ duration: 0.3, ease: expo }}
              >
                <button
                  type="button" aria-pressed={step.isDone} aria-label={`${step.isDone ? t.uncheck : t.check} ${step.title}`}
                  onClick={() => void toggle(step)}
                  className="flex min-h-[var(--lq-rule)] min-w-0 flex-1 items-start text-left outline-none focus-visible:rounded-md focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary"
                >
                  <span className="flex h-[var(--lq-rule)] w-[var(--lq-margin)] shrink-0 items-center justify-center"><InkBox done={step.isDone} seed={s} /></span>
                  <span className={cn('min-w-0 flex-1 pl-3 text-body-md leading-[var(--lq-rule)] transition-colors duration-500', step.isDone ? 'text-on-surface-light' : 'text-on-background')}>
                    <InkStrike done={step.isDone} seed={s}>{step.title}</InkStrike>
                  </span>
                </button>
                <Button
                  variant="icon" size="sm" aria-label={t.removeStep(step.title)} onClick={() => void removeStep(step)}
                  className="mt-1 size-9 shrink-0 text-on-surface-light opacity-60 hover:text-error-text md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {steps.length === 0 && <li className="pl-3 text-body-sm leading-[var(--lq-rule)] text-on-surface-light">{t.emptySteps}</li>}
        {/* El renglón libre donde se escribe el siguiente paso. */}
        <li>
          <form onSubmit={addStep} className="flex items-center gap-1 pr-2">
            <input
              aria-label={t.newStepFor(checklist.title)} value={newStep} onChange={(event) => setNewStep(event.target.value)} maxLength={160} placeholder={t.addPh}
              className="lq-selectable h-[var(--lq-rule)] min-w-0 flex-1 bg-transparent pl-3 text-body-md text-on-background outline-none placeholder:text-on-surface-light/70 focus-visible:placeholder:text-on-surface-light/40"
            />
            <Button type="submit" variant="icon" size="sm" aria-label={t.addStep} disabled={!newStep.trim()} loading={savingStep} className="size-9 shrink-0 text-primary-text">
              <Plus aria-hidden className="size-5" />
            </Button>
          </form>
        </li>
      </ul>

      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1 pl-[calc(var(--lq-margin)-0.5rem)] pr-4">
          {onShare && <Button variant="ghost" size="sm" onClick={onShare}><Share2 aria-hidden className="size-4" />{t.share}</Button>}
          <Button variant="ghost" size="sm" onClick={() => void duplicate()}><Copy aria-hidden className="size-4" />{t.duplicate}</Button>
          <Button variant="ghost" size="sm" onClick={() => void remove()} className="text-error-text"><Trash2 aria-hidden className="size-4" />{t.remove}</Button>
        </div>
      )}
    </article>
  );
}
