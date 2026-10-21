// Onboarding de 60 segundos (plan v3, T4), en 4 pasos y un cierre:
//   1. ¿Cómo te llamamos? — nombre, cómo te identificas, el personaje (su estudio
//      se abre encima) y, opcional, cómo nos conociste.
//   2. Elige tu luz — claro, oscuro (Aurora) o automático; la app cambia al momento.
//   3. ¿Qué quieres ordenar primero? — hasta 3 áreas y la meta del año (opcional).
//   4. Tu primer hábito — packs de un toque y «¿Ya hiciste alguno hoy? Márcalo».
// Cierre: «Tu espacio está listo». El progreso se guarda en este dispositivo; los
// hábitos de los packs se crean al tocarlos, así se pueden marcar en el mismo paso.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import type { AvatarConfig, Gender } from '@noutlife/shared';
import { ease } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, type ThemeMode } from '@/store/themeStore';
import { useToast } from '@/hooks/useToast';
import * as authService from '@/services/auth.service';
import { completeOnboarding } from '@/services/user.service';
import { createHabit, logHabit } from '@/services/habit.service';
import { createAntiHabit } from '@/services/antiHabit.service';
import { orderFromGoals, useNavStore } from '@/store/navStore';
import { bodyFor } from '@/utils/gender';
import { isProRequired, LITE_LIMITS } from '@/lib/plan';
import { track } from '@/lib/analytics';
import { BrandLockup } from '@/components/layout/Brand';
import { Button, CheckButton, IconChip, ModernLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { AvatarPreview } from '@/components/character/AvatarPixelEditor';
import { withBody, withDefaults } from '@/components/character/avatarOptions';
import {
  AvatarContent, GoalsContent, IdentityFields, LightChoice, MAX_GOALS, PACKS, goalCategoryOf, type HowFound, type Pack,
} from '@/components/onboarding/steps';
import { Lettering, TitleText } from '@/components/layout/Lettering';

const STORAGE_KEY = 'lifequest_onboarding_progress';
const TOTAL_STEPS = 4;

/** Hábito creado por un pack; `daily` dice si se puede marcar hoy. */
interface Created { id: string; title: string; daily: boolean; done: boolean; xp?: number }

interface OnboardingState {
  step: number;
  displayName: string;
  birthDate: string;
  timezone: string;
  gender: Gender | '';
  avatarConfig: Partial<AvatarConfig>;
  howFound: HowFound | '';
  goalCategories: string[];
  yearGoal: string;
  packs: string[];
  created: Created[];
}

function loadSaved(): Partial<OnboardingState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state: Partial<OnboardingState>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* sin storage */ }
}

/** Título del paso; al montarse por un cambio de paso recibe el foco (los lectores lo anuncian). */
function StepTitle({ children, focus }: { children: ReactNode; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focus) ref.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <h1 ref={ref} tabIndex={-1} className="text-heading-lg outline-none md:text-display-sm"><TitleText>{children}</TitleText></h1>;
}

function Shell({ step, title, subtitle, children, footer }: { step: number; title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const initialStep = useRef(step);
  // Pantalla de app: mide exactamente el alto visible (100dvh). Cabecera y botones
  // quedan fijos; si un paso no cabe, solo se desplaza su contenido.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-on-background">
      <header className="mx-auto flex w-full max-w-[640px] shrink-0 flex-col gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:gap-4 md:pt-10">
        <BrandLockup markSize={30} />
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface-light">Paso {step + 1} de {TOTAL_STEPS}</span>
          <div role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step + 1} className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={i <= step ? 'h-1.5 rounded-full bg-primary transition-colors duration-300' : 'h-1.5 rounded-full bg-surface-variant transition-colors duration-300'} />
            ))}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto flex min-h-0 w-full max-w-[640px] flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-4 pt-6 md:pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease } }}
            exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}
            className="flex flex-col gap-6 md:gap-8"
          >
            <div className="flex flex-col gap-1 md:gap-2">
              <StepTitle focus={step !== initialStep.current}>{title}</StepTitle>
              <p className="text-body-lg text-on-surface-light">{subtitle}</p>
            </div>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="lq-bar-glass shrink-0 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3">{footer}</div>
      </footer>
    </div>
  );
}

const back = (onClick: () => void, label = 'Atrás') => (
  <Button variant="ghost" onClick={onClick}><ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />{label}</Button>
);
const next = (onClick: () => void, label = 'Siguiente', disabled = false) => (
  <Button size="lg" disabled={disabled} onClick={onClick} className="flex-1 sm:flex-none sm:min-w-[200px]">{label}<ArrowRight aria-hidden className="size-5" strokeWidth={1.75} /></Button>
);

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const toast = useToast();
  const [initialSaved] = useState(() => (user?.displayName && !user?.onboardingCompleted ? {} : loadSaved()));
  const saved: Partial<OnboardingState> = initialSaved;
  const savedOrRegisteredGender = saved.gender;

  const [step, setStep] = useState(saved.step ?? 0);
  const [displayName, setDisplayName] = useState(saved.displayName ?? user?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(saved.birthDate ?? '');
  const [timezone] = useState(saved.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [gender, setGender] = useState<Gender | ''>(savedOrRegisteredGender ?? '');
  const [avatarConfig, setAvatarConfig] = useState<Partial<AvatarConfig>>(saved.avatarConfig ?? user?.avatarConfig ?? {});
  const [howFound, setHowFound] = useState<HowFound | ''>(saved.howFound ?? '');
  const [goalCategories, setGoalCategories] = useState<string[]>(saved.goalCategories ?? []);
  const [yearGoal, setYearGoal] = useState(saved.yearGoal ?? '');
  const [packs, setPacks] = useState<string[]>(saved.packs ?? []);
  const [created, setCreated] = useState<Created[]>(saved.created ?? []);
  const light = useThemeStore((s) => s.mode);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const completedUser = useRef<Parameters<typeof updateUser>[0] | null>(null);

  useEffect(() => {
    save({ step, displayName, birthDate, timezone, gender, avatarConfig, howFound, goalCategories, yearGoal, packs, created });
  }, [step, displayName, birthDate, timezone, gender, avatarConfig, howFound, goalCategories, yearGoal, packs, created]);

  useEffect(() => { track('onboarding_step_viewed', { step: step + 1 }); }, [step]);

  const config = withDefaults(avatarConfig, bodyFor(gender || null));
  const go = (s: number) => { setTried(false); setStep(s); };

  function submitIdentity() {
    if (!displayName.trim() || !gender) { setTried(true); return; }
    setDisplayName(displayName.trim());
    go(1);
  }

  function chooseGender(g: Gender) {
    setGender(g);
    // El cuerpo del personaje sigue al género elegido (luego se puede cambiar en el estudio).
    setAvatarConfig((c) => withBody(c, bodyFor(g)));
  }

  async function addPack(pack: Pack) {
    if (adding || packs.includes(pack.id)) return;
    setAdding(pack.id);
    const made: Created[] = [];
    try {
      for (const h of pack.habits) {
        const habit = await createHabit(h, 'pack');
        made.push({ id: habit.id, title: habit.title, daily: !h.frequency, done: false });
      }
      for (const title of pack.obstacles ?? []) await createAntiHabit({ title });
      track('pack_added', { pack: pack.id });
    } catch (error) {
      toast.info(isProRequired(error)
        ? `En NoutLife Lite tienes hasta ${LITE_LIMITS.activeHabits} hábitos activos. Con Pro, los que quieras.`
        : 'No se pudo agregar todo el pack. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      // Lo que alcanzó a crearse se queda: así un reintento no lo duplica.
      if (made.length) { setCreated((c) => [...c, ...made]); setPacks((p) => [...p, pack.id]); }
      setAdding(null);
    }
  }

  async function checkToday(habit: Created) {
    if (habit.done) return;
    setCreated((list) => list.map((h) => (h.id === habit.id ? { ...h, done: true } : h)));
    try {
      const result = await logHabit(habit.id, 'completed');
      const xp = result.rewards?.xpEarned;
      if (xp) setCreated((list) => list.map((h) => (h.id === habit.id ? { ...h, xp } : h)));
    } catch {
      setCreated((list) => list.map((h) => (h.id === habit.id ? { ...h, done: false } : h)));
      toast.error('No se pudo marcar. Inténtalo de nuevo.');
    }
  }

  async function finish() {
    setCelebrating(true);
    setSubmitting(true);
    // Las áreas elegidas pasan a ser las zonas principales de la navegación.
    const userId = useAuthStore.getState().user?.id;
    if (userId) useNavStore.getState().setOrder(String(userId), orderFromGoals(goalCategories));
    track('onboarding_completed', {
      how_found: howFound || null, theme: light, areas: goalCategories.length, packs: packs.length,
      year_goal: Boolean(yearGoal.trim()), checked_today: created.filter((h) => h.done).length,
      $set: { how_found: howFound || null },
    });
    try {
      const updated = await completeOnboarding({
        displayName, birthDate: birthDate || undefined, timezone, gender: gender || undefined, avatarConfig: config, goalCategories,
        mainQuestTitle: yearGoal.trim() || undefined, mainQuestCategory: goalCategoryOf(goalCategories), mainQuestDeadline: `${new Date().getFullYear()}-12-31`,
      });
      // Se aplica al pulsar «Entrar»: con onboardingCompleted la guarda de
      // ruta redirige a / y el cierre no llegaría a verse.
      completedUser.current = updated ? { ...updated, onboardingCompleted: true } : { onboardingCompleted: true };
    } catch (error) {
      console.error('[Onboarding] Error:', error);
      completedUser.current = { onboardingCompleted: true };
    } finally {
      setSubmitting(false);
    }
  }

  async function leave(to: '/login') {
    try { await authService.logout(); } catch { /* se limpia el estado igualmente */ }
    localStorage.removeItem(STORAGE_KEY);
    logout();
    navigate(to, { replace: true });
  }

  function enter() {
    localStorage.removeItem(STORAGE_KEY);
    updateUser(completedUser.current ?? { onboardingCompleted: true });
    navigate('/', { replace: true });
  }

  if (celebrating) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-on-background">
        {submitting ? (
          <ModernLoader label="Preparando tu espacio…" words={LOADING_COPY.splash} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease } }}
            className="flex w-full max-w-[440px] flex-col items-center gap-6 text-center"
          >
            <AvatarPreview config={config} size={120} animate="celebrate" className="lq-halo" />
            <div className="flex flex-col gap-2">
              <h1 className="text-display-sm"><Lettering text="Tu espacio está listo." /></h1>
              <p className="text-body-lg text-on-surface-light">Todo está en su sitio, {displayName.split(' ')[0]}.</p>
            </div>
            <Button size="lg" block onClick={enter} autoFocus>Entrar</Button>
          </motion.div>
        )}
      </div>
    );
  }

  if (step === 0) {
    return (
      <>
        <Shell
          step={0} title="¿Cómo te llamamos?" subtitle="Tu espacio te espera. Empecemos por ti."
          footer={<>
            <Button variant="ghost" onClick={() => void leave('/login')}>Usar otra cuenta</Button>
            {next(submitIdentity)}
          </>}
        >
          <IdentityFields
            name={displayName} onName={setDisplayName} nameError={tried && !displayName.trim() ? 'Escribe un nombre para continuar' : undefined}
            gender={gender} onGender={chooseGender} genderError={tried && !gender ? 'Elige una opción para continuar' : undefined}
            lockGender={Boolean(savedOrRegisteredGender)}
            config={config} onEditAvatar={() => setEditingAvatar(true)}
            howFound={howFound} onHowFound={setHowFound}
            birthDate={birthDate} onBirthDate={setBirthDate}
          />
        </Shell>
        {/* El estudio del personaje, encima del paso: se abre y se cierra sin perder lo escrito. */}
        <AnimatePresence>
          {editingAvatar && (
            <motion.div
              role="dialog" aria-modal="true" aria-label="Crea tu avatar"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="fixed inset-0 z-50 flex flex-col gap-3 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:p-8"
            >
              <h2 className="text-heading-md">Crea tu avatar</h2>
              <AvatarContent config={config} onChange={setAvatarConfig} />
              <Button size="lg" className="self-end sm:min-w-[200px]" onClick={() => setEditingAvatar(false)}>
                <Check aria-hidden className="size-5" strokeWidth={2} />Listo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (step === 1) {
    return (
      <Shell
        step={1} title="Elige tu luz" subtitle="Así se verá tu espacio."
        footer={<>{back(() => go(0))}{next(() => { track('theme_chosen', { mode: light }); go(2); })}</>}
      >
        <LightChoice mode={light} onMode={(m: ThemeMode) => useThemeStore.getState().setMode(m)} />
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell
        step={2} title="¿Qué quieres ordenar primero?" subtitle={`Elige hasta ${MAX_GOALS} áreas. Serán tus zonas principales.`}
        footer={<>{back(() => go(1))}{next(() => go(3), 'Siguiente', goalCategories.length === 0)}</>}
      >
        <GoalsContent
          selected={goalCategories}
          onToggle={(id) => setGoalCategories((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_GOALS ? [...s, id] : s))}
          yearGoal={yearGoal} onYearGoal={setYearGoal}
        />
      </Shell>
    );
  }

  const checkable = created.filter((h) => h.daily);
  return (
    <Shell
      step={3} title="Tu primer hábito" subtitle="Agrega un pack con un toque. Puedes editarlo después."
      footer={<>{back(() => go(2))}{next(() => void finish(), created.length ? 'Listo' : 'Saltar por ahora')}</>}
    >
      <ul className="flex flex-col gap-3">
        {PACKS.map((pack) => {
          const added = packs.includes(pack.id);
          return (
            <li key={pack.id}>
              <button
                type="button" disabled={added || Boolean(adding)} aria-pressed={added}
                onClick={() => void addPack(pack)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3 text-left',
                  'hover:border-border-strong focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary',
                  added && 'border-primary bg-background',
                )}
              >
                <IconChip icon={pack.icon} tone="primary" size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-label-lg">{pack.name}</span>
                  <span className="block text-body-sm text-on-surface-light">{pack.desc}</span>
                </span>
                <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', added ? 'bg-primary-strong text-on-primary' : 'border-2 border-border-strong')}>
                  {added ? <Check className="size-4" strokeWidth={3} /> : <Plus className="size-4" strokeWidth={2.5} />}
                </span>
                <span className="sr-only">{added ? 'Agregado' : adding === pack.id ? 'Agregando…' : 'Agregar'}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {checkable.length > 0 && (
        <section aria-labelledby="lq-check-today" className="flex flex-col gap-3">
          <h2 id="lq-check-today" className="text-label-lg">¿Ya hiciste alguno hoy? Márcalo.</h2>
          <ul className="flex flex-col gap-2">
            {checkable.map((h) => (
              <li key={h.id} className="flex min-h-11 items-center gap-3 rounded-2xl bg-surface px-3 py-2">
                <CheckButton checked={h.done} locked onToggle={() => void checkToday(h)} name={h.title} />
                <span className={cn('min-w-0 flex-1 text-body-md', h.done && 'text-on-surface-light')}>{h.title}</span>
                {h.xp ? <span className="text-label-sm tabular-nums text-primary-text">+{h.xp} XP</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}
