import { FlowButton } from "@/components/ui/flow-button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BarChart3,
  CalendarClock,
  Coffee,
  Dumbbell,
  Minus,
  Moon,
  MonitorSmartphone,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { StatTile } from "@/components/ui/StatTile";
import { useToast } from "../../hooks/useToast";
import { PixelPanel } from "../../components/ui/PixelPanel";
import { LifeQuestFlipCard } from "../../components/ui/lifequest-flip-card";
import { PixelButton } from "../../components/ui/PixelButton";
import { ModalFrame } from "../../components/ui/ModalFrame";
import type { SleepLog, SleepStats } from "@lifequest/shared";
import * as sleepService from "../../services/sleep.service";
import { SageContextButton } from "../../components/sage/SageContextButton";
import { E } from "@/components/ui/glyphs";

const QUALITY_LABELS = [
  "",
  " Terrible",
  " Malo",
  " Regular",
  " Bueno",
  " Excelente",
];
const QUALITY_COLORS = [
  "",
  "var(--accent-red)",
  "var(--text-muted)",
  "var(--text-secondary)",
  "var(--accent-green)",
  "var(--accent-green)",
];

function SleepModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (log: SleepLog) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [bedtime, setBedtime] = useState(`${today}T23:00`);
  const [wakeTime, setWakeTime] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.toISOString().split("T")[0]}T07:00`;
  });
  const [quality, setQuality] = useState(4);
  const [notes, setNotes] = useState("");
  const [caffeineLate, setCaffeineLate] = useState(false);
  const [screensBeforeBed, setScreensBeforeBed] = useState(false);
  const [exercisedToday, setExercisedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const duration = (() => {
    try {
      let hours =
        (new Date(wakeTime).getTime() - new Date(bedtime).getTime()) / 3600000;
      if (hours < 0) hours += 24;
      return hours.toFixed(1);
    } catch {
      return "?";
    }
  })();

  async function save() {
    setSaving(true);
    try {
      const log = await sleepService.createSleep({
        bedtime,
        wakeTime,
        quality,
        notes: notes || undefined,
        date: today,
        caffeineLate,
        screensBeforeBed,
        exercisedToday,
      });
      onSave(log);
      toast.success("¡Sueño registrado!", `${duration}h de descanso`);
    } catch {
      toast.error("Error al registrar sueño");
    } finally {
      setSaving(false);
    }
  }

  const factors = [
    {
      key: "caffeine",
      label: "Tomé cafeína tarde",
      detail: "Después de las 4 p. m.",
      active: caffeineLate,
      setActive: setCaffeineLate,
      Icon: Coffee,
    },
    {
      key: "screens",
      label: "Usé pantallas antes de dormir",
      detail: "TV, móvil o computador",
      active: screensBeforeBed,
      setActive: setScreensBeforeBed,
      Icon: MonitorSmartphone,
    },
    {
      key: "exercise",
      label: "Hice ejercicio hoy",
      detail: "Entrenamiento o actividad física",
      active: exercisedToday,
      setActive: setExercisedToday,
      Icon: Dumbbell,
    },
  ];

  const inputClass =
    "min-h-11 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-gold)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent-gold)_16%,transparent)]";

  return (
    <ModalFrame
      title="Registrar descanso"
      description="Guarda cómo dormiste para detectar patrones y cuidar tu energía."
      icon={<Moon className="h-4 w-4" aria-hidden="true" />}
      onClose={onClose}
      size="lg"
      contentClassName="space-y-5"
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <PixelButton variant="ghost" onClick={onClose} className="w-full">
            Cancelar
          </PixelButton>
          <PixelButton
            variant="primary"
            onClick={save}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Guardando…" : "Registrar sueño"}
          </PixelButton>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <CalendarClock
              className="h-3.5 w-3.5 text-[var(--accent-gold)]"
              aria-hidden="true"
            />{" "}
            Me acosté
          </span>
          <input
            type="datetime-local"
            value={bedtime}
            onChange={(event) => setBedtime(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
            <CalendarClock
              className="h-3.5 w-3.5 text-[var(--accent-gold)]"
              aria-hidden="true"
            />{" "}
            Me levanté
          </span>
          <input
            type="datetime-local"
            value={wakeTime}
            onChange={(event) => setWakeTime(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-4 text-center shadow-sm">
        <p className="text-sm font-medium text-[var(--text-muted)]">
          Duración calculada
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--accent-gold)]">
          {duration}
          <span className="ml-0.5 text-base">h</span>
        </p>
      </section>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
          ¿Cómo descansaste?
        </legend>
        <div
          className="flex items-center gap-2"
          role="radiogroup"
          aria-label="Calidad del sueño"
        >
          {[1, 2, 3, 4, 5].map((rating) => {
            const selected = quality === rating;
            return (
              <motion.button
                key={rating}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setQuality(rating)}
                aria-label={`${rating} de 5`}
                aria-pressed={selected}
                className={`flex h-11 flex-1 items-center justify-center rounded-xl border text-lg transition-colors ${
                  selected
                    ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                }`}
              >
                <E e="⭐" />
              </motion.button>
            );
          })}
        </div>
        <p
          className="mt-2 text-center text-sm font-medium"
          style={{ color: QUALITY_COLORS[quality] }}
        >
          <E e={QUALITY_LABELS[quality]} />
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
          Factores de la noche
        </legend>
        <div className="space-y-2">
          {factors.map(({ key, label, detail, active, setActive, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(!active)}
              aria-pressed={active}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/10"
                  : "border-[var(--border)] bg-[var(--bg-panel-light)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--text-primary)]">
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                  {detail}
                </span>
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${active ? "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--bg-deep)]" : "border-[var(--border-strong)] text-transparent"}`}
              >
                <E e="✓" />
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          Notas{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (opcional)
          </span>
        </span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Algo que quieras recordar sobre tu noche"
          className={inputClass}
        />
      </label>
    </ModalFrame>
  );
}

export default function SleepPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([
        sleepService.fetchSleep(),
        sleepService.fetchSleepStats(),
      ]);
      setLogs(l);
      setStats(s);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved(log: SleepLog) {
    setLogs((prev) => [log, ...prev]);
    setShowModal(false);
    load();
  }

  async function handleDelete(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    try {
      await sleepService.deleteSleep(id);
      load();
    } catch {
      toast.error("Error al eliminar");
      load();
    }
  }

  const chartData = logs
    .slice(0, 14)
    .reverse()
    .map((l) => ({
      date: new Date(l.date).toLocaleDateString("es-CO", {
        month: "short",
        day: "numeric",
      }),
      horas: Number(l.duration.toFixed(1)),
      quality: l.quality,
    }));

  const lastLog = logs[0];
  const historyLogs = lastLog ? logs.slice(1) : logs;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            <Moon className="h-5 w-5 text-[var(--accent-gold)]" aria-hidden="true" />
            Torre del sueño
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Registra tu descanso y entiende los patrones que influyen en tu energía.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SageContextButton
            message="¿Cómo está mi sueño últimamente? ¿Qué patrones detectas?"
            label="Pídele consejo al Sabio"
          />
          <FlowButton tone="primary" size="lg" withArrows={false} onClick={() => setShowModal(true)}>
            Registrar sueño
          </FlowButton>
        </div>
      </div>

      {!loading && logs.length === 0 && (
        <EmptyState
          icon={Moon}
          title="Tu descanso empieza esta noche"
          description="Guarda tu primera noche para descubrir cómo cambia tu energía con el tiempo."
          actionLabel="Registrar mi primera noche"
          onAction={() => setShowModal(true)}
        />
      )}

      {/* Stats */}
      {stats && logs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Promedio semanal",
              value: `${stats.weeklyAvg.toFixed(1)}h`,
              icon: Moon,
            },
            {
              label: "Promedio total",
              value: `${stats.avgDuration.toFixed(1)}h`,
              icon: BarChart3,
            },
            {
              label: "Calidad media",
              value: `${stats.avgQuality.toFixed(1)}/5`,
              icon: Star,
            },
            {
              label: "Tendencia",
              value:
                stats.trend === "improving"
                  ? "Mejorando"
                  : stats.trend === "declining"
                    ? "Bajando"
                    : "Estable",
              icon:
                stats.trend === "improving"
                  ? TrendingUp
                  : stats.trend === "declining"
                    ? TrendingDown
                    : Minus,
            },
          ].map((s, i) => (
            <StatTile key={s.label} icon={s.icon} label={s.label} value={s.value} index={i} />
          ))}
        </div>
      )}

      {/* Latest night: replaces the former static duplicate and stays out of history. */}
      {!loading && lastLog && (
        <LifeQuestFlipCard
          eyebrow="Anoche"
          title="Descanso de anoche"
          description={`De ${new Date(lastLog.bedtime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} a ${new Date(lastLog.wakeTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}. Calidad: ${QUALITY_LABELS[lastLog.quality].trim() || "Sin valorar"}.`}
          visual={
            <div className="flex items-center gap-4" aria-hidden="true">
              <span className="shrink-0 text-6xl leading-none">
                <E e="🌙" s={64} />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-5xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
                  {lastLog.duration.toFixed(1)}h
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  última noche
                </p>
              </div>
            </div>
          }
          visualLabel={`Última noche: ${lastLog.duration.toFixed(1)} horas de descanso`}
          badge="Último registro"
          frontFooter={
            <p className="text-xs font-semibold [color:var(--flip-accent)]">
              {Array.from({ length: lastLog.quality }).map((_, index) => (
                <E key={index} e="⭐" s={13} className="inline-block" />
              ))}
            </p>
          }
          backDescription={
            <p>
              {lastLog.duration < 7
                ? "Tu descanso quedó por debajo de siete horas. Registra la próxima noche para detectar si el patrón continúa."
                : "Una noche registrada se vuelve útil cuando puedes compararla con las que vienen."}
            </p>
          }
          metrics={[
            {
              label: "Semanal",
              value: stats ? `${stats.weeklyAvg.toFixed(1)}h` : "—",
            },
            { label: "Calidad", value: `${lastLog.quality}/5` },
            { label: "Registros", value: logs.length },
          ]}
          actionLabel="Registrar otra noche"
          onAction={() => setShowModal(true)}
          accent="var(--accent-gold)"
        />
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <PixelPanel className="p-4">
          <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">
            Últimas dos semanas
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{
                  fontFamily: "Montserrat",
                  fontSize: 12,
                  fill: "var(--text-secondary)",
                }}
              />
              <YAxis
                domain={[0, 10]}
                tick={{
                  fontFamily: "Montserrat",
                  fontSize: 12,
                  fill: "var(--text-secondary)",
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-strong)",
                  fontFamily: "Montserrat",
                  fontSize: "16px",
                  color: "var(--text-primary)",
                }}
                formatter={(v: number) => `${v}h`}
              />
              <Bar dataKey="horas">
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={QUALITY_COLORS[d.quality] ?? "var(--text-muted)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PixelPanel>
      )}

      {/* Log list */}
      {!loading && historyLogs.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Historial
          </p>
          <AnimatePresence>
            {historyLogs.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <PixelPanel className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-vt text-text-primary text-lg">
                      {new Date(l.date).toLocaleDateString("es-CO", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p
                      className="font-pixel text-text-secondary"
                      style={{ fontSize: "12px" }}
                    >
                      {new Date(l.bedtime).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      →{" "}
                      {new Date(l.wakeTime).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p
                      className="font-pixel text-accent-gold"
                      style={{ fontSize: "12px" }}
                    >
                      {l.duration.toFixed(1)}h
                    </p>
                    <p
                      className="font-vt text-base"
                      style={{ color: QUALITY_COLORS[l.quality] }}
                    >
                      {Array.from({ length: l.quality }).map((_, i) => (
                        <E key={i} e="⭐" s={14} className="inline-block" />
                      ))}
                    </p>
                    <FlowButton
                      tone="danger"
                      size="sm"
                      withArrows={false}
                      onClick={() => handleDelete(l.id)}
                      className="h-11 w-11 px-3 font-pixel text-xs"
                    >
                      <E e="✕" />
                    </FlowButton>
                  </div>
                </PixelPanel>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <SleepModal
            onClose={() => setShowModal(false)}
            onSave={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
