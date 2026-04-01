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
import { calculateStreak } from '../utils/streakCalculator';
import { SCORE_VERSION } from '../constants';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  refreshMorningReminderIfEnabled,
  notifyStreakMilestoneIfReached,
  LAST_SCORE_KEY,
} from '../services/notificationService';

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

    // 楽観的更新: Firestore再読みせずstoreを即時反映
    const today = format(new Date(), 'yyyy-MM-dd');
    set(state => ({
      todayLog: date === today ? (fullLog as SleepLog) : state.todayLog,
      recentLogs: [
        fullLog as SleepLog,
        ...state.recentLogs.filter(l => l.date !== date),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    }));

    // 最終スコアを保存（通知パーソナライズ用）・朝通知を再スケジュール（両方 fire-and-forget）
    AsyncStorage.setItem(LAST_SCORE_KEY, String(score)).catch(() => {});
    refreshMorningReminderIfEnabled(score).catch(() => {});

    // ストリーク達成通知（fire-and-forget）
    const { recentLogs: updatedLogs } = get();
    const streak = calculateStreak(updatedLogs);
    notifyStreakMilestoneIfReached(streak).catch(() => {});
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
