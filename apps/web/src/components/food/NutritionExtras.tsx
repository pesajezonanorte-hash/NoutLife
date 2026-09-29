import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PixelPanel } from '../ui/PixelPanel';
import { PixelButton } from '../ui/PixelButton';
import api from '../../lib/api';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

interface NutritionGoal { calories: number; protein: number; carbs: number; fat: number }
interface DailyMacros { calories: number; protein: number; carbs: number; fat: number; goal: NutritionGoal | null }
interface SavedMeal { id: string; name: string; calories?: number; protein?: number; carbs?: number; fat?: number }
interface AIParsed { name: string; estimatedCalories: number; estimatedProtein: number; estimatedCarbs: number; estimatedFat: number; aiAvailable?: boolean; aiSucceeded?: boolean }

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  const over = goal > 0 && value > goal;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>{label}</span>
        <span className="font-pixel" style={{ fontSize: '12px', color: over ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
          {Math.round(value)}/{goal}g
        </span>
      </div>
      <div className="stat-bar h-3">
        <motion.div
          className="h-full transition-colors"
          style={{ background: over ? 'var(--accent-red)' : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7 }}
        />
      </div>
    </div>
  );
}

export function MacroGoalsWidget({ date }: { date: string }) {
  const [data, setData] = useState<DailyMacros | null>(null);
  const [editGoal, setEditGoal] = useState(false);
  const [form, setForm] = useState({ calories: '2000', protein: '150', carbs: '200', fat: '70' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/nutrition/daily?date=${date}`).then((r: any) => {
      setData(r.data);
      if (r.data.goal) {
        setForm({
          calories: String(r.data.goal.calories),
          protein: String(r.data.goal.protein),
          carbs: String(r.data.goal.carbs),
          fat: String(r.data.goal.fat),
        });
      }
    }).catch(() => null);
  }, [date]);

  async function saveGoal() {
    setSaving(true);
    try {
      await api.put('/nutrition/goals', {
        calories: Number(form.calories),
        protein: Number(form.protein),
        carbs: Number(form.carbs),
        fat: Number(form.fat),
      });
      const r: any = await api.get(`/nutrition/daily?date=${date}`);
      setData(r.data);
      setEditGoal(false);
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  if (!data) return null;

  const goal = data.goal ?? { calories: 2000, protein: 150, carbs: 200, fat: 70 };

  return (
    <PixelPanel className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>MACROS HOY</p>
        <button onClick={() => setEditGoal(e => !e)} className="font-pixel text-text-secondary hover:text-accent-gold transition-colors" style={{ fontSize: '12px' }}>
          {editGoal ? <><E e="✕" s={11} /> CERRAR</> : <><E e="⚙" s={11} /> META</>}
        </button>
      </div>

      {editGoal ? (
        <div className="space-y-2">
          {([['Calorías (kcal)', 'calories'], ['Proteína (g)', 'protein'], ['Carbs (g)', 'carbs'], ['Grasa (g)', 'fat']] as [string, keyof typeof form][]).map(([label, key]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="font-pixel text-text-secondary w-28" style={{ fontSize: '12px' }}>{label}</span>
              <input
                type="number"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="flex-1 bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-2 py-1 focus:border-accent-gold outline-none"
              />
            </div>
          ))}
          <PixelButton variant="primary" onClick={saveGoal} disabled={saving} className="w-full">
            {saving ? 'Guardando...' : 'GUARDAR META'}
          </PixelButton>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-end">
            <div>
              <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>CALORÍAS</p>
              <p className="font-vt text-2xl" style={{ color: data.calories > goal.calories ? 'var(--accent-red)' : 'var(--accent-gold)' }}>
                {Math.round(data.calories)} <span className="text-base text-text-secondary">/ {goal.calories}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-pixel text-accent-green" style={{ fontSize: '12px' }}>
                {Math.max(0, goal.calories - data.calories)} kcal restantes
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <MacroBar label="PROTEÍNA" value={data.protein} goal={goal.protein} color="var(--accent-red)" />
            <MacroBar label="CARBOS" value={data.carbs} goal={goal.carbs} color="var(--accent-gold)" />
            <MacroBar label="GRASA" value={data.fat} goal={goal.fat} color="var(--accent-purple)" />
          </div>
        </>
      )}
    </PixelPanel>
  );
}

export function AIQuickLog({ onLogged }: { onLogged: (meal: { name: string; calories?: number; protein?: number; carbs?: number; fat?: number }) => void }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<AIParsed | null>(null);
  const [mealType, setMealType] = useState('LUNCH');

  const [aiError, setAiError] = useState<string | null>(null);

  async function parse() {
    if (!text.trim()) return;
    setParsing(true);
    setAiError(null);
    try {
      const r: any = await api.post('/nutrition/ai-parse', { description: text });
      setParsed(r.data);
      if (r.data?.aiAvailable === false) {
        setAiError('IA no configurada. Puedes registrar manualmente.');
      } else if (r.data?.aiSucceeded === false) {
        setAiError('No pude estimar los macros. Puedes editarlos antes de guardar o registrar manualmente.');
      }
    } catch (e: any) {
      setAiError('No se pudo conectar con el Sabio. Registra manualmente.');
      setParsed({ name: text.trim().slice(0, 80), estimatedCalories: 0, estimatedProtein: 0, estimatedCarbs: 0, estimatedFat: 0, aiAvailable: false, aiSucceeded: false });
    } finally { setParsing(false); }
  }

  function updateMacro(key: 'estimatedCalories' | 'estimatedProtein' | 'estimatedCarbs' | 'estimatedFat', val: string) {
    if (!parsed) return;
    const n = Math.max(0, Math.round(Number(val.replace(',', '.')) || 0));
    setParsed({ ...parsed, [key]: n });
  }

  async function confirmLog() {
    if (!parsed) return;
    try {
      const r: any = await api.post('/meals', {
        name: parsed.name,
        mealType,
        calories: parsed.estimatedCalories,
        protein: parsed.estimatedProtein,
        carbs: parsed.estimatedCarbs,
        fat: parsed.estimatedFat,
      });
      onLogged(r.data);
      setText('');
      setParsed(null);
    } catch { /* ignore */ }
  }

  return (
    <PixelPanel className="p-4 space-y-3">
      <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}><E e="🤖" /> REGISTRO RÁPIDO CON IA</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && parse()}
          placeholder="Ej: pollo con arroz y ensalada"
          className="min-w-0 w-full flex-1 bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none"
        />
        <PixelButton
          variant="secondary"
          onClick={parse}
          disabled={parsing || !text.trim()}
          className="w-full shrink-0 sm:w-auto"
        >
          {parsing ? '...' : '→ ANALIZAR'}
        </PixelButton>
      </div>

      {aiError && (
        <p className="font-vt text-[var(--accent-gold)] text-sm"><E e="⚠" /> {aiError}</p>
      )}
      {parsed && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <input
            value={parsed.name}
            onChange={e => setParsed({ ...parsed, name: e.target.value })}
            className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-lg px-2 py-1 focus:border-accent-gold outline-none"
          />
          <div className="grid grid-cols-4 gap-1">
            {([
              ['Kcal',  'estimatedCalories', parsed.estimatedCalories, 'var(--accent-gold)'],
              ['Prot',  'estimatedProtein',  parsed.estimatedProtein,  'var(--accent-red)'],
              ['Carbs', 'estimatedCarbs',    parsed.estimatedCarbs,    'var(--accent-cyan)'],
              ['Grasa', 'estimatedFat',      parsed.estimatedFat,      'var(--accent-purple)'],
            ] as [string, 'estimatedCalories' | 'estimatedProtein' | 'estimatedCarbs' | 'estimatedFat', number, string][]).map(([label, key, val, color]) => (
              <div key={label} className="text-center border border-border-pixel py-2">
                <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>{label}</p>
                <input
                  type="number"
                  min={0}
                  value={val}
                  onChange={e => updateMacro(key, e.target.value)}
                  className="w-full bg-transparent text-center font-vt text-xl outline-none"
                  style={{ color }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={mealType}
              onChange={e => setMealType(e.target.value)}
              className="flex-1 bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-2 py-1 focus:border-accent-gold outline-none"
            >
              <option value="BREAKFAST">Desayuno</option>
              <option value="LUNCH">Almuerzo</option>
              <option value="DINNER">Cena</option>
              <option value="SNACK">Snack</option>
            </select>
            <PixelButton variant="primary" onClick={confirmLog}><E e="✓" /> AGREGAR</PixelButton>
            <PixelButton variant="ghost" onClick={() => setParsed(null)}><E e="✕" /></PixelButton>
          </div>
        </motion.div>
      )}
    </PixelPanel>
  );
}

export function SavedMealsPanel({ onAdd }: { onAdd: (meal: SavedMeal) => void }) {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [mealType, setMealType] = useState('LUNCH');

  useEffect(() => {
    api.get('/nutrition/saved-meals').then((r: any) => setMeals(r.data ?? [])).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    const r: any = await api.post('/nutrition/saved-meals', {
      name: form.name,
      calories: form.calories ? Number(form.calories) : undefined,
      protein: form.protein ? Number(form.protein) : undefined,
      carbs: form.carbs ? Number(form.carbs) : undefined,
      fat: form.fat ? Number(form.fat) : undefined,
    });
    setMeals(prev => [...prev, r.data]);
    setShowForm(false);
    setForm({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  }

  async function handleDelete(id: string) {
    await api.delete(`/nutrition/saved-meals/${id}`);
    setMeals(prev => prev.filter(m => m.id !== id));
  }

  async function handleAdd(meal: SavedMeal) {
    await api.post('/meals', {
      name: meal.name,
      mealType,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    });
    onAdd(meal);
  }

  return (
    <PixelPanel className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}><E e="⭐" /> COMIDAS GUARDADAS</p>
        <button onClick={() => setShowForm(f => !f)} className="font-pixel text-text-secondary hover:text-accent-gold transition-colors" style={{ fontSize: '12px' }}>
          {showForm ? <E e="✕" s={11} /> : '+ NUEVA'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 border-t border-border-pixel pt-3">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de la comida" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none" />
          <div className="grid grid-cols-4 gap-1">
            {(['calories', 'protein', 'carbs', 'fat'] as const).map(k => (
              <div key={k}>
                <p className="font-pixel text-text-secondary mb-0.5" style={{ fontSize: '12px' }}>{k === 'calories' ? 'KCAL' : k.toUpperCase()}</p>
                <input type="number" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder="0" className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-1 py-1 focus:border-accent-gold outline-none" />
              </div>
            ))}
          </div>
          <PixelButton variant="primary" onClick={handleCreate} className="w-full">GUARDAR COMIDA</PixelButton>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <span className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>AGREGAR COMO:</span>
        <select value={mealType} onChange={e => setMealType(e.target.value)} className="flex-1 bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-sm px-2 py-1 outline-none">
          <option value="BREAKFAST">Desayuno</option>
          <option value="LUNCH">Almuerzo</option>
          <option value="DINNER">Cena</option>
          <option value="SNACK">Snack</option>
        </select>
      </div>

      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.nutrition]} />}>
        {loading ? null : meals.length === 0 ? (
        <p className="font-vt text-text-secondary text-base text-center py-4 italic">Sin comidas guardadas</p>
      ) : (
        <div className="space-y-1">
          {meals.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-border-pixel/30 last:border-0">
              <div>
                <p className="font-vt text-text-primary text-lg">{m.name}</p>
                {m.calories && <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>{m.calories} kcal · P:{m.protein ?? 0}g · C:{m.carbs ?? 0}g · G:{m.fat ?? 0}g</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAdd(m)} className="font-pixel text-accent-green hover:opacity-70 transition-opacity" style={{ fontSize: '12px' }}>+ AGREGAR</button>
                <button onClick={() => handleDelete(m.id)} className="font-pixel text-accent-red hover:opacity-70 transition-opacity" style={{ fontSize: '12px' }}><E e="✕" /></button>
              </div>
            </div>
          ))}
        </div>
        )}
      </LoadingGate>
    </PixelPanel>
  );
}
