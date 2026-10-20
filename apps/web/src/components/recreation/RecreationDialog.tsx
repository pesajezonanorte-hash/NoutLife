// Registrar o editar una función de la sala: lo que viste, jugaste o viviste
// (o lo que quieres ver: la cartelera). Una función vivida da XP y oro.
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button, ChipGroup, Field, Input, ResponsiveDialog, SegmentedControl, Textarea } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import { useUIStore } from '@/store/uiStore';
import * as recreationService from '@/services/recreation.service';
import type { RecreationEntry, RecreationKind, RecreationResult, RecreationStatus } from '@/services/recreation.service';
import { KINDS, kindOf, localDay } from './recreationMeta';
import { Stars } from './Cinema';

type Draft = {
  title: string; kind: RecreationKind | null; status: RecreationStatus; rating: number | null; minutes: string; date: string; notes: string;
  season: string; episode: string; totalSeasons: string; totalEpisodes: string; watched: string;
};

const fromEntry = (e: RecreationEntry): Draft => ({
  title: e.title, kind: e.kind, status: e.status, rating: e.rating, minutes: e.minutes ? String(e.minutes) : '', date: localDay(new Date(e.date)), notes: e.notes ?? '',
  season: e.season ? String(e.season) : '', episode: e.episode ? String(e.episode) : '',
  totalSeasons: e.totalSeasons ? String(e.totalSeasons) : '', totalEpisodes: e.totalEpisodes ? String(e.totalEpisodes) : '',
  watched: e.episodesWatched ? String(e.episodesWatched) : '',
});
const blank = (status: RecreationStatus): Draft => ({
  title: '', kind: null, status, rating: null, minutes: '', date: localDay(), notes: '',
  season: '', episode: '', totalSeasons: '', totalEpisodes: '', watched: '',
});

const whole = (text: string) => (text.trim() === '' ? null : Math.round(Number(text)));
const inRange = (n: number | null, min: number, max: number) => n === null || (n >= min && n <= max);

const STATUS_OPTIONS = [
  { value: 'DONE' as const, label: 'Ya la viví' },
  { value: 'PLANNED' as const, label: 'Por ver' },
];

export function RecreationDialog({ open, onClose, entry, initialStatus = 'DONE', onSaved, onDeleted }: {
  open: boolean;
  onClose: () => void;
  /** Con entrada: editar; sin ella: registrar una nueva. */
  entry?: RecreationEntry | null;
  initialStatus?: RecreationStatus;
  onSaved: (result: RecreationResult) => void;
  onDeleted?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(blank(initialStatus));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState<'save' | 'watched' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addFloatingXP, triggerLevelUp } = useUIStore();

  useEffect(() => {
    if (!open) return;
    setDraft(entry ? fromEntry(entry) : blank(initialStatus));
    setTouched(false); setError(null); setSaving(null);
  }, [open, entry, initialStatus]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const minutes = draft.minutes.trim() === '' ? null : Math.round(Number(draft.minutes));
  const minutesBad = minutes !== null && !(minutes >= 1 && minutes <= 1440);
  const series = {
    season: whole(draft.season), episode: whole(draft.episode), totalSeasons: whole(draft.totalSeasons),
    totalEpisodes: whole(draft.totalEpisodes), episodesWatched: whole(draft.watched),
  };
  const seriesBad = draft.kind === 'SERIES' && (
    !inRange(series.season, 1, 99) || !inRange(series.episode, 1, 999) || !inRange(series.totalSeasons, 1, 99) ||
    !inRange(series.totalEpisodes, 1, 9999) || !inRange(series.episodesWatched, 0, 9999) ||
    (series.totalEpisodes !== null && series.episodesWatched !== null && series.episodesWatched > series.totalEpisodes)
  );
  const valid = draft.title.trim() !== '' && draft.kind !== null && !minutesBad && !seriesBad;

  function celebrate(result: RecreationResult) {
    const r = result.rewards;
    if (r && r.xpGained > 0) addFloatingXP(r.xpGained, window.innerWidth / 2, window.innerHeight / 3);
    if (r?.leveledUp) triggerLevelUp({ oldLevel: r.oldLevel, newLevel: r.newLevel, xpEarned: r.xpGained, goldEarned: r.goldGained, statIncreases: {} });
    const toast = useToastStore.getState();
    if (result.entry.status === 'PLANNED') toast.success('Añadida a la cartelera', result.entry.title);
    else toast.success('Función registrada', r && r.xpGained > 0 ? `+${r.xpGained} XP y ${r.goldGained} de oro` : result.entry.title);
  }

  async function save(status: RecreationStatus, mode: 'save' | 'watched') {
    setTouched(true);
    if (!valid) return;
    setSaving(mode); setError(null);
    const body = {
      title: draft.title.trim(), kind: draft.kind!, status, rating: status === 'DONE' ? draft.rating : null,
      minutes, date: draft.date || undefined, notes: draft.notes.trim() || null,
      ...(draft.kind === 'SERIES' && { ...series, episodesWatched: series.episodesWatched ?? 0 }),
    };
    try {
      const result = entry ? await recreationService.updateRecreation(entry.id, body) : await recreationService.createRecreation(body);
      celebrate(result);
      onSaved(result);
    } catch {
      setError('No se pudo guardar la función. Inténtalo de nuevo.');
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!entry) return;
    setSaving('delete');
    try {
      await recreationService.deleteRecreation(entry.id);
      useToastStore.getState().info('Función quitada', entry.title);
      onDeleted?.(entry.id);
    } catch {
      setError('No se pudo quitar. Inténtalo de nuevo.');
      setSaving(null);
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); void save(draft.status, 'save'); };
  const planned = draft.status === 'PLANNED';
  const title = entry ? (entry.status === 'PLANNED' ? 'En cartelera' : 'Tu función') : planned ? 'Planear una función' : 'Registrar una función';

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={title} className="md:max-w-[560px]">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <SegmentedControl role="radiogroup" label="Estado" options={STATUS_OPTIONS} value={draft.status} onChange={(status) => set({ status })} />
        <Field label="¿Qué fue?" error={touched && !draft.title.trim() ? 'Ponle nombre a la función' : undefined}>
          <Input data-autofocus value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder={planned ? 'Ej. Dune: Parte Tres' : 'Ej. Partido de fútbol con amigos'} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">Tipo de ocio</span>
          <ChipGroup
            label="Tipo de ocio" className="flex flex-wrap gap-2"
            options={KINDS.map(({ value, label, icon }) => ({ value, label, icon }))}
            value={(draft.kind ?? '') as RecreationKind} onChange={(kind) => set({ kind })}
          />
          {touched && !draft.kind && <p role="alert" className="text-body-sm text-error-text">Elige qué tipo de ocio fue</p>}
        </div>
        {!planned && (
          <div className="flex flex-col gap-1">
            <span className="text-label-lg text-on-surface">¿Qué tal estuvo?</span>
            <Stars value={draft.rating} onChange={(rating) => set({ rating })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Duración" help="minutos" error={touched && minutesBad ? 'Entre 1 y 1.440' : undefined}>
            <Input type="number" inputMode="numeric" min="1" max="1440" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder="90" className="font-mono tabular-nums" />
          </Field>
          <Field label={planned ? 'Para cuándo' : 'Cuándo'}>
            <Input type="date" value={draft.date} max={planned ? undefined : localDay()} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        {draft.kind === 'SERIES' && (
          <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
            <span className="text-label-lg text-on-surface">Seguimiento de la serie</span>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Temporada actual">
                <Input type="number" inputMode="numeric" min="1" max="99" value={draft.season} onChange={(e) => set({ season: e.target.value })} placeholder="1" className="font-mono tabular-nums" />
              </Field>
              <Field label="Capítulo actual">
                <Input type="number" inputMode="numeric" min="1" max="999" value={draft.episode} onChange={(e) => set({ episode: e.target.value })} placeholder="1" className="font-mono tabular-nums" />
              </Field>
              <Field label="Capítulos vistos" help="En todas las temporadas">
                <Input type="number" inputMode="numeric" min="0" max="9999" value={draft.watched} onChange={(e) => set({ watched: e.target.value })} placeholder="0" className="font-mono tabular-nums" />
              </Field>
              <Field label="Capítulos en total" help="Opcional">
                <Input type="number" inputMode="numeric" min="1" max="9999" value={draft.totalEpisodes} onChange={(e) => set({ totalEpisodes: e.target.value })} placeholder="62" className="font-mono tabular-nums" />
              </Field>
              <Field label="Temporadas en total" help="Opcional">
                <Input type="number" inputMode="numeric" min="1" max="99" value={draft.totalSeasons} onChange={(e) => set({ totalSeasons: e.target.value })} placeholder="5" className="font-mono tabular-nums" />
              </Field>
            </div>
            {touched && seriesBad && <p role="alert" className="text-body-sm text-error-text">Revisa los números: temporada hasta 99, capítulo hasta 999, y no más capítulos vistos que el total.</p>}
          </div>
        )}
        <Field label="Notas" help="Opcional">
          <Textarea rows={2} maxLength={1000} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={planned ? 'Con quién, dónde la ves…' : 'Lo que más te gustó'} />
        </Field>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {entry ? (
            <Button variant="ghost" loading={saving === 'delete'} disabled={saving !== null && saving !== 'delete'} onClick={() => void remove()}>
              <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />Quitar
            </Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {entry?.status === 'PLANNED' && planned && (
              <Button variant="secondary" loading={saving === 'watched'} disabled={saving !== null && saving !== 'watched'} onClick={() => void save('DONE', 'watched')}>
                <Check aria-hidden className="size-5" strokeWidth={2} />Ya la vi
              </Button>
            )}
            <Button type="submit" loading={saving === 'save'} disabled={saving !== null && saving !== 'save'}>
              {planned ? (entry ? 'Guardar' : 'Añadir a la cartelera') : entry ? 'Guardar' : draft.kind ? `Registrar ${kindOf(draft.kind).label.toLowerCase()}` : 'Registrar función'}
            </Button>
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
