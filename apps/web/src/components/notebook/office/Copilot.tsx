// Copiloto de la oficina: un panel al lado del editor (abajo en el móvil). La persona elige qué hacer, el
// copiloto propone y nada cambia hasta que la persona lo inserta. Es IA: en Lite, el 402 abre el diálogo de Pro.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy as CopyIcon, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import { Button, ChipGroup, Field, Spinner, Textarea } from '@/components/ui/lq';
import { useToast } from '@/hooks/useToast';
import { isProRequired } from '@/lib/plan';
import { useLocale, useText } from '@/lib/i18n';
import * as office from '@/services/office.service';
import type { CopilotAction, CopilotResult } from '@/services/office.service';
import { OFFICE_COPY } from './copy';

export interface CopilotProps {
  actions: CopilotAction[];
  /** Lo que se le manda al copiloto para cada acción (texto, selección o CSV). */
  context: (action: CopilotAction) => string;
  /** Inserta la propuesta. `all`: reemplazar todo en vez de la selección. */
  onApply: (action: CopilotAction, result: CopilotResult, all?: boolean) => void;
  /** Mejorar con una selección hecha: ofrece reemplazar solo eso o todo. */
  hasSelection?: boolean;
  onClose: () => void;
}

export function Copilot({ actions, context, onApply, hasSelection, onClose }: CopilotProps) {
  const t = useText(OFFICE_COPY);
  const locale = useLocale();
  const toast = useToast();
  const [action, setAction] = useState<CopilotAction>(actions[0]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CopilotResult | null>(null);
  useEffect(() => { setResult(null); }, [action]);

  async function run() {
    const ctx = context(action).slice(-14_000);
    if (!prompt.trim() && !ctx.trim()) { toast.info(t.needInput); return; }
    setBusy(true);
    setResult(null);
    try {
      setResult(await office.copilot({ action, prompt: prompt.trim() || undefined, context: ctx || undefined, locale }));
    } catch (err) {
      // 402 de Lite: el diálogo de Pro ya se abrió.
      if (!isProRequired(err)) toast.error(office.officeMessage(err, t.aiFail));
    } finally {
      setBusy(false);
    }
  }

  function apply(all?: boolean) {
    if (!result) return;
    onApply(action, result, all);
    setResult(null);
    setPrompt('');
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result?.text ?? ''); toast.success(t.copied); } catch { /* sin permiso: no pasa nada */ }
  }

  return (
    <motion.aside
      aria-label={t.copilot}
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={springSoft}
      className="flex max-h-[55dvh] w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-border bg-background p-4 md:max-h-none md:w-[360px] md:border-l md:border-t-0"
    >
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-5 text-primary-text" strokeWidth={1.75} />
        <h2 className="flex-1 text-heading-sm">{t.copilot}</h2>
        <Button variant="icon" aria-label={t.closeCopilot} onClick={onClose}><X aria-hidden className="size-5" strokeWidth={1.75} /></Button>
      </div>
      {actions.length > 1 && <ChipGroup label={t.copilot} value={action} onChange={setAction} options={actions.map((value) => ({ value, label: t.actions[value] }))} />}
      <p className="text-body-sm text-on-surface-light">{t.actionHelp[action]}</p>
      <Field label={t.actions[action]}>
        <Textarea rows={action === 'slides' ? 6 : 3} maxLength={1000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t.promptPh[action]} />
      </Field>
      <Button onClick={() => void run()} loading={busy}><Sparkles aria-hidden className="size-4" strokeWidth={1.75} />{t.generate}</Button>

      <div aria-live="polite" className="flex flex-col gap-3">
        {busy && <p className="flex items-center gap-2 text-body-sm text-on-surface-light"><Spinner size="sm" />{t.thinking}</p>}
        {result && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springSoft} className="lq-well flex flex-col gap-3 p-3" aria-label={t.result}>
            <h3 className="text-label-lg text-on-surface-light">{t.result}</h3>
            {result.text && <p className={cn('lq-selectable max-h-72 overflow-y-auto whitespace-pre-wrap text-body-md text-on-surface')}>{result.text}</p>}
            {result.slides && (
              <ol className="flex list-decimal flex-col gap-1 pl-5 text-body-md">
                {result.slides.map((s, i) => <li key={i}>{s.title || s.body.split('\n')[0]}</li>)}
              </ol>
            )}
            <div className="flex flex-wrap gap-2">
              {action !== 'analyze' && <Button size="sm" onClick={() => apply()}>{t.apply[action]}</Button>}
              {action === 'improve' && hasSelection && <Button size="sm" variant="secondary" onClick={() => apply(true)}>{t.replaceAll}</Button>}
              {result.text && <Button size="sm" variant="ghost" onClick={() => void copy()}><CopyIcon aria-hidden className="size-4" strokeWidth={1.75} />{t.copy}</Button>}
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>{action === 'analyze' ? t.apply.analyze : t.discard}</Button>
            </div>
          </motion.section>
        )}
      </div>
    </motion.aside>
  );
}
