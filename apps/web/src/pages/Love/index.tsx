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
import type { Relationship, LoveDashboard, ImportantDate } from '@noutlife/shared';
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
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const es = {
  giftSaveFail: 'No se pudo guardar la idea',
  updateFail: 'No se pudo actualizar',
  deleteFail: 'No se pudo eliminar',
  giftsTitle: 'Ideas de regalo',
  idea: 'Idea',
  loadingGifts: 'Preparando tus detalles…',
  giftsLoadFail: 'No pudimos cargar tus ideas',
  noGifts: 'Sin ideas de regalo',
  noGiftsDesc: 'Guarda ideas cuando se te ocurran y márcalas al comprarlas.',
  addIdea: 'Añadir idea',
  forPerson: (name: string): string => `Para ${name}`,
  deleteAria: (title: string): string => `Eliminar ${title}`,
  bought: 'Comprado',
  markBought: 'Marcar como comprado',
  giftModal: 'Nueva idea de regalo',
  giftName: 'Nombre del regalo',
  giftNamePh: 'Clase de cerámica para dos',
  descOpt: 'Descripción (opcional)',
  estPrice: 'Precio estimado (COP)',
  forWhom: 'Para quién',
  namePh: 'Nombre',
  cancel: 'Cancelar',
  saveIdea: 'Guardar idea',
  yearsTogether: (n: number): string => `${n} ${n > 1 ? 'años' : 'año'} juntos`,
  monthsTogether: (n: number): string => `${n} ${n > 1 ? 'meses' : 'mes'} juntos`,
  daysTogether: (n: number): string => `${n} ${n === 1 ? 'día' : 'días'} juntos`,
  yearsMonthsDays: (y: number, m: number, d: number): string => `${y} ${y > 1 ? 'años' : 'año'}, ${m} ${m !== 1 ? 'meses' : 'mes'} y ${d} días juntos`,
  monthsDays: (m: number, d: number): string => `${m} ${m > 1 ? 'meses' : 'mes'} y ${d} días juntos`,
  daysOnly: (d: number): string => `${d} días juntos`,
  iconHeart: 'Corazón',
  iconGift: 'Regalo',
  iconDate: 'Fecha',
  iconSpecial: 'Especial',
  dateAdded: 'Fecha agregada',
  dateAddFail: 'Error al agregar',
  addDateTitle: 'Agregar fecha especial',
  dateName: 'Nombre de la fecha',
  dateNamePh: 'Aniversario',
  icon: 'Ícono',
  iconGroup: 'Ícono de la fecha',
  date: 'Fecha',
  yearlyRecurring: 'Recurrente anual',
  add: 'Agregar',
  setupDone: '¡Relación configurada!',
  nameRemoved: 'Nombre eliminado',
  setupFail: 'Error al configurar',
  gardenTitle: 'Configura tu jardín',
  gardenDesc: 'Define los datos que quieres recordar en este espacio personal. Puedes dejar el nombre vacío si prefieres que esta zona se mantenga privada.',
  partnerName: 'Nombre de tu pareja (opcional)',
  partnerNamePh: 'Ej. Valentina',
  startDate: 'Fecha de inicio',
  save: 'Guardar',
  inviteSent: (name: string): string => `Invitación enviada a ${name}`,
  inviteFail: 'No se pudo enviar la invitación',
  pickerTitle: '¿Tu pareja usa Noutlife?',
  pickerDesc: 'Elige a tu pareja entre tus amigos. Si acepta, cuidarán juntos este jardín: fechas, flores y recuerdos.',
  addFirstA: 'Primero agrégala como amiga en ',
  directory: 'tu directorio',
  invite: 'Invitar',
  nowShared: (first: string): string => `Ahora comparten el jardín con ${first}`,
  inviteDeclined: 'Invitación rechazada',
  replyFail: 'No se pudo responder',
  wantsShare: (name: string): string => `${name} quiere compartir su jardín contigo`,
  replaceNote: 'Si aceptas, tu jardín actual se reemplaza por el compartido.',
  togetherNote: 'Cuidarán juntos fechas especiales, flores y recuerdos.',
  notNow: 'Ahora no',
  accept: 'Aceptar',
  shareTitle: '¿Compartir el jardín?',
  shareBody: (first: string): string => `Tu jardín actual (sus fechas e ideas de regalo) se borra y pasas al jardín de ${first}.`,
  yesShare: 'Sí, compartir',
  relationships: 'Relaciones',
  titleGarden: 'Jardín del corazón',
  tagline: 'Cuida las relaciones y los momentos que más te importan.',
  sageLabel: 'Consejo del Sabio',
  sageQ: '¿Cómo puedo cuidar mejor las relaciones que importan?',
  setup: 'Configurar',
  view: 'Vista',
  garden: 'Jardín',
  gifts: 'Regalos',
  enteringGarden: 'Entrando al jardín…',
  gardenFail: 'No pudimos cargar tu jardín',
  waiting: 'Tu jardín espera',
  waitingDesc: 'Configura este espacio para guardar los momentos y fechas que quieres cuidar.',
  setupMine: 'Configurar mi jardín',
  linkPartner: 'Mi pareja usa Noutlife',
  nextSpecial: 'Próxima fecha especial',
  dayCount: (n: number): string => `${n === 1 ? 'día' : 'días'} para la fecha`,
  giftIdeas: 'Ideas de regalo',
  noUpcoming: 'Aún no hay una fecha próxima. Agrega una para ver la cuenta atrás.',
  addDate: 'Agregar fecha',
  circle: 'Tu círculo',
  partnerProfile: (name: string): string => `Perfil de ${name}`,
  partnerFallback: 'Tu pareja',
  partner: 'Pareja',
  sharedGarden: 'Jardín compartido',
  onlineIn: (zone: string): string => `En línea · en ${zone}`,
  online: 'En línea',
  activeAgo: (ago: string): string => `Activo ${ago}`,
  addStartDate: 'Agrega una fecha de inicio',
  inviteWaiting: 'Invitación enviada. Esperando respuesta.',
  cancelBtn: 'Cancelar',
  editGarden: 'Editar jardín',
  linkOn: 'Vincular en Noutlife',
  endOrChange: 'Terminar o cambiar',
  addSpecialDate: 'Añadir fecha especial',
  specialDates: 'Fechas especiales',
  add2: 'Agregar',
  noDates: 'Sin fechas especiales aún.',
  deleteDateAria: (label: string): string => `Eliminar ${label}`,
  yearly: ' · anual',
  inDays: (d: number): string => `en ${d} d`,
  daysAgo: (d: number): string => `hace ${d} d`,
  privateNotes: 'Notas privadas',
  dateDeleted: 'Fecha eliminada',
  dateDeleteFail: 'Error al eliminar',
  inviteCancelled: 'Invitación cancelada',
  cancelFail: 'No se pudo cancelar',
  closeFail: 'No se pudo cerrar el jardín',
  endTitle: '¿Terminar o cambiar de pareja?',
  endBody: 'El jardín se reinicia por completo: se borran la pareja, sus fechas especiales y sus ideas de regalo.',
  alsoCloses: (first: string): string => ` También se cierra para ${first}.`,
  afterwards: 'Después puedes empezar uno nuevo.',
  restart: 'Reiniciar jardín',
  viewAria: 'Vista',
  nextAria: 'Próxima fecha especial',
};

const en: typeof es = {
  giftSaveFail: 'Could not save the idea',
  updateFail: 'Could not update',
  deleteFail: 'Could not delete',
  giftsTitle: 'Gift ideas',
  idea: 'Idea',
  loadingGifts: 'Preparing your details…',
  giftsLoadFail: 'We could not load your ideas',
  noGifts: 'No gift ideas yet',
  noGiftsDesc: 'Save ideas when they come to you and mark them when you buy them.',
  addIdea: 'Add idea',
  forPerson: (name: string): string => `For ${name}`,
  deleteAria: (title: string): string => `Delete ${title}`,
  bought: 'Bought',
  markBought: 'Mark as bought',
  giftModal: 'New gift idea',
  giftName: 'Gift name',
  giftNamePh: 'Pottery class for two',
  descOpt: 'Description (optional)',
  estPrice: 'Estimated price (COP)',
  forWhom: 'For whom',
  namePh: 'Name',
  cancel: 'Cancel',
  saveIdea: 'Save idea',
  yearsTogether: (n: number): string => `${n} ${n > 1 ? 'years' : 'year'} together`,
  monthsTogether: (n: number): string => `${n} ${n > 1 ? 'months' : 'month'} together`,
  daysTogether: (n: number): string => `${n} ${n === 1 ? 'day' : 'days'} together`,
  yearsMonthsDays: (y: number, m: number, d: number): string => `${y} ${y > 1 ? 'years' : 'year'}, ${m} ${m !== 1 ? 'months' : 'month'} and ${d} days together`,
  monthsDays: (m: number, d: number): string => `${m} ${m > 1 ? 'months' : 'month'} and ${d} days together`,
  daysOnly: (d: number): string => `${d} days together`,
  iconHeart: 'Heart',
  iconGift: 'Gift',
  iconDate: 'Date',
  iconSpecial: 'Special',
  dateAdded: 'Date added',
  dateAddFail: 'Could not add',
  addDateTitle: 'Add special date',
  dateName: 'Date name',
  dateNamePh: 'Anniversary',
  icon: 'Icon',
  iconGroup: 'Date icon',
  date: 'Date',
  yearlyRecurring: 'Yearly recurring',
  add: 'Add',
  setupDone: 'Relationship set up!',
  nameRemoved: 'Name removed',
  setupFail: 'Could not set up',
  gardenTitle: 'Set up your garden',
  gardenDesc: 'Define the details you want to remember in this personal space. You can leave the name empty if you prefer to keep this area private.',
  partnerName: "Partner's name (optional)",
  partnerNamePh: 'E.g. Valentina',
  startDate: 'Start date',
  save: 'Save',
  inviteSent: (name: string): string => `Invitation sent to ${name}`,
  inviteFail: 'Could not send the invitation',
  pickerTitle: 'Does your partner use NoutLife?',
  pickerDesc: 'Pick your partner from your friends. If they accept, you will look after this garden together: dates, flowers and memories.',
  addFirstA: 'First add them as a friend in ',
  directory: 'your directory',
  invite: 'Invite',
  nowShared: (first: string): string => `You now share the garden with ${first}`,
  inviteDeclined: 'Invitation declined',
  replyFail: 'Could not reply',
  wantsShare: (name: string): string => `${name} wants to share their garden with you`,
  replaceNote: 'If you accept, your current garden is replaced by the shared one.',
  togetherNote: 'You will look after special dates, flowers and memories together.',
  notNow: 'Not now',
  accept: 'Accept',
  shareTitle: 'Share the garden?',
  shareBody: (first: string): string => `Your current garden (its dates and gift ideas) is erased and you move to ${first}'s garden.`,
  yesShare: 'Yes, share',
  relationships: 'Relationships',
  titleGarden: 'Garden of the heart',
  tagline: 'Look after the relationships and moments you care about most.',
  sageLabel: "The Sage's tip",
  sageQ: 'How can I better look after the relationships that matter?',
  setup: 'Set up',
  view: 'View',
  garden: 'Garden',
  gifts: 'Gifts',
  enteringGarden: 'Entering the garden…',
  gardenFail: 'We could not load your garden',
  waiting: 'Your garden is waiting',
  waitingDesc: 'Set up this space to keep the moments and dates you want to look after.',
  setupMine: 'Set up my garden',
  linkPartner: 'My partner uses NoutLife',
  nextSpecial: 'Next special date',
  dayCount: (n: number): string => `${n === 1 ? 'day' : 'days'} until the date`,
  giftIdeas: 'Gift ideas',
  noUpcoming: 'No upcoming date yet. Add one to see the countdown.',
  addDate: 'Add date',
  circle: 'Your circle',
  partnerProfile: (name: string): string => `Profile of ${name}`,
  partnerFallback: 'Your partner',
  partner: 'Partner',
  sharedGarden: 'Shared garden',
  onlineIn: (zone: string): string => `Online · in ${zone}`,
  online: 'Online',
  activeAgo: (ago: string): string => `Active ${ago}`,
  addStartDate: 'Add a start date',
  inviteWaiting: 'Invitation sent. Waiting for a reply.',
  cancelBtn: 'Cancel',
  editGarden: 'Edit garden',
  linkOn: 'Link on NoutLife',
  endOrChange: 'End or change',
  addSpecialDate: 'Add special date',
  specialDates: 'Special dates',
  add2: 'Add',
  noDates: 'No special dates yet.',
  deleteDateAria: (label: string): string => `Delete ${label}`,
  yearly: ' · yearly',
  inDays: (d: number): string => `in ${d} d`,
  daysAgo: (d: number): string => `${d} d ago`,
  privateNotes: 'Private notes',
  dateDeleted: 'Date deleted',
  dateDeleteFail: 'Could not delete',
  inviteCancelled: 'Invitation cancelled',
  cancelFail: 'Could not cancel',
  closeFail: 'Could not close the garden',
  endTitle: 'End or change partner?',
  endBody: 'The garden is reset completely: the partner, their special dates and their gift ideas are erased.',
  alsoCloses: (first: string): string => ` It also closes for ${first}.`,
  afterwards: 'Afterwards you can start a new one.',
  restart: 'Restart garden',
  viewAria: 'View',
  nextAria: 'Next special date',
};

const COPY: Copy<typeof es> = { es, en };

interface GiftIdea { id: string; title: string; description?: string; estimatedPrice?: number; isPurchased: boolean; forPerson?: string }

const money = (n: number, locale: Locale) => `$${n.toLocaleString(INTL_LOCALE[locale])}`;

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
  const t = useText(COPY);
  const locale = useLocale();
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
    } catch { toast.error(t.giftSaveFail); }
    finally { setSaving(false); }
  }

  async function togglePurchased(gift: GiftIdea) {
    setGifts((prev) => prev.map((g) => (g.id === gift.id ? { ...g, isPurchased: !g.isPurchased } : g)));
    try { await api.patch(`/relationships/gift-ideas/${gift.id}`, { isPurchased: !gift.isPurchased }); }
    catch { setGifts((prev) => prev.map((g) => (g.id === gift.id ? { ...g, isPurchased: gift.isPurchased } : g))); toast.error(t.updateFail); }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/relationships/gift-ideas/${id}`);
      setGifts((prev) => prev.filter((g) => g.id !== id));
    } catch { toast.error(t.deleteFail); }
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="love-gifts">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="love-gifts" className="text-heading-lg">{t.giftsTitle}</h2>
        <Button size="md" onClick={() => setShowForm(true)}><Plus aria-hidden className="size-4" />{t.idea}</Button>
      </div>

      {state === 'loading' ? (
        <PageLoader label={t.loadingGifts} words={LOADING_COPY.loveIdeas} size="sm" />
      ) : state === 'error' ? (
        <ErrorState title={t.giftsLoadFail} onRetry={() => void load()} />
      ) : gifts.length === 0 ? (
        <Card variant="elevated" padding="lg"><EmptyState icon={Gift} tone="forest" title={t.noGifts} description={t.noGiftsDesc} action={<Button onClick={() => setShowForm(true)}><Plus aria-hidden className="size-4" />{t.addIdea}</Button>} className="py-6" /></Card>
      ) : (
        <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {gifts.map((g) => (
            <motion.li key={g.id} variants={item}>
              <Card as="article" padding="lg" interactive aria-labelledby={`g-${g.id}`} className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  {g.forPerson ? <Badge variant="forest">{t.forPerson(g.forPerson)}</Badge> : <span />}
                  <div className="flex items-center gap-1">
                    {g.estimatedPrice ? <span className="font-mono text-label-lg tabular-nums">{money(g.estimatedPrice, locale)}</span> : null}
                    <Button variant="icon" size="sm" aria-label={t.deleteAria(g.title)} onClick={() => void handleDelete(g.id)} className="-mr-2"><Trash2 aria-hidden className="size-4" strokeWidth={1.75} /></Button>
                  </div>
                </div>
                <h3 id={`g-${g.id}`} className="text-heading-sm">{g.title}</h3>
                {g.description && <p className="text-body-sm text-on-surface-light">{g.description}</p>}
                <StepItem checked={g.isPurchased} onToggle={() => void togglePurchased(g)} className="mt-auto -mx-2">{g.isPurchased ? t.bought : t.markBought}</StepItem>
              </Card>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={t.giftModal}>
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <Field label={t.giftName}><Input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t.giftNamePh} /></Field>
          <Field label={t.descOpt}><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.estPrice}><Input type="number" inputMode="numeric" value={form.estimatedPrice} onChange={(e) => setForm((f) => ({ ...f, estimatedPrice: e.target.value }))} placeholder="0" /></Field>
            <Field label={t.forWhom}><Input value={form.forPerson} onChange={(e) => setForm((f) => ({ ...f, forPerson: e.target.value }))} placeholder={t.namePh} /></Field>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>{t.cancel}</Button>
            <Button type="submit" className="flex-1" disabled={!form.title.trim()} loading={saving}>{t.saveIdea}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/** Versión corta para la estaca del rosal. */
function togetherShort(createdAt: string, t: typeof es) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
  const years = Math.floor(days / 365);
  const months = Math.floor(days / 30);
  if (years > 0) return t.yearsTogether(years);
  if (months > 0) return t.monthsTogether(months);
  return t.daysTogether(days);
}
/** Mismo orden de especies que la escena: la flor de cada fila en la lista. */
const LIST_SPECIES: Species[] = ['tulipan', 'margarita', 'rosa', 'campanilla'];

function timeTogetherText(createdAt: string, t: typeof es) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  if (years > 0) return t.yearsMonthsDays(years, months % 12, days % 30);
  if (months > 0) return t.monthsDays(months, days % 30);
  return t.daysOnly(days);
}

const DATE_ICON_IDS = [
  { id: 'heart', icon: Heart, label: 'iconHeart' as const },
  { id: 'gift', icon: Gift, label: 'iconGift' as const },
  { id: 'calendar', icon: CalendarDays, label: 'iconDate' as const },
  { id: 'star', icon: Star, label: 'iconSpecial' as const },
];

function AddDateModal({ relationshipId, onClose, onSave }: { relationshipId: string; onClose: () => void; onSave: (r: Relationship) => void }) {
  const t = useText(COPY);
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
      toast.success(t.dateAdded);
    } catch { toast.error(t.dateAddFail); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={t.addDateTitle}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label={t.dateName}><Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t.dateNamePh} /></Field>
        <fieldset>
          <legend className="mb-2 text-label-lg text-on-surface">{t.icon}</legend>
          <div role="radiogroup" aria-label={t.iconGroup} className="grid grid-cols-4 gap-2">
            {DATE_ICON_IDS.map((o) => (
              <button
                key={o.id} type="button" role="radio" aria-checked={iconKey === o.id} aria-label={t[o.label]} title={t[o.label]} onClick={() => setIconKey(o.id)}
                className={cn('flex min-h-11 items-center justify-center rounded-md border transition-colors', iconKey === o.id ? 'border-primary/50 bg-primary/[var(--lq-soft-alpha)] text-primary-text' : 'border-border text-on-surface hover:border-primary/40')}
              ><o.icon aria-hidden className="size-5" strokeWidth={1.75} /></button>
            ))}
          </div>
        </fieldset>
        <Field label={t.date}><DatePicker value={date} onChange={setDate} /></Field>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span id="love-rec" className="text-body-md">{t.yearlyRecurring}</span>
          <Switch checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} aria-labelledby="love-rec" />
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" className="flex-1" disabled={!label.trim()} loading={saving}>{t.add}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SetupModal({ onClose, onSave, existing }: { onClose: () => void; onSave: (r: Relationship) => void; existing?: Relationship | null }) {
  const t = useText(COPY);
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
      toast.success(name.trim() ? t.setupDone : t.nameRemoved);
    } catch { toast.error(t.setupFail); }
    finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={t.gardenTitle}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="-mt-2 text-body-sm text-on-surface-light">{t.gardenDesc}</p>
        <Field label={t.partnerName}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t.partnerNamePh} /></Field>
        <Field label={t.startDate}><DatePicker value={startDate} onChange={setStartDate} /></Field>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" className="flex-1" loading={saving}>{t.save}</Button>
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
  const t = useText(COPY);
  const toast = useToast();
  const [friends, setFriends] = useState<FriendItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (open) getNetwork().then(setFriends).catch(() => setFriends([])); }, [open]);
  async function invite(f: FriendItem) {
    setBusy(f.friend.id);
    try { await invitePartner(f.friend.id); toast.success(t.inviteSent(f.friend.displayName.split(' ')[0])); onSent(); onClose(); }
    catch (e) { toast.error(apiError(e, t.inviteFail)); }
    finally { setBusy(null); }
  }
  return (
    <Modal open={open} onClose={onClose} title={t.pickerTitle}>
      <p className="-mt-2 text-body-sm text-on-surface-light">{t.pickerDesc}</p>
      {friends === null ? <PageLoader size="sm" /> : friends.length === 0 ? (
        <p className="text-body-md text-on-surface-light">{t.addFirstA}<Link to="/social?tab=directorio" className="text-primary-text underline">{t.directory}</Link>.</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
          {friends.map((f) => (
            <li key={f.friendshipId} className="flex min-h-[60px] items-center gap-3 border-b border-border py-2 last:border-0">
              <PresenceAvatar user={f.friend} online={f.friend.online} size={44} />
              <span className="min-w-0 flex-1"><span className="block truncate text-label-lg">{f.friend.displayName}</span><span className="text-body-sm text-on-surface-light">@{f.friend.username}</span></span>
              <Button size="sm" variant="secondary" loading={busy === f.friend.id} onClick={() => void invite(f)}><Heart aria-hidden className="size-4" />{t.invite}</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Alguien quiere compartir su jardín contigo: aceptar reemplaza tu jardín actual. */
function InviteCard({ invite, hasGarden, onDone }: { invite: NonNullable<GardenDashboard['incomingInvites']>[number]; hasGarden: boolean; onDone: (linked: boolean) => void }) {
  const t = useText(COPY);
  const toast = useToast();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const first = invite.from.displayName.split(' ')[0];
  async function answer(accept: boolean) {
    setBusy(accept ? 'yes' : 'no');
    try { const r = await respondPartnerInvite(invite.relationshipId, accept); toast.success(accept ? t.nowShared(first) : t.inviteDeclined); onDone(r.linked); }
    catch (e) { toast.error(apiError(e, t.replyFail)); setBusy(null); }
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
          <p className="text-heading-sm">{t.wantsShare(invite.from.displayName)}</p>
          <p className="text-body-sm text-on-surface-light">{hasGarden ? t.replaceNote : t.togetherNote}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" loading={busy === 'no'} onClick={() => void answer(false)}>{t.notNow}</Button>
          <Button loading={busy === 'yes'} onClick={() => (hasGarden ? setConfirm(true) : void answer(true))}><Heart aria-hidden className="size-4" />{t.accept}</Button>
        </div>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t.shareTitle}>
        <p className="text-body-md text-on-surface">{t.shareBody(first)}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setConfirm(false)}>{t.cancel}</Button>
          <Button size="md" loading={busy === 'yes'} onClick={() => { setConfirm(false); void answer(true); }}>{t.yesShare}</Button>
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
  const t = useText(COPY);
  const locale = useLocale();
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
      toast.success(t.dateDeleted);
      void load(true);
    } catch { toast.error(t.dateDeleteFail); }
  }

  const rel = dashboard?.relationship;
  const startDate = rel?.notes?.match(/startDate:(\S+)/)?.[1];
  const next = dashboard?.nextImportantDate;
  const dates = ((rel?.importantDates ?? []) as ImportantDate[]).map((d) => ({ d, days: daysUntil(d) })).sort((a, b) => a.days - b.days);
  const partnerUser = dashboard?.linkStatus === 'LINKED' ? dashboard.partnerUser ?? null : null;
  const partnerName = partnerUser ? partnerUser.displayName : rel?.name || t.partnerFallback;
  const initials = partnerName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '♥';
  const invites = dashboard?.incomingInvites ?? [];

  async function endGarden() {
    setEnding(true);
    try {
      await breakUp();
      setEndOpen(false);
      setBreakupOpen(true);
      setDashboard({ relationship: null, nextImportantDate: null, incomingInvites: invites });
    } catch (e) { toast.error(apiError(e, t.closeFail)); }
    finally { setEnding(false); }
  }
  async function cancelInvite() {
    try { await cancelPartnerInvite(); toast.success(t.inviteCancelled); void load(true); }
    catch { toast.error(t.cancelFail); }
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
          <span className="text-label-lg text-primary-text">{t.relationships}</span>
          <h1 className="text-display-sm md:text-display-md lg:text-display-lg"><Lettering text={t.titleGarden} /></h1>
          <p className="text-body-lg text-on-surface-light">{t.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SageContextButton message={t.sageQ} label={t.sageLabel} />
          {!rel && state === 'ready' && <Button onClick={() => setShowSetup(true)}>{t.setup}</Button>}
        </div>
      </motion.section>

      <AnimatePresence initial={false}>
        {invites.map((inv) => (
          <InviteCard key={inv.relationshipId} invite={inv} hasGarden={Boolean(rel)} onDone={() => void load(true)} />
        ))}
      </AnimatePresence>

      <motion.div variants={item} className="w-full max-w-[300px]">
        <SegmentedControl options={[{ value: 'jardin', label: t.garden }, { value: 'regalos', label: t.gifts }]} value={tab} onChange={setTab} label={t.viewAria} />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col gap-6 md:gap-8">
          {tab === 'regalos' ? <GiftWishlist relationshipId={rel?.id} /> : state === 'loading' ? (
            <PageLoader label={t.enteringGarden} words={LOADING_COPY.loveDashboard} />
          ) : state === 'error' ? (
            <ErrorState title={t.gardenFail} onRetry={() => void load()} />
          ) : !rel ? (
            <>
              {/* El jardín vacío: tierra y pasto esperando su primera flor */}
              <GardenScene dates={[]} />
              <Card variant="elevated" padding="lg">
                <EmptyState icon={Heart} tone="error" title={t.waiting} description={t.waitingDesc}
                  action={(
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => setShowSetup(true)}>{t.setupMine}</Button>
                      <Button variant="secondary" onClick={() => setPickerOpen(true)}><UserPlus aria-hidden className="size-4" />{t.linkPartner}</Button>
                    </div>
                  )} className="py-6" />
              </Card>
            </>
          ) : (
            <>
              <GardenScene
                partner={{ name: partnerName, together: startDate ? togetherShort(`${startDate}T00:00:00`, t) : undefined }}
                dates={dates.map(({ d, days }) => ({ id: d.id, label: d.label, days }))}
                fresh={sprout}
                onPick={(id) => { setPicked(id); document.getElementById(`love-date-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => setPicked(null), 1800); }}
              />
              {next ? (
                <Card as="section" variant="elevated" padding="lg" aria-label={t.nextAria} className="flex flex-wrap items-center gap-6 md:gap-8 md:p-8">
                  {/* El capullo se abre a medida que se acerca la fecha */}
                  <NextBloom days={next.daysUntil} className="h-32 w-20 shrink-0 md:h-36" />
                  <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-2">
                    <span className="text-label-lg text-primary-text">{t.nextSpecial}</span>
                    <h2 className="text-heading-lg md:text-display-sm">{next.label}</h2>
                    <p className="text-body-md text-on-surface-light">{new Date(next.date).toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  </div>
                  <p className="flex flex-col items-start">
                    <span className="font-mono text-display-sm font-bold tabular-nums md:text-display-md">{next.daysUntil}</span>
                    <span className="text-body-sm text-on-surface-light">{t.dayCount(next.daysUntil)}</span>
                  </p>
                  <Button variant="secondary" onClick={() => setTab('regalos')}><Gift aria-hidden className="size-4" />{t.giftIdeas}</Button>
                </Card>
              ) : (
                <Card variant="base" padding="md" className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-body-md text-on-surface">{t.noUpcoming}</p>
                  <Button variant="secondary" size="md" onClick={() => setShowAddDate(true)}><Plus aria-hidden className="size-4" />{t.addDate}</Button>
                </Card>
              )}

              <section className="flex flex-col gap-6" aria-labelledby="love-circle">
                <h2 id="love-circle" className="text-heading-lg">{t.circle}</h2>
                <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <li>
                    <Card as="article" padding="lg" interactive className="flex h-full flex-col gap-4">
                      <div className="flex items-center gap-4">
                        {partnerUser ? (
                          <Link to={`/u/${encodeURIComponent(partnerUser.username)}`} aria-label={t.partnerProfile(partnerName)}>
                            <PresenceAvatar user={partnerUser} online={partnerUser.online} size={56} />
                          </Link>
                        ) : (
                          <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-error/[var(--lq-soft-alpha)] text-heading-sm text-error-text">{initials}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-heading-sm">{partnerName}</h3>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="error">{t.partner}</Badge>
                            {partnerUser && <Badge variant="success">{t.sharedGarden}</Badge>}
                          </div>
                          {partnerUser && (
                            <p className="mt-1 text-body-sm text-on-surface-light">
                              {partnerUser.online ? (partnerUser.zone ? t.onlineIn(partnerUser.zone) : t.online) : partnerUser.lastSeen ? t.activeAgo(timeAgo(partnerUser.lastSeen)) : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* TODO(api): el prototipo muestra "Conexión %" y último contacto; la API no los ofrece. Se muestra el tiempo juntos. */}
                      <p className="flex items-center gap-2 text-body-sm text-on-surface"><Clock aria-hidden className="size-4 text-on-surface-light" />{startDate ? timeTogetherText(`${startDate}T00:00:00`, t) : t.addStartDate}</p>
                      {dashboard?.linkStatus === 'PENDING' && (
                        <p className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-light">
                          {t.inviteWaiting}
                          <button type="button" onClick={() => void cancelInvite()} className="text-primary-text underline-offset-4 hover:underline">{t.cancelBtn}</button>
                        </p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowSetup(true)}>{t.editGarden}</Button>
                        {!partnerUser && dashboard?.linkStatus !== 'PENDING' && (
                          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}><UserPlus aria-hidden className="size-4" />{t.linkOn}</Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-error-text" onClick={() => setEndOpen(true)}><HeartCrack aria-hidden className="size-4" />{t.endOrChange}</Button>
                      </div>
                    </Card>
                  </li>
                  <li>
                    <button type="button" onClick={() => setShowAddDate(true)} className="lq-lift flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-transparent text-on-surface">
                      <IconChip icon={Sprout} tone="success" />
                      <span className="text-label-lg">{t.addSpecialDate}</span>
                    </button>
                  </li>
                </ul>
              </section>

              <Card as="section" padding="lg" aria-labelledby="love-dates" className="flex flex-col gap-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 id="love-dates" className="text-heading-sm">{t.specialDates}</h2>
                  <Button variant="secondary" size="md" onClick={() => setShowAddDate(true)}><Plus aria-hidden className="size-4" />{t.add2}</Button>
                </div>
                {dates.length === 0 ? (
                  <p className="py-4 text-body-md text-on-surface-light">{t.noDates}</p>
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
                          <p className="text-body-sm text-on-surface-light">{new Date(d.date).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' })}{d.isRecurring ? t.yearly : ''}</p>
                        </div>
                        <Badge variant={i === 0 && days >= 0 ? 'error' : 'neutral'}><span className="font-mono tabular-nums">{days >= 0 ? t.inDays(days) : t.daysAgo(-days)}</span></Badge>
                        <Button variant="icon" aria-label={t.deleteDateAria(d.label)} onClick={() => void handleDeleteDate(d.id)}><Trash2 aria-hidden className="size-5" strokeWidth={1.75} /></Button>
                      </li>
                    ))}
                  </ul>
                  </>
                )}
              </Card>

              {rel.notes && !rel.notes.startsWith('startDate:') && (
                <Card as="section" padding="lg" aria-labelledby="love-notes" className="flex flex-col gap-2">
                  <h2 id="love-notes" className="text-heading-sm">{t.privateNotes}</h2>
                  <p className="text-body-md">{rel.notes}</p>
                </Card>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <PartnerPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSent={() => void load(true)} />
      <Modal open={endOpen} onClose={() => setEndOpen(false)} title={t.endTitle}>
        <p className="text-body-md text-on-surface">
          {t.endBody}
          {partnerUser ? t.alsoCloses(partnerName.split(' ')[0]) : ''} {t.afterwards}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={() => setEndOpen(false)}>{t.cancel}</Button>
          <Button variant="danger" size="md" loading={ending} onClick={() => void endGarden()}><HeartCrack aria-hidden className="size-4" />{t.restart}</Button>
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
