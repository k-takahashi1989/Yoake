import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleAlarm, cancelAlarm, scheduleSnooze } from '../services/alarmService';
import { FREE_LIMITS } from '../constants';

const STORAGE_KEY = '@yoake:alarm_settings';
export const PREMIUM_MAX_SNOOZE = 5;

// ============================================================
// 型
// ============================================================

interface AlarmData {
  hour: number;
  minute: number;
  isEnabled: boolean;
  smartWindowMinutes: number;
  snoozeCount: number;
  scheduledTimestamp: number | null;
}

interface AlarmStore extends AlarmData {
  isLoaded: boolean;
  loadAlarm: () => Promise<void>;
  setAlarmTime: (hour: number, minute: number, isPremium: boolean) => Promise<void>;
  toggleEnabled: (isPremium: boolean) => Promise<void>;
  toggleSmartWindow: () => Promise<void>;
  handleSnooze: (isPremium: boolean) => Promise<boolean>;
  handleDismiss: () => Promise<void>;
}

const DEFAULTS: AlarmData = {
  hour: 7,
  minute: 0,
  isEnabled: false,
  smartWindowMinutes: 0,
  snoozeCount: 0,
  scheduledTimestamp: null,
};

// ============================================================
// ストア
// ============================================================

export const useAlarmStore = create<AlarmStore>((set, get) => ({
  ...DEFAULTS,
  isLoaded: false,

  loadAlarm: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: AlarmData = JSON.parse(raw);
        set({ ...data, isLoaded: true });

        // 有効だがスケジュール済み時刻が過去なら再スケジュール
        if (data.isEnabled && (!data.scheduledTimestamp || data.scheduledTimestamp < Date.now())) {
          try {
            const next = await scheduleAlarm(data.hour, data.minute, data.smartWindowMinutes);
            const updated = { ...data, scheduledTimestamp: next.getTime() };
            set({ scheduledTimestamp: next.getTime() });
            await persist(updated);
          } catch {
            // ignore schedule errors on load
          }
        }
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setAlarmTime: async (hour, minute, isPremium) => {
    const { isEnabled, smartWindowMinutes } = get();
    set({ hour, minute, snoozeCount: 0 });

    if (isEnabled) {
      const window = isPremium ? smartWindowMinutes : 0;
      const next = await scheduleAlarm(hour, minute, window);
      set({ scheduledTimestamp: next.getTime() });
    }
    await saveState(get());
  },

  toggleEnabled: async (isPremium) => {
    const { isEnabled, hour, minute, smartWindowMinutes } = get();
    if (!isEnabled) {
      const window = isPremium ? smartWindowMinutes : 0;
      const next = await scheduleAlarm(hour, minute, window);
      set({ isEnabled: true, snoozeCount: 0, scheduledTimestamp: next.getTime() });
    } else {
      await cancelAlarm();
      set({ isEnabled: false, snoozeCount: 0, scheduledTimestamp: null });
    }
    await saveState(get());
  },

  toggleSmartWindow: async () => {
    const { smartWindowMinutes, isEnabled, hour, minute } = get();
    const newWindow = smartWindowMinutes === 0 ? 30 : 0;
    set({ smartWindowMinutes: newWindow });

    if (isEnabled) {
      const next = await scheduleAlarm(hour, minute, newWindow);
      set({ scheduledTimestamp: next.getTime() });
    }
    await saveState(get());
  },

  handleSnooze: async (isPremium) => {
    const { snoozeCount } = get();
    const max = isPremium ? PREMIUM_MAX_SNOOZE : FREE_LIMITS.SNOOZE_COUNT;
    if (snoozeCount >= max) return false;

    await cancelAlarm();
    const next = await scheduleSnooze(FREE_LIMITS.SNOOZE_INTERVAL_MIN);
    set({ snoozeCount: snoozeCount + 1, scheduledTimestamp: next.getTime() });
    await saveState(get());
    return true;
  },

  handleDismiss: async () => {
    const { hour, minute, smartWindowMinutes } = get();
    await cancelAlarm();
    // 翌日の同時刻に再スケジュール
    const next = await scheduleAlarm(hour, minute, smartWindowMinutes);
    set({ snoozeCount: 0, scheduledTimestamp: next.getTime() });
    await saveState(get());
  },
}));

// ============================================================
// ヘルパー
// ============================================================

function saveState(store: AlarmStore): Promise<void> {
  const { hour, minute, isEnabled, smartWindowMinutes, snoozeCount, scheduledTimestamp } = store;
  return persist({ hour, minute, isEnabled, smartWindowMinutes, snoozeCount, scheduledTimestamp });
}

function persist(data: AlarmData): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
