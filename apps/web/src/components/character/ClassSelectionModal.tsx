// Elegir clase (nivel 10) — radiogroup nativo de tarjetas 2×2, Continuar /
// Decidir después. Error en línea (role="alert") en lugar de alert().
import { useEffect, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Coins, Heart, Swords, Wand2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button, IconChip, ResponsiveDialog, type Tone } from '@/components/ui/lq';

const CLASSES: Array<{ id: string; icon: LucideIcon; tone: Exclude<Tone, 'muted'>; name: string; description: string; bonus: string; stat: string }> = [
  { id: 'warrior', icon: Swords, tone: 'error', name: 'Guerrero', description: 'Maestro del fitness y la disciplina', bonus: '+20% XP en misiones de Gym', stat: 'Fuerza +2 por nivel' },
  { id: 'mage', icon: Wand2, tone: 'secondary', name: 'Mago', description: 'Sabio del conocimiento', bonus: '+20% XP en misiones de Aprendizaje', stat: 'Inteligencia +2 por nivel' },
  { id: 'merchant', icon: Coins, tone: 'warning', name: 'Mercader', description: 'Maestro de las finanzas y el ahorro', bonus: '+20% de oro en todas las misiones', stat: 'Acumula riqueza más rápido' },
  { id: 'paladin', icon: Heart, tone: 'success', name: 'Paladín', description: 'Guardián de las relaciones y el bienestar', bonus: '+20% XP en misiones de Amor y Salud', stat: 'Carisma +2 por nivel' },
];

const ring: Record<Exclude<Tone, 'muted'>, string> = {
  primary: 'has-[:checked]:border-primary',
  secondary: 'has-[:checked]:border-secondary',
  success: 'has-[:checked]:border-success',
  warning: 'has-[:checked]:border-warning',
  error: 'has-[:checked]:border-error',
  info: 'has-[:checked]:border-info',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ClassSelectionModal({ open, onClose }: Props) {
  const name = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { updateUser, user } = useAuthStore();
  const cls = CLASSES.find((c) => c.id === selected);

  useEffect(() => { if (open) { setConfirmed(false); setError(null); } }, [open]);

  async function choose() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const r = await api.post<{ user?: unknown }>('/users/me/class', { playerClass: selected });
      if (r.data?.user) updateUser(r.data.user as never);
      else updateUser({ ...user, playerClass: selected } as never);
      setConfirmed(true);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'No se pudo guardar tu clase. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={confirmed ? '¡Clase elegida!' : <span className="block text-heading-lg md:text-display-sm">Elige tu clase</span>}
      className="md:max-w-[640px]"
    >
      {confirmed && cls ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: spring }}>
            <IconChip icon={cls.icon} tone={cls.tone} size="lg" />
          </motion.span>
          <p className="text-heading-sm">Ahora eres {cls.name}</p>
          <p className="text-body-md text-on-surface-light">{cls.bonus}. {cls.stat}.</p>
          <Button size="lg" block data-autofocus onClick={onClose}>Continuar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="-mt-2 text-body-md text-on-surface-light">Has llegado al nivel 10: especialízate. Tu clase da bonus de XP y atributos.</p>

          <div role="radiogroup" aria-label="Clase" className="grid grid-cols-2 gap-3 md:gap-4">
            {CLASSES.map((c) => (
              <label
                key={c.id}
                className={cn(
                  'lq-lift relative flex cursor-pointer flex-col gap-2 rounded-2xl border-2 border-border bg-surface p-3 md:p-4',
                  'hover:border-border-strong has-[:checked]:bg-background has-[:checked]:shadow-md',
                  'has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
                  ring[c.tone],
                )}
              >
                <input
                  type="radio" name={name} value={c.id}
                  checked={selected === c.id}
                  onChange={() => setSelected(c.id)}
                  className="peer sr-only"
                  aria-describedby={`${name}-${c.id}`}
                />
                <span className="flex items-start justify-between">
                  <IconChip icon={c.icon} tone={c.tone} size="sm" />
                  <span aria-hidden className={cn('flex size-6 items-center justify-center rounded-full', selected !== c.id && 'border-2 border-border-strong')}>
                    {selected === c.id && <CheckCircle2 className="size-6 text-primary-text" strokeWidth={2} />}
                  </span>
                </span>
                <span className="text-heading-sm">{c.name}</span>
                <span id={`${name}-${c.id}`} className="flex flex-col gap-1">
                  <span className="text-body-sm text-on-surface-light">{c.description}</span>
                  <span className="text-label-lg text-on-surface">{c.bonus}</span>
                  <span className="text-body-sm text-on-surface-light">{c.stat}</span>
                </span>
              </label>
            ))}
          </div>

          {error && <p role="alert" className="rounded-xl bg-error/[var(--lq-soft-alpha)] px-4 py-3 text-body-sm text-error-text">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>Decidir después</Button>
            <Button size="lg" disabled={!selected} loading={saving} onClick={choose}>
              {cls ? `Ser ${cls.name}` : 'Elige una clase'}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
