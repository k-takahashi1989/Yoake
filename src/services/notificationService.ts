import notifee, {
  AndroidImportance,
  TriggerType,
  RepeatFrequency,
  TimestampTrigger,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIF_STORAGE_KEY = '@yoake:notification_settings';
export const LAST_SCORE_KEY = '@yoake:last_score';
export const CHANNEL_ID = 'yoake_reminders';
export const NOTIF_ID = 'yoake_morning_reminder';

export async function ensureReminderChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'YOAKEリマインダー',
    importance: AndroidImportance.DEFAULT,
  });
}

/**
 * 朝リマインダーを（再）スケジュールする。
 * lastScore が渡されると「昨日のスコアはN点でした」を本文に含める。
 */
export async function schedulePersonalizedReminder(
  hour: number,
  minute: number,
  lastScore?: number | null,
): Promise<void> {
  await ensureReminderChannel();

  const body =
    lastScore != null
      ? `昨日のスコアは${lastScore}点でした。今日はどうでしたか？☀️`
      : '今日の睡眠を記録しましょう！';

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
      title: '☀️ おはようございます',
      body,
      android: { channelId: CHANNEL_ID },
    },
    trigger,
  );
}

export async function cancelReminder(): Promise<void> {
  await notifee.cancelNotification(NOTIF_ID);
}

// ストリーク達成通知のマイルストーン日数
const STREAK_MILESTONES = [3, 7, 14, 30];

// ストリーク達成通知の AsyncStorage キープレフィックス
const STREAK_NOTIFIED_PREFIX = '@yoake:streak_notified_';

/** マイルストーン別の通知内容 */
const STREAK_MESSAGES: Record<number, { title: string; body: string }> = {
  3:  { title: '🔥 3日連続記録達成！',    body: '継続は力なり。この調子で続けよう！' },
  7:  { title: '🔥 1週間連続記録達成！',  body: 'すごい！しろくまも喜んでるよ🐻‍❄️' },
  14: { title: '🔥 2週間連続記録達成！',  body: '習慣化できてるね。きみの睡眠力が上がってる！' },
  30: { title: '🔥 30日連続記録達成！',   body: '1ヶ月継続おめでとう！本物の睡眠マスターだよ🐻‍❄️' },
};

/**
 * ストリーク数がマイルストーンに達したとき即時通知を送る。
 * 同じマイルストーンで二重通知しないよう AsyncStorage に記録する。
 * ストリークが 0 にリセットされたら全通知済みキーをクリアする。
 */
export async function notifyStreakMilestoneIfReached(streak: number): Promise<void> {
  // ストリーク 0 はリセット → 全マイルストーンの通知済みフラグを消去
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
    body:  message.body,
    android: { channelId: CHANNEL_ID },
  });

  await AsyncStorage.setItem(storageKey, '1');
}

/** 保存済みの通知設定を読み込み、最新スコアで通知を再スケジュールする */
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
    // 通知の再スケジュール失敗はサイレントに無視
  }
}
