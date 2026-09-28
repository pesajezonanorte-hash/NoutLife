import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Trash2, Check, ShoppingBag, Shirt, Star, BarChart3 } from 'lucide-react';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { PixelButton } from '../../components/ui/PixelButton';
import { useToastStore } from '../../hooks/useToast';
import api from '../../lib/api';
import { E } from '@/components/ui/glyphs';
import ModernLoader from '@/components/ui/modern-loader';
import { LoadingGate } from '@/components/ui/LoadingGate';
import { LOADING_COPY } from '@/lib/loadingCopy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CareRoutine {
  id: string; name: string; timeOfDay: string;
  currentStreak: number; longestStreak: number; lastDoneAt?: string;
  steps: { id: string; name: string; product?: string; order: number }[];
}

interface ClothingItem {
  id: string; name: string; category: string; color?: string;
  brand?: string; cost?: number; timesWorn: number; isFavorite: boolean;
}

interface PresenceCheckin {
  id: string; week: string;
  posture: number; voice: number; confidence: number; communication: number;
}

const TABS = [
  { key: 'care',     label: ' Cuidado Personal' },
  { key: 'style',    label: ' Estilo' },
  { key: 'presence', label: ' Presencia' },
] as const;

const CATEGORIES = ['tops', 'bottoms', 'shoes', 'outerwear', 'accessories'];
const CATEGORY_LABELS: Record<string, string> = {
  tops: 'Camisas/Tops', bottoms: 'Pantalones', shoes: 'Zapatos',
  outerwear: 'Abrigos', accessories: 'Accesorios',
};
const TIME_OF_DAY = ['morning', 'night', 'weekly', 'custom'];
const TIME_LABELS: Record<string, string> = {
  morning: ' Mañana', night: ' Noche', weekly: ' Semanal', custom: ' Custom',
};

// ─── Care Section ────────────────────────────────────────────────────────────

function CareSection() {
  const toast = useToastStore();
  const [routines, setRoutines] = useState<CareRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', timeOfDay: 'morning', steps: [''] });
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mirror/routines');
      setRoutines(data);
    } catch { toast.error('Error cargando rutinas'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleComplete(id: string) {
    setCompleting(id);
    try {
      const { data } = await api.post(`/mirror/routines/${id}/complete`);
      if (data.alreadyDone) { toast.info('¡Ya completaste esta rutina hoy!'); }
      else { toast.success('¡Rutina completada! +20 XP'); load(); }
    } catch { toast.error('Error'); }
    finally { setCompleting(null); }
  }

  async function handleCreate() {
    try {
      await api.post('/mirror/routines', {
        name: form.name,
        timeOfDay: form.timeOfDay,
        steps: form.steps.filter(Boolean).map((s, i) => ({ name: s, order: i })),
      });
      setShowNew(false);
      setForm({ name: '', timeOfDay: 'morning', steps: [''] });
      load();
      toast.success('Rutina creada');
    } catch { toast.error('Error creando rutina'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-[var(--text-2)] text-[10px]">TUS RUTINAS DE CUIDADO</p>
        <PixelButton variant="primary" onClick={() => setShowNew(true)}>+ Nueva rutina</PixelButton>
      </div>

      {showNew && (
        <PixelPanel className="p-4 space-y-3">
          <input
            className="min-h-11 w-full rounded-lg px-3 py-2 text-base"
            style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}
            placeholder="Nombre de la rutina"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div className="flex gap-2 flex-wrap">
            {TIME_OF_DAY.map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, timeOfDay: t }))} className="min-h-11 px-2"
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12,
                  border: `1px solid ${form.timeOfDay === t ? 'var(--primary)' : 'var(--border)'}`,
                  background: form.timeOfDay === t ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'var(--bg-panel)',
                  color: form.timeOfDay === t ? 'var(--primary)' : 'var(--text-2)',
                }}
              ><E e={TIME_LABELS[t]} /></button>
            ))}
          </div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Pasos:</p>
          {form.steps.map((s, i) => (
            <input key={i}
              className="min-h-11 w-full rounded-lg px-3 py-2 text-base"
              style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder={`Paso ${i + 1}...`}
              value={s}
              onChange={e => setForm(f => {
                const steps = [...f.steps]; steps[i] = e.target.value; return { ...f, steps };
              })}
            />
          ))}
          <button onClick={() => setForm(f => ({ ...f, steps: [...f.steps, ''] }))}
            className="min-h-11 px-2 text-xs" style={{ color: 'var(--primary)' }}>+ Agregar paso</button>
          <div className="flex gap-2">
            <PixelButton variant="primary" onClick={handleCreate} disabled={!form.name}>Crear</PixelButton>
            <PixelButton variant="secondary" onClick={() => setShowNew(false)}>Cancelar</PixelButton>
          </div>
        </PixelPanel>
      )}

      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.glowUpRoutines]} />}>
        {loading ? null : routines.length === 0 ? (
        <PixelPanel className="p-8 text-center">
          <p className="text-3xl mb-2"><E e="🧴" /></p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin rutinas aún. ¡Crea tu primera!</p>
        </PixelPanel>
      ) : (
        <div className="space-y-3">
          {routines.map(r => (
            <PixelPanel key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{r.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-soft)', color: 'var(--text-2)' }}>
                      <E e={TIME_LABELS[r.timeOfDay]} />
                    </span>
                  </div>
                  {r.currentStreak > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--c-gold)' }}><E e="🔥" /> {r.currentStreak} días de racha</p>
                  )}
                  {r.steps.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {r.steps.map((s, i) => (
                        <p key={s.id} className="text-xs" style={{ color: 'var(--text-2)' }}>
                          {i + 1}. {s.name}{s.product && ` (${s.product})`}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <PixelButton
                  variant="primary"
                  onClick={() => handleComplete(r.id)}
                  disabled={completing === r.id}
                >
                  <Check size={14} />
                  {completing === r.id ? '...' : 'Hecho'}
                </PixelButton>
              </div>
            </PixelPanel>
          ))}
        </div>
        )}
      </LoadingGate>
    </div>
  );
}

// ─── Style Section ────────────────────────────────────────────────────────────

function StyleSection() {
  const toast = useToastStore();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'tops', color: '', brand: '', cost: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mirror/wardrobe');
      setItems(data);
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = activeCategory ? items.filter(i => i.category === activeCategory) : items;

  async function handleCreate() {
    try {
      await api.post('/mirror/wardrobe', { ...form, cost: form.cost ? Number(form.cost) : undefined });
      setShowNew(false); load(); toast.success('Prenda añadida');
    } catch { toast.error('Error'); }
  }

  async function handleWorn(id: string) {
    try { await api.post(`/mirror/wardrobe/${id}/worn`); load(); } catch { toast.error('Error'); }
  }

  async function handleDelete(id: string) {
    try { await api.delete(`/mirror/wardrobe/${id}`); load(); } catch { toast.error('Error'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-[var(--text-2)] text-[10px]">MI ARMARIO</p>
        <PixelButton variant="primary" onClick={() => setShowNew(true)}>+ Prenda</PixelButton>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setActiveCategory('')} className="min-h-11 px-2"
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12,
            border: `1px solid ${!activeCategory ? 'var(--primary)' : 'var(--border)'}`,
            background: !activeCategory ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'var(--bg-panel)',
            color: !activeCategory ? 'var(--primary)' : 'var(--text-2)',
          }}>Todas</button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              border: `1px solid ${activeCategory === c ? 'var(--primary)' : 'var(--border)'}`,
              background: activeCategory === c ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'var(--bg-panel)',
              color: activeCategory === c ? 'var(--primary)' : 'var(--text-2)',
            }}><E e={CATEGORY_LABELS[c]} /></button>
        ))}
      </div>

      {showNew && (
        <PixelPanel className="p-4 space-y-2">
          {[
            { key: 'name', label: 'Nombre', placeholder: 'Camiseta azul...' },
            { key: 'brand', label: 'Marca', placeholder: 'Zara, Nike...' },
            { key: 'color', label: 'Color', placeholder: '#8a8a92' },
            { key: 'cost', label: 'Precio (COP)', placeholder: '50000' },
          ].map(f => (
            <input key={f.key}
              className="min-h-11 w-full rounded-lg px-3 py-2 text-base"
              style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder={f.placeholder}
              value={(form as any)[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          ))}
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="min-h-11 w-full rounded-lg px-3 py-2 text-base"
            style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {CATEGORIES.map(c => <option key={c} value={c}><E e={CATEGORY_LABELS[c]} /></option>)}
          </select>
          <div className="flex gap-2">
            <PixelButton variant="primary" onClick={handleCreate} disabled={!form.name}>Añadir</PixelButton>
            <PixelButton variant="secondary" onClick={() => setShowNew(false)}>Cancelar</PixelButton>
          </div>
        </PixelPanel>
      )}

      <LoadingGate loading={loading} fallback={<ModernLoader words={[...LOADING_COPY.glowUpWardrobe]} />}>
        {loading ? null : displayed.length === 0 ? (
        <PixelPanel className="p-8 text-center">
          <Shirt size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tu armario está vacío</p>
        </PixelPanel>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayed.map(item => (
            <PixelPanel key={item.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-semibold truncate">{item.name}</p>
                <button onClick={() => handleDelete(item.id)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-red-500/10"
                  style={{ color: 'var(--text-muted)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}><E e={CATEGORY_LABELS[item.category]} /></p>
              {item.brand && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.brand}</p>}
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {item.timesWorn}x usado
                  {item.cost && item.timesWorn > 0
                    ? ` · $${Math.round(Number(item.cost) / item.timesWorn).toLocaleString('es-CO')}/uso`
                    : ''}
                </p>
                {item.isFavorite && <Star size={12} style={{ color: 'var(--c-gold)' }} />}
              </div>
              <button onClick={() => handleWorn(item.id)}
                className="min-h-11 w-full rounded text-xs py-1"
                style={{ background: 'var(--bg-soft)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
                Usar hoy
              </button>
            </PixelPanel>
          ))}
        </div>
        )}
      </LoadingGate>
    </div>
  );
}

// ─── Presence Section ─────────────────────────────────────────────────────────

const AREAS = [
  { key: 'posture',       label: 'Postura' },
  { key: 'voice',         label: 'Voz' },
  { key: 'confidence',    label: 'Confianza' },
  { key: 'communication', label: 'Comunicación' },
] as const;

function PresenceSection() {
  const toast = useToastStore();
  const [checkins, setCheckins] = useState<PresenceCheckin[]>([]);
  const [form, setForm] = useState({ posture: 3, voice: 3, confidence: 3, communication: 3, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/mirror/checkins');
      setCheckins(data);
    } catch { toast.error('Error'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const week = new Date();
      week.setHours(0, 0, 0, 0);
      week.setDate(week.getDate() - week.getDay());
      await api.post('/mirror/checkins', { week: week.toISOString(), ...form });
      toast.success('Autoevaluación guardada');
      load();
    } catch { toast.error('Error guardando'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="font-pixel text-[var(--text-2)] text-[10px]">AUTOEVALUACIÓN SEMANAL</p>

      <PixelPanel className="p-4 space-y-4">
        {AREAS.map(area => (
          <div key={area.key}>
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">{area.label}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{form[area.key]}/5</span>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => setForm(f => ({ ...f, [area.key]: v }))} className="min-h-11"
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6,
                    background: form[area.key] >= v
                      ? 'color-mix(in oklab, var(--primary) 80%, transparent)'
                      : 'var(--bg-soft)',
                    border: '1px solid var(--border)',
                    color: form[area.key] >= v ? 'white' : 'var(--text-2)',
                    fontSize: 12, fontWeight: 600,
                  }}>{v}</button>
              ))}
            </div>
          </div>
        ))}
        <textarea
          className="min-h-11 w-full resize-none rounded-lg px-3 py-2 text-base"
          style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}
          placeholder="Notas de la semana..."
          rows={2}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
        <PixelButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar evaluación'}
        </PixelButton>
      </PixelPanel>

      {checkins.length > 0 && (
        <div>
          <p className="font-pixel text-[var(--text-2)] text-[10px] mb-3">EVOLUCIÓN</p>
          <div className="space-y-2">
            {checkins.slice(0, 6).map(c => {
              const avg = Math.round((c.posture + c.voice + c.confidence + c.communication) / 4 * 20);
              return (
                <PixelPanel key={c.id} className="p-3 flex items-center gap-3">
                  <div className="text-xs font-medium w-20 shrink-0" style={{ color: 'var(--text-2)' }}>
                    {new Date(c.week).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </div>
                  <div className="flex-1 flex gap-2">
                    {AREAS.map(a => (
                      <div key={a.key} className="flex-1 text-center">
                        <div className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{c[a.key]}</div>
                        <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{a.label.slice(0, 3)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-bold shrink-0" style={{ color: avg >= 60 ? 'var(--c-green)' : 'var(--c-gold)' }}>
                    {avg}%
                  </div>
                </PixelPanel>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GlowUpPage() {
  const [activeTab, setActiveTab] = useState<'care' | 'style' | 'presence'>('care');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Sparkles size={22} style={{ color: 'var(--primary)' }} />
        <div>
          <h1 className="font-pixel text-[var(--accent-gold)]" style={{ fontSize: '14px' }}>
            EL ESPEJO
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Glow Up No Físico — Cuídate, vístete y preséntate</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-soft)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className="min-h-11"
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: activeTab === t.key ? 700 : 500,
              background: activeTab === t.key ? 'var(--bg-panel)' : 'transparent',
              color: activeTab === t.key ? 'var(--text)' : 'var(--text-2)',
              border: activeTab === t.key ? '1px solid var(--border)' : '1px solid transparent',
              boxShadow: activeTab === t.key ? 'var(--shadow-sm)' : 'none',
              transition: 'all .15s',
            }}>{t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'care' && <CareSection />}
          {activeTab === 'style' && <StyleSection />}
          {activeTab === 'presence' && <PresenceSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
