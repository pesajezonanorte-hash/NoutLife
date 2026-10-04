// Ajustes (SettingsDesktop): pestañas Perfil / Zonas / Juego / Datos / Acerca de,
// tema en vivo, guardar con loading + toast, zona de peligro y resumen de cuenta.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, Check, Download, FileText, Gamepad2, Info, Monitor, Moon, Music, Palette, RotateCcw, Save, Sun, User,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { item, pop3, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useMotionStore } from '@/store/motionStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useUIStore } from '@/store/uiStore';
import { useToast } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import * as userService from '@/services/user.service';
import {
  getNotificationPreferences, requestPermissionAndSubscribe, sendTestNotification, updateNotificationPreferences,
  type NotificationCategoryPreference, type NotificationPreferences,
} from '@/services/notification.service';
import { THEME_PALETTES } from '@/lib/shopThemes';
import { ZoneToggleList } from '@/components/settings/ZoneOrderEditor';
import { PageHeader } from '@/components/layout/PageHeader';
import { PasswordInput } from '@/components/auth/PasswordInput';
import {
  Badge, Button, Card, Field, IconChip, Input, Modal, ProgressBar, SegmentedControl, Select, Switch, AnimatedValue,
} from '@/components/ui/lq';

type TabId = 'profile' | 'zones' | 'game' | 'data' | 'about';
const TABS: Array<{ value: TabId; label: string }> = [
  { value: 'profile', label: 'Perfil' }, { value: 'zones', label: 'Zonas' }, { value: 'game', label: 'Juego' },
  { value: 'data', label: 'Datos' }, { value: 'about', label: 'Acerca de' },
];
const NOTIF_LABELS: Record<NotificationCategoryPreference['category'], string> = {
  HABITS: 'Hábitos', QUESTS: 'Misiones', GYM: 'Gimnasio', FINANCE: 'Finanzas', SOCIAL: 'Social', ACHIEVEMENTS: 'Logros', SYSTEM: 'Sistema',
};
const THEMES: Array<{ id: string; name: string; description: string; cost: number }> = [
  { id: 'aurora', name: 'Aurora', description: 'La experiencia Noutlife original.', cost: 0 },
  { id: 'cyber', name: 'Cyber', description: 'Contraste sobrio y preciso.', cost: 200 },
  { id: 'forest', name: 'Bosque', description: 'Una paleta tranquila para concentrarte.', cost: 200 },
  { id: 'ocean', name: 'Océano', description: 'Neutros fríos para sesiones largas.', cost: 200 },
  { id: 'sunset', name: 'Atardecer', description: 'Contraste suave con un toque cálido.', cost: 300 },
  { id: 'retro', name: 'Retro', description: 'Un homenaje minimalista a los RPG clásicos.', cost: 500 },
];
const TIMEZONES = [
  ['America/Bogota', 'Bogotá (UTC−5)'], ['America/New_York', 'Nueva York (UTC−5)'], ['America/Chicago', 'Chicago (UTC−6)'],
  ['America/Mexico_City', 'Ciudad de México (UTC−6)'], ['America/Argentina/Buenos_Aires', 'Buenos Aires (UTC−3)'],
  ['America/Santiago', 'Santiago (UTC−4)'], ['Europe/Madrid', 'Madrid (UTC+1)'], ['UTC', 'UTC'],
];
const RESET_WORD = 'RESET_MY_LIFEQUEST';

/** Tarjeta de sección (eyebrow + título + descripción). */
function Section({ eyebrow, title, description, aside, children, className }: { eyebrow?: string; title: string; description?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card padding="lg" className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <span className="text-label-lg text-primary-text">{eyebrow}</span>}
          <h2 className="text-heading-lg">{title}</h2>
          {description && <p className="max-w-2xl text-body-sm text-on-surface-light">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
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

function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setPassword(''); setWord(''); setError(''); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await api.post<{ message: string }>('/auth/factory-reset', { password, confirmation: RESET_WORD });
      toast.success(data.message);
      onClose();
      await refreshUser();
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo reiniciar la cuenta.');
    } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="¿Reiniciar tu cuenta?">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">Se borran para siempre tu personaje, XP, Gold y registros. Tu cuenta y tu correo se conservan.</p>
        <Field label="Tu contraseña actual" error={error || undefined}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={`Escribe ${RESET_WORD} para confirmar`}>
          <Input value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" spellCheck={false} className="font-mono" />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="danger" size="md" loading={busy} disabled={!password || word !== RESET_WORD}>Reiniciar cuenta</Button>
        </div>
      </form>
    </Modal>
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

  const [tab, setTab] = useState<TabId>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'America/Bogota');
  const [playlistUrl, setPlaylistUrl] = useState(user?.gymPlaylistUrl ?? '');
  const [showPlaylist, setShowPlaylist] = useState(Boolean(user?.gymPlaylistUrl));
  const [saving, setSaving] = useState(false);
  const [themeLoading, setThemeLoading] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'));

  useEffect(() => {
    setDisplayName(user?.displayName ?? ''); setTimezone(user?.timezone ?? 'America/Bogota');
    setPlaylistUrl(user?.gymPlaylistUrl ?? ''); setShowPlaylist(Boolean(user?.gymPlaylistUrl));
  }, [user]);
  useEffect(() => { getNotificationPreferences().then(setPrefs).catch(() => null); }, []);

  const activeTheme = (user as { activeTheme?: string } | null)?.activeTheme ?? 'aurora';
  const notificationsOn = permission === 'granted';
  const spotifyId = playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/)?.[1] ?? null;

  async function save() {
    if (!displayName.trim()) { toast.warning('Escribe un nombre para tu perfil'); return; }
    setSaving(true);
    try {
      updateUser(await userService.updateProfile({ displayName: displayName.trim(), timezone, gymPlaylistUrl: showPlaylist && playlistUrl.trim() ? playlistUrl.trim() : null }));
      toast.success('Perfil guardado');
    } catch { toast.error('No se pudieron guardar los cambios'); }
    finally { setSaving(false); }
  }
  async function applyTheme(id: string, name: string) {
    setThemeLoading(id);
    try {
      await api.patch('/users/me/theme', { theme: id });
      document.documentElement.setAttribute('data-theme', id);
      updateUser({ ...(user as object), activeTheme: id } as never);
      toast.success(`Tema ${name} aplicado`);
    } catch { toast.error('Aún no tienes ese tema. Desbloquéalo en la Tienda.'); }
    finally { setThemeLoading(null); }
  }
  async function enableNotifications() {
    try {
      const ok = await requestPermissionAndSubscribe();
      setPermission('Notification' in window ? Notification.permission : 'unsupported');
      if (ok) toast.success('Notificaciones activadas'); else toast.error('El navegador no permitió las notificaciones');
    } catch { toast.error('No se pudieron activar las notificaciones'); }
  }
  async function testNotification() {
    setTesting(true);
    try { await sendTestNotification(); toast.success('Notificación de prueba enviada'); }
    catch { toast.error('No se pudo enviar la prueba'); }
    finally { setTesting(false); }
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
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader eyebrow="Espacio personal" title="Ajustes" description="Tu experiencia, tus datos y las herramientas que acompañan tu progreso." />

      <motion.div variants={item} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <SegmentedControl label="Sección" value={tab} onChange={setTab} options={TABS} className="min-w-[520px] max-w-[720px]" />
      </motion.div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} variants={pop3} initial="initial" animate="animate" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex flex-col gap-6">
              {tab === 'profile' && (
                <Section eyebrow="Tu identidad" title="Perfil" description="La información con la que Noutlife te acompaña cada día.">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Nombre de aventurero"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" /></Field>
                    <Field label="Correo" help="Se administra desde tu cuenta."><Input type="email" value={user?.email ?? ''} disabled readOnly /></Field>
                    <Field label="Zona horaria">
                      <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <SwitchRow id="st-playlist" label="Playlist del gimnasio" description="Tu música de Spotify a mano en el Gimnasio." checked={showPlaylist} onChange={setShowPlaylist} last />
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
                      <div className="max-w-[360px]">
                        <SegmentedControl role="radiogroup" label="Tema" value={mode} onChange={setMode} options={modes.map(({ value, label }) => ({ value, label }))} />
                      </div>
                    </div>
                  </Section>

                  <Section title="Paleta de Noutlife" description="Los temas comprados en la Tienda se aplican aquí sin cambiar tus datos.">
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {THEMES.map((t) => {
                        const p = THEME_PALETTES[t.id];
                        const on = activeTheme === t.id;
                        return (
                          <li key={t.id}>
                            <Card padding="sm" interactive className={cn('flex h-full flex-col gap-3', on && 'border-primary')}>
                              <div className="flex items-start justify-between gap-2">
                                <IconChip icon={Palette} tone={on ? 'primary' : 'muted'} size="sm" />
                                {on ? <Badge variant="success" icon={Check}>En uso</Badge> : t.cost > 0 && <Badge variant="warning"><span className="font-mono">{t.cost}</span> Gold</Badge>}
                              </div>
                              <div><p className="text-label-lg">{t.name}</p><p className="text-body-sm text-on-surface-light">{t.description}</p></div>
                              <div aria-hidden className="flex gap-1.5">{[p.accent, p.soft, p.background].map((c, i) => <span key={i} className="h-2.5 flex-1 rounded-full" style={{ background: c }} />)}</div>
                              <Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={on} loading={themeLoading === t.id} onClick={() => void applyTheme(t.id, t.name)} className="mt-auto">{on ? 'En uso' : 'Aplicar'}</Button>
                            </Card>
                          </li>
                        );
                      })}
                    </ul>
                  </Section>

                  <Section title="Notificaciones" description="Elige qué avisos recibes y cuándo se silencian."
                    aside={notificationsOn
                      ? <Button size="md" variant="secondary" loading={testing} onClick={testNotification}><Bell aria-hidden className="size-4" />Probar aviso</Button>
                      : <Button size="md" variant="secondary" disabled={permission === 'unsupported'} onClick={enableNotifications}><Bell aria-hidden className="size-4" />Activar avisos</Button>}>
                    <Badge variant={notificationsOn ? 'success' : 'neutral'} icon={notificationsOn ? Check : Bell} className="self-start">{notificationsOn ? 'Permiso concedido' : 'Sin permiso del navegador'}</Badge>
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
                    <div className="min-w-0 flex-[1_1_260px]"><div className="text-label-lg text-error-text md:text-body-md md:font-semibold">Zona de peligro</div><div className="text-body-sm text-on-surface">Reiniciar tu cuenta borra para siempre tu personaje, XP y Gold.</div></div>
                    <Button variant="danger" size="md" onClick={() => setResetOpen(true)}><RotateCcw aria-hidden className="size-4" />Reiniciar cuenta</Button>
                  </div>
                </Section>
              )}

              {tab === 'about' && (
                <Section title="Noutlife" description="Convierte tus hábitos en una aventura. Hecho con cuidado para quienes construyen su mejor versión cada día.">
                  <IconChip icon={Gamepad2} tone="primary" size="lg" className="animate-float [.reduce-motion_&]:animate-none" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="md" onClick={() => navigate('/about')}><Info aria-hidden className="size-4" />Acerca de</Button>
                    <Button variant="ghost" size="md" onClick={() => navigate('/faq')}>Ayuda</Button>
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
        </motion.aside>
      </div>

      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} />
    </motion.div>
  );
}
