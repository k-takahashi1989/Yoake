import notifee, {
  AndroidImportance,
  TriggerType,
  TimestampTrigger,
} from '@notifee/react-native';

export const ALARM_NOTIFICATION_ID = 'yoake_alarm';
const ALARM_CHANNEL_ID = 'yoake_alarm';

// ============================================================
// チャンネル
// ============================================================

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'YOAKEアラーム',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

// ============================================================
// 通知ペイロード
// ============================================================

function buildPayload(title: string) {
  return {
    id: ALARM_NOTIFICATION_ID,
    title,
    body: 'タップして止める',
    android: {
      channelId: ALARM_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      fullScreenAction: {
        id: 'default',
        launchActivity: 'default',
      },
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [
        { title: '止める', pressAction: { id: 'dismiss' } },
        { title: 'スヌーズ 5分', pressAction: { id: 'snooze' } },
      ],
    },
  };
}

// ============================================================
// アラーム時刻計算（今日or明日の次の目標時刻）
// ============================================================

function resolveAlarmDate(hour: number, minute: number, smartWindowMinutes: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute - smartWindowMinutes, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

// ============================================================
// 公開API
// ============================================================

export async function scheduleAlarm(
  hour: number,
  minute: number,
  smartWindowMinutes = 0,
): Promise<Date> {
  await ensureChannel();
  const alarmDate = resolveAlarmDate(hour, minute, smartWindowMinutes);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: alarmDate.getTime(),
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(buildPayload('⏰ 起きる時間です！'), trigger);
  return alarmDate;
}

export async function cancelAlarm(): Promise<void> {
  await notifee.cancelNotification(ALARM_NOTIFICATION_ID);
}

export async function scheduleSnooze(minutes: number): Promise<Date> {
  await ensureChannel();
  const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: snoozeDate.getTime(),
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(buildPayload('⏰ スヌーズ終了'), trigger);
  return snoozeDate;
}
