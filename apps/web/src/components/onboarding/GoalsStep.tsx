import { useState } from 'react';
import { motion } from 'framer-motion';
import { PixelButton } from '../ui/PixelButton';
import { E } from '@/components/ui/glyphs';

const GOAL_OPTIONS = [
  { id: 'FITNESS',  icon: '💪', label: 'Gimnasio y Fuerza',  desc: 'Entrenar, ganar músculo, perder grasa' },
  { id: 'HEALTH',   icon: '🍎', label: 'Nutrición y Salud',  desc: 'Comer mejor, hidratación, descanso' },
  { id: 'SLEEP',    icon: '🌙', label: 'Sueño y Descanso',   desc: 'Dormir bien y recuperarte cada día' },
  { id: 'FINANCE',  icon: '💰', label: 'Finanzas',           desc: 'Ahorrar, invertir, controlar gastos' },
  { id: 'LEARNING', icon: '📚', label: 'Aprendizaje',        desc: 'Nuevas habilidades, idiomas, cursos' },
  { id: 'LOVE',     icon: '💖', label: 'Relaciones',         desc: 'Conexiones, amor, familia, amigos' },
  { id: 'PERSONAL', icon: '🧘', label: 'Bienestar Mental',   desc: 'Mindfulness, meditación, propósito' },
  { id: 'CREATIVE', icon: '🎨', label: 'Creatividad',        desc: 'Arte, música, escritura, proyectos' },
];

interface Props {
  onNext: (categories: string[]) => void;
  onBack: () => void;
}

export function GoalsStep({ onNext, onBack }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 3) { next.add(id); }
      return next;
    });
  };

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <div className="text-center">
        <h2 className="font-pixel text-accent-gold mb-1" style={{ fontSize: '12px' }}>
          TUS METAS INICIALES
        </h2>
        <p className="font-vt text-text-secondary text-xl">
          Elige hasta 3 áreas donde quieres empezar.
        </p>
        <p className="font-vt text-accent-gold text-lg mt-1">
          {selected.size}/3 seleccionadas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {GOAL_OPTIONS.map((opt) => {
          const isSelected = selected.has(opt.id);
          const isDisabled = !isSelected && selected.size >= 3;

          return (
            <motion.button
              key={opt.id}
              whileHover={!isDisabled ? { scale: 1.03 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              onClick={() => !isDisabled && toggle(opt.id)}
              className={`border-2 p-3 text-left transition-all ${
                isSelected
                  ? 'border-accent-gold bg-bg-panel-light shadow-pixel-gold'
                  : isDisabled
                  ? 'border-border-pixel bg-bg-deep opacity-40 cursor-not-allowed'
                  : 'border-border-pixel bg-bg-panel hover:border-accent-gold'
              }`}
            >
              <div className="text-2xl mb-1"><E e={opt.icon} /></div>
              <p className="font-pixel text-text-primary" style={{ fontSize: '12px', lineHeight: 1.4 }}>
                {opt.label}
              </p>
              <p className="font-vt text-text-secondary text-sm mt-0.5">{opt.desc}</p>
              {isSelected && (
                <motion.div
                  className="absolute top-1 right-1 text-accent-gold"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{ fontSize: '12px' }}
                >
                  <E e="✓" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <PixelButton variant="ghost" onClick={onBack} className="flex-1">← ATRÁS</PixelButton>
        <PixelButton
          variant="primary"
          onClick={() => selected.size > 0 && onNext(Array.from(selected))}
          disabled={selected.size === 0}
          className="flex-1"
        >
          SIGUIENTE →
        </PixelButton>
      </div>
    </motion.div>
  );
}
