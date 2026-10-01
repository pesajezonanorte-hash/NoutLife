import { FlowButton } from '@/components/ui/flow-button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Utensils } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import type { Meal } from '@lifequest/shared';
import * as mealService from '../../services/meal.service';
import { MacroGoalsWidget, AIQuickLog, SavedMealsPanel } from '../../components/food/NutritionExtras';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

const MEAL_TYPES = [
  { key: 'BREAKFAST', label: 'Desayuno', icon: '🌅' },
  { key: 'LUNCH', label: 'Almuerzo', icon: '☀️' },
  { key: 'DINNER', label: 'Cena', icon: '🌙' },
  { key: 'SNACK', label: 'Snack', icon: '🍎' },
  { key: 'WATER', label: 'Agua', icon: '💧' },
];

function MealModal({ onClose, onSave }: { onClose: () => void; onSave: (m: Meal) => void }) {
  const [mealType, setMealType] = useState('LUNCH');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const isWater = mealType === 'WATER';

  async function save() {
    if (!isWater && !name.trim()) return;
    setSaving(true);
    try {
      const m = await mealService.createMeal({
        name: isWater ? 'Agua' : name,
        mealType,
        calories: calories ? Number(calories) : undefined,
        protein: protein ? Number(protein) : undefined,
        carbs: carbs ? Number(carbs) : undefined,
        fat: fat ? Number(fat) : undefined,
        waterMl: waterMl ? Number(waterMl) : isWater ? 250 : undefined,
      });
      onSave(m);
      toast.success(isWater ? '¡Hidratación registrada!' : 'Comida registrada!');
    } catch {
      toast.error('Error al registrar');
    } finally { setSaving(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4" onClick={onClose}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', stiffness: 350, damping: 28 }} className="max-h-[86dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border-2 border-border-pixel bg-bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl md:p-5" onClick={e => e.stopPropagation()}>
        <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>REGISTRAR COMIDA</p>

        <div className="grid grid-cols-3 gap-1.5">
          {MEAL_TYPES.map(t => (
            <button key={t.key} onClick={() => setMealType(t.key)} className={`flex min-h-14 min-w-0 flex-col items-center justify-center px-2 py-2 border-2 transition-all ${mealType === t.key ? 'border-accent-gold bg-accent-gold/10' : 'border-border-pixel'}`}>
              <span className="text-xl"><E e={t.icon} /></span>
              <span className="font-pixel text-text-secondary mt-0.5" style={{ fontSize: '12px' }}>{t.label}</span>
            </button>
          ))}
        </div>

        {!isWater && (
          <>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="¿Qué comiste?" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-lg px-3 py-2 focus:border-accent-gold outline-none" />
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>CALORÍAS (opcional)</p>
                <input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="0" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-lg px-3 py-2 focus:border-accent-gold outline-none" />
              </div>
            </div>
            <button onClick={() => setShowMacros(m => !m)} className="font-pixel text-text-secondary hover:text-accent-gold transition-colors" style={{ fontSize: '12px' }}>
              {showMacros ? '▲ OCULTAR MACROS' : '▼ AGREGAR MACROS'}
            </button>
            {showMacros && (
              <div className="grid grid-cols-3 gap-2">
                {([['Proteína (g)', protein, setProtein], ['Carbs (g)', carbs, setCarbs], ['Grasa (g)', fat, setFat]] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                  <div key={label}>
                    <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>{label}</p>
                    <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder="0" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-2 py-1 focus:border-accent-gold outline-none" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {isWater && (
          <div>
            <p className="font-pixel text-text-secondary mb-2" style={{ fontSize: '12px' }}>CANTIDAD (ml)</p>
            <div className="flex gap-2">
              {[250, 500, 750].map(ml => (
                <button key={ml} onClick={() => setWaterMl(String(ml))} className={`flex-1 py-2 border-2 font-vt text-lg transition-all ${waterMl === String(ml) ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan' : 'border-border-pixel text-text-secondary'}`}>
                  {ml}ml
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <PixelButton variant="ghost" onClick={onClose} className="flex-1">Cancelar</PixelButton>
          <PixelButton variant="primary" onClick={save} disabled={saving || (!isWater && !name.trim())} className="flex-1">
            {saving ? '...' : 'GUARDAR'}
          </PixelButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function FoodPage() {
  const reduceMotion = useReducedMotion();
  const toast = useToast();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'log' | 'macros' | 'saved'>('log');
  const today = getTodayString();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mealService.fetchMeals(today);
      setMeals(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(m: Meal) {
    setMeals(prev => [...prev, m]);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    setMeals(prev => prev.filter(m => m.id !== id));
    try { await mealService.deleteMeal(id); }
    catch { toast.error('Error al eliminar'); load(); }
  }

  const waterLogs = meals.filter(m => m.mealType === 'WATER');
  const totalWater = waterLogs.reduce((a, m) => a + (m.waterMl ?? 0), 0);
  const waterGoal = 2000;
  const waterPct = Math.min((totalWater / waterGoal) * 100, 100);
  const totalCalories = meals.filter(m => m.calories).reduce((a, m) => a + (m.calories ?? 0), 0);

  const mealsByType = MEAL_TYPES.filter(t => t.key !== 'WATER').map(t => ({
    ...t,
    items: meals.filter(m => m.mealType === t.key),
  }));
  const hasMealRecords = meals.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]"><Utensils className="h-5 w-5 text-[var(--accent-gold)]" aria-hidden="true" /> La Posada</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Registra tus comidas y observa lo que sostiene tu energía.</p>
        </div>
        <div className="flex items-center gap-2">
          <SageContextButton message="¿Cómo está mi alimentación esta semana? ¿Qué puedo mejorar?" label="Pídele consejo al Sabio" />
          <FlowButton tone="primary" size="lg" withArrows={false} onClick={() => setShowModal(true)}>Registrar comida</FlowButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1">
        {([['log', ' Registro'], ['macros', ' Macros'], ['saved', ' Guardadas']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`min-h-11 min-w-0 px-2 py-1.5 border-2 font-pixel transition-all ${tab === key ? 'border-accent-gold bg-accent-gold text-bg-deep' : 'border-border-pixel text-text-secondary hover:border-text-secondary'}`}
            style={{ fontSize: '12px' }}
          >
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
      {/* Macros tab */}
      {tab === 'macros' && (
        <div className="space-y-4">
          <MacroGoalsWidget date={today} />
        </div>
      )}

      {/* Saved meals tab */}
      {tab === 'saved' && (
        <SavedMealsPanel onAdd={() => load()} />
      )}

      {tab !== 'log' ? null : <>

      {/* AI Quick Log */}
      <AIQuickLog onLogged={() => load()} />

      {/* Water tracker */}
      <PixelPanel className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--accent-cyan)]"><E e="💧" /> Hidratación de hoy</p>
          <p className="font-vt text-accent-cyan text-lg">{(totalWater / 1000).toFixed(1)}L / {waterGoal / 1000}L</p>
        </div>
        <div className="stat-bar h-5">
          <motion.div className="h-full bg-accent-cyan" initial={{ width: 0 }} animate={{ width: `${waterPct}%` }} transition={{ duration: 0.8 }} />
        </div>
        <div className="flex gap-2 mt-2">
          {[250, 500].map(ml => (
            <PixelButton key={ml} variant="secondary" onClick={async () => {
              const m = await mealService.createMeal({ name: 'Agua', mealType: 'WATER', waterMl: ml, date: today });
              setMeals(prev => [...prev, m]);
            }}>
              + {ml}ml <E e="💧" />
            </PixelButton>
          ))}
        </div>
      </PixelPanel>

      {/* Calories */}
      {totalCalories > 0 && (
        <PixelPanel className="p-3 flex justify-between items-center">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Calorías de hoy</p>
          <p className="font-vt text-accent-gold text-2xl">{totalCalories} kcal</p>
        </PixelPanel>
      )}

      {/* Meals by type */}
      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.food]} />}>
        {loading ? null : !hasMealRecords ? (
          <EmptyState
            icon={Utensils}
            title="Tu mesa está lista"
            description="Registra tu primera comida para comenzar a entender tus hábitos de alimentación."
            actionLabel="Registrar mi primera comida"
            onAction={() => setShowModal(true)}
          />
        ) : (
          <div className="space-y-3">
          {mealsByType.map(group => (
            <PixelPanel key={group.key} className="p-3">
              <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]"><E e={group.icon} /> {group.label}</p>
              {group.items.length === 0 ? (
                <p className="font-vt text-text-secondary text-base italic">— sin registros —</p>
              ) : (
                <AnimatePresence>
                  {group.items.map(m => (
                    <motion.div key={m.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center justify-between py-1 border-b border-border-pixel/30 last:border-0">
                      <p className="font-vt text-text-primary text-lg">{m.name}</p>
                      <div className="flex items-center gap-3">
                        {m.calories && <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>{m.calories} kcal</p>}
                        <FlowButton tone="danger" size="sm" withArrows={false} onClick={() => handleDelete(m.id)} className="min-h-11 px-3 font-pixel text-xs"><E e="✕" /></FlowButton>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </PixelPanel>
          ))}
          </div>
        )}
      </LoadingGate>
      </>}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showModal && <MealModal onClose={() => setShowModal(false)} onSave={handleSaved} />}
      </AnimatePresence>
    </div>
  );
}
