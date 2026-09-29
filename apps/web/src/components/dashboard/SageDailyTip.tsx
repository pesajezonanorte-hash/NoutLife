import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { sageDailyTip } from '../../services/sage.service';
import { useUIStore } from '../../store/uiStore';

const TIP_KEY = 'sage_daily_tip';
const TIP_DATE_KEY = 'sage_daily_tip_date';

export function SageDailyTip() {
  const openSage = useUIStore((s) => s.openSage);
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toDateString();
    const cachedDate = localStorage.getItem(TIP_DATE_KEY);
    const cachedTip = localStorage.getItem(TIP_KEY);

    if (cachedDate === today && cachedTip) {
      setTip(cachedTip);
      return;
    }

    sageDailyTip()
      .then(({ tip: t }) => {
        setTip(t);
        localStorage.setItem(TIP_KEY, t);
        localStorage.setItem(TIP_DATE_KEY, today);
      })
      .catch(() => null);
  }, []);

  if (!tip) return null;

  return (
    <button
      onClick={() => openSage('Cuéntame más sobre ese consejo.')}
      className="w-full flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-left hover:border-[var(--accent-gold)] transition-colors group"
    >
      <Sparkles size={16} className="text-[var(--accent-gold)] flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
      <div>
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">Sugerencia del Sabio</p>
        <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed">{tip}</p>
      </div>
    </button>
  );
}
