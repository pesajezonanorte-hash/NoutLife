import api from '@/lib/api';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type CycleFlow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleSymptom =
  | 'cramps' | 'headache' | 'bloating' | 'breast_tenderness' | 'back_pain' | 'acne'
  | 'nausea' | 'fatigue' | 'cravings' | 'insomnia' | 'anxiety' | 'irritability';
export type CycleMood = 'happy' | 'energetic' | 'sensitive' | 'anxious' | 'irritable' | 'mood_swings';
export type CycleSexualActivity = 'none' | 'protected' | 'unprotected';
export type CycleContraceptive = 'none' | 'pill' | 'iud' | 'implant' | 'injection' | 'condom' | 'other';
export type CycleIntensity = 'rest' | 'gentle' | 'moderate' | 'high';
export type CycleRegularity = 'regular' | 'variable' | 'irregular';
export type CycleFertility = 'peak' | 'high' | 'low';

export interface PhaseRange { start: number; end: number }
export interface CycleShape { length: number; period: number; ovulationDay: number; ranges: Record<CyclePhase, PhaseRange> }

export interface CycleSnapshot {
  cycleDay: number;
  phase: CyclePhase;
  phaseDay: number;
  phaseLength: number;
  onPeriod: boolean;
  periodOpen: boolean;
  periodStart: string;
  nextPeriod: string;
  nextPeriodEarliest: string | null;
  nextPeriodLatest: string | null;
  daysUntilNextPeriod: number;
  lateDays: number;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
  fertility: CycleFertility;
  shape: CycleShape;
}

export interface CycleAdvice {
  phase: CyclePhase;
  cycleDay: number;
  energy: number;
  energySource: 'today' | 'history' | 'typical';
  symptoms: CycleSymptom[];
  symptomsSource: 'today' | 'history' | null;
  intensity: CycleIntensity;
  training: { title: string; body: string; load: string; ideas: string[] };
  habits: { title: string; body: string };
  pauseFitness: boolean;
  note: string;
}

export interface CycleLog {
  date: string;
  flow: CycleFlow | null;
  moods: CycleMood[];
  energy: number | null;
  symptoms: CycleSymptom[];
  sexualActivity: CycleSexualActivity | null;
  contraception: CycleContraceptive | null;
  sleepQuality: number | null;
  stress: number | null;
  waterGlasses: number | null;
  notes: string | null;
}

export interface CyclePeriod { id: string; startDate: string; endDate: string | null; length: number | null }

export interface CycleAnalytics {
  cycles: { start: string; length: number }[];
  periods: { start: string; length: number }[];
  symptomsByPhase: Record<CyclePhase, { days: number; symptoms: { symptom: CycleSymptom; count: number }[] }>;
}

export interface CycleOverview {
  today: string;
  settings: { cycleLength: number; periodLength: number } | null;
  averages: {
    cycleLength: number; periodLength: number; cyclesTracked: number; shortest: number | null; longest: number | null;
    stdDev: number | null; regularity: CycleRegularity | null;
  };
  periods: CyclePeriod[];
  logs: CycleLog[];
  todayLog: CycleLog | null;
  snapshot: CycleSnapshot | null;
  advice: CycleAdvice | null;
  analytics: CycleAnalytics;
}

export type CycleLogInput = Partial<Pick<CycleLog,
  'flow' | 'moods' | 'energy' | 'symptoms' | 'sexualActivity' | 'contraception' | 'sleepQuality' | 'stress' | 'waterGlasses' | 'notes'>>;

// La zona vive en /menstrual-cycle de la API.
export const getCycle = () => api.get<CycleOverview>('/menstrual-cycle').then((r) => r.data);
export const getCycleAdvice = () => api.get<{ advice: CycleAdvice | null; snapshot: Pick<CycleSnapshot, 'phase' | 'cycleDay' | 'onPeriod' | 'daysUntilNextPeriod' | 'lateDays'> | null }>('/menstrual-cycle/advice').then((r) => r.data);
export const saveCycleSettings = (payload: { cycleLength?: number; periodLength?: number; lastPeriodStart?: string }) =>
  api.put<CycleOverview>('/menstrual-cycle/settings', payload).then((r) => r.data);
export const addCyclePeriod = (payload: { startDate: string; endDate?: string | null }) => api.post<CyclePeriod>('/menstrual-cycle/periods', payload).then((r) => r.data);
export const updateCyclePeriod = (id: string, payload: { startDate?: string; endDate?: string | null }) => api.patch<CyclePeriod>(`/menstrual-cycle/periods/${id}`, payload).then((r) => r.data);
export const deleteCyclePeriod = (id: string) => api.delete(`/menstrual-cycle/periods/${id}`);
export const logCycleDay = (date: string, payload: CycleLogInput) =>
  api.put<{ log: CycleLog; period: 'started' | 'extended' | null }>(`/menstrual-cycle/logs/${date}`, payload).then((r) => r.data);
export const clearCycleDay = (date: string) => api.delete(`/menstrual-cycle/logs/${date}`);
