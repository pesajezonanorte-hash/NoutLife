// Ajustes (SettingsDesktop): pestañas Perfil / Zonas / Juego / Datos / Acerca de,
// tema en vivo, guardar con loading + toast, zona de peligro y resumen de cuenta.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ZoneShell } from '@/components/ambience';
import { Gears, HangingTools, Workbench } from '@/components/settings/Workshop';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { isAdminEmail } from '@/utils/admin';
import {
  AlertTriangle, Bell, Check, Download, FileText, Gamepad2, Gem, Info, Monitor, Moon, Music, Palette, RotateCcw, Save, Sun, Trash2, User,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import * as shopService from '@/services/shop.service';
import { item, pop3, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useMotionStore } from '@/store/motionStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useUIStore } from '@/store/uiStore';
import { useToast } from '@/hooks/useToast';
import * as userService from '@/services/user.service';
import {
  getNotificationPreferences, enablePush, PUSH_MESSAGES, pushSupport, sendTestNotification, updateNotificationPreferences,
  type NotificationCategoryPreference, type NotificationPreferences, type SmartReminderPatch,
} from '@/services/notification.service';
import { SmartRemindersPanel } from '@/components/settings/SmartRemindersPanel';
import { SKINS, THEME_PALETTES, skinOf, themeIdOf } from '@/lib/shopThemes';
import { daysUntil, longDay } from '@/lib/plan';
import { LOCALE_NAMES, isLocale, useLocaleStore, type Locale } from '@/lib/i18n';
import type { Gender, InventoryItem, ShopItem, Subscription, User as Account } from '@noutlife/shared';
import { GENDER_OPTIONS, canUseCycle } from '@/utils/gender';
import { ZoneToggleList } from '@/components/settings/ZoneOrderEditor';
import { PrivacyPanel } from '@/components/settings/PrivacyPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { DangerDialog } from '@/components/settings/DangerDialog';
import { SkinModeNote } from '@/components/settings/SkinModeNote';
import {
  Badge, Button, Card, Field, IconChip, Input, ProgressBar, SegmentedControl, Select, Switch, AnimatedValue,
} from '@/components/ui/lq';

type TabId = 'profile' | 'privacy' | 'zones' | 'game' | 'data' | 'about';
const TABS: Array<{ value: TabId; label: string }> = [
  { value: 'profile', label: 'Perfil' }, { value: 'privacy', label: 'Privacidad' }, { value: 'zones', label: 'Zonas' }, { value: 'game', label: 'Juego' },
  { value: 'data', label: 'Datos' }, { value: 'about', label: 'Acerca de' },
];
const NOTIF_LABELS: Record<NotificationCategoryPreference['category'], string> = {
  HABITS: 'Hábitos', QUESTS: 'Misiones', COLISEO: 'Coliseo', FINANCE: 'Finanzas', SOCIAL: 'Social', ACHIEVEMENTS: 'Logros', SYSTEM: 'Sistema',
};
const TIMEZONES = [
  ['America/Bogota', 'Bogotá (UTC−5)'], ['America/New_York', 'Nueva York (UTC−5)'], ['America/Chicago', 'Chicago (UTC−6)'],
  ['America/Denver', 'Denver (UTC−7)'], ['America/Phoenix', 'Phoenix (UTC−7)'], ['America/Los_Angeles', 'Los Ángeles (UTC−8)'],
  ['America/Anchorage', 'Anchorage (UTC−9)'], ['Pacific/Honolulu', 'Honolulu (UTC−10)'],
  ['America/Mexico_City', 'Ciudad de México (UTC−6)'], ['America/Argentina/Buenos_Aires', 'Buenos Aires (UTC−3)'],
  ['America/Santiago', 'Santiago (UTC−4)'], ['Europe/Madrid', 'Madrid (UTC+1)'], ['UTC', 'UTC'],
];
/** Idioma guardado en la cuenta (las cuentas anteriores son español). */
const accountLocale = (value: string | null | undefined): Locale => (isLocale(value) ? value : 'es');
/** Resumen del plan en una línea. */
function planLine(sub: Subscription): string {
  if (sub.complimentary) return 'Pro de cortesía, sin cobros.';
  if (sub.status === 'pending_approval') return 'Esperando la aprobación de tu Nequi.';
  if (sub.status === 'trialing') return `Prueba Pro: ${daysUntil(sub.trialEndsAt) === 1 ? 'queda 1 día' : `quedan ${daysUntil(sub.trialEndsAt)} días`}.`;
  if (sub.status === 'active') return `Se renueva el ${longDay(sub.accessEndsAt)}.`;
  if (sub.status === 'canceled') return `Pro hasta el ${longDay(sub.accessEndsAt)}.`;
  return 'NoutLife Lite, gratis.';
}

/** Sección = banco de trabajo del taller (eyebrow + título + descripción); `fit` sube al guardar y las piezas encajan. */
function Section(props: { eyebrow?: string; title: string; description?: string; aside?: ReactNode; children: ReactNode; className?: string; fit?: number }) {
  return <Workbench {...props} />;
}

/** Fila con interruptor: etiqueta + ayuda a la izquierda. */
function SwitchRow({ id, label, description, checked, onChange, disabled, last }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean }) {
  return (
    <div className={cn('flex min-h-[76px] items-center gap-4', !last && 'border-b border-border', disabled && 'opacity-50')}>
      <div className="min-w-0 flex-1"><label htmlFor={id} className="text-label-lg md:text-body-md md:font-semibold">{label}</label><p className="text-body-sm text-on-surface-light">{description}</p></div>
      <Switch id={id} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const { audioEnabled, toggleAudio } = useUIStore();
  const toast = useToast();
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const reduceMotion = useMotionStore((s) => s.reduce);
  const setReduceMotion = useMotionStore((s) => s.setReduce);

  const [tab, setTab] = useState<TabId>(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some((x) => x.value === t) ? (t as TabId) : 'profile';
  });
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'America/Bogota');
  const [language, setLanguage] = useState<Locale>(accountLocale(user?.language));
  const [gender, setGender] = useState<Gender | ''>(user?.gender ?? '');
  const [playlistUrl, setPlaylistUrl] = useState(user?.coliseoPlaylistUrl ?? '');
  const [showPlaylist, setShowPlaylist] = useState(Boolean(user?.coliseoPlaylistUrl));
  const [saving, setSaving] = useState(false);
  const [themeLoading, setThemeLoading] = useState<string | null>(null);
  /** Temas del catálogo y lo comprado: la Tienda es la fuente (users.equippedTheme). */
  const [themes, setThemes] = useState<{ items: ShopItem[]; inv: InventoryItem[] } | null>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testing, setTesting] = useState(false);
  const [danger, setDanger] = useState<'reset' | 'delete' | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'));
  /** Al guardar, las piezas encajan; cada valor que cambia hace girar los engranajes. */
  const [fit, setFit] = useState(0);
  const [turns, setTurns] = useState(0);
  const sig = JSON.stringify([displayName, timezone, language, gender, showPlaylist, audioEnabled, reduceMotion, mode, user?.equippedTheme, prefs]);
  const lastSig = useRef(sig);
  useEffect(() => { if (lastSig.current !== sig) { lastSig.current = sig; setTurns((t) => t + 1); } }, [sig]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? ''); setTimezone(user?.timezone ?? 'America/Bogota'); setLanguage(accountLocale(user?.language)); setGender(user?.gender ?? '');
    setPlaylistUrl(user?.coliseoPlaylistUrl ?? ''); setShowPlaylist(Boolean(user?.coliseoPlaylistUrl));
  }, [user]);
  useEffect(() => { getNotificationPreferences().then(setPrefs).catch(() => null); }, []);
  useEffect(() => {
    Promise.all([shopService.fetchShopItems(), shopService.fetchInventory()])
      .then(([items, inv]) => setThemes({ items: items.filter((i) => i.type === 'THEME' && themeIdOf(i)), inv }))
      .catch(() => setThemes({ items: [], inv: [] }));
  }, []);

  const activeTheme = skinOf(user?.equippedTheme) ?? 'aurora';
  // Ajustes solo muestra tus temas (Aurora y los comprados); el resto está en la Tienda.
  const ownedThemes = themes?.items.filter((it) => themeIdOf(it) === 'aurora' || themes.inv.some((i) => i.shopItemId === it.id)) ?? [];
  const moreThemes = (themes?.items.length ?? 0) > ownedThemes.length;
  const notificationsOn = permission === 'granted';
  const spotifyId = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/)?.[1] ?? null;

  async function save() {
    if (!displayName.trim()) { toast.warning('Escribe un nombre para tu perfil'); return; }
    setSaving(true);
    try {
      const cycleBefore = canUseCycle(user?.gender);
      updateUser(await userService.updateProfile({
        displayName: displayName.trim(), timezone, language, gender: gender || null,
        coliseoPlaylistUrl: showPlaylist && playlistUrl.trim() ? playlistUrl.trim() : null,
      }));
      // El idioma de la cuenta manda con sesión; sin sesión (la portada) también se recuerda en este navegador.
      useLocaleStore.getState().choose(language);
      const cycleNow = canUseCycle(gender || null);
      toast.success('Perfil guardado', cycleNow && !cycleBefore ? 'La zona Ciclo Menstrual ya está en tu menú, en Bienestar.' : !cycleNow && cycleBefore ? 'La zona Ciclo Menstrual se ocultó. Tus registros siguen guardados.' : undefined);
      setFit((f) => f + 1);
    } catch { toast.error('No se pudieron guardar los cambios'); }
    finally { setSaving(false); }
  }
  /** Aurora quita el tema puesto; cualquier otro se equipa (si está comprado). */
  async function applyTheme(it: ShopItem) {
    const id = themeIdOf(it);
    const inv = id === 'aurora'
      ? themes?.inv.find((i) => i.shopItem.slot === 'theme' && i.shopItem.value === user?.equippedTheme)
      : themes?.inv.find((i) => i.shopItemId === it.id);
    if (!inv || !id) return;
    setThemeLoading(id);
    try {
      const r = await shopService.equipItem(inv.id);
      if (r.user) updateUser(r.user as Partial<Account>);
      toast.success(id === 'aurora' ? 'Volviste a Aurora, el tema de siempre' : `${it.name}: toda la app cambió`);
      setFit((f) => f + 1);
    } catch { toast.error('No se pudo cambiar el tema. Inténtalo de nuevo.'); }
    finally { setThemeLoading(null); }
  }
  async function enableNotifications() {
    const result = await enablePush();
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
    if (result === 'ok') toast.success(PUSH_MESSAGES.ok);
    else if (result === 'ios-install') toast.info(PUSH_MESSAGES[result]);
    else toast.error(PUSH_MESSAGES[result]);
  }
  async function testNotification() {
    setTesting(true);
    try {
      // Antes de probar, asegura que este dispositivo está suscrito.
      const sub = await enablePush();
      if (sub !== 'ok') { toast.error(PUSH_MESSAGES[sub]); return; }
      await sendTestNotification();
      toast.success('Aviso de prueba enviado. Debería llegarte en unos segundos.');
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'No se pudo enviar la prueba');
    } finally { setTesting(false); }
  }
  async function toggleCategory(category: NotificationCategoryPreference['category'], field: 'inAppEnabled' | 'pushEnabled') {
    if (!prefs || savingPrefs) return;
    const categories = prefs.categories.map((p) => (p.category === category ? { ...p, [field]: !p[field] } : p));
    const before = prefs;
    setPrefs({ ...prefs, categories }); setSavingPrefs(true);
    try { setPrefs(await updateNotificationPreferences({ categoryPreferences: categories })); }
    catch { setPrefs(before); toast.error('No se pudieron guardar las preferencias'); }
    finally { setSavingPrefs(false); }
  }
  async function quietHours(field: 'quietHoursStart' | 'quietHoursEnd', value: string) {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, [field]: value || null });
    try { setPrefs(await updateNotificationPreferences({ [field]: value || null })); }
    catch { setPrefs(before); toast.error('No se pudo actualizar el horario silencioso'); }
  }
  /** Cambia los avisos inteligentes: se ve al instante y, si el servidor lo rechaza, vuelve atrás. */
  async function smartReminders(patch: SmartReminderPatch) {
    if (!prefs) return;
    const before = prefs;
    const local: Record<string, object> = { ...prefs.reminderSettings };
    for (const [zone, change] of Object.entries(patch)) local[zone] = { ...local[zone], ...change };
    setPrefs({ ...prefs, reminderSettings: local as unknown as NotificationPreferences['reminderSettings'] });
    try { setPrefs(await updateNotificationPreferences({ reminderSettings: patch })); }
    catch { setPrefs(before); toast.error('No se pudieron guardar los avisos inteligentes'); }
  }
  async function exportData(format: 'json' | 'csv') {
    setExporting(format);
    try {
      const { data } = await api.get<Blob>(format === 'json' ? '/export/json' : '/export/transactions.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = format === 'json' ? `noutlife-backup-${new Date().toISOString().slice(0, 10)}.json` : `transacciones-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`Exportación ${format.toUpperCase()} descargada`);
    } catch { toast.error('No se pudo preparar la exportación'); }
    finally { setExporting(null); }
  }

  const modes: Array<{ value: ThemeMode; label: string; icon: LucideIcon }> = [
    { value: 'light', label: 'Claro', icon: Sun }, { value: 'dark', label: 'Oscuro', icon: Moon }, { value: 'auto', label: 'Auto', icon: Monitor },
  ];

  return (
    <ZoneShell
      zone="settings"
      className="lq-workshop"
      contentClassName="gap-8 md:gap-12"
      ambience={(
        // La pared del taller: tablero perforado con sus herramientas colgadas
        <span className="lq-pegboard absolute inset-x-0 top-0 block h-[18rem] [mask-image:linear-gradient(to_bottom,#000_40%,transparent)]">
          <HangingTools className="absolute right-[4%] top-6 hidden h-28 w-52 md:block" />
        </span>
      )}
    >
      <PageHeader eyebrow="Espacio personal" title="Ajustes" description="Tu experiencia, tus datos y las herramientas que acompañan tu progreso." aside={<Gears turns={turns} className="hidden sm:block" />} />
      {isAdminEmail(user?.email) && (
        <Link to="/admin" className="self-start text-label-lg text-primary-text underline underline-offset-2">Administración: cuentas y pagos</Link>
      )}

      <motion.div variants={item} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <SegmentedControl label="Sección" value={tab} onChange={setTab} options={TABS} className="min-w-[600px] max-w-[820px]" />
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div key={tab} variants={pop3} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-6">
              {tab === 'profile' && (
                <Section eyebrow="Tu identidad" title="Perfil" description="La información con la que Noutlife te acompaña cada día." fit={fit}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Nombre de aventurero"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" /></Field>
                    <Field label="Correo" help="Se administra desde tu cuenta."><Input type="email" value={user?.email ?? ''} disabled readOnly /></Field>
                    <Field label="Zona horaria">
                      <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        {/* La zona del dispositivo (onboarding) puede no estar en la lista: se muestra tal cual. */}
                        {!TIMEZONES.some(([v]) => v === timezone) && <option value={timezone}>{timezone}</option>}
                        {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </Field>
                    <Field label="Idioma" help="La portada, los planes, el pago y los textos legales ya están en inglés; el resto de la app se traduce poco a poco.">
                      <Select value={language} onChange={(e) => setLanguage(accountLocale(e.target.value))}>
                        <option value="es" lang="es">{LOCALE_NAMES.es}</option>
                        <option value="en" lang="en">{LOCALE_NAMES.en} (beta)</option>
                      </Select>
                    </Field>
                    <Field label="¿Cómo te identificas?" help="Si eliges Mujer, se activa la zona Ciclo Menstrual.">
                      <Select value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
                        {!gender && <option value="">Sin indicar</option>}
                        {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <SwitchRow id="st-playlist" label="Playlist del Coliseo" description="Tu música de Spotify a mano mientras entrenas en el Coliseo." checked={showPlaylist} onChange={setShowPlaylist} last />
                    {showPlaylist && (
                      <Field label="Enlace de Spotify" help="Pega el enlace de una playlist.">
                        <Input type="url" value={playlistUrl} onChange={(e) => setPlaylistUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/…" />
                      </Field>
                    )}
                    {showPlaylist && spotifyId && (
                      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-2">
                        <div className="flex items-center justify-between px-1"><span className="text-body-sm text-on-surface-light">Vista previa</span>
                          <Button size="sm" variant="ghost" onClick={() => window.open(`https://open.spotify.com/playlist/${spotifyId}`, '_blank', 'noopener,noreferrer')}><Music aria-hidden className="size-4" />Abrir</Button></div>
                        <iframe title="Vista previa de la playlist de Spotify" src={`https://open.spotify.com/embed/playlist/${spotifyId}?theme=0`} width="100%" height="152" allow="encrypted-media" className="rounded-md border-0" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end border-t border-border pt-4">
                    <Button size="md" loading={saving} onClick={save}><Save aria-hidden className="size-4" strokeWidth={1.75} />{saving ? 'Guardando…' : 'Guardar perfil'}</Button>
                  </div>
                </Section>
              )}

              {tab === 'privacy' && <PrivacyPanel Section={Section} />}

              {tab === 'zones' && <ZoneToggleList />}

              {tab === 'game' && (
                <>
                  <Section eyebrow="Experiencia" title="Juego">
                    <div className="flex flex-col">
                      <SwitchRow id="st-sound" label="Sonidos" description="Efectos al completar hábitos y misiones." checked={audioEnabled} onChange={() => toggleAudio()} />
                      <SwitchRow id="st-motion" label="Reducir movimiento" description="Quita todas las animaciones de la app (de base van activas)." checked={reduceMotion} onChange={setReduceMotion} last />
                    </div>
                    <div className="flex flex-col gap-3 border-t border-border pt-5">
                      <span id="st-theme" className="text-label-lg md:text-body-md md:font-semibold">Tema</span>
                      {activeTheme === 'aurora' ? (
                        <div className="max-w-[360px]">
                          <SegmentedControl role="radiogroup" label="Tema" value={mode} onChange={setMode} options={modes.map(({ value, label }) => ({ value, label }))} />
                        </div>
                      ) : (
                        <SkinModeNote />
                      )}
                    </div>
                  </Section>

                  <Section title="Tus temas" description="Cada tema cambia fondos, tarjetas, botones, letra y el color del logo en toda la app. Aquí están los que tienes; los demás se consiguen en la Tienda." fit={fit}
                    aside={moreThemes ? <Button size="md" variant="secondary" onClick={() => navigate('/shop')}><Palette aria-hidden className="size-4" />Más temas en la Tienda</Button> : undefined}>
                    {!themes ? <p className="text-body-sm text-on-surface-light">Cargando temas…</p> : (
                      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {ownedThemes.map((it) => {
                          const id = themeIdOf(it)!;
                          const p = THEME_PALETTES[id];
                          const on = activeTheme === id;
                          return (
                            <li key={it.id}>
                              <Card padding="sm" interactive className={cn('flex h-full flex-col gap-3', on && 'border-primary')}>
                                {/* Muestra del tema con sus propios colores */}
                                <div aria-hidden className="flex h-16 gap-2 rounded-lg p-2" style={{ background: p.background }}>
                                  <span className="w-6 rounded-md" style={{ background: p.accent }} />
                                  <span className="flex flex-1 flex-col justify-center gap-1.5 rounded-md px-2" style={{ background: p.surface }}>
                                    <span className="h-1.5 w-3/4 rounded-full" style={{ background: p.text }} />
                                    <span className="h-1.5 w-1/2 rounded-full" style={{ background: p.soft }} />
                                  </span>
                                </div>
                                <div className="flex items-start justify-between gap-2">
                                  <div><p className="text-label-lg">{it.name.replace(/^Tema: /, '')}</p><p className="text-body-sm text-on-surface-light">{it.description}</p></div>
                                  {on && <Badge variant="success" icon={Check} className="shrink-0">En uso</Badge>}
                                </div>
                                <p className="text-body-sm text-on-surface-light">{id === 'aurora' ? 'Claro, oscuro o automático' : SKINS[id].scheme === 'dark' ? 'Siempre oscuro' : 'Siempre claro'}</p>
                                <Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={on} loading={themeLoading === id} onClick={() => void applyTheme(it)} className="mt-auto">{on ? 'En uso' : 'Usar este tema'}</Button>
                              </Card>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Section>

                  <Section title="Notificaciones" description="Elige qué avisos recibes y cuándo se silencian."
                    aside={notificationsOn
                      ? <Button size="md" variant="secondary" loading={testing} onClick={testNotification}><Bell aria-hidden className="size-4" />Probar aviso</Button>
                      : <Button size="md" variant="secondary" disabled={permission === 'unsupported' && pushSupport() !== 'ios-install'} onClick={enableNotifications}><Bell aria-hidden className="size-4" />Activar avisos</Button>}>
                    <Badge variant={notificationsOn ? 'success' : 'neutral'} icon={notificationsOn ? Check : Bell} className="self-start">{notificationsOn ? 'Permiso concedido' : 'Sin permiso del navegador'}</Badge>
                    {pushSupport() === 'ios-install' && <p className="max-w-prose text-body-sm text-on-surface-light">{PUSH_MESSAGES['ios-install']}</p>}
                    {prefs && (
                      <>
                        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                          <Field label="Silencio desde"><Input type="time" value={prefs.quietHoursStart ?? ''} onChange={(e) => void quietHours('quietHoursStart', e.target.value)} /></Field>
                          <Field label="Hasta"><Input type="time" value={prefs.quietHoursEnd ?? ''} onChange={(e) => void quietHours('quietHoursEnd', e.target.value)} /></Field>
                        </div>
                        <ul className="overflow-hidden rounded-xl border border-border">
                          {prefs.categories.map((p) => (
                            <li key={p.category} className="flex min-h-14 flex-wrap items-center gap-2 border-b border-border px-3 last:border-b-0">
                              <span className="min-w-0 flex-1 text-label-lg">{NOTIF_LABELS[p.category]}</span>
                              <Button size="sm" variant={p.inAppEnabled ? 'primary' : 'secondary'} aria-pressed={p.inAppEnabled} disabled={savingPrefs} onClick={() => void toggleCategory(p.category, 'inAppEnabled')}>En app</Button>
                              <Button size="sm" variant={p.pushEnabled ? 'primary' : 'secondary'} aria-pressed={p.pushEnabled} disabled={savingPrefs} onClick={() => void toggleCategory(p.category, 'pushEnabled')}>Push</Button>
                            </li>
                          ))}
                        </ul>
                        <SmartRemindersPanel settings={prefs.reminderSettings} isFemale={user?.gender === 'female'} onChange={(patch) => void smartReminders(patch)} />
                      </>
                    )}
                  </Section>
                </>
              )}

              {tab === 'data' && (
                <Section eyebrow="Tus datos" title="Datos" description="Descarga una copia de todo tu progreso cuando quieras. Exportar no cambia tu cuenta.">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" size="md" loading={exporting === 'json'} onClick={() => void exportData('json')}><FileText aria-hidden className="size-4" />Exportar JSON</Button>
                    <Button variant="secondary" size="md" loading={exporting === 'csv'} onClick={() => void exportData('csv')}><Download aria-hidden className="size-4" />Exportar CSV</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-error/[var(--lq-soft-alpha)] p-5">
                    <AlertTriangle aria-hidden className="size-6 text-error-text" strokeWidth={1.75} />
                    <div className="min-w-0 flex-[1_1_260px]"><div className="text-label-lg text-error-text md:text-body-md md:font-semibold">Zona de peligro</div><div className="text-body-sm text-on-surface">Reiniciar borra tu progreso y empiezas de cero. Eliminar borra tu cuenta y todos tus datos para siempre.</div></div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" size="md" onClick={() => setDanger('reset')}><RotateCcw aria-hidden className="size-4" />Reiniciar cuenta</Button>
                      <Button variant="danger" size="md" onClick={() => setDanger('delete')}><Trash2 aria-hidden className="size-4" />Eliminar cuenta</Button>
                    </div>
                  </div>
                </Section>
              )}

              {tab === 'about' && (
                <Section title="Noutlife" description="Convierte tus hábitos en una aventura. Hecho con cuidado para quienes construyen su mejor versión cada día.">
                  <IconChip icon={Gamepad2} tone="primary" size="lg" className="animate-float [.reduce-motion_&]:animate-none" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="md" onClick={() => navigate('/about')}><Info aria-hidden className="size-4" />Acerca de</Button>
                    <Button variant="ghost" size="md" onClick={() => navigate('/faq')}>Ayuda</Button>
                    <Button variant="ghost" size="md" onClick={() => navigate('/privacy')}>Privacidad</Button>
                    <Button variant="ghost" size="md" onClick={() => navigate('/terms')}>Términos</Button>
                  </div>
                </Section>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <motion.aside variants={item} className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <Card padding="lg" className="flex flex-col gap-4">
            <div><h2 className="text-heading-sm">Resumen de cuenta</h2><p className="text-body-sm text-on-surface-light">Tu avance acompaña tus preferencias.</p></div>
            <div className="flex items-center gap-3">
              <IconChip icon={User} tone="primary" className="rounded-full" />
              <div className="min-w-0"><div className="truncate text-label-lg md:text-body-md md:font-semibold">{user?.displayName}</div><div className="text-body-sm text-on-surface-light">Nivel {user?.level ?? 1} · racha de {user?.currentStreak ?? 0} días</div></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['Nivel', user?.level ?? 1, ''], ['XP', user?.xp ?? 0, ''], ['Gold', user?.gold ?? 0, 'text-warning-text']] as const).map(([l, v, cls]) => (
                <Card key={l} padding="sm" className="bg-background px-3"><div className="text-body-sm text-on-surface-light">{l}</div><div className={cn('font-mono text-heading-sm tabular-nums', cls)}><AnimatedValue value={v} /></div></Card>
              ))}
            </div>
            <ProgressBar value={((user?.xp ?? 0) / Math.max(1, user?.xpToNextLevel ?? 1)) * 100} shine label="Experiencia hasta el siguiente nivel" />
          </Card>
          {user?.subscription && (
            <Card padding="lg" className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-heading-sm">Tu plan</h2><p className="text-body-sm text-on-surface-light">{planLine(user.subscription)}</p></div>
                <Badge variant={user.subscription.plan === 'pro' ? 'secondary' : 'neutral'} icon={Gem}>{user.subscription.plan === 'pro' ? 'Pro' : 'Lite'}</Badge>
              </div>
              <Button variant="secondary" size="md" onClick={() => navigate('/plan')}>Ver mi plan</Button>
            </Card>
          )}
        </motion.aside>
      </div>

      <DangerDialog mode={danger} onClose={() => setDanger(null)} />
    </ZoneShell>
  );
}
