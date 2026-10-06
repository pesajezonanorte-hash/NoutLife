// Editar el gremio: cualquiera que pertenezca a él puede cambiar el nombre, la
// descripción, el emblema y la foto. Todos ven el cambio al momento y queda un
// aviso en la carta del gremio con quién lo hizo.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToastStore } from '@/hooks/useToast';
import { apiError, updateGuildInfo } from '@/services/network.service';
import { EMBLEMS, emblemOf } from '@/components/guild/emblems';
import { GuildCrest, GuildPhotoDialog } from '@/components/guild/GuildCrest';
import { Button, Field, Input, ResponsiveDialog } from '@/components/ui/lq';

export interface EditableGuild { id: string; name: string; description?: string | null; emblem: string; photoUrl?: string | null }

const TONE_BG: Record<string, string> = {
  warning: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text', error: 'bg-error/[var(--lq-soft-alpha)] text-error-text',
  primary: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text', info: 'bg-info/[var(--lq-soft-alpha)] text-info-text',
  secondary: 'bg-secondary/[var(--lq-soft-alpha)] text-secondary-text', forest: 'bg-forest/[var(--lq-soft-alpha)] text-forest-text',
  success: 'bg-success/[var(--lq-soft-alpha)] text-success-text',
};

export function GuildEditDialog({ open, guild, onClose, onSaved }: {
  open: boolean; guild: EditableGuild; onClose: () => void; onSaved: (g: EditableGuild) => void;
}) {
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? '');
  const [emblem, setEmblem] = useState(guild.emblem);
  const [photo, setPhoto] = useState<string | null>(guild.photoUrl ?? null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radios = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpen = useRef(false);

  // Se rellena solo al abrirse (no cada vez que el gremio se refresca en vivo).
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(guild.name); setDescription(guild.description ?? ''); setEmblem(guild.emblem); setPhoto(guild.photoUrl ?? null); setError(null);
    }
    wasOpen.current = open;
  }, [open, guild]);

  const onRadioKey = (i: number) => (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + EMBLEMS.length) % EMBLEMS.length;
    setEmblem(EMBLEMS[n].id);
    radios.current[n]?.focus();
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: { name?: string; description?: string; emblem?: string; photoUrl?: string | null } = {};
    if (name.trim() !== guild.name) body.name = name.trim();
    if (description.trim() !== (guild.description ?? '')) body.description = description.trim();
    if (emblem !== guild.emblem) body.emblem = emblem;
    if (photo !== (guild.photoUrl ?? null)) body.photoUrl = photo;
    if (!Object.keys(body).length) { onClose(); return; }
    if (body.name !== undefined && body.name.length < 2) { setError('El nombre necesita al menos 2 letras'); return; }
    setBusy(true); setError(null);
    try {
      const g = await updateGuildInfo(guild.id, body);
      onSaved({ ...guild, ...g });
      useToastStore.getState().success('Gremio actualizado', 'Todos ven ya los cambios.');
      onClose();
    } catch (err) { setError(apiError(err, 'No se pudo guardar')); }
    finally { setBusy(false); }
  }

  const em = emblemOf(emblem);
  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Editar gremio" className="md:max-w-[520px]">
      <form noValidate onSubmit={save} className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span className="relative">
            <GuildCrest photoUrl={photo} emblem={em.icon} tone={em.tone} name={name || guild.name} halo={false} className="size-20 rounded-[26px] [&>svg]:size-9" />
            <button type="button" onClick={() => setPhotoOpen(true)} aria-label={photo ? 'Cambiar la foto del gremio' : 'Poner una foto al gremio'}
              className="absolute -bottom-2 -right-2 flex size-10 items-center justify-center rounded-full border border-border bg-surface text-on-surface shadow-md hover:text-primary-text">
              <Camera aria-hidden className="size-5" strokeWidth={1.75} />
            </button>
          </span>
          <p className="min-w-0 flex-1 text-body-sm text-on-surface-light">Cualquiera del gremio puede cambiar esto. En la carta queda un aviso con quién lo cambió.</p>
        </div>
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ej. Los Constantes" />
        </Field>
        <Field label="Descripción (opcional)">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="¿Qué los une?" />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label-lg text-on-surface">Emblema</legend>
          <div role="radiogroup" aria-label="Emblema" className="flex flex-wrap gap-2">
            {EMBLEMS.map((it, i) => {
              const on = emblem === it.id;
              return (
                <button
                  key={it.id} ref={(el) => { radios.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-label={it.name} tabIndex={on ? 0 : -1}
                  onClick={() => setEmblem(it.id)} onKeyDown={onRadioKey(i)}
                  className={cn('flex size-[52px] items-center justify-center rounded-2xl border-2 transition-[transform,border-color] duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]', TONE_BG[it.tone], on ? 'scale-110 border-primary' : 'border-transparent')}
                >
                  <it.icon aria-hidden className="size-6" strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" size="md" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="md" className="flex-1" loading={busy}>Guardar cambios</Button>
        </div>
      </form>
      <GuildPhotoDialog
        open={photoOpen} onClose={() => setPhotoOpen(false)} name={name || guild.name} photoUrl={photo} emblem={em.icon} tone={em.tone}
        onSave={(url) => { setPhoto(url); }}
      />
    </ResponsiveDialog>
  );
}
