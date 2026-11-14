// Documento: texto con formato (negrita, cursiva, subrayado, títulos y listas) en una hoja centrada. El HTML
// se sanea al guardar con la misma lista blanca de la Libreta. Pegar trae solo el texto. El copiloto redacta,
// mejora lo seleccionado o resume, y su propuesta entra con deshacer (execCommand mantiene el historial).
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Heading3, Italic, List, ListOrdered, Redo2, Underline, Undo2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useText } from '@/lib/i18n';
import { sanitizeHtml } from '@/components/notebook/paper';
import { textToHtml } from '@/lib/office';
import type { CopilotAction, CopilotResult, DocContent } from '@/services/office.service';
import { OFFICE_COPY } from './copy';
import { Copilot } from './Copilot';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function DocEditor({ title, content, onChange, copilotOpen, onCloseCopilot }: {
  title: string;
  content: DocContent;
  onChange: (content: DocContent) => void;
  copilotOpen: boolean;
  onCloseCopilot: () => void;
}) {
  const t = useText(OFFICE_COPY);
  const editor = useRef<HTMLDivElement>(null);
  /** Última selección dentro del documento: el copiloto trabaja sobre ella aunque el foco esté en su panel. */
  const saved = useRef<Range | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [words, setWords] = useState(0);
  const [states, setStates] = useState<Record<string, boolean>>({});

  // Contenido no controlado: se pinta una vez al abrir y después lo lleva el navegador.
  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    el.innerHTML = sanitizeHtml(content.html);
    setWords(countWords(el.innerText));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(() => {
    const el = editor.current;
    if (!el) return;
    onChange({ html: el.innerHTML });
    setWords(countWords(el.innerText));
  }, [onChange]);

  useEffect(() => {
    const onSelection = () => {
      const el = editor.current;
      const sel = document.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
      saved.current = sel.getRangeAt(0).cloneRange();
      setSelectionText(sel.isCollapsed ? '' : sel.toString());
      setStates({
        bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'), insertOrderedList: document.queryCommandState('insertOrderedList'),
        heading: /^h3$/i.test(String(document.queryCommandValue('formatBlock'))),
      });
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  /** Devuelve el foco al documento con la última selección (o el cursor al final). */
  function restore(atEnd = false) {
    const el = editor.current!;
    el.focus();
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    if (saved.current && !atEnd && el.contains(saved.current.startContainer)) {
      sel.addRange(saved.current);
    } else {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.addRange(r);
    }
  }

  function command(name: string, value?: string) {
    document.execCommand(name, false, value);
    emit();
  }
  // El botón no se lleva el foco: la selección sigue en el texto.
  const keep = (e: ReactMouseEvent) => e.preventDefault();

  function applyCopilot(action: CopilotAction, result: CopilotResult, all?: boolean) {
    const text = result.text ?? '';
    const el = editor.current;
    if (!el || !text) return;
    if (action === 'summarize') {
      restore(true);
      document.execCommand('insertHTML', false, `<h3>${escape(t.summaryTitle)}</h3>${textToHtml(text)}`);
    } else if (action === 'improve' && (all || !selectionText)) {
      el.focus();
      document.execCommand('selectAll');
      document.execCommand('insertHTML', false, textToHtml(text));
    } else {
      restore(action === 'write' && !saved.current);
      document.execCommand('insertHTML', false, textToHtml(text));
    }
    emit();
  }

  const tools: Array<{ id: string; icon: LucideIcon; label: string; run: () => void; pressed?: boolean }> = [
    { id: 'bold', icon: Bold, label: t.bold, run: () => command('bold'), pressed: states.bold },
    { id: 'italic', icon: Italic, label: t.italic, run: () => command('italic'), pressed: states.italic },
    { id: 'underline', icon: Underline, label: t.underline, run: () => command('underline'), pressed: states.underline },
    { id: 'heading', icon: Heading3, label: t.heading, run: () => command('formatBlock', states.heading ? 'div' : 'h3'), pressed: states.heading },
    { id: 'ul', icon: List, label: t.bullets, run: () => command('insertUnorderedList'), pressed: states.insertUnorderedList },
    { id: 'ol', icon: ListOrdered, label: t.numbered, run: () => command('insertOrderedList'), pressed: states.insertOrderedList },
    { id: 'undo', icon: Undo2, label: t.undo, run: () => command('undo') },
    { id: 'redo', icon: Redo2, label: t.redo, run: () => command('redo') },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div role="toolbar" aria-label={t.format} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 py-1 [scrollbar-width:none]">
          {tools.map((tool, i) => (
            <button
              key={tool.id} type="button" title={tool.label} aria-label={tool.label} aria-pressed={tool.pressed ?? undefined}
              onMouseDown={keep} onClick={tool.run}
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-md text-on-surface transition-colors hover:bg-surface-variant focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary',
                tool.pressed && 'bg-primary/[var(--lq-soft-alpha)] text-primary-text',
                i === 6 && 'ml-auto',
              )}
            >
              <tool.icon aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-6">
          <div
            ref={editor}
            contentEditable
            suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label={title}
            data-placeholder={t.docEmpty}
            spellCheck
            onInput={emit}
            onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
            className={cn(
              'lq-selectable mx-auto min-h-[70dvh] w-full max-w-[72ch] rounded-2xl border border-border bg-surface px-6 py-8 text-body-lg leading-relaxed text-on-background shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 sm:px-12 sm:py-12',
              'empty:before:text-on-surface-light empty:before:content-[attr(data-placeholder)]',
              '[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-heading-md [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
            )}
          />
          <p className="mx-auto mt-3 max-w-[72ch] text-right text-body-sm text-on-surface-light" aria-live="off">{t.words(words)}</p>
        </div>
      </div>
      {copilotOpen && (
        <Copilot
          actions={['write', 'improve', 'summarize']}
          hasSelection={Boolean(selectionText)}
          context={(action) => {
            const all = editor.current?.innerText ?? '';
            // Redactar ve el final del documento para seguir el tono; mejorar y resumir, la selección o todo.
            return action === 'write' ? all.slice(-4000) : selectionText || all;
          }}
          onApply={applyCopilot}
          onClose={onCloseCopilot}
        />
      )}
    </div>
  );
}
