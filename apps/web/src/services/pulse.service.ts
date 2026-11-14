// Pronóstico de carga de los próximos 7 días (API /pulse, lógica en apps/api/src/lib/pulse.ts).
import api from '../lib/api';

export type PulseKind = 'exam' | 'task' | 'agenda' | 'habits' | 'sleep' | 'money';
export type PulseLevel = 'clear' | 'cloudy' | 'storm';
export interface PulseFactor { kind: PulseKind; points: number; count: number; title?: string }
export interface PulseDay { day: string; load: number; level: PulseLevel; factors: PulseFactor[] }
export interface PulseAdvice { kind: 'study' | 'move' | 'today' | 'sleep' | 'calm'; day?: string; to?: string; title?: string; count?: number }
export interface Pulse { days: PulseDay[]; advice: PulseAdvice }

export const fetchPulse = () => api.get<Pulse>('/pulse').then((r) => r.data);
