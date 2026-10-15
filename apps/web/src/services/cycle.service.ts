import api from '@/lib/api';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type CycleFlow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleSymptom =
  | 'cramps' | 'headache' | 'bloating' | 'breast_tenderness' | 'back_pain' | 'acne'
  | 'nausea' | 'fatigue' | 'cravings' | 'insomnia' | 'anxiety' | 'irritability';
export type CycleIntensity = 'rest' | 'gentle' | 'moderate' | 'high';

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
  daysUntilNextPeriod: number;
  lateDays: number;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
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
  mood: number | null;
  energy: number | null;
  symptoms: CycleSymptom[];
  notes: string | null;
}

export interface CyclePeriod { id: string; startDate: string; endDate: string | null; length: number | null }

export interface CycleOverview {
  today: string;
  settings: { cycleLength: number; periodLength: number } | null;
  averages: { cycleLength: number; periodLength: number; cyclesTracked: number; shortest: number | null; longest: number | null };
  periods: CyclePeriod[];
  logs: CycleLog[];
  todayLog: CycleLog | null;
  snapshot: CycleSnapshot | null;
  advice: CycleAdvice | null;
}

export type CycleLogInput = Partial<Pick<CycleLog, 'flow' | 'mood' | 'energy' | 'notes'>> & { symptoms?: CycleSymptom[] };

export const getCycle = () => api.get<CycleOverview>('/cycle').then((r) => r.data);
export const getCycleAdvice = () => api.get<{ advice: CycleAdvice | null; snapshot: Pick<CycleSnapshot, 'phase' | 'cycleDay' | 'onPeriod' | 'daysUntilNextPeriod' | 'lateDays'> | null }>('/cycle/advice').then((r) => r.data);
export const saveCycleSettings = (payload: { cycleLength?: number; periodLength?: number; lastPeriodStart?: string }) =>
  api.put<CycleOverview>('/cycle/settings', payload).then((r) => r.data);
export const addCyclePeriod = (payload: { startDate: string; endDate?: string | null }) => api.post<CyclePeriod>('/cycle/periods', payload).then((r) => r.data);
export const updateCyclePeriod = (id: string, payload: { startDate?: string; endDate?: string | null }) => api.patch<CyclePeriod>(`/cycle/periods/${id}`, payload).then((r) => r.data);
export const deleteCyclePeriod = (id: string) => api.delete(`/cycle/periods/${id}`);
export const logCycleDay = (date: string, payload: CycleLogInput) =>
  api.put<{ log: CycleLog; period: 'started' | 'extended' | null }>(`/cycle/logs/${date}`, payload).then((r) => r.data);
export const clearCycleDay = (date: string) => api.delete(`/cycle/logs/${date}`);
