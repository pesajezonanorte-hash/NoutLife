// Registrar o editar una función de la sala: lo que viste, jugaste o viviste
// (o lo que quieres ver: la cartelera). Una función vivida da XP y oro.
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button, ChipGroup, Field, Input, ResponsiveDialog, SegmentedControl, Textarea } from '@/components/ui/lq';
import { useToastStore } from '@/hooks/useToast';
import { useUIStore } from '@/store/uiStore';
import * as recreationService from '@/services/recreation.service';
import type { RecreationEntry, RecreationKind, RecreationResult, RecreationStatus } from '@/services/recreation.service';
import { kindOf, kindsFor, localDay } from './recreationMeta';
import { Stars } from './Cinema';
import { useLocale, useText, type Copy } from '@/lib/i18n';

const es = {
  statusLabel: 'Estado',
  statusDone: 'Ya la viví',
  statusPlanned: 'Por ver',
  what: '¿Qué fue?',
  nameError: 'Ponle nombre a la función',
  namePlanned: 'Ej. Dune: Parte Tres',
  nameDone: 'Ej. Partido de fútbol con amigos',
  kind: 'Tipo de ocio',
  kindError: 'Elige qué tipo de ocio fue',
  howWas: '¿Qué tal estuvo?',
  duration: 'Duración',
  minutes: 'minutos',
  minutesRange: 'Entre 1 y 1.440',
  forWhen: 'Para cuándo',
  when: 'Cuándo',
  series: 'Seguimiento de la serie',
  currentSeason: 'Temporada actual',
  currentEpisode: 'Capítulo actual',
  watchedEpisodes: 'Capítulos vistos',
  allSeasons: 'En todas las temporadas',
  totalEpisodes: 'Capítulos en total',
  totalSeasons: 'Temporadas en total',
  optional: 'Opcional',
  seriesRange: 'Revisa los números: temporada hasta 99, capítulo hasta 999, y no más capítulos vistos que el total.',
  notes: 'Notas',
  notesPlanned: 'Con quién, dónde la ves…',
  notesDone: 'Lo que más te gustó',
  saveFail: 'No se pudo guardar la función. Inténtalo de nuevo.',
  removeFail: 'No se pudo quitar. Inténtalo de nuevo.',
  addedToBill: 'Añadida a la cartelera',
  registered: 'Función registrada',
  xpGold: (xp: number, gold: number): string => `+${xp} XP y ${gold} de oro`,
  removed: 'Función quitada',
  onBill: 'En cartelera',
  yourEntry: 'Tu función',
  planEntry: 'Planear una función',
  logEntry: 'Registrar una función',
  remove: 'Quitar',
  save: 'Guardar',
  addToBill: 'Añadir a la cartelera',
  sawIt: 'Ya la vi',
  logKind: (label: string): string => `Registrar ${label}`,
  logFunction: 'Registrar función',
};

const en: typeof es = {
  statusLabel: 'Status',
  statusDone: 'Already watched',
  statusPlanned: 'To watch',
  what: 'What was it?',
  nameError: 'Give it a name',
  namePlanned: 'E.g. Dune: Part Two',
  nameDone: 'E.g. Football match with friends',
  kind: 'Leisure type',
  kindError: 'Choose what kind of leisure it was',
  howWas: 'How was it?',
  duration: 'Duration',
  minutes: 'minutes',
  minutesRange: 'Between 1 and 1,440',
  forWhen: 'For when',
  when: 'When',
  series: 'Series tracking',
  currentSeason: 'Current season',
  currentEpisode: 'Current episode',
  watchedEpisodes: 'Episodes watched',
  allSeasons: 'Across all seasons',
  totalEpisodes: 'Total episodes',
  totalSeasons: 'Total seasons',
  optional: 'Optional',
  seriesRange: 'Check the numbers: season up to 99, episode up to 999, and no more episodes watched than the total.',
  notes: 'Notes',
  notesPlanned: 'With whom, where you’ll watch it…',
  notesDone: 'What you liked most',
  saveFail: 'Could not save the entry. Try again.',
  removeFail: 'Could not remove it. Try again.',
  addedToBill: 'Added to the billboard',
  registered: 'Entry logged',
  xpGold: (xp: number, gold: number): string => `+${xp} XP and ${gold} gold`,
  removed: 'Entry removed',
  onBill: 'On the billboard',
  yourEntry: 'Your entry',
  planEntry: 'Plan an entry',
  logEntry: 'Log an entry',
  remove: 'Remove',
  save: 'Save',
  addToBill: 'Add to the billboard',
  sawIt: 'I saw it',
  logKind: (label: string): string => `Log ${label}`,
  logFunction: 'Log entry',
};

const COPY: Copy<typeof es> = { es, en };

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
const blank = (status: RecreationStatus, kind: RecreationKind | null = null): Draft => ({
  title: '', kind, status, rating: null, minutes: '', date: localDay(), notes: '',
  season: '', episode: '', totalSeasons: '', totalEpisodes: '', watched: '',
});

const whole = (text: string) => (text.trim() === '' ? null : Math.round(Number(text)));
const inRange = (n: number | null, min: number, max: number) => n === null || (n >= min && n <= max);

export function RecreationDialog({ open, onClose, entry, initialStatus = 'DONE', initialKind = null, onSaved, onDeleted }: {
  open: boolean;
  onClose: () => void;
  /** Con entrada: editar; sin ella: registrar una nueva. */
  entry?: RecreationEntry | null;
  initialStatus?: RecreationStatus;
  /** Tipo ya elegido al registrar (p. ej. al tocar un objeto de la repisa de hobbies). */
  initialKind?: RecreationKind | null;
  onSaved: (result: RecreationResult) => void;
  onDeleted?: (id: string) => void;
}) {
  const t = useText(COPY);
  const locale = useLocale();
  const STATUS_OPTIONS = [
    { value: 'DONE' as const, label: t.statusDone },
    { value: 'PLANNED' as const, label: t.statusPlanned },
  ];
  const [draft, setDraft] = useState<Draft>(blank(initialStatus, initialKind));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState<'save' | 'watched' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addFloatingXP, triggerLevelUp } = useUIStore();

  useEffect(() => {
    if (!open) return;
    setDraft(entry ? fromEntry(entry) : blank(initialStatus, initialKind));
    setTouched(false); setError(null); setSaving(null);
  }, [open, entry, initialStatus, initialKind]);

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
    if (result.entry.status === 'PLANNED') toast.success(t.addedToBill, result.entry.title);
    else toast.success(t.registered, r && r.xpGained > 0 ? t.xpGold(r.xpGained, r.goldGained) : result.entry.title);
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
      setError(t.saveFail);
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!entry) return;
    setSaving('delete');
    try {
      await recreationService.deleteRecreation(entry.id);
      useToastStore.getState().info(t.removed, entry.title);
      onDeleted?.(entry.id);
    } catch {
      setError(t.removeFail);
      setSaving(null);
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); void save(draft.status, 'save'); };
  const planned = draft.status === 'PLANNED';
  const title = entry ? (entry.status === 'PLANNED' ? t.onBill : t.yourEntry) : planned ? t.planEntry : t.logEntry;

  return (
    <ResponsiveDialog open={open} onClose={onClose} title={title} className="md:max-w-[560px]">
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <SegmentedControl role="radiogroup" label={t.statusLabel} options={STATUS_OPTIONS} value={draft.status} onChange={(status) => set({ status })} />
        <Field label={t.what} error={touched && !draft.title.trim() ? t.nameError : undefined}>
          <Input data-autofocus value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder={planned ? t.namePlanned : t.nameDone} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label-lg text-on-surface">{t.kind}</span>
          <ChipGroup
            label={t.kind} className="flex flex-wrap gap-2"
            options={kindsFor(locale).map(({ value, label, icon }) => ({ value, label, icon }))}
            value={(draft.kind ?? '') as RecreationKind} onChange={(kind) => set({ kind })}
          />
          {touched && !draft.kind && <p role="alert" className="text-body-sm text-error-text">{t.kindError}</p>}
        </div>
        {!planned && (
          <div className="flex flex-col gap-1">
            <span className="text-label-lg text-on-surface">{t.howWas}</span>
            <Stars value={draft.rating} onChange={(rating) => set({ rating })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.duration} help={t.minutes} error={touched && minutesBad ? t.minutesRange : undefined}>
            <Input type="number" inputMode="numeric" min="1" max="1440" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder="90" className="font-mono tabular-nums" />
          </Field>
          <Field label={planned ? t.forWhen : t.when}>
            <Input type="date" value={draft.date} max={planned ? undefined : localDay()} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        {draft.kind === 'SERIES' && (
          <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
            <span className="text-label-lg text-on-surface">{t.series}</span>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.currentSeason}>
                <Input type="number" inputMode="numeric" min="1" max="99" value={draft.season} onChange={(e) => set({ season: e.target.value })} placeholder="1" className="font-mono tabular-nums" />
              </Field>
              <Field label={t.currentEpisode}>
                <Input type="number" inputMode="numeric" min="1" max="999" value={draft.episode} onChange={(e) => set({ episode: e.target.value })} placeholder="1" className="font-mono tabular-nums" />
              </Field>
              <Field label={t.watchedEpisodes} help={t.allSeasons}>
                <Input type="number" inputMode="numeric" min="0" max="9999" value={draft.watched} onChange={(e) => set({ watched: e.target.value })} placeholder="0" className="font-mono tabular-nums" />
              </Field>
              <Field label={t.totalEpisodes} help={t.optional}>
                <Input type="number" inputMode="numeric" min="1" max="9999" value={draft.totalEpisodes} onChange={(e) => set({ totalEpisodes: e.target.value })} placeholder="62" className="font-mono tabular-nums" />
              </Field>
              <Field label={t.totalSeasons} help={t.optional}>
                <Input type="number" inputMode="numeric" min="1" max="99" value={draft.totalSeasons} onChange={(e) => set({ totalSeasons: e.target.value })} placeholder="5" className="font-mono tabular-nums" />
              </Field>
            </div>
            {touched && seriesBad && <p role="alert" className="text-body-sm text-error-text">{t.seriesRange}</p>}
          </div>
        )}
        <Field label={t.notes} help={t.optional}>
          <Textarea rows={2} maxLength={1000} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={planned ? t.notesPlanned : t.notesDone} />
        </Field>
        {error && <p role="alert" className="text-body-sm text-error-text">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {entry ? (
            <Button variant="ghost" loading={saving === 'delete'} disabled={saving !== null && saving !== 'delete'} onClick={() => void remove()}>
              <Trash2 aria-hidden className="size-5" strokeWidth={1.75} />{t.remove}
            </Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {entry?.status === 'PLANNED' && planned && (
              <Button variant="secondary" loading={saving === 'watched'} disabled={saving !== null && saving !== 'watched'} onClick={() => void save('DONE', 'watched')}>
                <Check aria-hidden className="size-5" strokeWidth={2} />{t.sawIt}
              </Button>
            )}
            <Button type="submit" loading={saving === 'save'} disabled={saving !== null && saving !== 'save'}>
              {planned ? (entry ? t.save : t.addToBill) : entry ? t.save : draft.kind ? t.logKind(kindOf(draft.kind, locale).label.toLowerCase()) : t.logFunction}
            </Button>
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
