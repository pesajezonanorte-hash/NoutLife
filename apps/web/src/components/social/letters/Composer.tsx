// El renglón donde se escribe la carta, pegado encima del teclado:
//   · la cámara (polaroid; también deja elegir de la galería),
//   · el renglón, que crece con el texto (con una transición suave) hasta un
//     tope y entonces se desplaza siguiendo lo que escribes,
//   · la carita: abre el cajón de stickers y juegos en el sitio del teclado,
//   · el lacre: envía sin cerrar el teclado (como en Instagram). Con el renglón
//     vacío es un micrófono: mantenlo pulsado para grabar y suelta para enviar
//     (desliza a la izquierda para cancelar), o tócalo para grabar con las manos libres.
// Encima, la cita a la que respondes o el mensaje que editas.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Mic, Pencil, Reply, Send, Smile, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { Button } from '@/components/ui/lq';
import type { GameType } from '@/services/network.service';
import { Quote, snippetOf } from './MessageRow';
import { StickerPanel } from './StickerPanel';
import { clock, useVoiceRecorder, type VoiceClip } from './voice';
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
  onVoice: (clip: VoiceClip) => Promise<void>;
  onSticker: (hash: string) => void;
  onGame: (type: GameType) => void;
  onTyping: (on: boolean) => void;
  /** El renglón ganó o perdió el foco (para el teclado del móvil). */
  onFocusChange?: (focused: boolean) => void;
  /** Alto del teclado la última vez que se abrió (para el cajón). */
  keyboardHeight: number;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(props, handle) {
  const { to, maxLength, replying, editing, nameOf, colorOf, onCancelReply, onCancelEdit, onSend, onEdit, onCamera, onVoice, onSticker, onGame, onTyping, onFocusChange, keyboardHeight } = props;
  const reduce = useMotionStore((s) => s.reduce);
  const fine = useMediaQuery('(pointer: fine)');
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [drawer, setDrawer] = useState(false);
  const rec = useVoiceRecorder();
  const [voiceMode, setVoiceMode] = useState<'off' | 'hold' | 'locked'>('off');
  const [cancelling, setCancelling] = useState(false);
  const press = useRef<{ x: number; at: number } | null>(null);

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

  // ─── Notas de voz ──────────────────────────────────────────────────────────
  async function micDown(e: PointerEvent<HTMLButtonElement>) {
    if (voiceMode !== 'off') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = { x: e.clientX, at: Date.now() };
    setVoiceMode('hold');
    setCancelling(false);
    const ok = await rec.start();
    if (!ok) {
      setVoiceMode('off');
      press.current = null;
      toaster().error(rec.state === 'denied' ? 'Sin permiso para usar el micrófono' : 'Este navegador no puede grabar notas de voz');
    }
  }
  function micMove(e: PointerEvent<HTMLButtonElement>) {
    if (voiceMode !== 'hold' || !press.current) return;
    setCancelling(e.clientX - press.current.x < -90);
  }
  async function micUp() {
    if (voiceMode !== 'hold' || !press.current) return;
    const held = Date.now() - press.current.at;
    press.current = null;
    if (held < 350) { setVoiceMode('locked'); return; } // un toque: grabar con las manos libres
    await finishVoice(!cancelling);
  }
  async function finishVoice(send: boolean) {
    setVoiceMode('off');
    setCancelling(false);
    const clip = await rec.stop(send);
    if (!send) return;
    if (!clip) { toaster().info('La nota de voz era demasiado corta'); return; }
    try { await onVoice(clip); } catch (err) { toaster().error((err as Error).message); }
  }

  const recording = voiceMode !== 'off';
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
        <AnimatePresence mode="popLayout" initial={false}>
          {recording ? (
            <motion.div key="rec" initial={reduce ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, transition: { duration: 0.12 } }} transition={springs.snappy}
              className="flex min-h-12 flex-1 items-center gap-3 pl-1">
              <Button type="button" variant="icon" aria-label="Descartar la nota de voz" onClick={() => void finishVoice(false)} className="text-error-text">
                <Trash2 aria-hidden className="size-5" />
              </Button>
              <span className="relative flex size-3 shrink-0" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-error/60 [.reduce-motion_&]:hidden" />
                <span className="relative size-3 rounded-full bg-error" />
              </span>
              <span className="font-mono text-label-lg tabular-nums text-on-background" role="timer" aria-live="off">{clock(rec.elapsed)}</span>
              <span aria-hidden="true" className="flex h-7 flex-1 items-center gap-[3px] overflow-hidden">
                {Array.from({ length: 18 }, (_, i) => (
                  <span key={i} className="block w-[3px] rounded-full bg-error/70 transition-[height] duration-100" style={{ height: `${Math.max(12, Math.min(100, rec.level * 100 * (0.5 + ((i * 37) % 10) / 10)))}%` }} />
                ))}
              </span>
              {voiceMode === 'hold' && (
                <span className={cn('whitespace-nowrap text-body-sm transition-colors', cancelling ? 'text-error-text' : 'text-on-surface-light')}>
                  {cancelling ? 'Suelta para cancelar' : '‹ Desliza para cancelar'}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div key="write" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex min-w-0 flex-1 items-end gap-2">
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
            </motion.div>
          )}
        </AnimatePresence>

        {empty && !editing ? (
          recording && voiceMode === 'locked' ? (
            <motion.button
              type="button" aria-label="Enviar la nota de voz" onClick={() => void finishVoice(true)}
              whileTap={reduce ? undefined : { scale: 0.86, rotate: -10 }}
              className="lq-wax flex size-12 shrink-0 items-center justify-center"
            >
              <Send aria-hidden className="size-5" strokeWidth={1.75} />
            </motion.button>
          ) : (
            <motion.button
              type="button" aria-label={recording ? 'Grabando: suelta para enviar' : 'Mantén pulsado para grabar una nota de voz'}
              onPointerDown={(e) => void micDown(e)} onPointerMove={micMove} onPointerUp={() => void micUp()} onPointerCancel={() => void finishVoice(false)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !recording) { e.preventDefault(); void rec.start().then((ok) => ok && setVoiceMode('locked')); } }}
              animate={recording ? { scale: 1.25 } : { scale: 1 }} transition={springs.snappy}
              className={cn('flex size-12 shrink-0 touch-none items-center justify-center rounded-full transition-colors', recording ? 'bg-error text-white shadow-lg' : 'bg-primary/12 text-primary-text hover:bg-primary/20')}
            >
              <Mic aria-hidden className="size-5" strokeWidth={1.9} />
            </motion.button>
          )
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
      />
    </div>
  );
});
