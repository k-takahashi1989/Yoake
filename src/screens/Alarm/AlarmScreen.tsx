import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useAlarmStore, PREMIUM_MAX_SNOOZE } from '../../stores/alarmStore';
import { useAuthStore } from '../../stores/authStore';
import { FREE_LIMITS } from '../../constants';
import { useTranslation } from '../../i18n';
import { getDateFnsLocale } from '../../utils/dateUtils';

export default function AlarmScreen() {
  const { t } = useTranslation();
  const { isPremium } = useAuthStore();
  const {
    hour, minute, isEnabled, smartWindowMinutes, scheduledTimestamp, isLoaded,
    loadAlarm, setAlarmTime, toggleEnabled, toggleSmartWindow,
  } = useAlarmStore();

  const [showPicker, setShowPicker] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  useEffect(() => {
    if (!isLoaded) loadAlarm();
  }, []);

  const handleTimeChange = async (_: any, date?: Date) => {
    setShowPicker(false);
    if (!date) return;
    await setAlarmTime(date.getHours(), date.getMinutes(), isPremium);
  };

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await toggleEnabled(isPremium);
    } finally {
      setIsToggling(false);
    }
  };

  const pickerValue = new Date();
  pickerValue.setHours(hour, minute, 0, 0);

  const maxSnooze = isPremium ? PREMIUM_MAX_SNOOZE : FREE_LIMITS.SNOOZE_COUNT;

  const scheduledLabel = scheduledTimestamp
    ? t('alarm.scheduled', { date: format(new Date(scheduledTimestamp), 'M/d（EEE）HH:mm', { locale: getDateFnsLocale() }) })
    : null;

  return (
    <View style={styles.root}>
      {/* ヘッダー（左上固定） */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>{t('alarm.title')}</Text>
      </View>

      {!isLoaded ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6B5CE7" size="large" />
        </View>
      ) : (
        <>
          {/* 時刻カード（右側フローティング・時計の隣） */}
          <View style={[styles.timeFloatCard, { top: screenH * 0.28 }]}>
            <TouchableOpacity onPress={() => setShowPicker(true)} activeOpacity={0.7}>
              <Text style={[styles.timeText, isEnabled && styles.timeTextActive]}>
                {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </Text>
              <Text style={styles.timeTapHint}>{t('alarm.tapHint')}</Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              {isToggling ? (
                <ActivityIndicator color="#6B5CE7" />
              ) : (
                <Switch
                  value={isEnabled}
                  onValueChange={handleToggle}
                  trackColor={{ false: '#3D3D5E', true: '#6B5CE7' }}
                  thumbColor="#FFFFFF"
                />
              )}
            </View>

            {isEnabled && scheduledLabel ? (
              <Text style={styles.scheduledLabel}>⏱ {scheduledLabel}</Text>
            ) : !isEnabled ? (
              <Text style={styles.disabledLabel}>{t('alarm.disabled')}</Text>
            ) : null}
          </View>

          {/* ボトムシート（設定） */}
          <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.handle} />

            {/* スマートアラーム */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  {isPremium ? t('alarm.smartAlarm') : t('alarm.smartAlarmLocked')}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {smartWindowMinutes > 0
                    ? t('alarm.smartAlarmSubActive', { minutes: smartWindowMinutes })
                    : t('alarm.smartAlarmSubOff')}
                </Text>
              </View>
              <Switch
                value={smartWindowMinutes > 0}
                onValueChange={isPremium ? toggleSmartWindow : undefined}
                disabled={!isPremium}
                trackColor={{ false: '#3D3D5E', true: '#6B5CE7' }}
                thumbColor={smartWindowMinutes > 0 ? '#FFFFFF' : '#666'}
              />
            </View>

            <View style={styles.divider} />

            {/* スヌーズ設定 */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('alarm.snoozeTitle')}</Text>
                <Text style={styles.settingSubtitle}>
                  {isPremium
                    ? t('alarm.snoozeSub', { interval: FREE_LIMITS.SNOOZE_INTERVAL_MIN, max: maxSnooze })
                    : t('alarm.snoozeSubPremium', { interval: FREE_LIMITS.SNOOZE_INTERVAL_MIN, max: maxSnooze, premiumMax: PREMIUM_MAX_SNOOZE })}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* ヒント */}
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>{t('alarm.hintText')}</Text>
            </View>

            {!isPremium && (
              <TouchableOpacity style={styles.upgradeBtn}>
                <Text style={styles.upgradeBtnText}>{t('alarm.upgradeBtn')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {showPicker && (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour
          display="spinner"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // 時刻カード（右フローティング）
  timeFloatCard: {
    position: 'absolute',
    right: 16,
    width: '52%',
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.35)',
    zIndex: 10,
  },
  timeText: {
    fontSize: 52,
    fontWeight: '200',
    color: '#C8C8E0',
    letterSpacing: -1,
  },
  timeTextActive: { color: '#FFFFFF' },
  timeTapHint: { fontSize: 11, color: '#C8C8E0', marginTop: 2 },
  switchRow: { marginTop: 14 },
  scheduledLabel: { fontSize: 12, color: '#9C8FFF', marginTop: 10 },
  disabledLabel: { fontSize: 12, color: '#C8C8E0', marginTop: 10 },
  // ボトムシート
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.3)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 92, 231, 0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 15, color: '#FFFFFF', marginBottom: 3 },
  settingSubtitle: { fontSize: 12, color: '#C8C8E0', lineHeight: 18 },
  divider: { height: 1, backgroundColor: 'rgba(107, 92, 231, 0.25)' },
  hintRow: { paddingVertical: 10 },
  hintText: { fontSize: 12, color: '#C8C8E0', lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: '#6B5CE7',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
