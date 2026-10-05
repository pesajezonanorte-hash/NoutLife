// La «foto de perfil» del gremio: su foto en una baldosa redondeada o, si no
// tiene, su emblema. Quien lidera el gremio puede cambiarla desde la cabecera; el
// diálogo deja subir una foto, encuadrarla (el mismo recorte que la foto de
// perfil, a 384 px) o quitarla. La foto también ondea en el banderín de la fogata.
import { useRef, useState, type ChangeEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Trash2, Upload, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useToast } from '@/hooks/useToast';
import { PhotoCropper } from '@/components/character/PhotoCropper';
import { Button, IconChip, ResponsiveDialog, type Tone } from '@/components/ui/lq';

/** Lado del JPEG de la foto del gremio (px): nítido en la cabecera y ligero de guardar. */
const PHOTO_SIZE = 384;

export interface GuildCrestProps {
  photoUrl?: string | null;
  emblem: LucideIcon;
  tone: Exclude<Tone, 'muted'>;
  name: string;
  /** Aro que late alrededor (cabecera); sin él en vistas previas pequeñas. */
  halo?: boolean;
  className?: string;
}

/** Foto o emblema del gremio, con el mismo tamaño y forma. */
export function GuildCrest({ photoUrl, emblem, tone, name, halo = true, className }: GuildCrestProps) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {photoUrl ? (
        <motion.span
          key={photoUrl.slice(-24)}
          className={cn('relative block shrink-0 overflow-hidden bg-surface shadow-md ring-2 ring-warning/35', halo && 'lq-halo', className)}
          initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, transition: springs.heavy }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
        >
          <img src={photoUrl} alt={`Foto del gremio ${name}`} className="size-full object-cover" draggable={false} />
        </motion.span>
      ) : (
        <motion.span key="emblem" className="block shrink-0" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1, transition: springs.heavy }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
          <IconChip icon={emblem} tone={tone} size="lg" className={cn('[&>svg]:size-10', halo && 'lq-halo', className)} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export interface GuildPhotoDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  photoUrl?: string | null;
  emblem: LucideIcon;
  tone: Exclude<Tone, 'muted'>;
  /** Guarda la foto nueva o la quita (null). Si falla, el diálogo sigue abierto. */
  onSave: (photoUrl: string | null) => Promise<void> | void;
}

export function GuildPhotoDialog({ open, onClose, name, photoUrl, emblem, tone, onSave }: GuildPhotoDialogProps) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => { if (saving) return; setCropSrc(null); onClose(); };

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Elige un archivo de imagen'); return; }
    try { setCropSrc(await readAsDataUrl(file)); }
    catch { toast.error('No se pudo leer la imagen'); }
  }

  async function save(url: string | null) {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(url);
      setCropSrc(null);
      onClose();
    } catch {
      // onSave ya avisó del error; el diálogo sigue abierto para reintentar.
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onClose={close} title="Foto del gremio" className="max-w-[440px]">
      {cropSrc ? (
        <PhotoCropper src={cropSrc} size={PHOTO_SIZE} onCancel={() => setCropSrc(null)} onApply={(url) => void save(url)} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <GuildCrest photoUrl={photoUrl} emblem={emblem} tone={tone} name={name} className="size-28 rounded-[36px]" />
            <p className="max-w-[320px] text-body-md text-on-surface-light">
              Una foto que represente a {name}. Se verá en la cabecera del gremio y en el banderín de la fogata.
            </p>
          </div>
          <input ref={input} type="file" accept="image/*" aria-label="Subir foto del gremio" className="hidden" tabIndex={-1} onChange={(e) => void pick(e)} />
          <div className="flex flex-col gap-2">
            <Button block loading={saving} onClick={() => input.current?.click()}>
              <Upload aria-hidden className="size-5" strokeWidth={1.75} />{photoUrl ? 'Cambiar foto' : 'Subir foto'}
            </Button>
            {photoUrl && (
              <Button variant="ghost" block disabled={saving} onClick={() => void save(null)}>
                <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Quitar foto
              </Button>
            )}
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}

/** Botón de cámara sobre el escudo (solo para quien lidera el gremio). */
export function CrestEditButton({ onClick, label = 'Cambiar la foto del gremio' }: { onClick: () => void; label?: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileHover={{ scale: 1.08, rotate: -6 }}
      whileTap={{ scale: 0.92 }}
      transition={springs.snappy}
      className="absolute -bottom-2 -right-2 z-[1] flex size-11 items-center justify-center rounded-full border border-border bg-surface text-on-surface shadow-md hover:text-primary-text"
    >
      <Camera aria-hidden className="size-5" strokeWidth={1.75} />
    </motion.button>
  );
}
