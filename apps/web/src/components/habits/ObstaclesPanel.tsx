// Obstáculos (anti-hábitos): lo que quieres dejar. Cada caída o tentación se
// registra y se ve su frecuencia por día, semana y mes, y los días que llevas limpio.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { Button, Card, EmptyState, Field, IconChip, Input, Modal, ResponsiveDialog, Textarea } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import * as svc from '@/services/antiHabit.service';
import type { AntiHabit } from '@/services/antiHabit.service';

const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function SlipBars({ daily }: { daily: AntiHabit['metrics']['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5" role="img" aria-label={`Caídas por día, últimos 7 días: ${daily.map((d) => d.count).join(', ')}`}>
      {daily.map((d) => (
        <span key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <span className="flex h-10 w-full items-end">
            <span
              className={cn('w-full rounded-sm', d.count ? 'bg-error/70' : 'bg-border')}
              style={{ height: d.count ? `${Math.max(18, (d.count / max) * 100)}%` : '3px' }}
            />
          </span>
          <span aria-hidden className="text-label-md text-on-surface-light">{WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}</span>
        </span>
      ))}
    </div>
  );
}

export function ObstaclesPanel() {
  const [list, setList] = useState<AntiHabit[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [slipping, setSlipping] = useState<AntiHabit | null>(null);
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<AntiHabit | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    svc.fetchAntiHabits().then(setList).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await svc.createAntiHabit({ name: name.trim(), icon: icon.trim() || undefined });
      setCreating(false); setName(''); setIcon('');
      useToastStore.getState().success('Obstáculo añadido');
      load();
    } catch {
      useToastStore.getState().error('No se pudo añadir el obstáculo');
    } finally {
      setBusy(false);
    }
  }

  async function logSlip(e: FormEvent) {
    e.preventDefault();
    if (!slipping) return;
    setBusy(true);
    try {
      const updated = await svc.logSlip(slipping.id, note.trim() || undefined);
      if (updated) setList((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? prev);
      useToastStore.getState().info('Caída registrada', 'Anotarla ya es avanzar. Mañana vuelve a empezar.');
      setSlipping(null); setNote('');
    } catch {
      useToastStore.getState().error('No se pudo registrar');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const target = removing;
    if (!target) return;
    setRemoving(null);
    setList((prev) => prev?.filter((a) => a.id !== target.id) ?? prev);
    try { await svc.deleteAntiHabit(target.id); } catch { useToastStore.getState().error('No se pudo eliminar'); load(); }
  }

  return (
    <Card as="section" padding="lg" aria-labelledby="obstacles-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip icon={ShieldAlert} tone="error" size="sm" />
          <div>
            <h2 id="obstacles-title" className="text-heading-sm">Obstáculos</h2>
            <p className="text-body-sm text-on-surface-light">Lo que quieres dejar: registra cada caída o tentación y mira con qué frecuencia aparece.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" strokeWidth={2} />Obstáculo</Button>
      </div>

      {list && list.length === 0 && (
        <EmptyState icon={ShieldAlert} tone="muted" title="Sin obstáculos" description="Añade un anti-hábito (p. ej. «Redes antes de dormir») para medir tus caídas." className="py-6" />
      )}

      {list && list.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <motion.li key={a.id} variants={item} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-error/[var(--lq-soft-alpha)] text-heading-sm">
                  {a.icon || <ShieldAlert className="size-5 text-error-text" strokeWidth={1.75} />}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-label-lg">{a.name}</h3>
                  <p className="text-body-sm text-on-surface-light">
                    <b className="font-mono tabular-nums text-success-text">{a.metrics.cleanStreakDays}</b> {a.metrics.cleanStreakDays === 1 ? 'día' : 'días'} {a.lastSlipAt ? 'sin caer' : 'desde que empezaste'}
                  </p>
                </div>
                <Button variant="icon" aria-label={`Eliminar ${a.name}`} onClick={() => setRemoving(a)} className="-mr-2 hover:text-error-text">
                  <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {([['Hoy', a.metrics.today], ['7 días', a.metrics.last7Days], ['30 días', a.metrics.last30Days]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface px-2 py-2">
                    <dt className="text-label-md text-on-surface-light">{k}</dt>
                    <dd className={cn('font-mono text-heading-sm tabular-nums', v > 0 ? 'text-error-text' : 'text-on-background')}>{v}</dd>
                  </div>
                ))}
              </dl>
              <SlipBars daily={a.metrics.daily} />
              <Button variant="secondary" block onClick={() => { setSlipping(a); setNote(''); }}>Registrar caída</Button>
            </motion.li>
          ))}
        </ul>
      )}

      <ResponsiveDialog open={creating} onClose={() => setCreating(false)} title="Nuevo obstáculo">
        <form className="flex flex-col gap-4" onSubmit={(e) => void create(e)}>
          <Field label="¿Qué quieres dejar?">
            <Input data-autofocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej. Redes antes de dormir" />
          </Field>
          <Field label="Emoji" help="Opcional">
            <Input value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} placeholder="📱" className="w-24" />
          </Field>
          <Button type="submit" block loading={busy} disabled={!name.trim()}>Añadir</Button>
        </form>
      </ResponsiveDialog>

      <ResponsiveDialog open={Boolean(slipping)} onClose={() => setSlipping(null)} title={slipping ? `Caída: ${slipping.name}` : 'Registrar caída'}>
        <form className="flex flex-col gap-4" onSubmit={(e) => void logSlip(e)}>
          <p className="text-body-md text-on-surface">Sin culpa: anotarlo te ayuda a ver cuándo y por qué pasa.</p>
          <Field label="¿Qué pasó?" help="Opcional">
            <Textarea rows={3} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Estaba aburrido después de cenar" />
          </Field>
          <Button type="submit" block loading={busy}>Registrar</Button>
        </form>
      </ResponsiveDialog>

      <Modal open={Boolean(removing)} onClose={() => setRemoving(null)} title={removing ? `¿Eliminar «${removing.name}»?` : '¿Eliminar?'}>
        <p className="text-body-md text-on-surface">Se borrará con todo su historial de caídas.</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => void remove()}>Eliminar</Button>
        </div>
      </Modal>
    </Card>
  );
}
