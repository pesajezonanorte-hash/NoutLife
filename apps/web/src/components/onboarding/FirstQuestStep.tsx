import { useState } from 'react';
import { motion } from 'framer-motion';
import { PixelButton } from '../ui/PixelButton';
import { PixelInput } from '../ui/PixelInput';
import { PixelPanel } from '../ui/PixelPanel';
import { E } from '@/components/ui/glyphs';

const CATEGORIES = [
  { id: 'FITNESS', label: ' Fitness' },
  { id: 'FINANCE', label: ' Finanzas' },
  { id: 'LEARNING', label: ' Aprendizaje' },
  { id: 'HEALTH', label: ' Salud' },
  { id: 'LOVE', label: ' Relaciones' },
  { id: 'PERSONAL', label: ' Personal' },
  { id: 'CREATIVE', label: ' Creativo' },
  { id: 'SOCIAL', label: ' Social' },
];

interface Props {
  onNext: (data: { title: string; category: string; deadline: string }) => void;
  onBack: () => void;
}

export function FirstQuestStep({ onNext, onBack }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('PERSONAL');
  const endOfYear = `${new Date().getFullYear()}-12-31`;
  const [deadline, setDeadline] = useState(endOfYear);

  const canContinue = title.trim().length > 0;

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <div className="text-center">
        <h2 className="font-pixel text-accent-gold mb-1" style={{ fontSize: '12px' }}>
          TU PRIMERA MISIÓN ÉPICA
        </h2>
        <p className="font-vt text-text-secondary text-xl">
          ¿Cuál es la meta más grande que quieres conquistar este año?
        </p>
      </div>

      <PixelPanel className="p-5 space-y-5">
        <div>
          <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
            DESCRIBE TU META PRINCIPAL
          </label>
          <PixelInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Llegar a 80kg con masa muscular..."
            maxLength={120}
          />
          <p className="font-vt text-text-secondary text-sm mt-1">
            Esta será tu Misión Principal (500 XP de recompensa <E e="🏆" />)
          </p>
        </div>

        <div>
          <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
            CATEGORÍA
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`border-2 px-2 py-1.5 font-vt text-base text-left transition-colors ${
                  category === cat.id
                    ? 'border-accent-gold bg-bg-panel-light text-accent-gold'
                    : 'border-border-pixel bg-bg-deep text-text-secondary hover:border-accent-gold'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="font-pixel text-text-secondary block mb-2" style={{ fontSize: '12px' }}>
            FECHA OBJETIVO
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-xl px-3 py-2 focus:outline-none focus:border-accent-gold"
          />
        </div>
      </PixelPanel>

      <div className="flex gap-3">
        <PixelButton variant="ghost" onClick={onBack} className="flex-1">← ATRÁS</PixelButton>
        <PixelButton
          variant="primary"
          onClick={() => canContinue && onNext({ title: title.trim(), category, deadline })}
          disabled={!canContinue}
          className="flex-1"
        >
          ¡FORJAR MISIÓN! <E e="⚔" />
        </PixelButton>
      </div>
    </motion.div>
  );
}
