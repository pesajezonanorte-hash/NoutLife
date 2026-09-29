import { FlowButton } from "@/components/ui/flow-button";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Sun,
  Moon,
  Zap,
  Play,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Flame,
  X,
  Timer,
} from "lucide-react";
import { useToastStore } from "../../hooks/useToast";
import * as ritualsService from "../../services/rituals.service";
import type { Ritual, RitualStep } from "../../services/rituals.service";
import { E } from "@/components/ui/glyphs";

const TYPE_CONFIG = {
  morning: {
    label: "Mañana",
    color: "var(--accent-gold)",
    icon: <Sun size={16} />,
  },
  night: {
    label: "Noche",
    color: "var(--accent-cyan)",
    icon: <Moon size={16} />,
  },
  custom: {
    label: "Custom",
    color: "var(--accent-green)",
    icon: <Zap size={16} />,
  },
};

function ExecutionMode({
  ritual,
  onClose,
  onComplete,
}: {
  ritual: Ritual;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [completing, setCompleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToastStore();

  const step = ritual.steps[stepIdx];
  const isLast = stepIdx === ritual.steps.length - 1;
  const progress = (stepIdx / ritual.steps.length) * 100;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (step?.durationMin) {
      const total = step.durationMin * 60;
      setTimer(total);
      setElapsed(0);
    } else {
      setTimer(null);
      setElapsed(0);
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [stepIdx, step?.durationMin]);

  useEffect(() => {
    if (timer === null) return;
    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e >= timer) {
          clearInterval(intervalRef.current!);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          return e;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [timer]);

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  async function handleNext() {
    if (isLast) {
      setCompleting(true);
      try {
        const result = await ritualsService.completeRitual(ritual.id);
        if (result.alreadyDone) {
          toast.info(result.message);
        } else {
          toast.success(result.message);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
        }
        onComplete();
      } catch {
        toast.error("Error al completar el ritual");
      } finally {
        setCompleting(false);
      }
    } else {
      setStepIdx((i) => i + 1);
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  const timerPct = timer ? (elapsed / timer) * 100 : 0;
  const cfg =
    TYPE_CONFIG[ritual.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.custom;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-deep)]"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div>
          <span className="text-lg mr-2">
            <E e={ritual.icon} />
          </span>
          <span className="font-semibold text-[var(--text-primary)]">
            {ritual.name}
          </span>
        </div>
        <FlowButton
          tone="ghost"
          size="sm"
          withArrows={false}
          onClick={onClose}
          className="h-11 w-11 px-3"
          aria-label="Cerrar ejecución del ritual"
        >
          <X size={18} />
        </FlowButton>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <motion.div
          className="h-full"
          style={{ background: cfg.color }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Step display */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          className="space-y-6"
        >
          <div
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: cfg.color }}
          >
            Paso {stepIdx + 1} de {ritual.steps.length}
          </div>

          <h2 className="text-3xl font-bold text-[var(--text-primary)] max-w-sm">
            {step?.title}
          </h2>

          {/* Timer */}
          {timer !== null && (
            <div
              className="relative mx-auto"
              style={{ width: 120, height: 120 }}
            >
              <svg
                width={120}
                height={120}
                style={{ transform: "rotate(-90deg)" }}
              >
                <circle
                  cx={60}
                  cy={60}
                  r={52}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth={8}
                />
                <motion.circle
                  cx={60}
                  cy={60}
                  r={52}
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 52}
                  animate={{
                    strokeDashoffset: 2 * Math.PI * 52 * (1 - timerPct / 100),
                  }}
                  transition={{ duration: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Timer size={16} className="text-[var(--text-muted)] mb-1" />
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: cfg.color }}
                >
                  {formatTime(Math.max(0, timer - elapsed))}
                </span>
              </div>
            </div>
          )}

          {timer === null && (
            <div className="text-5xl">
              <E e="✅" />
            </div>
          )}

          <p className="text-sm text-[var(--text-muted)]">
            {timer !== null
              ? "El timer suena cuando termines el paso"
              : "Haz el paso y marca completado"}
          </p>
        </motion.div>
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-1.5 pb-4">
        {ritual.steps.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${i < stepIdx ? "w-2 h-2" : i === stepIdx ? "w-4 h-2" : "w-2 h-2 opacity-30"}`}
            style={{
              background: i <= stepIdx ? cfg.color : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      {/* Next button */}
      <div className="px-6 pb-10">
        <FlowButton
          tone="primary"
          fullWidth
          withArrows={false}
          onClick={handleNext}
          disabled={completing}
          className="h-14 rounded-2xl text-base"
          style={{ background: cfg.color, color: "var(--bg-deep)" }}
        >
          {completing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isLast ? (
            <>
              <CheckCircle2 size={20} /> ¡Completar Ritual!
            </>
          ) : (
            <>
              Hecho <ChevronRight size={20} />
            </>
          )}
        </FlowButton>
      </div>
    </motion.div>
  );
}

function RitualCard({
  ritual,
  onRefresh,
}: {
  ritual: Ritual;
  onRefresh: () => void;
}) {
  const [executing, setExecuting] = useState(false);
  const [stats, setStats] = useState<{
    streak: number;
    thisMonth: number;
  } | null>(null);
  const cfg =
    TYPE_CONFIG[ritual.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.custom;
  const toast = useToastStore();

  useEffect(() => {
    ritualsService
      .getRitualStats(ritual.id)
      .then((s) => setStats({ streak: s.streak, thisMonth: s.thisMonth }))
      .catch(() => null);
  }, [ritual.id]);

  const totalDuration = ritual.steps.reduce(
    (s, step) => s + (step.durationMin ?? 0),
    0,
  );

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 transition-colors group"
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: cfg.color + "22" }}
          >
            <E e={ritual.icon} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">
                  {ritual.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: cfg.color + "22", color: cfg.color }}
                  >
                    {cfg.icon} {cfg.label}
                  </span>
                  {totalDuration > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {totalDuration} min
                    </span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">
                    {ritual.steps.length} pasos
                  </span>
                </div>
              </div>
              <FlowButton
                tone="ghost"
                size="sm"
                withArrows={false}
                onClick={() => setExecuting(true)}
                className="min-h-11 shrink-0 gap-1.5"
                style={{ background: cfg.color + "22", color: cfg.color }}
              >
                <Play size={12} /> Ejecutar
              </FlowButton>
            </div>

            {/* Steps preview */}
            <div className="mt-3 flex gap-1 flex-wrap">
              {ritual.steps.slice(0, 4).map((step, i) => (
                <span
                  key={step.id}
                  className="text-xs text-[var(--text-muted)] bg-[var(--bg-panel-light)] px-2 py-0.5 rounded-full"
                >
                  {i + 1}.{" "}
                  {step.title.length > 20
                    ? step.title.slice(0, 20) + "…"
                    : step.title}
                </span>
              ))}
              {ritual.steps.length > 4 && (
                <span className="text-xs text-[var(--text-muted)]">
                  +{ritual.steps.length - 4} más
                </span>
              )}
            </div>

            {/* Stats */}
            {stats && (
              <div className="flex items-center gap-3 mt-3">
                {stats.streak > 0 && (
                  <div className="flex items-center gap-1 text-xs text-[var(--accent-gold)]">
                    <Flame size={12} /> {stats.streak}d racha
                  </div>
                )}
                <div className="text-xs text-[var(--text-muted)]">
                  {stats.thisMonth} este mes
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {executing && (
          <ExecutionMode
            ritual={ritual}
            onClose={() => setExecuting(false)}
            onComplete={() => {
              setExecuting(false);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function RitualsPage() {
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const toast = useToastStore();

  const load = useCallback(async () => {
    try {
      const data = await ritualsService.listRituals();
      setRituals(data);
    } catch {
      toast.error("Error cargando rituales");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSeedPresets() {
    setSeeding(true);
    try {
      await ritualsService.seedPresets();
      await load();
      toast.success("¡Rituales presets creados!");
    } catch {
      toast.error("Error");
    } finally {
      setSeeding(false);
    }
  }

  const grouped = {
    morning: rituals.filter((r) => r.type === "morning"),
    night: rituals.filter((r) => r.type === "night"),
    custom: rituals.filter((r) => r.type === "custom"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Sun className="text-[var(--accent-gold)]" size={24} />
            Rituales
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Secuencias que construyen a la mejor versión de ti
          </p>
        </div>
        {rituals.length > 0 && (
          <FlowButton
            tone="ghost"
            size="sm"
            withArrows={false}
            disabled
            title="La creación de rituales personalizados estará disponible próximamente"
            className="min-h-11 gap-2"
          >
            <Plus size={16} /> Nuevo
          </FlowButton>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-[var(--bg-panel)] animate-pulse"
            />
          ))}
        </div>
      ) : rituals.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 space-y-4"
        >
          <div className="text-6xl">
            <E e="⚡" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Sin rituales todavía
          </h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-xs mx-auto">
            Los rituales son secuencias de pasos que ejecutas cada día. Empieza
            con los presets o crea los tuyos.
          </p>
          <FlowButton
            tone="primary"
            withArrows={false}
            onClick={handleSeedPresets}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{
              background: "var(--accent-gold)",
              color: "var(--bg-deep)",
            }}
          >
            {seeding ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            Cargar rituales sugeridos
          </FlowButton>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {(Object.entries(grouped) as [keyof typeof grouped, Ritual[]][]).map(
            ([type, list]) => {
              if (list.length === 0) return null;
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <h2
                      className="text-sm font-semibold"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {list.map((r) => (
                      <RitualCard key={r.id} ritual={r} onRefresh={load} />
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
