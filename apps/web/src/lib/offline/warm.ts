// Deja guardado lo esencial aunque no se haya visitado: al quedarse sin conexión, hábitos, agenda, libretas
// y avisos ya están en el teléfono. Se hace una vez cada tanto y sin prisa, cuando la app está ociosa.
// App.tsx lo importa aparte: nada de esto pesa en el arranque.
import { monthRange } from '../../components/finances/financeMeta';
import { fetchAchievements } from '../../services/achievement.service';
import { fetchEvents, fetchUpcoming } from '../../services/agenda.service';
import { listAntiHabits } from '../../services/antiHabit.service';
import { listChecklists } from '../../services/checklist.service';
import { fetchBudgets, fetchFinancialGoals, fetchSavings, fetchTransactionSummary, fetchTransactions } from '../../services/finance.service';
import { fetchDebts, fetchRecurring } from '../../services/finance2.service';
import { fetchHabits } from '../../services/habit.service';
import { fetchJournal, fetchJournalStreak } from '../../services/journal.service';
import { fetchPage, listNotebooks } from '../../services/notebook.service';
import { getNotificationPreferences } from '../../services/notification.service';
import { fetchQuests } from '../../services/quest.service';
import { listRituals } from '../../services/rituals.service';
import { fetchSleep, fetchSleepStats } from '../../services/sleep.service';
import { getStatsSummary } from '../../services/stats.service';
import { fetchDashboard } from '../../services/user.service';
import { fetchColiseoAttendances, fetchRoutines, fetchWorkouts } from '../../services/workout.service';
import { isOnline } from './connectivity';
import { hasRecentCopy } from './engine';

type Step = () => Promise<unknown>;

const WARM_EVERY_MS = 60 * 60_000;
const WARM_KEY = 'lq-offline-warmed';
/** Las demás zonas cambian menos, y al visitarlas ya se guardan: esto es para quien aún no las ha abierto. */
const WIDE_EVERY_MS = 12 * 60 * 60_000;
const WIDE_KEY = 'lq-offline-warmed-wide';
/** Hojas por libreta y libretas guardadas por adelantado (las usadas más recientemente). */
const MAX_PAGES = 60;
const MAX_NOTEBOOKS = 5;
/** Entre hoja y hoja: la API admite 200 peticiones por minuto y esto va de fondo. */
const PAGE_SPACING_MS = 600;
const pause = (ms: number) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

const idle = (job: () => void) => {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(job, { timeout: 4000 });
  else window.setTimeout(job, 1500);
};

function essentialSteps(): Step[] {
  const now = new Date();
  return [
    fetchHabits,
    fetchDashboard,
    fetchUpcoming,
    // El mes de la Agenda (misma ventana que su página): se reconoce la copia exacta al abrirla.
    () => fetchEvents({ from: new Date(now.getFullYear(), now.getMonth(), 1 - 7).toISOString(), to: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString() }),
    () => listNotebooks().then((books) => {
      books.filter((b) => b.usedPages > 0).slice(0, MAX_NOTEBOOKS).forEach((b) => warmNotebookPages(b.id, b.pageCount));
    }),
    fetchQuests,
    getNotificationPreferences,
    fetchDebts,
    fetchRecurring,
  ];
}

/** Las mismas lecturas que hacen sus páginas: sin copia, Finanzas abre con un error, y Coliseo, Diario o Perfil con ceros que parecen datos perdidos. */
function wideSteps(): Step[] {
  const month = monthRange(0);
  const previous = monthRange(-1);
  return [
    listAntiHabits,
    listRituals,
    () => fetchTransactions({ to: `${month.to}T23:59:59` }),
    () => fetchTransactionSummary(month.from, `${month.to}T23:59:59`),
    () => fetchTransactionSummary(previous.from, `${previous.to}T23:59:59`),
    fetchSavings,
    fetchFinancialGoals,
    () => fetchBudgets(month.month, month.year),
    listChecklists,
    () => fetchWorkouts(60),
    fetchRoutines,
    () => fetchColiseoAttendances(),
    () => fetchJournal(),
    fetchJournalStreak,
    () => fetchSleep(),
    fetchSleepStats,
    () => getStatsSummary('all'),
    fetchAchievements,
  ];
}

const due = (key: string, every: number) => {
  try { return Date.now() - Number(localStorage.getItem(key) ?? 0) >= every; } catch { return true; }
};
const stamp = (key: string) => {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* sin storage: se calienta igual */ }
};

let warming = false;

/** En serie, sin competir con lo que la persona está viendo. Cuenta como hecho al terminar: si la app se cerró a medias, la próxima vez se repite. */
export function warmOfflineCache() {
  if (warming || !isOnline()) return;
  const batches = ([[WARM_KEY, WARM_EVERY_MS, essentialSteps], [WIDE_KEY, WIDE_EVERY_MS, wideSteps]] as const).filter(([key, every]) => due(key, every));
  if (!batches.length) return;
  warming = true;
  idle(() => {
    void batches.flatMap(([, , steps]) => steps())
      .reduce((chain, step) => chain.then(() => (isOnline() ? step().then(() => undefined, () => undefined) : undefined)), Promise.resolve() as Promise<unknown>)
      .then(() => { if (isOnline()) batches.forEach(([key]) => stamp(key)); })
      .finally(() => { warming = false; });
  });
}

let notebookQueue: Promise<void> = Promise.resolve();

/** Las hojas de una libreta quedan en el dispositivo para leerlas y seguir escribiendo sin conexión. De una en una. */
export function warmNotebookPages(notebookId: string, pageCount: number) {
  notebookQueue = notebookQueue.then(async () => {
    for (let i = 0; i < Math.min(pageCount, MAX_PAGES); i += 1) {
      if (!isOnline()) return;
      if (await hasRecentCopy(`/notebooks/${notebookId}/pages/${i}`, 24 * 60 * 60_000)) continue;
      await fetchPage(notebookId, i).catch(() => null);
      await pause(PAGE_SPACING_MS);
    }
  });
}
