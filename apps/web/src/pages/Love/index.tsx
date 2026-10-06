// Relaciones — RelationsDesktop.dc.html. Cuenta atrás de la próxima fecha, tu círculo,
// fechas especiales (agregar/eliminar) y regalos. Datos: love.service (sin cambios).
// Zona ambientada: un jardín vivo. Arriba, la escena: cielo de atardecer (de noche
// luna, estrellas y luciérnagas), la cerca, la tierra y el pasto que se mece con la
// brisa de tu cursor; tu pareja es el rosal del centro y cada fecha especial una
// flor que se abre más cuanto más cerca está. La cuenta atrás es un capullo que se
// abre; añadir una fecha hace brotar su flor. Pétalos que caen y luz de atardecer.
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Clock, Gift, Heart, HeartCrack, Plus, Sprout, Star, Trash2, UserPlus } from 'lucide-react';
import { springs } from '@/lib/motion/presets';
import { BreakupScene } from '@/components/love/Breakup';
import { PresenceAvatar } from '@/components/social/SocialBits';
import {
  apiError, breakUp, cancelPartnerInvite, getNetwork, invitePartner, respondPartnerInvite, timeAgo,
  type FriendItem, type PublicUser,
} from '@/services/network.service';
import type { Relationship, LoveDashboard, ImportantDate } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { AmbientLight, Particles, ZoneShell, useParticleBudget } from '@/components/ambience';
import { Bloom, GardenScene, NextBloom, bloomOf, type Species } from '@/components/love/Garden';
import { useToast } from '../../hooks/useToast';
import * as loveService from '../../services/love.service';
import api from '../../lib/api';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { E } from '@/components/ui/glyphs';
import { Badge, Button, Card, EmptyState, ErrorState, Field, IconChip, Input, Modal, SegmentedControl, StepItem, Switch, PageLoader, DatePicker } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { Lettering } from '@/components/layout/Lettering';

interface GiftIdea { id: string; title: string; description?: string; estimatedPrice?: number; isPurchased: boolean; forPerson?: string }

const money = (n: number) => `$${n.toLocaleString('es-CO')}`;

/** La API guarda el regalo como `name` y «para quién» en `occasion`; el precio llega como texto (Decimal). */
interface GiftIdeaRow { id: string; name: string; description?: string | null; estimatedPrice?: string | number | null; isPurchased: boolean; occasion?: string | null }
const fromApi = (g: GiftIdeaRow): GiftIdea => ({
  id: g.id,
  title: g.name,
  description: g.description ?? undefined,
  estimatedPrice: g.estimatedPrice != null ? Number(g.estimatedPrice) : undefined,
  isPurchased: g.isPurchased,
  forPerson: g.occasion ?? undefined,
});

function GiftWishlist({ relationshipId }: { relationshipId?: string }) {
  const toast = useToast();
  const [gifts, setGifts] = useState<GiftIdea[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', estimatedPrice: '', forPerson: '' });

  const load = useCallback(async () => {
    setState('loading');
    try {
      const q = relationshipId ? `?relationshipId=${relationshipId}` : '';
      const r = await api.get<GiftIdeaRow[]>(`/relationships/gift-ideas${q}`);
      setGifts((r.data ?? []).map(fromApi));
      setState('ready');
    } catch { setState('error'); }
  }, [relationshipId]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const r = await api.post<GiftIdeaRow>('/relationships/gift-ideas', {
        name: form.title.trim(),
        description: form.description || undefined,
        estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : undefined,
        occasion: form.forPerson.trim() || undefined,
        relationshipId: relationshipId || undefined,
      });
      setGifts((prev) => [fromApi(r.data), ...prev]);
      setShowForm(false);
      setForm({ title: '', description: '', estimatedPrice: '', forPerson: '' });
    } catch { toast.error('No se pudo guardar la idea'); }
    finally { setSaving(false); }
  }

  async function togglePurchased(gift: GiftIdea) {
    setGifts((prev) => prev.map((g) => (g.id === gift.id ? { ...g, isPurchased: !g.isPurchased } : g)));
    try { await api.patch(`/relationships/gift-ideas/${gift.id}`, { isPurchased: !gift.isPurchased }); }
    catch { setGifts((prev) => prev.map((g) => (g.id === gift.id ? { ...g, isPurchased: gift.isPurchased } : g))); toast.error('No se pudo actualizar'); }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/relationships/gift-ideas/${id}`);
      setGifts((prev) => prev.filter((g) => g.id !== id));
    } catch { toast.error('No se pudo eliminar'); }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="love-gifts">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="love-gifts" className="text-heading-lg">Ideas de regalo</h2>
        <Button size="md" onClick={() => setShowForm(true)}><Plus aria-hidden className="size-4" />Idea</Button>
      </div>

      {state === 'loading' ? (
        <PageLoader label="Preparando tus detalles…" words={LOADING_COPY.loveIdeas} size="sm" />
      ) : state === 'error' ? (
        <ErrorState title="No pudimos cargar tus ideas" onRetry={() => void load()} />
      ) : gifts.length === 0 ? (
        <Card variant="elevated" padding="lg"><EmptyState icon={Gift} tone="forest" title="Sin ideas de regalo" description="Guarda ideas cuando se te ocurran y márcalas al comprarlas." action={<Button onClick={() => setShowForm(true)}><Plus aria-hidden className="size-4" />Añadir idea</Button>} className="py-6" /></Card>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {gifts.map((g) => (
            <motion.li key={g.id} variants={item}>
              <Card as="article" padding="lg" interactive aria-labelledby={`g-${g.id}`} className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  {g.forPerson ? <Badge variant="forest">Para {g.forPerson}</Badge> : <span />}
                  <div className="flex items-center gap-1">
                    {g.estimatedPrice ? <span className="font-mono text-label-lg tabular-nums">{money(g.estimatedPrice)}</span> : null}
                    <Button variant="icon" size="sm" aria-label={`Eliminar ${g.title}`} onClick={() => void handleDelete(g.id)} className="-mr-2"><Trash2 aria-hidden className="size-4" strokeWidth={1.75} /></Button>
                  </div>
                </div>
                <h3 id={`g-${g.id}`} className="text-heading-sm">{g.title}</h3>
                {g.description && <p className="text-body-sm text-on-surface-light">{g.description}</p>}
                <StepItem checked={g.isPurchased} onToggle={() => void togglePurchased(g)} className="mt-auto -mx-2">{g.isPurchased ? 'Comprado' : 'Marcar como comprado'}</StepItem>
              </Card>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva idea de regalo">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <Field label="Nombre del regalo"><Input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Clase de cerámica para dos" /></Field>
          <Field label="Descripción (opcional)"><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio estimado (COP)"><Input type="number" inputMode="numeric" value={form.estimatedPrice} onChange={(e) => setForm((f) => ({ ...f, estimatedPrice: e.target.value }))} placeholder="0" /></Field>
            <Field label="Para quién"><Input value={form.forPerson} onChange={(e) => setForm((f) => ({ ...f, forPerson: e.target.value }))} placeholder="Nombre" /></Field>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!form.title.trim()} loading={saving}>Guardar idea</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/** Versión corta para la estaca del rosal. */
function togetherShort(createdAt: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
  const years = Math.floor(days / 365);
  const months = Math.floor(days / 30);
  if (years > 0) return `${years} año${years > 1 ? 's' : ''} juntos`;
  if (months > 0) return `${months} mes${months > 1 ? 'es' : ''} juntos`;
  return `${days} día${days === 1 ? '' : 's'} juntos`;
}
/** Mismo orden de especies que la escena: la flor de cada fila en la lista. */
const LIST_SPECIES: Species[] = ['tulipan', 'margarita', 'rosa', 'campanilla'];

function timeTogetherText(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  if (years > 0) return `${years} año${years > 1 ? 's' : ''}, ${months % 12} mes${months % 12 !== 1 ? 'es' : ''} y ${days % 30} días juntos`;
  if (months > 0) return `${months} mes${months > 1 ? 'es' : ''} y ${days % 30} días juntos`;
  return `${days} días juntos`;
}

const DATE_ICON_OPTIONS = [
  { id: 'heart', label: 'Corazón', icon: Heart },
  { id: 'gift', label: 'Regalo', icon: Gift },
  { id: 'calendar', label: 'Fecha', icon: CalendarDays },
  { id: 'star', label: 'Especial', icon: Star },
];

function AddDateModal({ relationshipId, onClose, onSave }: { relationshipId: string; onClose: () => void; onSave: (r: Relationship) => void }) {
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(true);
  const [iconKey, setIconKey] = useState('heart');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const r = await loveService.addImportantDate(relationshipId, { label, date, isRecurring, emoji: iconKey });
      onSave(r);
      toast.success('Fecha agregada');
    } catch { toast.error('Error al agregar'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Agregar fecha especial">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Nombre de la fecha"><Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aniversario" /></Field>
        <fieldset>
          <legend className="mb-2 text-label-lg text-on-surface">Ícono</legend>
          <div role="radiogroup" aria-label="Ícono de la fecha" className="grid grid-cols-4 gap-2">
            {DATE_ICON_OPTIONS.map((o) => (
              <button
                key={o.id} type="button" role="radio" aria-checked={iconKey === o.id} aria-label={o.label} title={o.label} onClick={() => setIconKey(o.id)}
                className={cn('flex min-h-11 items-center justify-center rounded-md border transition-colors', iconKey === o.id ? 'border-primary/50 bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:border-primary/40')}
              ><o.icon aria-hidden className="size-5" strokeWidth={1.75} /></button>
            ))}
          </div>
        </fieldset>
        <Field label="Fecha"><DatePicker value={date} onChange={setDate} /></Field>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span id="love-rec" className="text-body-md">Recurrente anual</span>
          <Switch checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} aria-labelledby="love-rec" />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={!label.trim()} loading={saving}>Agregar</Button>
        </div>
      </form>
    </Modal>
  );
}

function SetupModal({ onClose, onSave, existing }: { onClose: () => void; onSave: (r: Relationship) => void; existing?: Relationship | null }) {
  const existingStartDate = (existing?.notes as string | undefined)?.match(/startDate:(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().split('T')[0];
  const [name, setName] = useState(existing?.name ?? '');
  const [startDate, setStartDate] = useState(existingStartDate);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    try {
      // Editar actualiza el mismo jardín (crear otro duplicaría la pareja).
      const notes = startDate ? `startDate:${startDate}` : undefined;
      const relationship = existing
        ? await loveService.updateRelationship(existing.id, { name: name.trim(), ...(notes ? { notes } : {}) })
        : await loveService.createRelationship({ name: name.trim(), type: 'romantic', isPartner: true, notes });
      onSave(relationship);
      toast.success(name.trim() ? '¡Relación configurada!' : 'Nombre eliminado');
    } catch { toast.error('Error al configurar'); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="Configura tu jardín">
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="-mt-2 text-body-sm text-on-surface-light">Define los datos que quieres recordar en este espacio personal. Puedes dejar el nombre vacío si prefieres que esta zona se mantenga privada.</p>
        <Field label="Nombre de tu pareja (opcional)"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Valentina" /></Field>
        <Field label="Fecha de inicio"><DatePicker value={startDate} onChange={setStartDate} /></Field>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving}>Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

/** El jardín con lo que añade la red social: con quién se comparte y las invitaciones. */
type GardenDashboard = LoveDashboard & {
  linkStatus?: 'PENDING' | 'LINKED' | null;
  partnerUser?: (PublicUser & { online: boolean; zone: string | null; lastSeen: string | null }) | null;
  incomingInvites?: Array<{ relationshipId: string; from: PublicUser; createdAt: string }>;
};

/** Elegir a la pareja entre tus amigos de Noutlife para compartir el jardín. */
function PartnerPicker({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (open) getNetwork().then(setFriends).catch(() => setFriends([])); }, [open]);
  async function invite(f: FriendItem) {
    setBusy(f.friend.id);
    try { await invitePartner(f.friend.id); toast.success(`Invitación enviada a ${f.friend.displayName.split(' ')[0]}`); onSent(); onClose(); }
    catch (e) { toast.error(apiError(e, 'No se pudo enviar la invitación')); }
    finally { setBusy(null); }
  }
  return (
    <Modal open={open} onClose={onClose} title="¿Tu pareja usa Noutlife?">
      <p className="-mt-2 text-body-sm text-on-surface-light">Elige a tu pareja entre tus amigos. Si acepta, cuidarán juntos este jardín: fechas, flores y recuerdos.</p>
      {friends === null ? <PageLoader size="sm" /> : friends.length === 0 ? (
        <p className="text-body-md text-on-surface-light">Primero agrégala como amiga en <Link to="/social?tab=amigos" className="text-primary-text underline">tu libreta de amigos</Link>.</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
          {friends.map((f) => (
            <li key={f.friendshipId} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2 last:border-0">
              <PresenceAvatar user={f.friend} online={f.friend.online} size={44} />
              <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{f.friend.displayName}</span><span className="text-body-sm text-on-surface-light">@{f.friend.username}</span></span>
              <Button size="sm" variant="secondary" loading={busy === f.friend.id} onClick={() => void invite(f)}><Heart aria-hidden className="size-4" />Invitar</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Alguien quiere compartir su jardín contigo: aceptar reemplaza tu jardín actual. */
function InviteCard({ invite, hasGarden, onDone }: { invite: NonNullable<GardenDashboard['incomingInvites']>[number]; hasGarden: boolean; onDone: (linked: boolean) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const first = invite.from.displayName.split(' ')[0];
  async function answer(accept: boolean) {
    setBusy(accept ? 'yes' : 'no');
    try { const r = await respondPartnerInvite(invite.relationshipId, accept); toast.success(accept ? `Ahora comparten el jardín con ${first}` : 'Invitación rechazada'); onDone(r.linked); }
    catch (e) { toast.error(apiError(e, 'No se pudo responder')); setBusy(null); }
  }
  return (
    <motion.div layout initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={springs.heavy}>
      <Card variant="elevated" padding="lg" className="flex flex-wrap items-center gap-4 border-error/30">
        <span className="relative">
          <PresenceAvatar user={invite.from} size={56} />
          <motion.span aria-hidden animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-error-text text-background">
            <Heart className="size-3.5 fill-current" />
          </motion.span>
        </span>
        <div className="min-w-0 flex-[1_1_240px]">
          <p className="text-heading-sm">{invite.from.displayName} quiere compartir su jardín contigo</p>
          <p className="text-body-sm text-on-surface-light">{hasGarden ? 'Si aceptas, tu jardín actual se reemplaza por el compartido.' : 'Cuidarán juntos fechas especiales, flores y recuerdos.'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" loading={busy === 'no'} onClick={() => void answer(false)}>Ahora no</Button>
          <Button loading={busy === 'yes'} onClick={() => (hasGarden ? setConfirm(true) : void answer(true))}><Heart aria-hidden className="size-4" />Aceptar</Button>
        </div>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Compartir el jardín?">
        <p className="text-body-md text-on-surface">Tu jardín actual (sus fechas e ideas de regalo) se borra y pasas al jardín de {first}.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(false)}>Cancelar</Button>
          <Button size="md" loading={busy === 'yes'} onClick={() => { setConfirm(false); void answer(true); }}>Sí, compartir</Button>
        </div>
      </Modal>
    </motion.div>
  );
}

function daysUntil(d: ImportantDate) {
  const target = new Date(d.date);
  if (d.isRecurring) { target.setFullYear(new Date().getFullYear()); if (target < new Date()) target.setFullYear(target.getFullYear() + 1); }
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

export default function LovePage() {
  const toast = useToast();
  const [dashboard, setDashboard] = useState<GardenDashboard | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [breakupOpen, setBreakupOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [showSetup, setShowSetup] = useState(false);
  const [showAddDate, setShowAddDate] = useState(false);
  const [tab, setTab] = useState<'jardin' | 'regalos'>('jardin');
  /** Flor recién plantada (brota delante de ti) y fila resaltada al tocar una flor. */
  const [sprout, setSprout] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const budget = useParticleBudget();

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      setDashboard(await loveService.fetchLoveDashboard());
      setState('ready');
    } catch { if (!silent) setState('error'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleRelationshipSaved(r: Relationship) {
    setDashboard((prev) => ({ ...prev, relationship: r, nextImportantDate: prev?.nextImportantDate ?? null }));
    setShowSetup(false);
    void load(true);
  }

  async function handleDeleteDate(dateId: string) {
    if (!dashboard?.relationship) return;
    try {
      await loveService.deleteImportantDate(dashboard.relationship.id, dateId);
      toast.success('Fecha eliminada');
      void load(true);
    } catch { toast.error('Error al eliminar'); }
  }

  const rel = dashboard?.relationship;
  const startDate = rel?.notes?.match(/startDate:(\S+)/)?.[1];
  const next = dashboard?.nextImportantDate;
  const dates = ((rel?.importantDates ?? []) as ImportantDate[]).map((d) => ({ d, days: daysUntil(d) })).sort((a, b) => a.days - b.days);
  const partnerUser = dashboard?.linkStatus === 'LINKED' ? dashboard.partnerUser ?? null : null;
  const partnerName = partnerUser ? partnerUser.displayName : rel?.name || 'Tu pareja';
  const initials = partnerName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '♥';
  const invites = dashboard?.incomingInvites ?? [];

  async function endGarden() {
    setEnding(true);
    try {
      await breakUp();
      setEndOpen(false);
      setBreakupOpen(true);
      setDashboard({ relationship: null, nextImportantDate: null, incomingInvites: invites });
    } catch (e) { toast.error(apiError(e, 'No se pudo cerrar el jardín')); }
    finally { setEnding(false); }
  }
  async function cancelInvite() {
    try { await cancelPartnerInvite(); toast.success('Invitación cancelada'); void load(true); }
    catch { toast.error('No se pudo cancelar'); }
  }

  return (
    <ZoneShell
      zone="love"
      contentClassName="gap-6 md:gap-8"
      ambience={(
        // Luz de atardecer que cambia muy despacio.
        <span className="lq-amb-wander absolute -right-[10%] top-[-12%] block h-[36rem] w-[60%] [--d:34s]">
          <AmbientLight tone="warning" alpha={0.14} darkAlpha={0.05} d={18} className="inset-0" />
          <AmbientLight tone="error" alpha={0.07} darkAlpha={0.04} d={23} className="inset-[18%]" />
        </span>
      )}
      view={(
        <>
          {/* De día caen pétalos; de noche flotan luciérnagas. */}
          <span className="absolute inset-0 block dark:hidden">
            <Particles count={budget(9)} kind="fall" seed={11} y={[-12, 10]} duration={[14, 22]} alpha={[0.35, 0.6]} size={[6, 10]} sx={[20, 60]} h={[420, 720]}
              render={(sz, i) => <span className={`lq-petal block ${i % 2 ? 'bg-error/40' : 'bg-warning/40'}`} style={{ width: sz, height: sz * 0.7 }} />} />
          </span>
          <span className="absolute inset-0 hidden dark:block">
            <Particles count={budget(12)} kind="glow" seed={5} y={[20, 90]} duration={[3.5, 6]} alpha={[0.5, 0.9]} size={[3, 5]} sx={[-10, 10]} sy={[-14, 6]}
              render={(sz) => <span className="block rounded-full bg-warning shadow-[0_0_10px_2px_rgb(var(--lq-warning)/.6)]" style={{ width: sz, height: sz }} />} />
          </span>
        </>
      )}
    >
      <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <span className="text-label-lg text-primary-text">Relaciones</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text="Jardín del corazón" /></h1>
          <p className="text-body-lg text-on-surface-light">Cuida las relaciones y los momentos que más te importan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SageContextButton message="¿Cómo puedo cuidar mejor las relaciones que importan?" label="Consejo del Sabio" />
          {!rel && state === 'ready' && <Button onClick={() => setShowSetup(true)}>Configurar</Button>}
        </div>
      </motion.section>

      <AnimatePresence initial={false}>
        {invites.map((inv) => (
          <InviteCard key={inv.relationshipId} invite={inv} hasGarden={Boolean(rel)} onDone={() => void load(true)} />
        ))}
      </AnimatePresence>

      <motion.div variants={item} className="w-full max-w-[300px]">
        <SegmentedControl options={[{ value: 'jardin', label: 'Jardín' }, { value: 'regalos', label: 'Regalos' }]} value={tab} onChange={setTab} label="Vista" />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6 md:gap-8">
          {tab === 'regalos' ? <GiftWishlist relationshipId={rel?.id} /> : state === 'loading' ? (
            <PageLoader label="Entrando al jardín…" words={LOADING_COPY.loveDashboard} />
          ) : state === 'error' ? (
            <ErrorState title="No pudimos cargar tu jardín" onRetry={() => void load()} />
          ) : !rel ? (
            <>
              {/* El jardín vacío: tierra y pasto esperando su primera flor */}
              <GardenScene dates={[]} />
              <Card variant="elevated" padding="lg">
                <EmptyState icon={Heart} tone="error" title="Tu jardín espera" description="Configura este espacio para guardar los momentos y fechas que quieres cuidar."
                  action={(
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setShowSetup(true)}>Configurar mi jardín</Button>
                      <Button variant="secondary" onClick={() => setPickerOpen(true)}><UserPlus aria-hidden className="size-4" />Mi pareja usa Noutlife</Button>
                    </div>
                  )} className="py-6" />
              </Card>
            </>
          ) : (
            <>
              <GardenScene
                partner={{ name: partnerName, together: startDate ? togetherShort(`${startDate}T00:00:00`) : undefined }}
                dates={dates.map(({ d, days }) => ({ id: d.id, label: d.label, days }))}
                fresh={sprout}
                onPick={(id) => { setPicked(id); document.getElementById(`love-date-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => setPicked(null), 1800); }}
              />
              {next ? (
                <Card as="section" variant="elevated" padding="lg" aria-label="Próxima fecha especial" className="flex flex-wrap items-center gap-6 md:gap-8 md:p-8">
                  {/* El capullo se abre a medida que se acerca la fecha */}
                  <NextBloom days={next.daysUntil} className="h-32 w-20 shrink-0 md:h-36" />
                  <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
                    <span className="text-label-lg text-primary-text">Próxima fecha especial</span>
                    <h2 className="text-heading-lg md:text-display-sm">{next.label}</h2>
                    <p className="text-body-md text-on-surface-light">{new Date(next.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  <p className="flex flex-col items-start">
                    <span className="font-mono text-display-sm font-bold tabular-nums md:text-display-md">{next.daysUntil}</span>
                    <span className="text-body-sm text-on-surface-light">{next.daysUntil === 1 ? 'día' : 'días'} para la fecha</span>
                  </p>
                  <Button variant="secondary" onClick={() => setTab('regalos')}><Gift aria-hidden className="size-4" />Ideas de regalo</Button>
                </Card>
              ) : (
                <Card variant="base" padding="md" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-body-md text-on-surface">Aún no hay una fecha próxima. Agrega una para ver la cuenta atrás.</p>
                  <Button variant="secondary" size="md" onClick={() => setShowAddDate(true)}><Plus aria-hidden className="size-4" />Agregar fecha</Button>
                </Card>
              )}

              <section className="flex flex-col gap-6" aria-labelledby="love-circle">
                <h2 id="love-circle" className="text-heading-lg">Tu círculo</h2>
                <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <li>
                    <Card as="article" padding="lg" interactive className="flex h-full flex-col gap-4">
                      <div className="flex items-center gap-4">
                        {partnerUser ? (
                          <Link to={`/u/${encodeURIComponent(partnerUser.username)}`} aria-label={`Perfil de ${partnerName}`}>
                            <PresenceAvatar user={partnerUser} online={partnerUser.online} size={56} />
                          </Link>
                        ) : (
                          <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-error/[var(--lq-soft-alpha)] text-heading-sm text-error-text">{initials}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-heading-sm">{partnerName}</h3>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="error">Pareja</Badge>
                            {partnerUser && <Badge variant="success">Jardín compartido</Badge>}
                          </div>
                          {partnerUser && (
                            <p className="mt-1 text-body-sm text-on-surface-light">
                              {partnerUser.online ? (partnerUser.zone ? `En línea · en ${partnerUser.zone}` : 'En línea') : partnerUser.lastSeen ? `Activo ${timeAgo(partnerUser.lastSeen)}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* TODO(api): el prototipo muestra "Conexión %" y último contacto; la API no los ofrece. Se muestra el tiempo juntos. */}
                      <p className="flex items-center gap-2 text-body-sm text-on-surface"><Clock aria-hidden className="size-4 text-on-surface-light" />{startDate ? timeTogetherText(`${startDate}T00:00:00`) : 'Agrega una fecha de inicio'}</p>
                      {dashboard?.linkStatus === 'PENDING' && (
                        <p className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-light">
                          Invitación enviada. Esperando respuesta.
                          <button type="button" onClick={() => void cancelInvite()} className="text-primary-text underline-offset-4 hover:underline">Cancelar</button>
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowSetup(true)}>Editar jardín</Button>
                        {!partnerUser && dashboard?.linkStatus !== 'PENDING' && (
                          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}><UserPlus aria-hidden className="size-4" />Vincular en Noutlife</Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-error-text" onClick={() => setEndOpen(true)}><HeartCrack aria-hidden className="size-4" />Terminar o cambiar</Button>
                      </div>
                    </Card>
                  </li>
                  <li>
                    <button type="button" onClick={() => setShowAddDate(true)} className="lq-lift flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-transparent text-on-surface">
                      <IconChip icon={Sprout} tone="success" />
                      <span className="text-label-lg">Añadir fecha especial</span>
                    </button>
                  </li>
                </ul>
              </section>

              <Card as="section" padding="lg" aria-labelledby="love-dates" className="flex flex-col gap-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 id="love-dates" className="text-heading-sm">Fechas especiales</h2>
                  <Button variant="secondary" size="md" onClick={() => setShowAddDate(true)}><Plus aria-hidden className="size-4" />Agregar</Button>
                </div>
                {dates.length === 0 ? (
                  <p className="py-4 text-body-md text-on-surface-light">Sin fechas especiales aún.</p>
                ) : (
                  <>
                  <ul className="mt-2">
                    {dates.map(({ d, days }, i) => (
                      <li key={d.id} id={`love-date-${d.id}`} className={cn('flex min-h-[72px] items-center gap-4 rounded-xl border-b border-border px-2 transition-colors duration-700 last:border-0', picked === d.id && 'bg-error/[var(--lq-soft-alpha)]')}>
                        <IconChip tone={i === 0 && days >= 0 ? 'error' : 'primary'} size="sm">
                          <E e={d.emoji ?? '💝'} s={20} />
                        </IconChip>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-label-lg">
                            {/* Su flor en el jardín */}
                            {i < 7 && <svg aria-hidden="true" viewBox="0 0 52 52" className="hidden size-5 shrink-0 sm:block"><Bloom species={LIST_SPECIES[i % 4]} open={Math.max(0.5, bloomOf(days))} /></svg>}
                            <span className="truncate">{d.label}</span>
                          </p>
                          <p className="text-body-sm text-on-surface-light">{new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}{d.isRecurring ? ' · anual' : ''}</p>
                        </div>
                        <Badge variant={i === 0 && days >= 0 ? 'error' : 'neutral'}><span className="font-mono tabular-nums">{days >= 0 ? `en ${days} d` : `hace ${-days} d`}</span></Badge>
                        <Button variant="icon" aria-label={`Eliminar ${d.label}`} onClick={() => void handleDeleteDate(d.id)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                      </li>
                    ))}
                  </ul>
                  </>
                )}
              </Card>

              {rel.notes && !rel.notes.startsWith('startDate:') && (
                <Card as="section" padding="lg" aria-labelledby="love-notes" className="flex flex-col gap-2">
                  <h2 id="love-notes" className="text-heading-sm">Notas privadas</h2>
                  <p className="text-body-md">{rel.notes}</p>
                </Card>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <PartnerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSent={() => void load(true)} />
      <Modal open={endOpen} onClose={() => setEndOpen(false)} title="¿Terminar o cambiar de pareja?">
        <p className="text-body-md text-on-surface">
          El jardín se reinicia por completo: se borran la pareja, sus fechas especiales y sus ideas de regalo.
          {partnerUser ? ` También se cierra para ${partnerName.split(' ')[0]}.` : ''} Después puedes empezar uno nuevo.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setEndOpen(false)}>Cancelar</Button>
          <Button variant="danger" size="md" loading={ending} onClick={() => void endGarden()}><HeartCrack aria-hidden className="size-4" />Reiniciar jardín</Button>
        </div>
      </Modal>
      <BreakupScene
        open={breakupOpen}
        onClose={() => { setBreakupOpen(false); void load(true); }}
        onRestart={() => { setBreakupOpen(false); setShowSetup(true); void load(true); }}
      />
      {showSetup && <SetupModal onClose={() => setShowSetup(false)} onSave={handleRelationshipSaved} existing={dashboard?.relationship} />}
      {showAddDate && rel && <AddDateModal relationshipId={rel.id} onClose={() => setShowAddDate(false)} onSave={(r) => {
        const before = new Set(((rel.importantDates ?? []) as ImportantDate[]).map((d) => d.id));
        const added = ((r.importantDates ?? []) as ImportantDate[]).find((d) => !before.has(d.id));
        if (added) setSprout(added.id);
        setDashboard((prev) => ({ ...prev!, relationship: r })); setShowAddDate(false); void load(true);
      }} />}
    </ZoneShell>
  );
}
