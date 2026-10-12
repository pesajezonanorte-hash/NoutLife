// Armario del Espejo: cada prenda con su foto (cámara o galería, encuadrada),
// clasificada por zona del cuerpo (torso, piernas, calzado…), y conjuntos armados
// eligiendo una prenda por zona. Las fotos son privadas: solo las ve su dueño.
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, Layers, Plus, Shirt, Star, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import api from '@/lib/api';
import { compressPhoto } from '@/services/network.service';
import { PhotoCropper } from '@/components/character/PhotoCropper';
import { Button, Card, ChipGroup, EmptyState, ErrorState, Field, Input, Modal, PageLoader, ResponsiveDialog } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { useToastStore } from '@/hooks/useToast';

export type Zone = 'torso' | 'piernas' | 'calzado' | 'abrigo' | 'accesorios' | 'cuerpo_completo';

const ZONES: { value: Zone; label: string; optional?: boolean }[] = [
  { value: 'torso', label: 'Torso' },
  { value: 'piernas', label: 'Piernas' },
  { value: 'calzado', label: 'Calzado' },
  { value: 'abrigo', label: 'Abrigo', optional: true },
  { value: 'accesorios', label: 'Accesorios', optional: true },
  { value: 'cuerpo_completo', label: 'Cuerpo completo', optional: true },
];
const ZONE_LABEL = Object.fromEntries(ZONES.map((z) => [z.value, z.label])) as Record<Zone, string>;
/** Prendas guardadas antes de las zonas: su categoría vieja dice dónde van. */
const LEGACY_ZONE: Record<string, Zone> = { tops: 'torso', bottoms: 'piernas', shoes: 'calzado', outerwear: 'abrigo', accessories: 'accesorios' };

interface Garment {
  id: string; name: string; category: string; zone: Zone | null; color?: string | null;
  brand?: string | null; cost?: number | null; timesWorn: number; isFavorite: boolean; photoUrl?: string | null;
}
interface Outfit {
  id: string; name: string | null; occasion: string | null; lastWornAt: string | null; photoUrl?: string | null;
  items: { clothingItem: { id: string } }[];
}

const zoneOf = (g: Garment): Zone => g.zone ?? LEGACY_ZONE[g.category] ?? 'accesorios';

/** Foto con cámara o galería y encuadre cuadrado antes de guardarla. */
function PhotoPicker({ value, onChange, label }: { value: string | null; onChange: (url: string | null) => void; label: string }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setCropSrc(await compressPhoto(file, 1400, 0.9)); }
    catch { useToastStore.getState().error('No se pudo abrir la foto'); }
  }

  if (cropSrc) {
    return (
      <PhotoCropper
        src={cropSrc}
        shape="square"
        size={600}
        quality={0.8}
        title="Encuadra la foto"
        onCancel={() => setCropSrc(null)}
        onApply={(url) => { onChange(url); setCropSrc(null); }}
      />
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface">
        {value
          ? <img src={value} alt={label} className="size-full object-cover" />
          : <span className="flex size-full items-center justify-center text-on-surface-light"><Shirt aria-hidden className="size-8" strokeWidth={1.5} /></span>}
        {value && (
          <button type="button" aria-label="Quitar foto" onClick={() => onChange(null)} className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-on-background shadow">
            <X aria-hidden className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={() => camera.current?.click()}><Camera aria-hidden className="size-4" strokeWidth={1.75} />Tomar foto</Button>
        <Button variant="ghost" size="sm" onClick={() => gallery.current?.click()}><ImageIcon aria-hidden className="size-4" strokeWidth={1.75} />Galería</Button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-label={`${label}: cámara`} onChange={(e) => void pick(e)} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-label={`${label}: galería`} onChange={(e) => void pick(e)} />
    </div>
  );
}

function Thumb({ garment, className }: { garment?: Garment; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface text-on-surface-light', className)}>
      {garment?.photoUrl ? <img src={garment.photoUrl} alt="" className="size-full object-cover" /> : <Shirt aria-hidden className="size-1/2" strokeWidth={1.5} />}
    </span>
  );
}

const BLANK = { name: '', zone: 'torso' as Zone, color: '', brand: '', cost: '', photoUrl: null as string | null };

export function WardrobeSection() {
  const toast = useToastStore.getState();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [filter, setFilter] = useState<'all' | Zone>('all');
  const [garmentOpen, setGarmentOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [outfitOpen, setOutfitOpen] = useState(false);
  const [pick, setPick] = useState<Partial<Record<Zone, string>>>({});
  const [outfitName, setOutfitName] = useState('');
  const [outfitPhoto, setOutfitPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<{ kind: 'garment' | 'outfit'; id: string; name: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const [g, o] = await Promise.all([api.get<Garment[]>('/mirror/wardrobe'), api.get<Outfit[]>('/mirror/outfits')]);
      setGarments(g.data);
      setOutfits(o.data);
      setState('ready');
    } catch {
      if (!silent) setState('error');
      else useToastStore.getState().error('No se pudo actualizar el armario');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments]);
  const shown = filter === 'all' ? garments : garments.filter((g) => zoneOf(g) === filter);
  const options = useMemo(() => [
    { value: 'all' as const, label: `Todas (${garments.length})` },
    ...ZONES.map((z) => ({ value: z.value, label: `${z.label} (${garments.filter((g) => zoneOf(g) === z.value).length})` })),
  ], [garments]);

  async function saveGarment(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/mirror/wardrobe', {
        name: form.name.trim(), zone: form.zone, color: form.color, brand: form.brand,
        cost: form.cost ? Number(form.cost) : undefined, photoUrl: form.photoUrl ?? undefined,
      });
      setGarmentOpen(false);
      setForm(BLANK);
      toast.success('Prenda añadida');
      void load(true);
    } catch { toast.error('No se pudo añadir la prenda'); } finally { setSaving(false); }
  }

  async function saveOutfit(e: FormEvent) {
    e.preventDefault();
    const itemIds = Object.values(pick).filter(Boolean) as string[];
    if (itemIds.length < 2) return;
    setSaving(true);
    try {
      await api.post('/mirror/outfits', { name: outfitName.trim() || undefined, itemIds, photoUrl: outfitPhoto ?? undefined });
      setOutfitOpen(false);
      toast.success('Conjunto guardado');
      void load(true);
    } catch { toast.error('No se pudo guardar el conjunto'); } finally { setSaving(false); }
  }

  async function wornGarment(id: string) {
    try { await api.post(`/mirror/wardrobe/${id}/worn`); void load(true); } catch { toast.error('No se pudo registrar el uso'); }
  }

  async function wornOutfit(id: string) {
    try { await api.post(`/mirror/outfits/${id}/worn`); toast.success('Conjunto de hoy registrado'); void load(true); } catch { toast.error('No se pudo registrar el uso'); }
  }

  async function confirmRemove() {
    const target = removing;
    if (!target) return;
    setRemoving(null);
    try {
      await api.delete(target.kind === 'garment' ? `/mirror/wardrobe/${target.id}` : `/mirror/outfits/${target.id}`);
      void load(true);
    } catch { toast.error('No se pudo eliminar'); }
  }

  const openOutfit = () => { setPick({}); setOutfitName(''); setOutfitPhoto(null); setOutfitOpen(true); };
  const picked = Object.values(pick).filter(Boolean).length;

  return (
    <section className="flex flex-col gap-6" aria-labelledby="glow-style">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="glow-style" className="text-heading-lg">Mi armario</h2>
        <div className="flex gap-2">
          <Button size="md" variant="secondary" disabled={garments.length < 2} onClick={openOutfit}><Layers aria-hidden className="size-4" />Conjunto</Button>
          <Button size="md" onClick={() => { setForm(BLANK); setGarmentOpen(true); }}><Plus aria-hidden className="size-4" />Prenda</Button>
        </div>
      </div>

      {state === 'loading' ? (
        <PageLoader label="Abriendo tu armario…" words={LOADING_COPY.glowUpWardrobe} />
      ) : state === 'error' ? (
        <ErrorState title="No pudimos cargar tu armario" onRetry={() => void load()} />
      ) : (
        <>
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <ChipGroup label="Zona del cuerpo" options={options} value={filter} onChange={setFilter} />
          </div>

          {shown.length === 0 ? (
            <Card variant="elevated" padding="lg">
              <EmptyState icon={Shirt} tone="info" title={garments.length ? 'Nada en esta zona' : 'Tu armario está vacío'}
                description="Fotografía tus prendas una a una y clasifícalas: luego arma conjuntos con ellas."
                action={<Button onClick={() => { setForm({ ...BLANK, zone: filter === 'all' ? 'torso' : filter }); setGarmentOpen(true); }}><Plus aria-hidden className="size-4" />Añadir prenda</Button>} className="py-6" />
            </Card>
          ) : (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((g) => (
                <motion.li key={g.id} variants={item}>
                  <Card as="article" padding="none" className="flex h-full flex-col overflow-hidden">
                    <div className="relative aspect-square bg-surface-variant">
                      {g.photoUrl
                        ? <img src={g.photoUrl} alt={g.name} loading="lazy" className="size-full object-cover" />
                        : <span className="flex size-full items-center justify-center text-on-surface-light"><Shirt aria-hidden className="size-10" strokeWidth={1.25} /></span>}
                      <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-label-md">{ZONE_LABEL[zoneOf(g)]}</span>
                      <Button variant="icon" size="sm" aria-label={`Eliminar ${g.name}`} onClick={() => setRemoving({ kind: 'garment', id: g.id, name: g.name })} className="absolute right-1 top-1 bg-background/80 hover:text-error-text">
                        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                      </Button>
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <div className="flex items-center gap-1">
                        <h3 className="min-w-0 flex-1 truncate text-label-lg">{g.name}</h3>
                        {g.isFavorite && <Star aria-label="Favorita" className="size-4 shrink-0 fill-warning text-warning" />}
                      </div>
                      <p className="truncate text-body-sm text-on-surface-light">
                        {[g.color, g.brand].filter(Boolean).join(' · ') || ' '}
                      </p>
                      <p className="text-body-sm text-on-surface-light">
                        <span className="font-mono tabular-nums">{g.timesWorn}</span> {g.timesWorn === 1 ? 'uso' : 'usos'}
                        {g.cost && g.timesWorn > 0 ? <> · <span className="font-mono tabular-nums">${Math.round(Number(g.cost) / g.timesWorn).toLocaleString('es-CO')}</span>/uso</> : null}
                      </p>
                      <Button variant="secondary" size="sm" block className="mt-auto" onClick={() => void wornGarment(g.id)}>Usar hoy</Button>
                    </div>
                  </Card>
                </motion.li>
              ))}
            </motion.ul>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-heading-sm">Mis conjuntos</h3>
            {outfits.length === 0 ? (
              <p className="text-body-md text-on-surface-light">
                {garments.length < 2 ? 'Añade al menos dos prendas para armar tu primer conjunto.' : 'Elige una prenda por zona y guarda tu primer conjunto.'}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {outfits.map((o) => {
                  const pieces = o.items.map((it) => byId.get(it.clothingItem.id)).filter((g): g is Garment => Boolean(g))
                    .sort((a, b) => ZONES.findIndex((z) => z.value === zoneOf(a)) - ZONES.findIndex((z) => z.value === zoneOf(b)));
                  return (
                    <li key={o.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
                      {o.photoUrl
                        ? <img src={o.photoUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                        : <span className="flex -space-x-3">{pieces.slice(0, 3).map((g) => <Thumb key={g.id} garment={g} className="size-12 ring-2 ring-background" />)}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label-lg">{o.name || 'Conjunto'}</p>
                        <p className="truncate text-body-sm text-on-surface-light">{pieces.map((g) => g.name).join(' + ') || 'Sin prendas'}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => void wornOutfit(o.id)}>Hoy</Button>
                      <Button variant="icon" size="sm" aria-label={`Eliminar ${o.name || 'conjunto'}`} onClick={() => setRemoving({ kind: 'outfit', id: o.id, name: o.name || 'este conjunto' })} className="-mr-1 hover:text-error-text">
                        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <ResponsiveDialog open={garmentOpen} onClose={() => setGarmentOpen(false)} title="Nueva prenda" className="md:max-w-[520px]">
        <form className="flex flex-col gap-4" onSubmit={(e) => void saveGarment(e)}>
          <PhotoPicker label="Foto de la prenda" value={form.photoUrl} onChange={(photoUrl) => setForm((f) => ({ ...f, photoUrl }))} />
          <Field label="Nombre"><Input value={form.name} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Camiseta azul" /></Field>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <ChipGroup label="Zona del cuerpo" options={ZONES.map((z) => ({ value: z.value, label: z.label }))} value={form.zone} onChange={(zone) => setForm((f) => ({ ...f, zone }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Color" help="Opcional"><Input value={form.color} maxLength={40} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="Azul marino" /></Field>
            <Field label="Marca" help="Opcional"><Input value={form.brand} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Zara, Nike…" /></Field>
          </div>
          <Field label="Precio (COP)" help="Opcional · para saber cuánto te cuesta cada uso"><Input type="number" inputMode="numeric" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} placeholder="50000" /></Field>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setGarmentOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!form.name.trim()} loading={saving}>Añadir</Button>
          </div>
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog open={outfitOpen} onClose={() => setOutfitOpen(false)} title="Armar conjunto" className="md:max-w-[640px]">
        <form className="flex flex-col gap-5" onSubmit={(e) => void saveOutfit(e)}>
          {ZONES.map((z) => {
            const options = garments.filter((g) => zoneOf(g) === z.value);
            if (!options.length) return null;
            return (
              <fieldset key={z.value} className="flex flex-col gap-2">
                <legend className="mb-1 text-label-lg">{z.label}{z.optional && <span className="text-on-surface-light"> · opcional</span>}</legend>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={z.label}>
                  {options.map((g) => {
                    const on = pick[z.value] === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={g.name}
                        onClick={() => setPick((p) => ({ ...p, [z.value]: on ? undefined : g.id }))}
                        className={cn('relative flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl border-2 p-1 text-label-md transition-colors', on ? 'border-primary bg-primary/[var(--lq-soft-alpha)]' : 'border-transparent hover:bg-surface-variant')}
                      >
                        <Thumb garment={g} className="size-16" />
                        <span className="w-full truncate text-center">{g.name}</span>
                        {on && <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary-strong text-on-primary"><Check aria-hidden className="size-3.5" strokeWidth={3} /></span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <Field label="Nombre del conjunto" help="Opcional"><Input value={outfitName} maxLength={80} onChange={(e) => setOutfitName(e.target.value)} placeholder="Ej. Viernes de oficina" /></Field>
          <div className="flex flex-col gap-2">
            <span className="text-label-lg">Foto con el conjunto puesto <span className="text-on-surface-light">· opcional</span></span>
            <PhotoPicker label="Foto del conjunto" value={outfitPhoto} onChange={setOutfitPhoto} />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setOutfitOpen(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={picked < 2} loading={saving}>{picked < 2 ? 'Elige 2 prendas' : 'Guardar conjunto'}</Button>
          </div>
        </form>
      </ResponsiveDialog>

      <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} title={removing ? `¿Eliminar «${removing.name}»?` : '¿Eliminar?'}>
        <p className="text-body-md text-on-surface">{removing?.kind === 'garment' ? 'Se quitará también de los conjuntos donde aparece.' : 'Las prendas siguen en tu armario.'}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => void confirmRemove()}>Eliminar</Button>
        </div>
      </Modal>
    </section>
  );
}
