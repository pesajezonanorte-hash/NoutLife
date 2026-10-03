import { create } from 'zustand';
import { audio } from '../lib/audio';

export interface StatIncreases {
  strength?: number;
  intelligence?: number;
  charisma?: number;
  hp?: number;
  mp?: number;
}

export interface LevelUpData {
  oldLevel: number;
  newLevel: number;
  xpEarned: number;
  goldEarned: number;
  statIncreases: StatIncreases;
}

export interface AchievementToast {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

interface FloatingXP {
  id: string;
  amount: number;
  x: number;
  y: number;
}

interface UIState {
  levelUpData: LevelUpData | null;
  floatingXPs: FloatingXP[];
  isScreenFlashing: boolean;
  flashColor: string;
  achievementToasts: AchievementToast[];
  audioEnabled: boolean;
  xpSparkTrigger: number;
  goldPrevious: number;
  sageOpen: boolean;
  sagePendingMessage: string | null;

  triggerLevelUp: (data: LevelUpData) => void;
  clearLevelUp: () => void;
  addFloatingXP: (amount: number, x?: number, y?: number) => void;
  removeFloatingXP: (id: string) => void;
  flashScreen: (color?: string) => void;
  showAchievementToast: (achievement: Omit<AchievementToast, 'id'>) => void;
  removeAchievementToast: (id: string) => void;
  toggleAudio: () => boolean;
  initAudio: () => void;
  triggerXPSpark: () => void;
  setGoldPrevious: (gold: number) => void;
  openSage: (message?: string) => void;
  closeSage: () => void;
  clearSagePending: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  levelUpData: null,
  floatingXPs: [],
  isScreenFlashing: false,
  flashColor: '#ffffff',
  achievementToasts: [],
  audioEnabled: false,
  xpSparkTrigger: 0,
  goldPrevious: 0,
  sageOpen: false,
  sagePendingMessage: null,

  triggerLevelUp: (data) => {
    set({ levelUpData: data });
    audio.play('levelUp');
  },
  clearLevelUp: () => set({ levelUpData: null }),

  addFloatingXP: (amount, x = window.innerWidth / 2, y = window.innerHeight / 2) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({
      floatingXPs: [...state.floatingXPs, { id, amount, x, y }],
      xpSparkTrigger: state.xpSparkTrigger + 1,
    }));
    audio.play('coin');
    setTimeout(() => get().removeFloatingXP(id), 1500);
  },

  removeFloatingXP: (id) =>
    set((state) => ({ floatingXPs: state.floatingXPs.filter((xp) => xp.id !== id) })),

  flashScreen: (color = '#ffffff') => {
    set({ isScreenFlashing: true, flashColor: color });
    setTimeout(() => set({ isScreenFlashing: false }), 300);
  },

  showAchievementToast: (achievement) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ achievementToasts: [...state.achievementToasts, { id, ...achievement }] }));
    audio.play('achievement');
    // El cierre automático (4 s, en pausa con hover/foco) lo gestiona AchievementUnlockedToast.
  },

  removeAchievementToast: (id) =>
    set((state) => ({ achievementToasts: state.achievementToasts.filter((t) => t.id !== id) })),

  toggleAudio: () => {
    const enabled = audio.toggle();
    set({ audioEnabled: enabled });
    return enabled;
  },

  initAudio: () => {
    audio.load();
    set({ audioEnabled: audio.enabled });
  },

  triggerXPSpark: () => set((s) => ({ xpSparkTrigger: s.xpSparkTrigger + 1 })),

  setGoldPrevious: (gold) => set({ goldPrevious: gold }),

  openSage: (message) => set({ sageOpen: true, sagePendingMessage: message ?? null }),
  closeSage: () => set({ sageOpen: false, sagePendingMessage: null }),
  clearSagePending: () => set({ sagePendingMessage: null }),
}));
