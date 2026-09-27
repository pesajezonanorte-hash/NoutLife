import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, CheckCircle2, Frown, Annoyed, Meh, Smile, Laugh } from 'lucide-react';
import * as checkinService from '../../services/checkin.service';
import type { DailyCheckin } from '../../services/checkin.service';
import { Slider } from '../ui/slider';
import { E } from '@/components/ui/glyphs';

const MOOD_OPTIONS = [
  { value: 1, Icon: Frown,   label: 'Mal' },
  { value: 2, Icon: Annoyed, label: 'Bajo' },
  { value: 3, Icon: Meh,     label: 'Normal' },
  { value: 4, Icon: Smile,   label: 'Bien' },
  { value: 5, Icon: Laugh,   label: '¡Genial!' },
];

export function DailyCheckinWidget() {
  const [checkin, setCheckin] = useState<DailyCheckin | null | undefined>(undefined);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    checkinService.getTodayCheckin()
      .then((c) => {
        setCheckin(c);
        if (c) {
          setMood(c.mood);
          setEnergy(c.energy);
          setDone(true);
        }
      })
      .catch(() => setCheckin(null));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await checkinService.upsertCheckin(mood, energy);
      setCheckin(result);
      setDone(true);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (checkin === undefined) return null; // loading

  const selectedMood = MOOD_OPTIONS.find((option) => option.value === checkin?.mood) ?? MOOD_OPTIONS[2];

  if (done && checkin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4"
        style={{ borderColor: 'var(--accent-green)44' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--accent-green)]" />
            <span className="text-xs font-semibold text-[var(--accent-green)]">Check-in de hoy completado</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5"><E e={selectedMood.Icon} s={15} />{selectedMood.label}</span>
            <span className="flex items-center gap-1 text-[var(--text-muted)]"><Zap size={13} />{checkin.energy}/10</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5"
      style={{ borderColor: 'var(--accent-cyan)44' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Heart size={16} className="text-[var(--accent-pink)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">¿Cómo llegas hoy?</h3>
        <span className="text-xs text-[var(--text-muted)] ml-auto">5 segundos</span>
      </div>

      {/* Mood */}
      <div className="flex gap-2 justify-between mb-4">
        {MOOD_OPTIONS.map((m) => (
          <motion.button
            key={m.value}
            onClick={() => setMood(m.value)}
            whileTap={{ scale: 0.9 }}
            className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all"
            style={{
              background: mood === m.value ? 'var(--accent-cyan)22' : 'transparent',
              border: `1px solid ${mood === m.value ? 'var(--accent-cyan)' : 'transparent'}`,
            }}
          >
            <span className="flex h-6 items-center justify-center"><E e={m.Icon} s={19} /></span>
            <span className="text-[10px] text-[var(--text-muted)]">{m.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Energy */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Zap size={13} className="text-[var(--accent-gold)]" />
            <span className="text-xs text-[var(--text-secondary)]">Energía</span>
          </div>
          <span className="text-sm font-bold text-[var(--accent-gold)]">{energy}/10</span>
        </div>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[energy]}
          onValueChange={([value]) => setEnergy(value)}
          accent="var(--accent-gold)"
          aria-label="Nivel de energía"
        />
      </div>

      <motion.button
        onClick={handleSave}
        disabled={saving}
        whileTap={{ scale: 0.97 }}
        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all"
        style={{ background: 'var(--accent-cyan)', color: 'var(--bg-deep)' }}
      >
        {saving ? 'Guardando...' : 'Registrar'}
      </motion.button>
    </motion.div>
  );
}
