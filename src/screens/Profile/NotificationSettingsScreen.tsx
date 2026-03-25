import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, { AndroidImportance, TriggerType, TimestampTrigger } from '@notifee/react-native';
import { useTranslation } from '../../i18n';

const STORAGE_KEY = '@yoake:notification_settings';
const CHANNEL_ID = 'yoake_reminders';
const NOTIF_ID = 'yoake_morning_reminder';

interface NotifSettings {
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
}

const DEFAULTS: NotifSettings = { morningEnabled: false, morningHour: 8, morningMinute: 0 };

async function ensureReminderChannel() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'YOAKEリマインダー',
    importance: AndroidImportance.DEFAULT,
  });
}

async function scheduleReminder(hour: number, minute: number): Promise<void> {
  await ensureReminderChannel();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target <= new Date()) target.setDate(target.getDate() + 1);

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: target.getTime(),
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(
    {
      id: NOTIF_ID,
      title: '☀️ おはようございます',
      body: '今日の睡眠を記録しましょう！',
      android: { channelId: CHANNEL_ID },
    },
    trigger,
  );
}

async function cancelReminder(): Promise<void> {
  await notifee.cancelNotification(NOTIF_ID);
}

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setSettings(JSON.parse(raw));
      setIsLoaded(true);
    });
  }, []);

  const save = async (next: NotifSettings) => {
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (next.morningEnabled) {
      await scheduleReminder(next.morningHour, next.morningMinute);
    } else {
      await cancelReminder();
    }
  };

  const toggleMorning = () => save({ ...settings, morningEnabled: !settings.morningEnabled });

  const handleTimeChange = (_: any, date?: Date) => {
    setShowPicker(false);
    if (!date) return;
    const next = { ...settings, morningHour: date.getHours(), morningMinute: date.getMinutes() };
    save(next);
  };

  const pickerValue = new Date();
  pickerValue.setHours(settings.morningHour, settings.morningMinute, 0, 0);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator color="#6B5CE7" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('notification.morningTitle')}</Text>

          {/* ON/OFF トグル */}
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t('notification.morningToggle')}</Text>
              <Text style={styles.rowSubtitle}>
                {t('notification.morningToggleSub')}
              </Text>
            </View>
            <Switch
              value={settings.morningEnabled}
              onValueChange={toggleMorning}
              trackColor={{ false: '#3D3D5E', true: '#6B5CE7' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 時刻設定（有効時のみ） */}
          {settings.morningEnabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{t('notification.timeLabel')}</Text>
                <Text
                  style={styles.timeValue}
                  onPress={() => setShowPicker(true)}
                >
                  {String(settings.morningHour).padStart(2, '0')}:
                  {String(settings.morningMinute).padStart(2, '0')}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.note}>{t('notification.note')}</Text>

        <View style={{ height: 32 }} />
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour
          display="spinner"
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    margin: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', paddingVertical: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, color: '#FFFFFF', flex: 1 },
  rowSubtitle: { fontSize: 12, color: '#888', marginTop: 3, lineHeight: 17 },
  timeValue: {
    fontSize: 22,
    fontWeight: '600',
    color: '#9C8FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6B5CE720',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6B5CE740',
  },
  divider: { height: 1, backgroundColor: '#1A1A2E' },
  note: {
    marginHorizontal: 16,
    fontSize: 11,
    color: '#555',
    lineHeight: 17,
  },
});
