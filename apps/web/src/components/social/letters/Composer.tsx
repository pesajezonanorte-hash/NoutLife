// El renglón donde se escribe la carta, pegado encima del teclado:
//   · la cámara (polaroid; también deja elegir de la galería),
//   · el renglón, que crece con el texto (con una transición suave) hasta un
//     tope y entonces se desplaza siguiendo lo que escribes,
//   · la carita: abre el cajón de stickers y juegos en el sitio del teclado,
//   · el lacre: envía sin cerrar el teclado (como en Instagram). Con el renglón
//     vacío es la cámara de video: graba hasta 15 s para la carta.
// Encima, la cita a la que respondes o el mensaje que editas.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Pencil, Reply, Send, Smile, Video, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { Button } from '@/components/ui/lq';
import type { GameType } from '@/services/network.service';
import { Quote, snippetOf } from './MessageRow';
import { StickerPanel } from './StickerPanel';
import type { LetterMsg } from './useLetter';

const toaster = () => useToastStore.getState();

export interface ComposerHandle { focus: () => void; blur: () => void }

interface Props {
  to: string;
  maxLength: number;
  replying: LetterMsg | null;
  editing: LetterMsg | null;
  nameOf: (authorId: string) => string;
  colorOf: (authorId: string) => string | null | undefined;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  /** Enviar texto (o guardar la edición). Si falla, devuelve el texto al renglón. */
  onSend: (text: string) => Promise<void>;
  onEdit: (text: string) => Promise<void>;
  onCamera: () => void;
  /** Abre el grabador de video. */
  onVideo: () => void;
  onSticker: (hash: string) => void;
  onGame: (type: GameType) => void;
  onTyping: (on: boolean) => void;
  /** El renglón ganó o perdió el foco (para el teclado del móvil). */
  onFocusChange?: (focused: boolean) => void;
  /** Alto del teclado la última vez que se abrió (para el cajón). */
  keyboardHeight: number;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(props, handle) {
  const { to, maxLength, replying, editing, nameOf, colorOf, onCancelReply, onCancelEdit, onSend, onEdit, onCamera, onVideo, onSticker, onGame, onTyping, onFocusChange, keyboardHeight } = props;
  const reduce = useMotionStore((s) => s.reduce);
  const fine = useMediaQuery('(pointer: fine)');
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [drawer, setDrawer] = useState(false);

  useImperativeHandle(handle, () => ({ focus: () => input.current?.focus(), blur: () => input.current?.blur() }));

  // El renglón crece con el texto (y vuelve a su sitio al vaciarse).
  const grow = useCallback(() => {
    const el = input.current;
    if (!el) return;
    const max = Math.max(96, Math.min(window.innerHeight * 0.32, 180));
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, max);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
    // Lo que se está escribiendo siempre a la vista.
    if (el.selectionStart === el.value.length) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(() => { requestAnimationFrame(grow); }, [text, grow]);

  // Al editar, el texto del mensaje pasa al renglón.
  useEffect(() => {
    if (!editing) return;
    setText(editing.content ?? '');
    setDrawer(false);
    requestAnimationFrame(() => { const el = input.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  }, [editing]);
  useEffect(() => { if (replying) { setDrawer(false); input.current?.focus(); } }, [replying]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText('');
    // El teclado no se cierra: el foco sigue en el renglón.
    input.current?.focus();
    try {
      if (editing) await onEdit(content);
      else await onSend(content);
    } catch (err) {
      setText(content);
      toaster().error((err as Error).message);
    }
  }

  const empty = !text.trim();
  const drawerHeight = Math.min(360, Math.max(250, keyboardHeight || 290));

  return (
    <div className="relative" data-keyboard-managed>
      <AnimatePresence initial={false}>
        {(replying || editing) && (
          <motion.div
            key={editing ? `edit-${editing.id}` : `reply-${replying!.id}`}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : springs.natural}
            className="relative overflow-hidden border-t border-border/80 bg-surface"
          >
            <div className="flex items-center gap-2 px-3 py-2 md:px-5">
              {editing ? <Pencil aria-hidden className="size-4 shrink-0 text-primary-text" strokeWidth={1.9} /> : <Reply aria-hidden className="size-4 shrink-0 text-primary-text" strokeWidth={1.9} />}
              {editing
                ? <span className="lq-quote min-w-0 flex-1"><span className="block text-label-md text-primary-text">Editando tu mensaje</span><span className="line-clamp-1 block text-body-sm text-on-surface-light">{editing.content}</span></span>
                : <Quote r={{ id: replying!.id, authorId: replying!.author?.id ?? '', kind: replying!.kind, content: snippetOf(replying!) }} name={`Respondes a ${nameOf(replying!.author?.id ?? '')}`} nameColor={colorOf(replying!.author?.id ?? '')} className="min-w-0 flex-1" />}
              <Button variant="icon" aria-label={editing ? 'Cancelar la edición' : 'Cancelar la respuesta'} onClick={() => { if (editing) { setText(''); onCancelEdit(); } else onCancelReply(); }}>
                <X aria-hidden className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={submit} className="relative flex items-end gap-2 border-t border-border/80 bg-surface px-2.5 pt-2.5 md:px-5" style={{ paddingBottom: drawer ? '0.625rem' : 'max(.625rem, env(safe-area-inset-bottom))' }}>
            <div className="flex min-w-0 flex-1 items-end gap-2">
              <Button type="button" variant="secondary" aria-label={`Tomar o elegir una foto para ${to}`} onClick={onCamera} className="size-12 shrink-0 rounded-full p-0">
                <Camera aria-hidden className="size-5" strokeWidth={1.75} />
              </Button>
              <div className="relative flex min-w-0 flex-1 items-end">
                <label htmlFor="letter-input" className="sr-only">{editing ? 'Editar tu mensaje' : `Escribir a ${to}`}</label>
                <textarea
                  id="letter-input" ref={input} rows={1} value={text} maxLength={maxLength} autoComplete="off" enterKeyHint={fine ? 'send' : 'enter'}
                  onChange={(e) => { setText(e.target.value); onTyping(Boolean(e.target.value.trim())); }}
                  onFocus={() => { setDrawer(false); onFocusChange?.(true); }}
                  onBlur={() => { onTyping(false); onFocusChange?.(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && (replying || editing)) { e.stopPropagation(); if (editing) { setText(''); onCancelEdit(); } else onCancelReply(); return; }
                    if (e.key === 'Enter' && !e.shiftKey && fine && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
                  }}
                  placeholder={editing ? 'Edita tu mensaje…' : replying ? 'Escribe tu respuesta…' : `Escribe a ${to}…`}
                  className="lq-pen-line min-h-12 w-full resize-none py-3 pl-1 pr-11 text-body-lg leading-6 text-on-background transition-[height] duration-150 ease-out placeholder:text-on-surface-light/80"
                />
                <button
                  type="button" aria-label={drawer ? 'Volver al teclado' : 'Stickers y juegos'} aria-expanded={drawer}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => { if (drawer) { setDrawer(false); input.current?.focus(); } else { input.current?.blur(); setDrawer(true); } }}
                  className={cn('absolute bottom-1 right-0 flex size-10 items-center justify-center rounded-full transition-colors', drawer ? 'text-primary-text' : 'text-on-surface-light hover:text-on-background')}
                >
                  <Smile aria-hidden className="size-6" strokeWidth={1.75} />
                </button>
              </div>
            </div>

        {empty && !editing ? (
          <motion.button
            type="button" aria-label={`Grabar un video para ${to} (hasta 15 segundos)`} onClick={onVideo}
            initial={reduce ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={springs.snappy}
            whileTap={reduce ? undefined : { scale: 0.88 }}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary-text transition-colors hover:bg-primary/20"
          >
            <Video aria-hidden className="size-5" strokeWidth={1.9} />
          </motion.button>
        ) : (
          <motion.button
            type="submit" aria-label={editing ? 'Guardar el cambio' : 'Enviar carta'} disabled={empty}
            // Sin robar el foco al renglón: así el teclado no se cierra al enviar.
            onPointerDown={(e) => e.preventDefault()}
            initial={reduce ? false : { scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={springs.snappy}
            whileTap={reduce ? undefined : { scale: 0.86, rotate: -10 }}
            className="lq-wax flex size-12 shrink-0 items-center justify-center transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? <Pencil aria-hidden className="size-5" strokeWidth={1.75} /> : <Send aria-hidden className="size-5" strokeWidth={1.75} />}
          </motion.button>
        )}
      </form>

      <StickerPanel
        open={drawer} height={drawerHeight}
        onSticker={(hash) => { onSticker(hash); }}
        onGame={(type) => { setDrawer(false); onGame(type); }}
        onClose={() => setDrawer(false)}
      />
    </div>
  );
});
