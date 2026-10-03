// Onboarding — 5 pasos (identidad, bienvenida, avatar, metas, primera misión) y
// celebración final. Mismo estado, persistencia local y llamada a
// completeOnboarding que antes; cambia la presentación. Transición entre pasos
// fade + x 24 (250 ms); el foco pasa al título de cada paso.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Droplet, Heart, Sparkles, Star } from 'lucide-react';
import type { AvatarConfig } from '@lifequest/shared';
import { ease } from '@/lib/motion';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/auth.service';
import { completeOnboarding } from '@/services/user.service';
import { getHeroLabel, getWelcomeLabel } from '@/utils/gender';
import { BrandMark } from '@/components/layout/Brand';
import { Badge, Button, Confetti, Spinner } from '@/components/ui/lq';
import { AvatarPreview } from '@/components/character/AvatarPixelEditor';
import { withDefaults } from '@/components/character/avatarOptions';
import {
  AvatarContent, FirstQuestFields, GoalsContent, IdentityFields, MAX_GOALS, WelcomeContent,
} from '@/components/onboarding/steps';

const STORAGE_KEY = 'lifequest_onboarding_progress';
const TOTAL_STEPS = 5;

interface OnboardingState {
  step: number;
  displayName: string;
  birthDate: string;
  timezone: string;
  gender: 'male' | 'female';
  avatarConfig: Partial<AvatarConfig>;
  goalCategories: string[];
  mainQuestTitle: string;
  mainQuestCategory: string;
  mainQuestDeadline: string;
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
  return <h1 ref={ref} tabIndex={-1} className="text-heading-lg outline-none md:text-display-sm">{children}</h1>;
}

function Shell({ step, title, subtitle, children, footer }: { step: number; title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  const initialStep = useRef(step);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-background">
      <header className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pt-6 md:pt-10">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-heading-sm">LifeQuest</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface-light">Paso {step + 1} de {TOTAL_STEPS}</span>
          <div role="progressbar" aria-label="Progreso del registro" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step + 1}
            className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span key={i} className={i <= step ? 'h-1.5 rounded-full bg-primary transition-colors duration-300' : 'h-1.5 rounded-full bg-surface-variant transition-colors duration-300'} />
            ))}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-4 pb-6 pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.25, ease } }}
            exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col gap-2">
              <StepTitle focus={step !== initialStep.current}>{title}</StepTitle>
              <p className="text-body-lg text-on-surface-light">{subtitle}</p>
            </div>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[640px] flex-col-reverse gap-2 sm:flex-row sm:justify-between">{footer}</div>
      </footer>
    </div>
  );
}

const back = (onClick: () => void, label = 'Atrás') => (
  <Button variant="ghost" onClick={onClick}><ArrowLeft aria-hidden className="size-5" strokeWidth={1.75} />{label}</Button>
);
const next = (onClick: () => void, label = 'Siguiente') => (
  <Button size="lg" onClick={onClick} className="sm:min-w-[200px]">{label}<ArrowRight aria-hidden className="size-5" strokeWidth={1.75} /></Button>
);

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const saved = user?.displayName && !user?.onboardingCompleted ? {} : loadSaved();
  const savedOrRegisteredGender = saved.gender ?? user?.avatarConfig?.bodyType;

  const [step, setStep] = useState(saved.step ?? 0);
  const [displayName, setDisplayName] = useState(saved.displayName ?? user?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(saved.birthDate ?? '');
  const [timezone] = useState(saved.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [gender, setGender] = useState<'male' | 'female'>(savedOrRegisteredGender ?? 'male');
  const [avatarConfig, setAvatarConfig] = useState<Partial<AvatarConfig>>(saved.avatarConfig ?? user?.avatarConfig ?? {});
  const [goalCategories, setGoalCategories] = useState<string[]>(saved.goalCategories ?? []);
  const [mainQuestTitle, setMainQuestTitle] = useState(saved.mainQuestTitle ?? '');
  const [mainQuestCategory, setMainQuestCategory] = useState(saved.mainQuestCategory ?? 'PERSONAL');
  const [mainQuestDeadline, setMainQuestDeadline] = useState(saved.mainQuestDeadline ?? `${new Date().getFullYear()}-12-31`);
  const [tried, setTried] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const completedUser = useRef<Parameters<typeof updateUser>[0] | null>(null);

  useEffect(() => {
    save({ step, displayName, birthDate, timezone, gender, avatarConfig, goalCategories, mainQuestTitle, mainQuestCategory, mainQuestDeadline });
  }, [step, displayName, birthDate, timezone, gender, avatarConfig, goalCategories, mainQuestTitle, mainQuestCategory, mainQuestDeadline]);

  const config = withDefaults(avatarConfig, gender);
  const go = (s: number) => { setTried(false); setStep(s); };

  function submitIdentity() {
    if (!displayName.trim()) { setTried(true); return; }
    setDisplayName(displayName.trim());
    setAvatarConfig((c) => ({ ...c, bodyType: gender, hairStyle: c.hairStyle ?? (gender === 'female' ? 'long' : 'short') }));
    go(1);
  }

  async function submitQuest() {
    if (!mainQuestTitle.trim()) { setTried(true); return; }
    setCelebrating(true);
    setSubmitting(true);
    try {
      const updated = await completeOnboarding({
        displayName, birthDate: birthDate || undefined, timezone, avatarConfig: config, goalCategories,
        mainQuestTitle: mainQuestTitle.trim(), mainQuestCategory, mainQuestDeadline,
      });
      // Se aplica al pulsar «Empezar»: con onboardingCompleted la guarda de
      // ruta redirige a / y la celebración no llegaría a verse.
      completedUser.current = updated ? { ...updated, onboardingCompleted: true } : { onboardingCompleted: true };
    } catch (error) {
      console.error('[Onboarding] Error:', error);
      completedUser.current = { onboardingCompleted: true };
    } finally {
      setSubmitting(false);
    }
  }

  async function leave(to: '/login' | '/register') {
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
          <div role="status" className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-body-md text-on-surface-light">Preparando tu aventura…</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease } }}
            className="flex w-full max-w-[440px] flex-col items-center gap-6 text-center"
          >
            <Confetti />
            <AvatarPreview config={config} size={120} animate="celebrate" className="lq-halo" />
            <div className="flex flex-col gap-2">
              <span className="text-label-lg text-primary-text">Nivel 1</span>
              <h1 className="text-display-sm">¡{getWelcomeLabel(gender)}, {displayName}!</h1>
              <p className="text-body-lg text-on-surface-light">Tu {getHeroLabel(gender)} está {gender === 'female' ? 'lista' : 'listo'}. Tu primera misión ya te espera.</p>
            </div>
            <ul aria-label="Atributos iniciales" className="flex flex-wrap justify-center gap-2">
              <li><Badge variant="error" size="lg" icon={Heart}>100 HP</Badge></li>
              <li><Badge variant="info" size="lg" icon={Droplet}>100 MP</Badge></li>
              <li><Badge variant="primary" size="lg" icon={Star}>500 XP en juego</Badge></li>
            </ul>
            <Button size="lg" block onClick={enter} autoFocus>
              <Sparkles aria-hidden className="size-5" strokeWidth={1.75} />Empezar
            </Button>
          </motion.div>
        )}
      </div>
    );
  }

  if (step === 0) {
    return (
      <Shell
        step={0} title="¿Quién eres?" subtitle="Cuéntanos un poco sobre la persona que empieza esta aventura."
        footer={<>
          <div className="flex flex-col gap-1 sm:flex-row">
            {back(() => void leave('/register'), 'Volver al registro')}
            <Button variant="ghost" onClick={() => void leave('/login')}>Usar otra cuenta</Button>
          </div>
          {next(submitIdentity)}
        </>}
      >
        <IdentityFields
          name={displayName} onName={setDisplayName} nameError={tried && !displayName.trim() ? 'Escribe un nombre para continuar' : undefined}
          birthDate={birthDate} onBirthDate={setBirthDate}
          gender={gender} onGender={setGender} lockGender={Boolean(savedOrRegisteredGender)}
          timezone={timezone}
        />
      </Shell>
    );
  }

  if (step === 1) {
    return (
      <Shell step={1} title={`Hola, ${displayName.split(' ')[0]}`} subtitle="Así empieza tu partida." footer={<>{back(() => go(0))}{next(() => go(2), 'Comenzar')}</>}>
        <WelcomeContent config={config} />
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell step={2} title="Tu avatar" subtitle="Dale estilo a tu personaje; cada cambio se ve al instante." footer={<>{back(() => go(1))}{next(() => go(3))}</>}>
        <AvatarContent config={config} onChange={setAvatarConfig} />
      </Shell>
    );
  }

  if (step === 3) {
    return (
      <Shell
        step={3} title="¿Qué quieres mejorar?" subtitle={`Elige hasta ${MAX_GOALS} áreas para empezar.`}
        footer={<>
          {back(() => go(2))}
          <Button size="lg" disabled={goalCategories.length === 0} onClick={() => go(4)} className="sm:min-w-[200px]">
            Siguiente<ArrowRight aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        </>}
      >
        <GoalsContent
          selected={goalCategories}
          onToggle={(id) => setGoalCategories((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_GOALS ? [...s, id] : s))}
        />
      </Shell>
    );
  }

  return (
    <Shell step={4} title="Tu primera misión" subtitle="¿Cuál es la meta más grande que quieres conquistar este año?" footer={<>{back(() => go(3))}{next(() => void submitQuest(), 'Crear misión')}</>}>
      <FirstQuestFields
        title={mainQuestTitle} onTitle={setMainQuestTitle} titleError={tried && !mainQuestTitle.trim() ? 'Escribe tu meta para continuar' : undefined}
        category={mainQuestCategory} onCategory={setMainQuestCategory}
        deadline={mainQuestDeadline} onDeadline={setMainQuestDeadline}
      />
    </Shell>
  );
}
