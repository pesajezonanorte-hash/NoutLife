import { useMotionStore } from "@/store/motionStore";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  Clock3,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  Info,
  Leaf,
  Monitor,
  Moon,
  Music,
  Palette,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  User,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FlowButton } from "../../components/ui/flow-button";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useToast } from "../../hooks/useToast";
import * as userService from "../../services/user.service";
import {
  getNotificationPreferences,
  requestPermissionAndSubscribe,
  sendTestNotification,
  updateNotificationPreferences,
  type NotificationCategoryPreference,
  type NotificationPreferences,
} from "../../services/notification.service";
import api from "../../lib/api";
import {
  applyThemeMode,
  readThemeMode,
  resolveIsDark,
  subscribeThemeMode,
} from "../../lib/themeMode";

type TabId = "profile" | "game" | "data" | "about";
type ThemeMode = "dark" | "light" | "system";

interface ThemeOption {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  colors: [string, string, string];
  cost: number;
}

const TABS: Array<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: "profile", label: "Perfil", Icon: User },
  { id: "game", label: "Juego", Icon: Gamepad2 },
  { id: "data", label: "Datos", Icon: Database },
  { id: "about", label: "Acerca de", Icon: Info },
];

const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategoryPreference['category'], string> = {
  HABITS: 'Hábitos',
  QUESTS: 'Misiones',
  GYM: 'Gym',
  FINANCE: 'Finanzas',
  SOCIAL: 'Social',
  ACHIEVEMENTS: 'Logros',
  SYSTEM: 'Sistema',
};

const THEMES: ThemeOption[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "La experiencia LifeQuest original.",
    Icon: Sparkles,
    colors: ["#9a7b1c", "#169a63", "#596fdb"],
    cost: 0,
  },
  {
    id: "cyber",
    name: "Cyber",
    description: "Contraste sobrio y preciso.",
    Icon: Monitor,
    colors: ["#d4d4d8", "#3f3f46", "#111114"],
    cost: 200,
  },
  {
    id: "forest",
    name: "Bosque",
    description: "Una paleta tranquila para concentrarte.",
    Icon: Leaf,
    colors: ["#3d8961", "#78bc61", "#234239"],
    cost: 200,
  },
  {
    id: "ocean",
    name: "Océano",
    description: "Neutros fríos para sesiones largas.",
    Icon: Palette,
    colors: ["#3a76a8", "#6da4cf", "#182738"],
    cost: 200,
  },
  {
    id: "sunset",
    name: "Atardecer",
    description: "Contraste suave con un toque cálido.",
    Icon: Sun,
    colors: ["#c4845e", "#d8a266", "#33231e"],
    cost: 300,
  },
  {
    id: "retro",
    name: "Retro",
    description: "Un homenaje minimalista a los RPG clásicos.",
    Icon: Gamepad2,
    colors: ["#b4b4a1", "#5c5c50", "#1b1b18"],
    cost: 500,
  },
];

const APPEARANCE_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  Icon: LucideIcon;
}> = [
  { id: "dark", label: "Oscuro", Icon: Moon },
  { id: "light", label: "Claro", Icon: Sun },
  { id: "system", label: "Sistema", Icon: Monitor },
];

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] shadow-[0_14px_36px_rgba(0,0,0,0.08)] ${className}`}
    >
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
        {eyebrow && (
          <p className="text-sm font-medium text-[var(--accent-gold)]">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel-light)] disabled:cursor-not-allowed ${
          checked
            ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]"
            : "border-[var(--border)] bg-[var(--bg-panel)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      {hint && (
        <span className="mt-1.5 block text-xs leading-4 text-[var(--text-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-3">
      <p className="text-sm font-medium text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const { audioEnabled, toggleAudio } = useUIStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() =>
    readThemeMode(),
  );
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "America/Bogota");
  const [playlistUrl, setPlaylistUrl] = useState(user?.gymPlaylistUrl ?? "");
  const [showPlaylist, setShowPlaylist] = useState(
    Boolean(user?.gymPlaylistUrl),
  );
  const reduceMotion = useMotionStore((s) => s.reduce);
  const setReduceMotion = useMotionStore((s) => s.setReduce);
  const animationsEnabled = !reduceMotion;
  const [isSaving, setIsSaving] = useState(false);
  const [themeLoading, setThemeLoading] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [notifStatus, setNotifStatus] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  useEffect(
    () => subscribeThemeMode(() => setThemeModeState(readThemeMode())),
    [],
  );

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setTimezone(user?.timezone ?? "America/Bogota");
    setPlaylistUrl(user?.gymPlaylistUrl ?? "");
    setShowPlaylist(Boolean(user?.gymPlaylistUrl));
  }, [user]);

  useEffect(() => {
    getNotificationPreferences().then(setNotificationPreferences).catch(() => null);
  }, []);

  const activeTheme =
    (user as (typeof user & { activeTheme?: string }) | null)?.activeTheme ??
    "aurora";
  const activeThemeRef = useRef(activeTheme);
  const currentTheme = useMemo(
    () => THEMES.find((theme) => theme.id === activeTheme) ?? THEMES[0],
    [activeTheme],
  );
  const resolvedTheme = resolveIsDark(themeMode) ? "dark" : "light";
  const notificationsEnabled = notifPermission === "granted";

  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);
  useEffect(
    () => () => {
      document.documentElement.setAttribute(
        "data-theme",
        activeThemeRef.current,
      );
    },
    [],
  );

  const setThemeMode = (mode: ThemeMode) => {
    applyThemeMode(mode);
    setThemeModeState(mode);
  };

  const handleToggleAnimations = (enabled: boolean) => {
    setReduceMotion(!enabled);
  };

  const saveProfile = async () => {
    if (!displayName.trim()) {
      toast.warning("Escribe un nombre para tu perfil");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await userService.updateProfile({
        displayName: displayName.trim(),
        timezone,
        gymPlaylistUrl:
          showPlaylist && playlistUrl.trim() ? playlistUrl.trim() : null,
      });
      updateUser(updated);
      toast.success("Tus preferencias se guardaron");
    } catch {
      toast.error("No se pudieron guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = async (theme: ThemeOption) => {
    setThemeLoading(theme.id);
    try {
      await api.patch("/users/me/theme", { theme: theme.id });
      document.documentElement.setAttribute("data-theme", theme.id);
      updateUser({ ...(user as any), activeTheme: theme.id } as any);
      setPreviewTheme(null);
      toast.success(`Tema ${theme.name} aplicado`);
    } catch {
      toast.error(
        "No tienes ese tema disponible. Podrás desbloquearlo en la tienda.",
      );
    } finally {
      setThemeLoading(null);
    }
  };

  const handleThemePreview = (themeId: string) => {
    if (previewTheme === themeId) {
      document.documentElement.setAttribute("data-theme", activeTheme);
      setPreviewTheme(null);
      return;
    }
    document.documentElement.setAttribute("data-theme", themeId);
    setPreviewTheme(themeId);
  };

  const handleEnableNotifications = async () => {
    setNotifStatus(null);
    try {
      const ok = await requestPermissionAndSubscribe();
      const permission =
        "Notification" in window ? Notification.permission : "unsupported";
      setNotifPermission(permission);
      setNotifStatus({
        ok,
        text: ok
          ? "Notificaciones habilitadas para tus recordatorios."
          : "No se pudo habilitar el permiso en este navegador.",
      });
      if (ok) toast.success("Notificaciones activadas");
    } catch {
      setNotifStatus({
        ok: false,
        text: "No se pudo habilitar el permiso en este navegador.",
      });
      toast.error("No se pudieron activar las notificaciones");
    }
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    try {
      await sendTestNotification();
      toast.success("Notificación de prueba enviada");
    } catch {
      toast.error("No se pudo enviar la notificación de prueba");
    } finally {
      setTestingNotif(false);
    }
  };

  const updateCategoryPreference = async (
    category: NotificationCategoryPreference['category'],
    field: 'inAppEnabled' | 'pushEnabled',
  ) => {
    if (!notificationPreferences || savingNotificationPreferences) return;
    const categories = notificationPreferences.categories.map((preference) => (
      preference.category === category ? { ...preference, [field]: !preference[field] } : preference
    ));
    const optimistic = { ...notificationPreferences, categories };
    setNotificationPreferences(optimistic);
    setSavingNotificationPreferences(true);
    try {
      const saved = await updateNotificationPreferences({ categoryPreferences: categories });
      setNotificationPreferences(saved);
    } catch {
      setNotificationPreferences(notificationPreferences);
      toast.error('No se pudieron guardar las preferencias de notificaciones');
    } finally {
      setSavingNotificationPreferences(false);
    }
  };

  const updateQuietHours = async (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    if (!notificationPreferences) return;
    const optimistic = { ...notificationPreferences, [field]: value || null };
    setNotificationPreferences(optimistic);
    try {
      const saved = await updateNotificationPreferences({ [field]: value || null });
      setNotificationPreferences(saved);
    } catch {
      setNotificationPreferences(notificationPreferences);
      toast.error('No se pudo actualizar el horario silencioso');
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadExport = async (format: "json" | "csv") => {
    setExporting(format);
    try {
      const endpoint =
        format === "json" ? "/export/json" : "/export/transactions.csv";
      const { data } = await api.get<Blob>(endpoint, { responseType: "blob" });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(
        data,
        format === "json"
          ? `lifequest-backup-${date}.json`
          : `transacciones-${date}.csv`,
      );
      toast.success(`Exportación ${format.toUpperCase()} descargada`);
    } catch {
      toast.error("No se pudo preparar la exportación");
    } finally {
      setExporting(null);
    }
  };

  const extractSpotifyId = (url: string): string | null => {
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const spotifyId = extractSpotifyId(playlistUrl);
  const openGymPlaylist = () => {
    if (!playlistUrl.trim()) return;
    const target = playlistUrl.startsWith("http")
      ? playlistUrl
      : `https://open.spotify.com/playlist/${playlistUrl}`;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[var(--accent-gold)]">
              Espacio personal
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Configuración
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-[var(--text-secondary)]">
              Ajusta tu experiencia, tus datos y las herramientas que acompañan
              tu progreso.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-panel)] text-[var(--accent-gold)]">
              <SettingsIcon size={15} />
            </span>
            Tema {currentTheme.name} ·{" "}
            {resolvedTheme === "dark" ? "modo oscuro" : "modo claro"}
          </div>
        </div>
      </header>

      <nav
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-1.5"
        aria-label="Secciones de configuración"
      >
        <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] sm:justify-start ${active ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {activeTab === "profile" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
              <SectionCard
                eyebrow="Tu identidad"
                title="Perfil"
                description="La información con la que LifeQuest te acompaña cada día."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Nombre de aventurero"
                    value={displayName}
                    onChange={setDisplayName}
                  />
                  <FormField
                    label="Correo"
                    value={user?.email ?? ""}
                    onChange={() => undefined}
                    type="email"
                    disabled
                    hint="El correo se administra desde tu cuenta."
                  />
                </div>
                <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
                  <FlowButton
                    onClick={saveProfile}
                    disabled={isSaving}
                    size="sm"
                    withArrows={false}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Save size={14} />
                      {isSaving ? "Guardando…" : "Guardar perfil"}
                    </span>
                  </FlowButton>
                </div>
              </SectionCard>

              <SectionCard
                title="Resumen de cuenta"
                description="Tu avance siempre acompaña tus preferencias."
              >
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-3.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent-gold)_12%,var(--bg-panel))] text-[var(--accent-gold)]">
                    <User size={21} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {user?.displayName || "Aventurero"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Nivel {user?.level ?? 1} · Racha{" "}
                      {user?.currentStreak ?? 0} días
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Stat label="Nivel" value={user?.level ?? 1} />
                  <Stat label="XP" value={user?.xp ?? 0} />
                  <Stat label="Oro" value={user?.gold ?? 0} />
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "game" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <SectionCard
                  eyebrow="Apariencia"
                  title="Modo de visualización"
                  description="Elige cómo se adapta la interfaz a tu entorno."
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    {APPEARANCE_OPTIONS.map(({ id, label, Icon }) => {
                      const selected = themeMode === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setThemeMode(id)}
                          className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${selected ? "border-[var(--accent-gold)] bg-[color-mix(in_oklab,var(--accent-gold)_9%,var(--bg-panel))] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"}`}
                        >
                          <Icon
                            size={17}
                            className={
                              selected ? "text-[var(--accent-gold)]" : ""
                            }
                          />
                          <span className="text-sm font-medium">{label}</span>
                          {selected && (
                            <Check
                              className="ml-auto text-[var(--accent-gold)]"
                              size={15}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Tema de LifeQuest"
                  description="Los temas desbloqueables aparecerán aquí sin cambiar tu información ni tus controles."
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    {THEMES.map((theme) => {
                      const selected = activeTheme === theme.id;
                      const isPreviewing = previewTheme === theme.id;
                      const Icon = theme.Icon;
                      return (
                        <div
                          key={theme.id}
                          className={`relative rounded-xl border p-3 transition-colors ${selected ? "border-[var(--accent-gold)] bg-[color-mix(in_oklab,var(--accent-gold)_7%,var(--bg-panel))]" : "border-[var(--border)] bg-[var(--bg-panel)]"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-panel-light)] text-[var(--accent-gold)]">
                              <Icon size={16} />
                            </span>
                            {selected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-gold)] text-white">
                                <Check size={12} />
                              </span>
                            )}
                            {!selected && theme.cost > 0 && (
                              <span className="text-xs font-medium text-[var(--text-muted)]">
                                {theme.cost} oro
                              </span>
                            )}
                          </div>
                          <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                            {theme.name}
                          </p>
                          <p className="mt-1 min-h-10 text-xs leading-4 text-[var(--text-secondary)]">
                            {theme.description}
                          </p>
                          <div className="mt-3 flex gap-1.5" aria-hidden="true">
                            {theme.colors.map((color) => (
                              <span
                                key={color}
                                className="h-2.5 flex-1 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <FlowButton
                              tone="primary"
                              size="sm"
                              withArrows={false}
                              disabled={themeLoading === theme.id || selected}
                              onClick={() => handleThemeChange(theme)}
                              className="min-h-11 text-xs"
                            >
                              {themeLoading === theme.id
                                ? "Aplicando…"
                                : selected
                                  ? "En uso"
                                  : "Aplicar"}
                            </FlowButton>
                            <FlowButton
                              tone="ghost"
                              size="sm"
                              withArrows={false}
                              onClick={() => handleThemePreview(theme.id)}
                              className="ml-auto min-h-11 gap-1 text-xs"
                            >
                              {isPreviewing ? (
                                <EyeOff size={13} />
                              ) : (
                                <Eye size={13} />
                              )}
                              Vista
                            </FlowButton>
                          </div>
                          {isPreviewing && (
                            <p className="mt-2 rounded-lg bg-[var(--bg-panel-light)] px-2 py-1.5 text-xs leading-4 text-[var(--text-secondary)]">
                              Previsualización conceptual. Tu tema activo no
                              cambia hasta aplicarlo.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Ritmo y recordatorios"
                  description="Configura las señales que quieres recibir durante tus aventuras."
                >
                  <div className="divide-y divide-[var(--border)]">
                    <Toggle
                      checked={audioEnabled}
                      onChange={() => toggleAudio()}
                      label="Sonidos de la experiencia"
                      description="Confirmaciones suaves al completar acciones y registrar tu progreso."
                    />
                    <Toggle
                      checked={animationsEnabled}
                      onChange={handleToggleAnimations}
                      label="Animaciones suaves"
                      description="Transiciones discretas para paneles, cambios de vista y estados de progreso."
                    />
                  </div>
                  <div className="mt-3 rounded-xl bg-[var(--bg-panel)] px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        {audioEnabled ? (
                          <Volume2
                            size={15}
                            className="text-[var(--accent-gold)]"
                          />
                        ) : (
                          <VolumeX size={15} />
                        )}
                        <span>
                          Notificaciones:{" "}
                          {notificationsEnabled ? "habilitadas" : "sin permiso"}
                        </span>
                      </div>
                      {notificationsEnabled ? (
                        <FlowButton
                          onClick={handleTestNotification}
                          disabled={testingNotif}
                          size="sm"
                          tone="ghost"
                          withArrows={false}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Bell size={14} />
                            {testingNotif ? "Enviando…" : "Probar aviso"}
                          </span>
                        </FlowButton>
                      ) : (
                        <FlowButton
                          onClick={handleEnableNotifications}
                          disabled={notifPermission === "unsupported"}
                          size="sm"
                          tone="ghost"
                          withArrows={false}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Bell size={14} /> Activar avisos
                          </span>
                        </FlowButton>
                      )}
                    </div>
                  </div>
                  {notifStatus && (
                    <p
                      className={`mt-3 rounded-xl px-3 py-2 text-xs ${notifStatus.ok ? "bg-[color-mix(in_oklab,var(--accent-green)_12%,var(--bg-panel))] text-[var(--accent-green)]" : "bg-[color-mix(in_oklab,var(--accent-gold)_12%,var(--bg-panel))] text-[var(--accent-gold)]"}`}
                    >
                      {notifStatus.text}
                    </p>
                  )}
                  {notificationPreferences && (
                    <div className="mt-4 border-t border-[var(--border)] pt-4">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Canales por categoría</p>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)]">La bandeja in-app se conserva; las horas silenciosas sólo pausan push.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                          <label>Silencio desde<input type="time" value={notificationPreferences.quietHoursStart ?? ''} onChange={(event) => void updateQuietHours('quietHoursStart', event.target.value)} className="mt-1 block h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-2 text-sm text-[var(--text-primary)]" /></label>
                          <label>Hasta<input type="time" value={notificationPreferences.quietHoursEnd ?? ''} onChange={(event) => void updateQuietHours('quietHoursEnd', event.target.value)} className="mt-1 block h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] px-2 text-sm text-[var(--text-primary)]" /></label>
                        </div>
                      </div>
                      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                        {notificationPreferences.categories.map((preference) => (
                          <div key={preference.category} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{NOTIFICATION_CATEGORY_LABELS[preference.category]}</span>
                            <button type="button" disabled={savingNotificationPreferences} onClick={() => void updateCategoryPreference(preference.category, 'inAppEnabled')} aria-pressed={preference.inAppEnabled} className={`min-h-9 rounded-lg border px-2 text-xs font-medium ${preference.inAppEnabled ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/12 text-[var(--accent-gold)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>En app</button>
                            <button type="button" disabled={savingNotificationPreferences} onClick={() => void updateCategoryPreference(preference.category, 'pushEnabled')} aria-pressed={preference.pushEnabled} className={`min-h-9 rounded-lg border px-2 text-xs font-medium ${preference.pushEnabled ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/12 text-[var(--accent-gold)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>Push</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="space-y-4">
                <SectionCard
                  title="Preferencias de juego"
                  description="Detalles que ajustan la forma en que planificas tu día."
                >
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        Zona horaria
                      </span>
                      <select
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        style={{ colorScheme: resolvedTheme }}
                        className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_20%,transparent)]"
                      >
                        <option value="America/Bogota">Bogotá (UTC−5)</option>
                        <option value="America/New_York">
                          Nueva York (UTC−5)
                        </option>
                        <option value="America/Chicago">Chicago (UTC−6)</option>
                        <option value="America/Mexico_City">
                          Ciudad de México (UTC−6)
                        </option>
                        <option value="America/Argentina/Buenos_Aires">
                          Buenos Aires (UTC−3)
                        </option>
                        <option value="America/Santiago">
                          Santiago (UTC−4)
                        </option>
                        <option value="Europe/Madrid">Madrid (UTC+1)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </label>
                    <Toggle
                      checked={showPlaylist}
                      onChange={setShowPlaylist}
                      label="Mostrar playlist"
                      description="Mantiene a mano tu música de enfoque en el dashboard."
                    />
                    {showPlaylist && (
                      <>
                        <FormField
                          label="Enlace de Spotify"
                          value={playlistUrl}
                          onChange={setPlaylistUrl}
                          type="url"
                          hint="Pega un enlace de playlist de Spotify."
                        />
                        {spotifyId && (
                          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2">
                            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                              <span className="text-xs text-[var(--text-secondary)]">
                                Vista previa de tu playlist
                              </span>
                              <FlowButton
                                onClick={openGymPlaylist}
                                size="sm"
                                tone="green"
                                withArrows={false}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <Music size={14} />
                                  Abrir
                                </span>
                              </FlowButton>
                            </div>
                            <iframe
                              title="Vista previa de playlist de Spotify"
                              src={`https://open.spotify.com/embed/playlist/${spotifyId}?theme=0`}
                              width="100%"
                              height="152"
                              frameBorder="0"
                              allow="encrypted-media"
                              className="rounded-lg"
                            />
                          </div>
                        )}
                      </>
                    )}
                    <FlowButton
                      onClick={saveProfile}
                      disabled={isSaving}
                      size="sm"
                      fullWidth
                      withArrows={false}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Save size={14} />
                        {isSaving ? "Guardando…" : "Guardar preferencias"}
                      </span>
                    </FlowButton>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Tu actividad"
                  description="Un vistazo rápido a lo que has construido."
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat label="Nivel" value={user?.level ?? 1} />
                    <Stat
                      label="Racha"
                      value={`${user?.currentStreak ?? 0} días`}
                    />
                    <Stat label="Fuerza" value={user?.strength ?? 0} />
                    <Stat label="Intelecto" value={user?.intelligence ?? 0} />
                    <Stat label="Carisma" value={user?.charisma ?? 0} />
                    <Stat label="Oro" value={user?.gold ?? 0} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--bg-panel)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                    <Clock3 size={14} className="text-[var(--accent-gold)]" />{" "}
                    Las métricas se actualizan con tus registros.
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <SectionCard
                eyebrow="Portabilidad"
                title="Exporta tu recorrido"
                description="Descarga tus registros cuando quieras. Las exportaciones no eliminan ni alteran tus datos."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <FlowButton
                    tone="secondary"
                    fullWidth
                    withArrows={false}
                    disabled={exporting === "json"}
                    onClick={() => downloadExport("json")}
                    className="min-h-40 items-start rounded-xl p-4 text-left"
                  >
                    <span className="block w-full">
                      <FileText
                        size={20}
                        className="text-[var(--accent-gold)]"
                      />
                      <span className="mt-3 block text-sm font-semibold text-[var(--text-primary)]">
                        Archivo JSON
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                        Copia completa para respaldo o migración.
                      </span>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-gold)]">
                        <Download size={13} />{" "}
                        {exporting === "json" ? "Preparando…" : "Descargar"}
                      </span>
                    </span>
                  </FlowButton>
                  <FlowButton
                    tone="secondary"
                    fullWidth
                    withArrows={false}
                    disabled={exporting === "csv"}
                    onClick={() => downloadExport("csv")}
                    className="min-h-40 items-start rounded-xl p-4 text-left"
                  >
                    <span className="block w-full">
                      <Database
                        size={20}
                        className="text-[var(--accent-gold)]"
                      />
                      <span className="mt-3 block text-sm font-semibold text-[var(--text-primary)]">
                        Archivo CSV
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                        Resumen práctico para hojas de cálculo.
                      </span>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-gold)]">
                        <Download size={13} />{" "}
                        {exporting === "csv" ? "Preparando…" : "Descargar"}
                      </span>
                    </span>
                  </FlowButton>
                </div>
              </SectionCard>
              <SectionCard
                title="Tu privacidad"
                description="LifeQuest usa tus registros para calcular tu progreso y personalizar tus vistas."
              >
                <div className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                  <p>
                    Exportar conserva una copia local para ti y deja intacta tu
                    cuenta.
                  </p>
                  <p>
                    Para soporte o cambios permanentes en los datos de tu
                    cuenta, revisa la sección Acerca de.
                  </p>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "about" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <SectionCard
                eyebrow="LifeQuest"
                title="Construye una vida que quieras jugar"
                description="Una capa de intención sobre tus hábitos, misiones, finanzas y bienestar."
              >
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_12%,var(--bg-panel))] text-[var(--accent-gold)]">
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        LifeQuest
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Versión 2.0
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
                    Diseñado para convertir los avances pequeños y sostenidos en
                    un recorrido visible, sin perder la calma ni el control
                    sobre tus datos.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <FlowButton
                    onClick={() => navigate("/about")}
                    size="sm"
                    withArrows={false}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Info size={14} />
                      Conocer LifeQuest
                    </span>
                  </FlowButton>
                </div>
              </SectionCard>
              <SectionCard
                title="Estado de la cuenta"
                description="Información útil de esta sesión."
              >
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-secondary)]">Tema</dt>
                    <dd className="font-medium text-[var(--text-primary)]">
                      {currentTheme.name}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-secondary)]">Apariencia</dt>
                    <dd className="font-medium capitalize text-[var(--text-primary)]">
                      {themeMode}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-secondary)]">
                      Notificaciones
                    </dt>
                    <dd className="font-medium text-[var(--text-primary)]">
                      {notificationsEnabled ? "Activas" : "Inactivas"}
                    </dd>
                  </div>
                </dl>
              </SectionCard>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
