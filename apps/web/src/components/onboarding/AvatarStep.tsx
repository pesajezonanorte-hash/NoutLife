import { useState } from 'react';
import { motion } from 'framer-motion';
import { MiguelSprite } from '../character/MiguelSprite';
import { PixelButton } from '../ui/PixelButton';
import { PixelPanel } from '../ui/PixelPanel';
import { ColorPicker } from './ColorPicker';
import type { AvatarConfig, HairStyle, Accessory, Expression } from '@lifequest/shared';
import { E } from '@/components/ui/glyphs';

const HAIR_COLORS = ['#2c1810', '#4a3728', '#8b4513', '#d4a017', '#c8a2c8', '#708090', '#1a1a1a', '#ff6b6b', '#e8c090', '#ffffff', '#3d5a80', '#c0392b'];
const SKIN_COLORS = [
  '#fdf0e8','#fde8d0','#fcd9c0','#f8d5b0',
  '#f5c89f','#f0b98e','#e8a876','#d4956a',
  '#c68642','#b87340','#a86035','#a0522d',
  '#8b4513','#7b3f2c','#6b3422','#5c2e1a',
  '#4a2010','#3d1a0c','#2d1009','#1c0806',
];
const SHIRT_COLORS = ['#4d96ff', '#ff6b9d', '#4ecdc4', '#6bcf7f', '#ffd23f', '#ff6347', '#9b59b6', '#2c3e50', '#e74c3c', '#1abc9c', '#f97316', '#64748b', '#ffffff', '#000000'];
const PANTS_COLORS = ['#37474f', '#1a237e', '#4e342e', '#1b5e20', '#880e4f', '#263238', '#000000', '#5d4037', '#b71c1c', '#1565c0'];
const HAIR_STYLES_MALE: HairStyle[] = ['short', 'medium', 'long', 'shaved', 'copete', 'afro'];
const HAIR_STYLES_FEMALE: HairStyle[] = ['long', 'short', 'recogido', 'trenzas', 'ondulado', 'afro'];
const ACCESSORIES: Accessory[] = ['none', 'glasses', 'cap', 'headband', 'earrings', 'scarf'];
const EXPRESSIONS: Expression[] = ['normal', 'smile', 'serious', 'determined'];

const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: 'Corto',
  medium: 'Medio',
  long: 'Largo',
  shaved: 'Rapado',
  copete: 'Copete',
  afro: 'Afro',
  recogido: 'Recogido',
  trenzas: 'Trenzas',
  ondulado: 'Ondulado',
};

const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: 'Sin accesorio',
  glasses: 'Gafas',
  cap: 'Gorra',
  headband: 'Diadema',
  earrings: 'Aretes',
  scarf: 'Bufanda',
};

const EXPRESSION_LABELS: Record<Expression, string> = {
  normal: 'Normal',
  smile: 'Sonriente',
  serious: 'Serio',
  determined: 'Decidido',
};

interface Props {
  gender: 'male' | 'female';
  initialConfig: Partial<AvatarConfig>;
  onNext: (config: AvatarConfig) => void;
  onBack: () => void;
}

export function AvatarStep({ gender, initialConfig, onNext, onBack }: Props) {
  const [config, setConfig] = useState<AvatarConfig>({
    bodyType: initialConfig.bodyType ?? gender,
    hairStyle: (initialConfig.hairStyle as HairStyle) ?? (gender === 'female' ? 'long' : 'short'),
    hairColor: initialConfig.hairColor ?? '#2c1810',
    skinColor: initialConfig.skinColor ?? '#c68642',
    shirtColor: initialConfig.shirtColor ?? '#4d96ff',
    pants: initialConfig.pants ?? '#37474f',
    accessory: (initialConfig.accessory as Accessory) ?? 'none',
    expression: (initialConfig.expression as Expression) ?? 'normal',
    pet: null,
  });

  const update = (key: keyof AvatarConfig) => (value: string) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const hairStyles = gender === 'female' ? HAIR_STYLES_FEMALE : HAIR_STYLES_MALE;

  const optionButtonClass = (selected: boolean) =>
    `rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
      selected
        ? 'border-accent-gold bg-accent-gold/15 text-accent-gold shadow-[0_0_0_1px_rgba(255,210,63,0.35)]'
        : 'border-border-pixel bg-white/0 text-text-secondary hover:border-accent-gold hover:bg-white/5 hover:text-text-primary'
    }`;

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
    >
      <div className="text-center">
        <h2 className="mb-1 font-pixel text-accent-gold" style={{ fontSize: '12px' }}>
          PERSONALIZA TU AVATAR
        </h2>
        <p className="font-vt text-xl text-text-secondary">
          Dale estilo a tu {gender === 'female' ? 'heroína' : 'héroe'}. Cada cambio se ve al instante.
        </p>
      </div>

      <div className="flex justify-center">
        <motion.div
          key={JSON.stringify(config)}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.15 }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-full bg-accent-gold/10 blur-2xl" />
          <MiguelSprite
            size={120}
            bodyType={config.bodyType}
            hairStyle={config.hairStyle}
            hairColor={config.hairColor}
            skinColor={config.skinColor}
            shirtColor={config.shirtColor}
            pantsColor={config.pants}
            accessory={config.accessory}
            expression={config.expression}
            animate="idle"
          />
        </motion.div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <span className="rounded-full border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-xs font-semibold text-accent-gold">
          Cabello: {HAIR_STYLE_LABELS[config.hairStyle]}
        </span>
        <span className="rounded-full border border-border-pixel bg-bg-panel px-3 py-1 text-xs font-semibold text-text-secondary">
          Accesorio: {ACCESSORY_LABELS[config.accessory]}
        </span>
        <span className="rounded-full border border-border-pixel bg-bg-panel px-3 py-1 text-xs font-semibold text-text-secondary">
          Expresión: {EXPRESSION_LABELS[config.expression]}
        </span>
      </div>

      <PixelPanel className="space-y-5 p-4">
        <div>
          <label className="mb-2 block font-pixel text-text-secondary" style={{ fontSize: '12px' }}>
            ESTILO DE CABELLO
          </label>
          <p className="mb-3 text-sm text-text-secondary">
            Elige la silueta que mejor representa tu avatar.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {hairStyles.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update('hairStyle')(style)}
                className={optionButtonClass(config.hairStyle === style)}
              >
                {HAIR_STYLE_LABELS[style]}
              </button>
            ))}
          </div>
        </div>

        <ColorPicker label="COLOR DE CABELLO" value={config.hairColor} colors={HAIR_COLORS} onChange={update('hairColor')} />
        <ColorPicker label="TONO DE PIEL" value={config.skinColor} colors={SKIN_COLORS} onChange={update('skinColor')} />
        <ColorPicker label="COLOR DE CAMISA" value={config.shirtColor} colors={SHIRT_COLORS} onChange={update('shirtColor')} />
        <ColorPicker label="COLOR DE PANTALÓN" value={config.pants} colors={PANTS_COLORS} onChange={update('pants')} />

        <div>
          <label className="mb-2 block font-pixel text-text-secondary" style={{ fontSize: '12px' }}>
            ACCESORIOS
          </label>
          <p className="mb-3 text-sm text-text-secondary">
            Añade un detalle que haga más único a tu personaje.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACCESSORIES.map((accessory) => (
              <button
                key={accessory}
                type="button"
                onClick={() => update('accessory')(accessory)}
                className={optionButtonClass(config.accessory === accessory)}
              >
                {ACCESSORY_LABELS[accessory]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-pixel text-text-secondary" style={{ fontSize: '12px' }}>
            EXPRESIÓN
          </label>
          <p className="mb-3 text-sm text-text-secondary">
            Define la actitud con la que tu avatar entra al reino.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EXPRESSIONS.map((expression) => (
              <button
                key={expression}
                type="button"
                onClick={() => update('expression')(expression)}
                className={optionButtonClass(config.expression === expression)}
              >
                {EXPRESSION_LABELS[expression]}
              </button>
            ))}
          </div>
        </div>
      </PixelPanel>

      <div className="flex gap-3">
        <PixelButton variant="ghost" onClick={onBack} className="flex-1">
          ← ATRÁS
        </PixelButton>
        <PixelButton variant="primary" onClick={() => onNext(config)} className="flex-1">
          SIGUIENTE →
        </PixelButton>
      </div>
    </motion.div>
  );
}
