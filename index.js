/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee, { EventType, TriggerType, AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// アラームのバックグラウンドイベント処理
// アプリが終了 / バックグラウンド状態でも通知アクションを処理する
// ============================================================

const ALARM_ID = 'yoake_alarm';
const ALARM_CHANNEL_ID = 'yoake_alarm';
const SNOOZE_MINUTES = 5;
const ALARM_STORAGE_KEY = '@yoake:alarm_settings';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  if (!notification || notification.id !== ALARM_ID) return;

  if (type === EventType.ACTION_PRESS) {
    if (pressAction?.id === 'dismiss') {
      // キャンセルのみ（翌日再スケジュールはアプリ起動時に実行）
      await notifee.cancelNotification(ALARM_ID);
    } else if (pressAction?.id === 'snooze') {
      // スヌーズ：5分後に再スケジュール
      await notifee.cancelNotification(ALARM_ID);
      await notifee.createChannel({
        id: ALARM_CHANNEL_ID,
        name: 'YOAKEアラーム',
        importance: AndroidImportance.HIGH,
      });
      await notifee.createTriggerNotification(
        {
          id: ALARM_ID,
          title: '⏰ スヌーズ終了',
          body: 'タップして止める',
          android: {
            channelId: ALARM_CHANNEL_ID,
            importance: AndroidImportance.HIGH,
            fullScreenAction: { id: 'default', launchActivity: 'default' },
            pressAction: { id: 'default', launchActivity: 'default' },
            actions: [
              { title: '止める', pressAction: { id: 'dismiss' } },
              { title: 'スヌーズ 5分', pressAction: { id: 'snooze' } },
            ],
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: Date.now() + SNOOZE_MINUTES * 60 * 1000,
          alarmManager: { allowWhileIdle: true },
        },
      );
      // スヌーズカウントを AsyncStorage で更新
      try {
        const raw = await AsyncStorage.getItem(ALARM_STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          data.snoozeCount = (data.snoozeCount ?? 0) + 1;
          await AsyncStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(data));
        }
      } catch {
        // ignore
      }
    }
  }
});

// AppRegistry は同期的に登録する必要がある（非同期の中で呼ぶとクラッシュする）
// i18n の初期化は App コンポーネント内で行う
AppRegistry.registerComponent(appName, () => App);
