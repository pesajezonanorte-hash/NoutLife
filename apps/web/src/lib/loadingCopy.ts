/**
 * Brief, contextual copy for shared loading states. Every terminal receives a
 * small rotation rather than generic repeated "Cargando…" text.
 * Cada tabla existe en español y en inglés: los componentes usan `useLoadingCopy()`.
 */
import type { Locale } from './locale';
import { useLocale } from './i18n';

const es = {
  splash: [
    'Iniciando tus herramientas…',
    'Sincronizando tu progreso…',
    'Preparando tu jornada…',
  ],
  page: [
    'Preparando la zona…',
    'Sincronizando tu aventura…',
    'Trazando el siguiente paso…',
  ],
  routeCue: [
    'Preparando la siguiente zona…',
    'Abriendo un nuevo camino…',
  ],
  achievements: [
    'Contando tus logros…',
    'Revisando tus hazañas…',
    'Ordenando tus trofeos…',
  ],
  agenda: [
    'Ordenando tu agenda…',
    'Acomodando tus planes…',
    'Consultando tu calendario…',
  ],
  food: [
    'Preparando tu registro…',
    'Sirviendo tus comidas…',
    'Sumando tus nutrientes…',
  ],
  glowUpRoutines: [
    'Preparando tus rituales…',
    'Afinando tu rutina…',
    'Abriendo tu tocador…',
  ],
  glowUpWardrobe: [
    'Abriendo tu armario…',
    'Ordenando tus prendas…',
    'Preparando tu estilo…',
  ],
  guild: [
    'Convocando a tu gremio…',
    'Revisando la hermandad…',
    'Preparando la sala común…',
  ],
  history: [
    'Revisando tu historial…',
    'Ordenando tus jornadas…',
    'Trazando tu avance…',
  ],
  journal: [
    'Abriendo tu diario…',
    'Hilando tus reflexiones…',
    'Buscando tus páginas…',
  ],
  learning: [
    'Abriendo la biblioteca…',
    'Preparando tus estudios…',
    'Ordenando tus lecciones…',
  ],
  learningNotes: [
    'Abriendo tus apuntes…',
    'Ordenando tus notas…',
    'Preparando tu repaso…',
  ],
  learningCards: [
    'Barajando tus tarjetas…',
    'Preparando el repaso…',
    'Recuperando tus conceptos…',
  ],
  loveIdeas: [
    'Preparando tus detalles…',
    'Buscando nuevas ideas…',
    'Ordenando tus regalos…',
  ],
  loveDashboard: [
    'Entrando al jardín…',
    'Cuidando su historia…',
    'Preparando momentos compartidos…',
  ],
  shop: [
    'Abriendo el mercado…',
    'Preparando el catálogo…',
    'Contando las existencias…',
  ],
  life: [
    'Calculando tu Life Score…',
    'Leyendo tu progreso…',
    'Conectando tus áreas de vida…',
  ],
  season: [
    'Preparando la campaña…',
    'Consultando la temporada…',
    'Reuniendo las recompensas…',
  ],
  customZones: [
    'Trazando tus zonas…',
    'Preparando tu reino…',
    'Levantando nuevos espacios…',
  ],
  nutrition: [
    'Preparando tus macros…',
    'Calculando tus nutrientes…',
    'Ordenando tu despensa…',
  ],
  stats: [
    'Leyendo tus estadísticas…',
    'Calculando tendencias…',
    'Preparando tus métricas…',
  ],
  statsFinance: [
    'Analizando tu tesorería…',
    'Ordenando tus finanzas…',
    'Calculando tu balance…',
  ],
  statsSleep: [
    'Revisando tu descanso…',
    'Midiendo tus noches…',
    'Preparando el reporte de sueño…',
  ],
  statsTraining: [
    'Revisando tu entrenamiento…',
    'Calculando tu esfuerzo…',
    'Ordenando tus sesiones…',
  ],
  statsPredictions: [
    'Trazando tus proyecciones…',
    'Leyendo tus tendencias…',
    'Preparando tus pronósticos…',
  ],
  habits: [
    'Cargando tus hábitos…',
    'Revisando tus rachas…',
    'Ordenando tu día…',
  ],
  quests: [
    'Cargando misiones…',
    'Desplegando el mapa…',
    'Revisando tus objetivos…',
  ],
  recreation: [
    'Apagando las luces…',
    'Preparando la función…',
    'Rebobinando la cinta…',
  ],
  coliseo: [
    'Calentando motores…',
    'Cargando tus rutinas…',
    'Sumando tu volumen…',
  ],
};

const en: Record<keyof typeof es, string[]> = {
  splash: ['Starting your tools…', 'Syncing your progress…', 'Preparing your day…'],
  page: ['Getting the zone ready…', 'Syncing your adventure…', 'Plotting the next step…'],
  routeCue: ['Preparing the next zone…', 'Opening a new path…'],
  achievements: ['Counting your achievements…', 'Reviewing your feats…', 'Sorting your trophies…'],
  agenda: ['Sorting your agenda…', 'Arranging your plans…', 'Checking your calendar…'],
  food: ['Preparing your log…', 'Serving your meals…', 'Adding up your nutrients…'],
  glowUpRoutines: ['Preparing your rituals…', 'Tuning your routine…', 'Opening your vanity…'],
  glowUpWardrobe: ['Opening your wardrobe…', 'Sorting your pieces…', 'Preparing your style…'],
  guild: ['Calling your guild…', 'Checking the brotherhood…', 'Preparing the common room…'],
  history: ['Reviewing your history…', 'Sorting your days…', 'Plotting your progress…'],
  journal: ['Opening your journal…', 'Weaving your reflections…', 'Finding your pages…'],
  learning: ['Opening the library…', 'Preparing your studies…', 'Sorting your lessons…'],
  learningNotes: ['Opening your notes…', 'Sorting your notes…', 'Preparing your review…'],
  learningCards: ['Shuffling your cards…', 'Preparing the review…', 'Recalling your concepts…'],
  loveIdeas: ['Preparing your little gestures…', 'Finding new ideas…', 'Sorting your gifts…'],
  loveDashboard: ['Walking into the garden…', 'Tending its story…', 'Preparing shared moments…'],
  shop: ['Opening the market…', 'Preparing the catalog…', 'Counting the stock…'],
  life: ['Calculating your Life Score…', 'Reading your progress…', 'Connecting your life areas…'],
  season: ['Preparing the campaign…', 'Checking the season…', 'Gathering the rewards…'],
  customZones: ['Mapping your zones…', 'Preparing your kingdom…', 'Raising new spaces…'],
  nutrition: ['Preparing your macros…', 'Calculating your nutrients…', 'Stocking your pantry…'],
  stats: ['Reading your stats…', 'Calculating trends…', 'Preparing your metrics…'],
  statsFinance: ['Analyzing your treasury…', 'Sorting your finances…', 'Calculating your balance…'],
  statsSleep: ['Checking your rest…', 'Measuring your nights…', 'Preparing the sleep report…'],
  statsTraining: ['Checking your training…', 'Calculating your effort…', 'Sorting your sessions…'],
  statsPredictions: ['Plotting your projections…', 'Reading your trends…', 'Preparing your forecasts…'],
  habits: ['Loading your habits…', 'Checking your streaks…', 'Sorting your day…'],
  quests: ['Loading goals…', 'Unrolling the map…', 'Checking your objectives…'],
  recreation: ['Dimming the lights…', 'Preparing the show…', 'Rewinding the tape…'],
  coliseo: ['Warming up…', 'Loading your routines…', 'Adding up your volume…'],
};

const TABLES: Record<Locale, Record<keyof typeof es, readonly string[]>> = { es, en };

/** Frases de carga en un idioma (para fuera de React). */
export function loadingCopyFor(locale: Locale) {
  return TABLES[locale];
}

/** Frases de carga en el idioma de la persona. */
export function useLoadingCopy() {
  return TABLES[useLocale()];
}

/** Frases en español (compatibilidad: preferir `useLoadingCopy`). */
export const LOADING_COPY = es;

export type LoadingCopyKey = keyof typeof es;
