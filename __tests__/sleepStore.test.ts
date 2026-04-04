jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, pattern: string) => {
    if (pattern !== 'yyyy-MM-dd') {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }),
}));

jest.mock('../src/services/firebase', () => ({
  getSleepLog: jest.fn(),
  getRecentSleepLogs: jest.fn(),
  saveSleepLog: jest.fn(),
  deleteSleepLog: jest.fn(),
  saveAiReport: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/utils/scoreCalculator', () => ({
  calculateScore: jest.fn(() => ({ score: 88 })),
  calculateSleepDebt: jest.fn(() => 15),
}));

jest.mock('../src/utils/streakCalculator', () => ({
  calculateStreak: jest.fn(() => 3),
}));

jest.mock('../src/services/notificationService', () => ({
  refreshMorningReminderIfEnabled: jest.fn().mockResolvedValue(undefined),
  notifyStreakMilestoneIfReached: jest.fn().mockResolvedValue(undefined),
  LAST_SCORE_KEY: '@yoake:last_score',
}));

jest.mock('../src/services/claudeApi', () => ({
  generateLogInsight: jest.fn().mockResolvedValue({
    type: 'insight',
    content: 'insight',
    generatedAt: {
      toDate: () => new Date('2026-04-02T12:00:00'),
      seconds: 1775127600,
      nanoseconds: 0,
    },
    inputSummary: '',
    modelUsed: 'claude-haiku-4-5',
    tokenCount: null,
  }),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const firestoreFn: any = jest.fn(() => ({}));
  firestoreFn.Timestamp = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  };
  return firestoreFn;
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSleepStore } from '../src/stores/sleepStore';
import {
  getRecentSleepLogs,
  saveSleepLog,
  deleteSleepLog,
  saveAiReport,
} from '../src/services/firebase';
import {
  refreshMorningReminderIfEnabled,
  notifyStreakMilestoneIfReached,
} from '../src/services/notificationService';
import { generateLogInsight } from '../src/services/claudeApi';

const ts = (iso: string) => {
  const date = new Date(iso);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
};

describe('useSleepStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-02T12:00:00'));
    useSleepStore.setState({
      todayLog: null,
      recentLogs: [],
      isLoading: false,
    });
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loadRecent syncs todayLog from the recent logs list', async () => {
    (getRecentSleepLogs as jest.Mock).mockResolvedValue([
      {
        date: '2026-04-02',
        score: 80,
      },
      {
        date: '2026-04-01',
        score: 70,
      },
    ]);

    await useSleepStore.getState().loadRecent(7);

    expect(useSleepStore.getState().recentLogs).toHaveLength(2);
    expect(useSleepStore.getState().todayLog).toMatchObject({
      date: '2026-04-02',
      score: 80,
    });
  });

  it('loadRecent clears stale todayLog when today is absent from recent logs', async () => {
    useSleepStore.setState({
      todayLog: { date: '2026-04-02', score: 80 } as any,
      recentLogs: [],
      isLoading: false,
    });
    (getRecentSleepLogs as jest.Mock).mockResolvedValue([
      {
        date: '2026-04-01',
        score: 70,
      },
    ]);

    await useSleepStore.getState().loadRecent(7);

    expect(useSleepStore.getState().todayLog).toBeNull();
  });

  it('saveLog prefers targetDate over bedTime date when saving past records', async () => {
    const form = {
      bedTime: new Date('2026-04-01T23:00:00'),
      wakeTime: new Date('2026-04-02T07:00:00'),
      sleepOnset: 'NORMAL',
      wakeFeeling: 'GOOD',
      habits: [],
      memo: '',
    } as any;
    const goal = {
      targetHours: 7.5,
      targetScore: 80,
      bedTimeTarget: '23:00',
      updatedAt: null,
    };

    await useSleepStore
      .getState()
      .saveLog(form, goal, 'MANUAL', '2026-04-02', { generateInsight: true });

    expect(saveSleepLog).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-04-02',
        totalMinutes: 480,
        score: 88,
        sleepDebtMinutes: 15,
      }),
    );
    expect(useSleepStore.getState().recentLogs[0]).toMatchObject({
      date: '2026-04-02',
      score: 88,
    });
    expect(refreshMorningReminderIfEnabled).toHaveBeenCalledWith(88);
    expect(notifyStreakMilestoneIfReached).toHaveBeenCalledWith(3);
    expect(generateLogInsight).toHaveBeenCalledTimes(1);
    expect(saveAiReport).toHaveBeenCalledWith(
      'insight:2026-04-02',
      expect.objectContaining({ type: 'insight' }),
    );
  });

  it('saveLog does not regenerate insight when generateInsight is false', async () => {
    const form = {
      bedTime: new Date('2026-04-01T23:00:00'),
      wakeTime: new Date('2026-04-02T07:00:00'),
      sleepOnset: 'NORMAL',
      wakeFeeling: 'GOOD',
      habits: [],
      memo: '',
    } as any;
    const goal = {
      targetHours: 7.5,
      targetScore: 80,
      bedTimeTarget: '23:00',
      updatedAt: null,
    };

    await useSleepStore
      .getState()
      .saveLog(form, goal, 'MANUAL', '2026-04-02', { generateInsight: false });

    expect(generateLogInsight).not.toHaveBeenCalled();
    expect(saveAiReport).not.toHaveBeenCalled();
  });

  it('deleteLog clears todayLog when deleting today record', async () => {
    useSleepStore.setState({
      todayLog: {
        date: '2026-04-02',
        score: 88,
        bedTime: ts('2026-04-01T23:00:00'),
        wakeTime: ts('2026-04-02T07:00:00'),
      } as any,
      recentLogs: [{ date: '2026-04-02', score: 88 } as any],
      isLoading: false,
    });

    await useSleepStore.getState().deleteLog('2026-04-02');

    expect(deleteSleepLog).toHaveBeenCalledWith('2026-04-02');
    expect(useSleepStore.getState().todayLog).toBeNull();
    expect(useSleepStore.getState().recentLogs).toEqual([]);
  });
});
