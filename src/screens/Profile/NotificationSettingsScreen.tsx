import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Switch, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { i18n, useTranslation } from '../../i18n';
import TimePickerRow from '../../components/common/TimePickerRow';
import {
  schedulePersonalizedReminder,
  cancelReminder,
  scheduleBedtimeReminder,
  cancelBedtimeReminder,
  NOTIF_STORAGE_KEY as STORAGE_KEY,
  LAST_SCORE_KEY,
} from '../../services/notificationService';
import { useAuthStore } from '../../stores/authStore';
import { MORNING_THEME } from '../../theme/morningTheme';

interface NotifSettings {
  morningEnabled: boolean;
  morningHour: number;
  morningMinute: number;
  bedtimeEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
}

const DEFAULTS: NotifSettings = {
  morningEnabled: false,
  morningHour: 8,
  morningMinute: 0,
  bedtimeEnabled: false,
  bedtimeHour: 22,
  bedtimeMinute: 0,
};

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { isPremium } = useAuthStore();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const isJa = i18n.language === 'ja';

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      setIsLoaded(true);
    });
  }, []);

  const ensureNotifPermission = async (): Promise<boolean> => {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      Alert.alert(
        isJa ? '通知が許可されていません' : 'Notifications disabled',
        isJa
          ? '端末の設定からYOAKEの通知を許可してください。'
          : 'Please enable notifications for YOAKE in device settings.',
      );
      return false;
    }
    // Android 12+ exact alarm permission check
    const androidSettings = settings.android;
    if (androidSettings && androidSettings.alarm === 0 /* NOT_ALLOWED */) {
      Alert.alert(
        isJa ? '正確な時刻での通知に追加設定が必要です' : 'Exact alarm permission required',
        isJa
          ? '設定 → アプリ → 特別なアプリアクセス → 「アラームとリマインダー」からYOAKEを許可してください。'
          : 'Go to Settings → Apps → Special app access → Alarms & reminders and allow YOAKE.',
        [
          { text: isJa ? 'キャンセル' : 'Cancel', style: 'cancel' },
          { text: isJa ? '設定を開く' : 'Open settings', onPress: () => notifee.openAlarmPermissionSettings() },
        ],
      );
      return false;
    }
    return true;
  };

  const save = async (next: NotifSettings) => {
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (next.morningEnabled) {
      const scoreRaw = await AsyncStorage.getItem(LAST_SCORE_KEY);
      const lastScore = scoreRaw ? parseInt(scoreRaw, 10) : null;
      await schedulePersonalizedReminder(next.morningHour, next.morningMinute, lastScore);
    } else {
      await cancelReminder();
    }

    if (next.bedtimeEnabled && isPremium) {
      await scheduleBedtimeReminder(next.bedtimeHour, next.bedtimeMinute);
    } else {
      await cancelBedtimeReminder();
    }
  };

  const toggleMorning = async () => {
    const next = !settings.morningEnabled;
    if (next && !(await ensureNotifPermission())) return;
    save({ ...settings, morningEnabled: next });
  };
  const toggleBedtime = async () => {
    const next = !settings.bedtimeEnabled;
    if (next && !(await ensureNotifPermission())) return;
    save({ ...settings, bedtimeEnabled: next });
  };

  const toDate = (hour: number, minute: number) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator color={MORNING_THEME.goldStrong} /></View>
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
              trackColor={{ false: MORNING_THEME.surfaceSoft, true: MORNING_THEME.gold }}
              thumbColor="#FFFFFF"
            />
          </View>

          {settings.morningEnabled && (
            <>
              <View style={styles.divider} />
              <TimePickerRow
                label={t('notification.timeLabel')}
                value={toDate(settings.morningHour, settings.morningMinute)}
                onChange={date => save({ ...settings, morningHour: date.getHours(), morningMinute: date.getMinutes() })}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>
              {isJa ? '就寝前リマインダー' : 'Bedtime reminder'}
            </Text>
            {!isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>

          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>
                {isJa ? '「今から寝ます」通知' : '"Going to bed now" reminder'}
              </Text>
              <Text style={styles.rowSubtitle}>
                {isJa
                  ? '就寝前に通知して、押すと就寝時刻だけ先に残せます'
                  : 'Get a bedtime prompt and save bedtime in one tap'}
              </Text>
            </View>
            <Switch
              value={settings.bedtimeEnabled && isPremium}
              onValueChange={toggleBedtime}
              disabled={!isPremium}
              trackColor={{ false: MORNING_THEME.surfaceSoft, true: MORNING_THEME.gold }}
              thumbColor="#FFFFFF"
            />
          </View>

          {!isPremium && (
            <Text style={styles.lockedNote}>
              {isJa
                ? 'プレミアムで、寝る前の「今から寝ます」通知が使えます'
                : 'Premium unlocks the bedtime "Going to bed now" reminder'}
            </Text>
          )}

          {settings.bedtimeEnabled && isPremium && (
            <>
              <View style={styles.divider} />
              <TimePickerRow
                label={t('notification.timeLabel')}
                value={toDate(settings.bedtimeHour, settings.bedtimeMinute)}
                onChange={date => save({ ...settings, bedtimeHour: date.getHours(), bedtimeMinute: date.getMinutes() })}
              />
            </>
          )}
        </View>

        <Text style={styles.note}>{t('notification.note')}</Text>

        <View style={{ height: 32 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MORNING_THEME.root },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    margin: 16,
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: { fontSize: 13, color: MORNING_THEME.textMuted, fontWeight: '600', paddingVertical: 14 },
  premiumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: MORNING_THEME.goldSurface,
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  premiumBadgeText: { color: MORNING_THEME.goldStrong, fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, color: MORNING_THEME.textPrimary, flex: 1 },
  rowSubtitle: { fontSize: 12, color: MORNING_THEME.textMuted, marginTop: 3, lineHeight: 17 },
  divider: { height: 1, backgroundColor: MORNING_THEME.borderSoft },
  lockedNote: {
    fontSize: 12,
    color: MORNING_THEME.textMuted,
    lineHeight: 18,
    marginTop: 2,
    paddingBottom: 14,
  },
  note: {
    marginHorizontal: 16,
    fontSize: 11,
    color: MORNING_THEME.textMuted,
    lineHeight: 17,
  },
});
