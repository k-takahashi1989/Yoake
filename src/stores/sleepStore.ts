import { create } from 'zustand';
import { format } from 'date-fns';
import {
  getSleepLog,
  getRecentSleepLogs,
  saveSleepLog,
  deleteSleepLog,
} from '../services/firebase';
import { SleepLog, SleepInputForm, UserGoal } from '../types';
import { calculateScore, calculateSleepDebt } from '../utils/scoreCalculator';
import { SCORE_VERSION } from '../constants';
import firestore from '@react-native-firebase/firestore';

interface SleepState {
  todayLog: SleepLog | null;
  recentLogs: SleepLog[];
  isLoading: boolean;

  loadToday: () => Promise<void>;
  loadRecent: (days?: number) => Promise<void>;
  saveLog: (form: SleepInputForm, goal: UserGoal, source: 'HEALTH_CONNECT' | 'MANUAL') => Promise<void>;
  deleteLog: (date: string) => Promise<void>;
}

export const useSleepStore = create<SleepState>((set, get) => ({
  todayLog: null,
  recentLogs: [],
  isLoading: false,

  loadToday: async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const log = await getSleepLog(today);
    set({ todayLog: log });
  },

  loadRecent: async (days = 14) => {
    set({ isLoading: true });
    try {
      const logs = await getRecentSleepLogs(days);
      set({ recentLogs: logs });
    } finally {
      set({ isLoading: false });
    }
  },

  saveLog: async (form, goal, source) => {
    const { recentLogs } = get();
    const date = format(form.bedTime, 'yyyy-MM-dd');

    const totalMinutes = Math.round(
      (form.wakeTime.getTime() - form.bedTime.getTime()) / 60000,
    );

    const logPartial = {
      date,
      bedTime: firestore.Timestamp.fromDate(form.bedTime),
      wakeTime: firestore.Timestamp.fromDate(form.wakeTime),
      totalMinutes,
      deepSleepMinutes: form.deepSleepMinutes ?? null,
      remMinutes: form.remMinutes ?? null,
      lightSleepMinutes: form.lightSleepMinutes ?? null,
      awakenings: form.awakenings ?? null,
      heartRateAvg: form.heartRateAvg ?? null,
      sleepOnset: form.sleepOnset,
      wakeFeeling: form.wakeFeeling,
      habits: form.habits,
      memo: form.memo || null,
      source,
    };

    const { score } = calculateScore(logPartial as any, recentLogs);
    const sleepDebtMinutes = calculateSleepDebt(
      recentLogs.slice(0, 13),
      goal.targetHours,
    );

    const fullLog: Omit<SleepLog, 'createdAt' | 'updatedAt'> = {
      ...logPartial,
      score,
      sleepDebtMinutes,
      scoreVersion: SCORE_VERSION,
    };

    await saveSleepLog(fullLog);

    // キャッシュ更新
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) {
      set({ todayLog: fullLog as SleepLog });
    }
    await get().loadRecent();
  },

  deleteLog: async (date: string) => {
    await deleteSleepLog(date);
    const today = format(new Date(), 'yyyy-MM-dd');
    set(state => ({
      recentLogs: state.recentLogs.filter(l => l.date !== date),
      todayLog: state.todayLog?.date === date ? null : state.todayLog,
    }));
    // todayLog が今日だった場合、ストアに反映済みのため追加取得不要
    if (date !== today) return;
  },
}));
