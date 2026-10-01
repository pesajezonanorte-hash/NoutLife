import { motion } from 'framer-motion';

interface Props {
  label: string;
  value: string;
  colors: string[];
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, colors, onChange }: Props) {
  return (
    <div>
      <p className="font-pixel text-text-secondary mb-2" style={{ fontSize: '12px' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <motion.button
            key={color}
            type="button"
            aria-label={`Elegir ${label}: ${color}`}
            aria-pressed={value === color}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onChange(color)}
            className="h-11 w-11 border-2 transition-all sm:h-7 sm:w-7"
            style={{
              backgroundColor: color,
              borderColor: value === color ? '#ffd23f' : '#0d0620',
              boxShadow: value === color ? '0 0 0 2px #ffd23f' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
