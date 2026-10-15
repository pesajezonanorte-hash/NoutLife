import api from '../lib/api';

export interface WisdomCard {
  id: string;
  quote: string;
  author?: string;
  /** Obra u ocasión de la cita. */
  source?: string | null;
  category: string;
  levelRequired: number;
}

export async function getDailyCard(): Promise<WisdomCard | null> {
  const { data } = await api.get('/wisdom/daily');
  return data;
}

export async function getAllCards(): Promise<{
  available: WisdomCard[];
  locked: { id: string; category: string; levelRequired: number }[];
  userLevel: number;
}> {
  const { data } = await api.get('/wisdom');
  return data;
}
