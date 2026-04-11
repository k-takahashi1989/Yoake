import notifee, {
  AndroidImportance,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIF_STORAGE_KEY = '@yoake:notification_settings';
export const LAST_SCORE_KEY = '@yoake:last_score';
export const CHANNEL_ID = 'yoake_reminders';
export const NOTIF_ID = 'yoake_morning_reminder';
export const BEDTIME_REMINDER_NOTIFICATION_ID = 'yoake_bedtime_reminder';
export const BEDTIME_REMINDER_ACTION_ID = 'bedtime_start';
export const WEEKLY_REPORT_CHANNEL_ID = 'yoake_weekly_report';
export const PENDING_SLEEP_START_KEY = '@yoake:pending_sleep_start';
const PENDING_SLEEP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingSleepStart {
  bedTime: Date;
  savedAt: Date;
  source: 'bedtime_push';
}

export async function ensureWeeklyReportChannel(): Promise<void> {
  await notifee.createChannel({
    id: WEEKLY_REPORT_CHANNEL_ID,
    name: 'YOAKE週次レポート',
    importance: AndroidImportance.HIGH,
  });
}

export async function ensureReminderChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'YOAKEリマインダー',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function schedulePersonalizedReminder(
  hour: number,
  minute: number,
  lastScore?: number | null,
): Promise<void> {
  await ensureReminderChannel();

  const body =
    lastScore != null
      ? `昨日のスコアは${lastScore}点でした。今日の睡眠も記録しておきましょう。`
      : '今日の睡眠を記録しておきましょう。';

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= new Date()) target.setDate(target.getDate() + 1);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: target.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(
    {
      id: NOTIF_ID,
      title: 'おはようございます',
      body,
      android: { channelId: CHANNEL_ID, smallIcon: 'ic_stat_name', pressAction: { id: 'default' } },
    },
    trigger,
  );
}

export async function cancelReminder(): Promise<void> {
  await notifee.cancelNotification(NOTIF_ID);
}

export async function scheduleBedtimeReminder(
  hour: number,
  minute: number,
): Promise<void> {
  await ensureReminderChannel();

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= new Date()) target.setDate(target.getDate() + 1);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: target.getTime(),
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(
    {
      id: BEDTIME_REMINDER_NOTIFICATION_ID,
      title: 'そろそろ就寝予定の時間です',
      body: 'ボタンを押すと、今の時刻が就寝時刻として記録されます。',
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_name',
        pressAction: { id: 'default' },
        actions: [
          {
            title: '今から寝ます → 就寝時刻を保存',
            pressAction: { id: BEDTIME_REMINDER_ACTION_ID },
          },
        ],
      },
    },
    trigger,
  );
}

export async function cancelBedtimeReminder(): Promise<void> {
  await notifee.cancelNotification(BEDTIME_REMINDER_NOTIFICATION_ID);
}

export async function savePendingSleepStart(date = new Date()): Promise<void> {
  const payload = {
    bedTime: date.toISOString(),
    savedAt: new Date().toISOString(),
    source: 'bedtime_push' as const,
  };
  await AsyncStorage.setItem(PENDING_SLEEP_START_KEY, JSON.stringify(payload));
}

export async function getPendingSleepStart(): Promise<PendingSleepStart | null> {
  const raw = await AsyncStorage.getItem(PENDING_SLEEP_START_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      bedTime?: string;
      savedAt?: string;
      source?: 'bedtime_push';
    };

    if (!parsed.bedTime || !parsed.savedAt) {
      await AsyncStorage.removeItem(PENDING_SLEEP_START_KEY);
      return null;
    }

    const bedTime = new Date(parsed.bedTime);
    const savedAt = new Date(parsed.savedAt);
    const isInvalid = Number.isNaN(bedTime.getTime()) || Number.isNaN(savedAt.getTime());
    const isExpired = Date.now() - savedAt.getTime() > PENDING_SLEEP_MAX_AGE_MS;

    if (isInvalid || isExpired) {
      await AsyncStorage.removeItem(PENDING_SLEEP_START_KEY);
      return null;
    }

    return {
      bedTime,
      savedAt,
      source: parsed.source ?? 'bedtime_push',
    };
  } catch {
    await AsyncStorage.removeItem(PENDING_SLEEP_START_KEY);
    return null;
  }
}

export async function clearPendingSleepStart(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SLEEP_START_KEY);
}

const STREAK_MILESTONES = [3, 7, 14, 30];
const STREAK_NOTIFIED_PREFIX = '@yoake:streak_notified_';

const STREAK_MESSAGES: Record<number, { title: string; body: string }> = {
  3: {
    title: '3日連続で記録できました',
    body: '継続できています。この調子で続けていきましょう。',
  },
  7: {
    title: '1週間連続で記録できました',
    body: 'いい流れです。毎日の記録が睡眠の見え方を変えていきます。',
  },
  14: {
    title: '2週間連続で記録できました',
    body: '習慣として定着してきています。ここから先も積み上げていきましょう。',
  },
  30: {
    title: '30日連続で記録できました',
    body: '1か月継続達成です。ここまでの積み重ねが大きな力になっています。',
  },
};

export async function notifyStreakMilestoneIfReached(streak: number): Promise<void> {
  if (streak === 0) {
    const clearKeys = STREAK_MILESTONES.map(n => `${STREAK_NOTIFIED_PREFIX}${n}`);
    await AsyncStorage.multiRemove(clearKeys);
    return;
  }

  if (!STREAK_MILESTONES.includes(streak)) return;

  const storageKey = `${STREAK_NOTIFIED_PREFIX}${streak}`;
  const alreadyNotified = await AsyncStorage.getItem(storageKey);
  if (alreadyNotified) return;

  const message = STREAK_MESSAGES[streak];
  await ensureReminderChannel();
  await notifee.displayNotification({
    title: message.title,
    body: message.body,
    android: { channelId: CHANNEL_ID, smallIcon: 'ic_stat_name' },
  });

  await AsyncStorage.setItem(storageKey, '1');
}

export async function refreshMorningReminderIfEnabled(
  lastScore: number | null,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return;

    const settings = JSON.parse(raw) as {
      morningEnabled: boolean;
      morningHour: number;
      morningMinute: number;
    };

    if (!settings.morningEnabled) return;

    await schedulePersonalizedReminder(
      settings.morningHour,
      settings.morningMinute,
      lastScore,
    );
  } catch {
    // Ignore reminder refresh errors.
  }
}
