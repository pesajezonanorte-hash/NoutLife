/**
 * Brief, contextual copy for shared loading states. Every terminal receives a
 * small rotation rather than generic repeated "Cargando…" text.
 */
export const LOADING_COPY = {
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
  challenges: [
    'Preparando los retos…',
    'Buscando desafíos…',
    'Reuniendo tus pruebas…',
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
} as const;

export type LoadingCopyKey = keyof typeof LOADING_COPY;
