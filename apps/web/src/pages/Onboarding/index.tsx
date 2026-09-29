import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import * as authService from '../../services/auth.service';
import { completeOnboarding } from '../../services/user.service';
import { OnboardingProgress } from '../../components/onboarding/OnboardingProgress';
import { WelcomeStep } from '../../components/onboarding/WelcomeStep';
import { IdentityStep } from '../../components/onboarding/IdentityStep';
import { AvatarStep } from '../../components/onboarding/AvatarStep';
import { GoalsStep } from '../../components/onboarding/GoalsStep';
import { FirstQuestStep } from '../../components/onboarding/FirstQuestStep';
import { FinalCelebrationStep } from '../../components/onboarding/FinalCelebrationStep';
import { getHeroLabelCapitalized } from '../../utils/gender';
import type { AvatarConfig } from '@lifequest/shared';

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const saved = user?.displayName && !user?.onboardingCompleted ? {} : loadSaved();
  const savedOrRegisteredGender = saved.gender ?? user?.avatarConfig?.bodyType;

  const [step, setStep] = useState(saved.step ?? 0);
  const [displayName, setDisplayName] = useState(saved.displayName ?? user?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(saved.birthDate ?? '');
  const [timezone, setTimezone] = useState(saved.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [gender, setGender] = useState<'male' | 'female'>(savedOrRegisteredGender ?? 'male');
  const [avatarConfig, setAvatarConfig] = useState<Partial<AvatarConfig>>(saved.avatarConfig ?? user?.avatarConfig ?? {});
  const [goalCategories, setGoalCategories] = useState<string[]>(saved.goalCategories ?? []);
  const [mainQuestTitle, setMainQuestTitle] = useState(saved.mainQuestTitle ?? '');
  const [mainQuestCategory, setMainQuestCategory] = useState(saved.mainQuestCategory ?? 'PERSONAL');
  const [mainQuestDeadline, setMainQuestDeadline] = useState(saved.mainQuestDeadline ?? `${new Date().getFullYear()}-12-31`);
  const [celebrating, setCelebrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    save({
      step,
      displayName,
      birthDate,
      timezone,
      gender,
      avatarConfig,
      goalCategories,
      mainQuestTitle,
      mainQuestCategory,
      mainQuestDeadline,
    });
  }, [step, displayName, birthDate, timezone, gender, avatarConfig, goalCategories, mainQuestTitle, mainQuestCategory, mainQuestDeadline]);

  const goNext = () => setStep((current) => current + 1);
  const goBack = () => setStep((current) => Math.max(0, current - 1));

  const handleIdentity = (data: { displayName: string; birthDate: string; timezone: string; gender: 'male' | 'female' }) => {
    setDisplayName(data.displayName);
    setBirthDate(data.birthDate);
    setTimezone(data.timezone);
    setGender(data.gender);
    setAvatarConfig((current) => ({
      ...current,
      bodyType: data.gender,
      hairStyle: current.hairStyle ?? (data.gender === 'female' ? 'long' : 'short'),
    }));
    goNext();
  };

  const handleAvatar = (config: AvatarConfig) => {
    setAvatarConfig(config);
    goNext();
  };

  const handleGoals = (categories: string[]) => {
    setGoalCategories(categories);
    goNext();
  };

  const handleFirstQuest = async (data: { title: string; category: string; deadline: string }) => {
    setMainQuestTitle(data.title);
    setMainQuestCategory(data.category);
    setMainQuestDeadline(data.deadline);
    setCelebrating(true);
    setSubmitting(true);

    try {
      const updatedUser = await completeOnboarding({
        displayName,
        birthDate: birthDate || undefined,
        timezone,
        avatarConfig,
        goalCategories,
        mainQuestTitle: data.title,
        mainQuestCategory: data.category,
        mainQuestDeadline: data.deadline,
      });

      if (updatedUser) {
        updateUser({ ...updatedUser, onboardingCompleted: true });
      }
    } catch (error) {
      console.error('[Onboarding] Error:', error);
      updateUser({ onboardingCompleted: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnterCastle = () => {
    localStorage.removeItem(STORAGE_KEY);
    navigate('/', { replace: true });
  };

  const handleSwitchAccount = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors and still clear local auth state.
    }

    localStorage.removeItem(STORAGE_KEY);
    logout();
    navigate('/login', { replace: true });
  };

  const handleBackToRegister = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore logout errors and still send the user back to the register form.
    }

    localStorage.removeItem(STORAGE_KEY);
    logout();
    navigate('/register', { replace: true });
  };

  if (celebrating) {
    return (
      <div className="min-h-screen bg-bg-deep flex items-center justify-center overflow-hidden px-4">
        <div className="w-full max-w-sm">
          {submitting ? (
            <div className="text-center">
              <motion.p
                className="font-pixel text-accent-gold"
                style={{ fontSize: '12px' }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                FORJANDO TU {getHeroLabelCapitalized(gender).toUpperCase()}...
              </motion.p>
            </div>
          ) : (
            <FinalCelebrationStep
              displayName={displayName}
              gender={gender}
              avatarConfig={avatarConfig}
              onEnter={handleEnterCastle}
            />
          )}
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="min-h-screen bg-bg-deep flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <IdentityStep
              initialName={displayName}
              initialBirthDate={birthDate}
              initialGender={gender}
              lockGender={Boolean(savedOrRegisteredGender)}
              secondaryActionLabel="Registrarse o iniciar sesion con otra cuenta"
              onSecondaryAction={handleSwitchAccount}
              onNext={handleIdentity}
              onBack={handleBackToRegister}
            />
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return <WelcomeStep gender={gender} avatarConfig={avatarConfig} onNext={goNext} />;
  }

  return (
    <div className="min-h-screen bg-bg-deep flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 40 }, (_, index) => (
          <motion.div
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
            }}
            animate={{ opacity: [0.1, 0.6, 0.1] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 p-4">
        <h1 className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>
          LIFEQUEST
        </h1>
        <OnboardingProgress currentStep={step - 2} totalSteps={TOTAL_STEPS} />
        <p className="font-vt text-lg text-text-secondary">
          Paso {step - 1} de {TOTAL_STEPS}
        </p>
      </div>

      <div className="relative z-10 flex flex-1 items-start justify-center px-4 pb-6">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div key={step}>
              {step === 2 && (
                <AvatarStep
                  gender={gender}
                  initialConfig={avatarConfig}
                  onNext={handleAvatar}
                  onBack={goBack}
                />
              )}
              {step === 3 && (
                <GoalsStep
                  onNext={handleGoals}
                  onBack={goBack}
                />
              )}
              {step === 4 && (
                <FirstQuestStep
                  onNext={handleFirstQuest}
                  onBack={goBack}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
