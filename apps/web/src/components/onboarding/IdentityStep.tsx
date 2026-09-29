import { useState } from 'react';
import { motion } from 'framer-motion';
import { PixelInput } from '../ui/PixelInput';
import { PixelButton } from '../ui/PixelButton';
import { PixelPanel } from '../ui/PixelPanel';

interface Props {
  initialName?: string;
  initialBirthDate?: string;
  initialGender?: 'male' | 'female';
  lockGender?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onNext: (data: { displayName: string; birthDate: string; timezone: string; gender: 'male' | 'female' }) => void;
  onBack: () => void;
}

export function IdentityStep({
  initialName = '',
  initialBirthDate = '',
  initialGender = 'male',
  lockGender = false,
  secondaryActionLabel,
  onSecondaryAction,
  onNext,
  onBack,
}: Props) {
  const [name, setName] = useState(initialName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [gender, setGender] = useState<'male' | 'female'>(initialGender);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const canContinue = name.trim().length > 0;

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <div className="text-center">
        <h2 className="font-pixel text-accent-gold mb-1" style={{ fontSize: '12px' }}>
          ¿QUIÉN ERES?
        </h2>
        <p className="font-vt text-text-secondary text-xl">
          Cuéntame sobre la persona que está comenzando esta aventura.
        </p>
      </div>

      <PixelPanel className="p-5 space-y-5">
        {!lockGender && (
          <div>
            <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
              ¿ERES HÉROE O HEROÍNA?
            </label>
            <div className="flex gap-3">
              {(['male', 'female'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender(option)}
                  className={`flex-1 rounded-xl border-2 py-3 font-vt text-lg transition-colors ${
                    gender === option
                      ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                      : 'border-border-pixel text-text-secondary hover:border-accent-gold'
                  }`}
                >
                  {option === 'male' ? 'Héroe' : 'Heroína'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
            ¿CÓMO TE LLAMARÁN EN EL REINO?
          </label>
          <PixelInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre de héroe..."
            maxLength={60}
          />
        </div>

        <div>
          <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
            FECHA DE NACIMIENTO (OPCIONAL)
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full border-2 border-border-pixel bg-bg-deep px-3 py-2 font-vt text-xl text-text-primary focus:border-accent-gold focus:outline-none"
          />
          <p className="mt-1 font-vt text-sm text-text-secondary">
            Para celebrar tu aniversario en LifeQuest
          </p>
        </div>

        <div>
          <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
            ZONA HORARIA (AUTO-DETECTADA)
          </label>
          <div className="border-2 border-border-pixel bg-bg-deep px-3 py-2">
            <span className="font-vt text-lg text-text-secondary">{timezone}</span>
          </div>
        </div>
      </PixelPanel>

      <div className="flex gap-3">
        <PixelButton variant="ghost" onClick={onBack} className="flex-1">
          ← VOLVER AL REGISTRO
        </PixelButton>
        <PixelButton
          variant="primary"
          onClick={() => canContinue && onNext({ displayName: name.trim(), birthDate, timezone, gender })}
          disabled={!canContinue}
          className="flex-1"
        >
          SIGUIENTE →
        </PixelButton>
      </div>

      {secondaryActionLabel && onSecondaryAction && (
        <button
          type="button"
          onClick={onSecondaryAction}
          className="text-center font-vt text-base text-[var(--text-secondary)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
        >
          {secondaryActionLabel}
        </button>
      )}
    </motion.div>
  );
}
