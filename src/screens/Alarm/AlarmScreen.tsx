import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAlarmStore, PREMIUM_MAX_SNOOZE } from '../../stores/alarmStore';
import { useAuthStore } from '../../stores/authStore';
import { FREE_LIMITS } from '../../constants';

export default function AlarmScreen() {
  const { isPremium } = useAuthStore();
  const {
    hour, minute, isEnabled, smartWindowMinutes, scheduledTimestamp, isLoaded,
    loadAlarm, setAlarmTime, toggleEnabled, toggleSmartWindow,
  } = useAlarmStore();

  const [showPicker, setShowPicker] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

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
    ? format(new Date(scheduledTimestamp), 'M月d日（EEE）HH:mm', { locale: ja }) + ' に予定'
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>アラーム</Text>
      </View>

      {!isLoaded ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6B5CE7" size="large" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* メインカード */}
          <View style={[styles.mainCard, isEnabled && styles.mainCardActive]}>
            <View style={styles.mainCardTop}>
              {/* 時刻表示 */}
              <TouchableOpacity onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                <Text style={[styles.timeText, isEnabled && styles.timeTextActive]}>
                  {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
                </Text>
                <Text style={styles.timeTapHint}>タップで時刻変更</Text>
              </TouchableOpacity>

              {/* トグル */}
              <View style={styles.switchWrap}>
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
            </View>

            {isEnabled && scheduledLabel ? (
              <Text style={styles.scheduledLabel}>⏱ {scheduledLabel}</Text>
            ) : !isEnabled ? (
              <Text style={styles.disabledLabel}>アラームはオフです</Text>
            ) : null}
          </View>

          {/* 設定カード */}
          <View style={styles.settingsCard}>
            {/* スマートアラーム */}
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>
                  スマートアラーム{!isPremium ? ' 🔒' : ''}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {smartWindowMinutes > 0
                    ? `起床ウィンドウ：${smartWindowMinutes}分前から段階的に起こします`
                    : '設定した時刻ちょうどに起こします'}
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
                <Text style={styles.settingTitle}>スヌーズ設定</Text>
                <Text style={styles.settingSubtitle}>
                  間隔 {FREE_LIMITS.SNOOZE_INTERVAL_MIN}分 ／ 最大 {maxSnooze}回
                  {!isPremium && `（プレミアムで${PREMIUM_MAX_SNOOZE}回）`}
                </Text>
              </View>
            </View>
          </View>

          {/* 使い方ヒント */}
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>📌 アラームの使い方</Text>
            <Text style={styles.hintText}>
              {'・アラームをONにすると翌日の設定時刻に通知が届きます\n'}
              {'・止めると翌日の同じ時刻に自動で再スケジュールします\n'}
              {'・スマートアラームは起床ウィンドウ内で最適なタイミングに起こします（プレミアム）'}
            </Text>
          </View>

          {!isPremium && (
            <TouchableOpacity style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>
                有料プランでスマートアラームを使う
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.spacer} />
        </ScrollView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  mainCard: {
    margin: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mainCardActive: {
    borderColor: '#6B5CE740',
    backgroundColor: '#6B5CE710',
  },
  mainCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 56,
    fontWeight: '200',
    color: '#555',
    letterSpacing: -1,
  },
  timeTextActive: { color: '#FFFFFF' },
  timeTapHint: { fontSize: 11, color: '#555', marginTop: 2 },
  switchWrap: { width: 56, alignItems: 'flex-end' },
  scheduledLabel: { fontSize: 12, color: '#9C8FFF', marginTop: 12 },
  disabledLabel: { fontSize: 12, color: '#555', marginTop: 12 },
  settingsCard: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 15, color: '#FFFFFF', marginBottom: 3 },
  settingSubtitle: { fontSize: 12, color: '#888', lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#1A1A2E' },
  hintCard: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  hintTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8 },
  hintText: { fontSize: 12, color: '#666', lineHeight: 20 },
  upgradeBtn: {
    marginHorizontal: 16,
    backgroundColor: '#6B5CE7',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  spacer: { height: 32 },
});
