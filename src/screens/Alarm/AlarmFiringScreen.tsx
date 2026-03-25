import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAlarmStore, PREMIUM_MAX_SNOOZE } from '../../stores/alarmStore';
import { useAuthStore } from '../../stores/authStore';
import { FREE_LIMITS } from '../../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'AlarmFiring'>;

export default function AlarmFiringScreen({ navigation }: Props) {
  const [now, setNow] = useState(new Date());
  const { snoozeCount, handleSnooze, handleDismiss } = useAlarmStore();
  const { isPremium } = useAuthStore();

  const maxSnooze = isPremium ? PREMIUM_MAX_SNOOZE : FREE_LIMITS.SNOOZE_COUNT;
  const snoozesLeft = maxSnooze - snoozeCount;

  // 時計を毎秒更新
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 戻るボタンで閉じさせない
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const onDismiss = async () => {
    await handleDismiss();
    navigation.navigate('Main');
  };

  const onSnooze = async () => {
    const ok = await handleSnooze(isPremium);
    if (ok) navigation.navigate('Main');
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <SafeAreaView style={styles.inner}>
        {/* 上部：挨拶 */}
        <View style={styles.topSection}>
          <Text style={styles.greetingIcon}>🌅</Text>
          <Text style={styles.greeting}>おはようございます</Text>
        </View>

        {/* 中央：時計 */}
        <View style={styles.clockSection}>
          <Text style={styles.clockTime}>{format(now, 'HH:mm')}</Text>
          <Text style={styles.clockSec}>{format(now, 'ss')}</Text>
          <Text style={styles.clockDate}>
            {format(now, 'M月d日（EEE）', { locale: ja })}
          </Text>
        </View>

        {/* 下部：ボタン */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.dismissIcon}>🔕</Text>
            <Text style={styles.dismissText}>止める</Text>
          </TouchableOpacity>

          {snoozesLeft > 0 ? (
            <TouchableOpacity
              style={styles.snoozeBtn}
              onPress={onSnooze}
              activeOpacity={0.8}
            >
              <Text style={styles.snoozeText}>
                スヌーズ +{FREE_LIMITS.SNOOZE_INTERVAL_MIN}分
              </Text>
              <Text style={[
                styles.snoozeRemain,
                snoozesLeft === 1 && styles.snoozeRemainWarning,
              ]}>
                あと{snoozesLeft}回{snoozesLeft === 1 ? '（最後）' : ''}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.snoozeExhausted}>
              <Text style={styles.snoozeExhaustedText}>スヌーズ回数の上限です</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  inner: { flex: 1, paddingHorizontal: 32, justifyContent: 'space-between' },
  topSection: { alignItems: 'center', paddingTop: 48 },
  greetingIcon: { fontSize: 52, marginBottom: 12 },
  greeting: { fontSize: 18, color: '#B0B0C8', fontWeight: '300', letterSpacing: 2 },
  clockSection: { alignItems: 'center' },
  clockTime: {
    fontSize: 88,
    fontWeight: '100',
    color: '#FFFFFF',
    letterSpacing: -2,
    includeFontPadding: false,
  },
  clockSec: { fontSize: 22, color: '#555', fontWeight: '300', marginTop: -8 },
  clockDate: { fontSize: 15, color: '#666', marginTop: 8, letterSpacing: 1 },
  bottomSection: { paddingBottom: 48, gap: 14 },
  dismissBtn: {
    backgroundColor: '#6B5CE7',
    borderRadius: 24,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dismissIcon: { fontSize: 26 },
  dismissText: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  snoozeBtn: {
    borderWidth: 1,
    borderColor: '#3D3D5E',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  snoozeText: { fontSize: 16, color: '#9C8FFF' },
  snoozeRemain: { fontSize: 11, color: '#555', marginTop: 3 },
  snoozeRemainWarning: { color: '#FF9800', fontWeight: '600' },
  snoozeExhausted: { alignItems: 'center', paddingVertical: 14 },
  snoozeExhaustedText: { fontSize: 13, color: '#444' },
});
