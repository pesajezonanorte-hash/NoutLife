import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Dumbbell,
  Flame,
  Globe,
  Medal,
  PiggyBank,
  RefreshCw,
  Trophy,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  getLeaderboard,
  sendFriendRequest,
  getFriends,
  getPendingRequests,
  respondFriendRequest,
  removeFriend,
} from "../../services/social.service";
import { useAuthStore } from "../../store/authStore";
import { AvatarDisplay } from "../../components/character/AvatarDisplay";
import { FlowButton } from "../../components/ui/flow-button";

type Category = "xp" | "streak" | "gym" | "savings";

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  level: number;
  value: number;
  xpToNextLevel?: number;
  avatarConfig?: unknown;
  avatarUrl?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
  equippedHat?: string | null;
}

interface Friend {
  friendshipId: string;
  friend: {
    id: string;
    username: string;
    displayName: string;
    level: number;
    currentStreak: number;
    avatarConfig?: unknown;
    avatarUrl?: string | null;
  };
  since: string;
}

interface PendingRequest {
  id: string;
  requester: {
    id: string;
    username: string;
    displayName: string;
    level: number;
    avatarConfig?: unknown;
    avatarUrl?: string | null;
  };
  createdAt: string;
}

const CATEGORIES: Array<{
  id: Category;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  unit: string;
  description: string;
}> = [
  {
    id: "xp",
    label: "XP total",
    shortLabel: "XP",
    Icon: Trophy,
    unit: "XP",
    description: "Progreso acumulado de cada aventurero.",
  },
  {
    id: "streak",
    label: "Racha activa",
    shortLabel: "Racha",
    Icon: Flame,
    unit: "días",
    description: "Días consecutivos sosteniendo el ritmo.",
  },
  {
    id: "gym",
    label: "Entrenamiento",
    shortLabel: "Gym",
    Icon: Dumbbell,
    unit: "sesiones",
    description: "Sesiones registradas en el Coliseo.",
  },
  {
    id: "savings",
    label: "Ahorro",
    shortLabel: "Ahorro",
    Icon: PiggyBank,
    unit: "%",
    description: "Porcentaje de ahorro del mes actual.",
  },
];

function formatValue(value: number, unit: string) {
  const amount = new Intl.NumberFormat("es-CO").format(value);
  return unit === "%" ? `${amount}%` : `${amount} ${unit}`;
}

function rankTone(rank: number) {
  if (rank === 1)
    return "text-[var(--accent-gold)] border-[color-mix(in_oklab,var(--accent-gold)_42%,var(--border))] bg-[color-mix(in_oklab,var(--accent-gold)_10%,var(--bg-panel))]";
  if (rank === 2)
    return "text-[var(--text-primary)] border-[var(--border-strong)] bg-[var(--bg-panel)]";
  if (rank === 3)
    return "text-[var(--text-secondary)] border-[var(--border)] bg-[var(--bg-panel)]";
  return "text-[var(--text-muted)] border-transparent bg-transparent";
}

function RankMark({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg border ${rankTone(rank)}`}
        aria-label={`Posición ${rank}`}
      >
        <Medal size={16} strokeWidth={1.9} />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center text-xs font-semibold tabular-nums text-[var(--text-muted)]">
      {rank}
    </span>
  );
}

function PanelTitle({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_10%,var(--bg-panel))] text-[var(--accent-gold)]">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {detail && (
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

function FriendManager({
  friends,
  pending,
  loading,
  addInput,
  setAddInput,
  addLoading,
  addMessage,
  onSend,
  onRespond,
  onRemove,
}: {
  friends: Friend[];
  pending: PendingRequest[];
  loading: boolean;
  addInput: string;
  setAddInput: (value: string) => void;
  addLoading: boolean;
  addMessage: { ok: boolean; text: string } | null;
  onSend: () => Promise<void>;
  onRespond: (id: string, accept: boolean) => Promise<void>;
  onRemove: (friendshipId: string) => Promise<void>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <PanelTitle
          icon={Users}
          title="Tu círculo"
          detail="Compara avances y acompaña el progreso de tus amigos."
        />
      </div>
      <div className="space-y-4 p-4">
        <div>
          <label
            className="text-xs font-medium text-[var(--text-secondary)]"
            htmlFor="friend-identifier"
          >
            Invitar a un amigo
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="friend-identifier"
              value={addInput}
              onChange={(event) => setAddInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void onSend();
              }}
              placeholder="Usuario o código"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_20%,transparent)]"
            />
            <FlowButton
              onClick={() => void onSend()}
              disabled={addLoading || !addInput.trim()}
              size="sm"
              withArrows={false}
              aria-label="Enviar solicitud de amistad"
            >
              <span className="inline-flex items-center gap-1.5">
                <UserPlus size={14} />
                {addLoading ? "…" : "Enviar"}
              </span>
            </FlowButton>
          </div>
          {addMessage && (
            <p
              className={`mt-2 text-xs ${addMessage.ok ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}
            >
              {addMessage.text}
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Cargando amistades">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Solicitudes · {pending.length}
                </p>
                <div className="space-y-2">
                  {pending.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2.5"
                    >
                      <AvatarDisplay
                        avatarConfig={request.requester.avatarConfig}
                        avatarUrl={request.requester.avatarUrl}
                        size={34}
                        animate="idle"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {request.requester.displayName}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          @{request.requester.username} · Nivel{" "}
                          {request.requester.level}
                        </p>
                      </div>
                      <FlowButton
                        tone="green"
                        size="sm"
                        withArrows={false}
                        className="h-8 w-8 px-2"
                        onClick={() => void onRespond(request.id, true)}
                        aria-label={`Aceptar solicitud de ${request.requester.displayName}`}
                      >
                        <Check size={15} />
                      </FlowButton>
                      <FlowButton
                        tone="danger"
                        size="sm"
                        withArrows={false}
                        className="h-8 w-8 px-2"
                        onClick={() => void onRespond(request.id, false)}
                        aria-label={`Rechazar solicitud de ${request.requester.displayName}`}
                      >
                        <X size={15} />
                      </FlowButton>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Amigos · {friends.length}
              </p>
              {friends.length ? (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {friends.map(({ friendshipId, friend }) => (
                    <div
                      key={friendshipId}
                      className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-2.5"
                    >
                      <AvatarDisplay
                        avatarConfig={friend.avatarConfig}
                        avatarUrl={friend.avatarUrl}
                        size={34}
                        animate="idle"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {friend.displayName}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          @{friend.username} · Nivel {friend.level} ·{" "}
                          {friend.currentStreak} días
                        </p>
                      </div>
                      <FlowButton
                        tone="danger"
                        size="sm"
                        withArrows={false}
                        className="h-8 w-8 px-2"
                        onClick={() => void onRemove(friendshipId)}
                        aria-label={`Eliminar a ${friend.displayName}`}
                      >
                        <X size={14} />
                      </FlowButton>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-[var(--bg-panel)] px-3 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                  Aún no tienes amigos. Invita a alguien con su usuario o código
                  de invitación.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState<Category>("xp");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const currentCategory = useMemo(
    () => CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0],
    [category],
  );

  const refreshLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getLeaderboard(category, friendsOnly);
      setData(response as LeaderboardEntry[]);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [category, friendsOnly]);

  const refreshFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const [friendList, pendingList] = await Promise.all([
        getFriends(),
        getPendingRequests(),
      ]);
      setFriends(friendList as Friend[]);
      setPending(pendingList as PendingRequest[]);
    } catch {
      setFriends([]);
      setPending([]);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLeaderboard();
  }, [refreshLeaderboard]);
  useEffect(() => {
    if (friendsOnly) void refreshFriends();
  }, [friendsOnly, refreshFriends]);

  const myEntry = data.find((entry) => entry.id === user?.id);

  const handleSendRequest = async () => {
    if (!addInput.trim()) return;
    setAddLoading(true);
    setAddMessage(null);
    try {
      await sendFriendRequest(addInput.trim());
      setAddMessage({
        ok: true,
        text: "Solicitud enviada. Aparecerá en tu círculo cuando sea aceptada.",
      });
      setAddInput("");
    } catch (error: unknown) {
      const response = error as { response?: { data?: { error?: string } } };
      setAddMessage({
        ok: false,
        text:
          response.response?.data?.error ?? "No se pudo enviar la solicitud.",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRespond = async (id: string, accept: boolean) => {
    try {
      await respondFriendRequest(id, accept);
      setPending((items) => items.filter((item) => item.id !== id));
      if (accept) await Promise.all([refreshFriends(), refreshLeaderboard()]);
    } catch {
      setAddMessage({ ok: false, text: "No se pudo actualizar la solicitud." });
    }
  };

  const handleRemove = async (friendshipId: string) => {
    try {
      await removeFriend(friendshipId);
      setFriends((items) =>
        items.filter((item) => item.friendshipId !== friendshipId),
      );
      await refreshLeaderboard();
    } catch {
      setAddMessage({ ok: false, text: "No se pudo eliminar a este amigo." });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-4 py-5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-gold)]">
              Comunidad
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Tabla de líderes
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-[var(--text-secondary)]">
              Una lectura clara del progreso global o de las personas que tienes
              cerca.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_10%,var(--bg-panel))] text-[var(--accent-gold)]">
              <Trophy size={16} />
            </span>
            Actualizado al abrir esta vista
          </div>
        </div>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.08)] sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex rounded-xl bg-[var(--bg-panel)] p-1"
                aria-label="Alcance de la clasificación"
              >
                <button
                  type="button"
                  onClick={() => setFriendsOnly(false)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${!friendsOnly ? "bg-[var(--bg-panel-light)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  aria-pressed={!friendsOnly}
                >
                  <Globe size={15} />
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => setFriendsOnly(true)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${friendsOnly ? "bg-[var(--bg-panel-light)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  aria-pressed={friendsOnly}
                >
                  <Users size={15} />
                  Amigos
                </button>
              </div>
              <FlowButton
                tone="ghost"
                size="sm"
                withArrows={false}
                onClick={() => void refreshLeaderboard()}
                className="min-h-11 gap-1.5"
                aria-label="Actualizar tabla"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                Actualizar
              </FlowButton>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map(({ id, label, shortLabel, Icon }) => {
                const selected = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${selected ? "border-[var(--accent-gold)] bg-[color-mix(in_oklab,var(--accent-gold)_9%,var(--bg-panel))] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"}`}
                  >
                    <Icon
                      size={16}
                      className={
                        selected
                          ? "shrink-0 text-[var(--accent-gold)]"
                          : "shrink-0"
                      }
                    />
                    <span className="min-w-0 truncate text-xs font-medium">
                      <span className="sm:hidden">{shortLabel}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
              <PanelTitle
                icon={currentCategory.Icon}
                title={currentCategory.label}
                detail={currentCategory.description}
              />
              <span className="rounded-full bg-[var(--bg-panel)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {friendsOnly ? "Tu círculo" : "Global"} · {data.length}
              </span>
            </div>

            {loading ? (
              <div
                className="space-y-2 p-4 sm:p-5"
                aria-label="Cargando tabla de líderes"
              >
                {[1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="skeleton h-[68px] rounded-xl" />
                ))}
              </div>
            ) : data.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <Users
                  size={28}
                  className="mx-auto text-[var(--text-muted)] opacity-50"
                />
                <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                  Aún no hay posiciones para mostrar
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">
                  {friendsOnly
                    ? "Invita a tus amigos o registra una actividad para empezar la comparación."
                    : "Sé de los primeros en registrar tu progreso."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {data.slice(0, 50).map((entry, index) => {
                  const isMe = entry.id === user?.id;
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.18,
                        delay: Math.min(index, 8) * 0.025,
                      }}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors sm:px-5 ${isMe ? "bg-[color-mix(in_oklab,var(--accent-gold)_8%,var(--bg-panel))]" : "hover:bg-[var(--bg-panel)]"}`}
                    >
                      <RankMark rank={entry.rank} />
                      <AvatarDisplay
                        avatarConfig={entry.avatarConfig}
                        avatarUrl={entry.avatarUrl}
                        equippedAura={entry.equippedAura}
                        equippedFrame={entry.equippedFrame}
                        size={42}
                        animate="idle"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p
                            className={`truncate text-sm font-semibold ${isMe ? "text-[var(--accent-gold)]" : "text-[var(--text-primary)]"}`}
                          >
                            {entry.displayName}
                          </p>
                          {isMe && (
                            <span className="rounded-full bg-[color-mix(in_oklab,var(--accent-gold)_12%,var(--bg-panel))] px-1.5 py-0.5 text-xs font-medium text-[var(--accent-gold)]">
                              Tú
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                          @{entry.username} · Nivel {entry.level}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-[var(--accent-gold)]">
                          {formatValue(entry.value, currentCategory.unit)}
                        </p>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
                          Posición {entry.rank}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
            <PanelTitle
              icon={Trophy}
              title="Tu posición"
              detail={
                friendsOnly
                  ? "Dentro de tu círculo."
                  : "Dentro de la clasificación global."
              }
            />
            {myEntry ? (
              <div className="mt-4 flex items-end justify-between rounded-xl border border-[color-mix(in_oklab,var(--accent-gold)_35%,var(--border))] bg-[color-mix(in_oklab,var(--accent-gold)_8%,var(--bg-panel))] px-3.5 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Posición
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--accent-gold)]">
                    #{myEntry.rank}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatValue(myEntry.value, currentCategory.unit)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {currentCategory.shortLabel}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--bg-panel)] px-3 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                Registra actividad en esta categoría para aparecer en la tabla.
              </p>
            )}
          </section>

          <AnimatePresence mode="wait">
            {friendsOnly ? (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
              >
                <FriendManager
                  friends={friends}
                  pending={pending}
                  loading={friendsLoading}
                  addInput={addInput}
                  setAddInput={setAddInput}
                  addLoading={addLoading}
                  addMessage={addMessage}
                  onSend={handleSendRequest}
                  onRespond={handleRespond}
                  onRemove={handleRemove}
                />
              </motion.div>
            ) : (
              <motion.section
                key="global"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.08)]"
              >
                <PanelTitle
                  icon={Users}
                  title="Compite con calma"
                  detail="La tabla sirve como referencia: tu avance más importante es el que puedes sostener."
                />
                <FlowButton
                  onClick={() => setFriendsOnly(true)}
                  tone="ghost"
                  size="sm"
                  withArrows={false}
                  className="mt-4 w-full"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <UserPlus size={14} />
                    Ver amigos
                  </span>
                </FlowButton>
              </motion.section>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
