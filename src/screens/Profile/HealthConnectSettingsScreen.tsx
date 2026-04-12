import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  hasSleepDataPermission,
  isSleepDataAvailable,
  openHealthDataProviderApp,
  openHealthDataProviderStorePage,
  requestSleepDataPermissions,
} from '../../services/healthData';
import { useTranslation } from '../../i18n';
import { useSleepStore } from '../../stores/sleepStore';
import { MORNING_THEME } from '../../theme/morningTheme';

type Status = 'loading' | 'unavailable' | 'granted' | 'denied';

export default function HealthConnectSettingsScreen() {
  const { t } = useTranslation();
  const isIos = Platform.OS === 'ios';
  const isEnglishUi = t('nav.aiChat') === 'AI Chat';
  const [status, setStatus] = useState<Status>('loading');
  const [isRequesting, setIsRequesting] = useState(false);

  const checkStatus = async () => {
    setStatus('loading');
    try {
      const available = await isSleepDataAvailable();
      if (!available) {
        setStatus('unavailable');
        return;
      }

      const granted = await hasSleepDataPermission();
      setStatus(granted ? 'granted' : 'denied');
    } catch {
      setStatus('unavailable');
    }
  };

  useEffect(() => {
    checkStatus().catch(() => {
      setStatus('unavailable');
    });
  }, []);

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestSleepDataPermissions();
      setStatus(granted ? 'granted' : 'denied');
      if (granted) {
        await useSleepStore.getState().loadRecent();
      }
    } catch {
      setStatus('denied');
    } finally {
      setIsRequesting(false);
    }
  };

  const openProviderApp = () => {
    openHealthDataProviderApp().catch(() => undefined);
  };

  const openProviderStore = () => {
    openHealthDataProviderStorePage().catch(() => undefined);
  };

  const title = isIos
    ? (isEnglishUi ? 'Apple Health status' : 'Apple Health 連携状況')
    : t('healthConnect.statusTitle');
  const statusColor =
    status === 'granted'
      ? '#79E0B5'
      : status === 'denied'
        ? '#F4B35D'
        : '#F16C6C';

  const statusText = isIos
    ? status === 'granted'
      ? (isEnglishUi ? 'Apple Health connected' : 'Apple Health の読み取り準備ができました')
      : status === 'denied'
        ? (isEnglishUi ? 'Permission required' : '権限の許可が必要です')
        : (isEnglishUi ? 'Apple Health unavailable on this device' : 'この端末では Apple Health を利用できません')
    : status === 'granted'
      ? t('healthConnect.statusGranted')
      : status === 'denied'
        ? t('healthConnect.statusDenied')
        : t('healthConnect.statusUnavailable');

  const statusSubText = isIos
    ? status === 'granted'
      ? (isEnglishUi
          ? 'Sleep import can now fill bedtime, wake time, stages, and heart rate when Health data exists.'
          : '睡眠データがある日は、就寝・起床・睡眠ステージ・心拍の自動入力に使えます。')
      : status === 'denied'
        ? (isEnglishUi
            ? 'Allow Apple Health access to import sleep data from Apple Watch and the Health app.'
            : 'Apple Watch やヘルスケアの睡眠データを取り込むには、Apple Health の権限許可が必要です。')
        : (isEnglishUi
            ? 'HealthKit is not available on this device or simulator.'
            : 'HealthKit がこの端末またはシミュレータで利用できません。')
    : status === 'granted'
      ? t('healthConnect.statusSubGranted')
      : status === 'denied'
        ? t('healthConnect.statusSubDenied')
        : t('healthConnect.statusSubUnavailable');

  const descTitle = isIos
    ? (isEnglishUi ? 'What Apple Health imports' : 'Apple Health で取り込める内容')
    : t('healthConnect.descTitle');
  const descText = isIos
    ? (isEnglishUi
        ? 'YOAKE reads sleep sessions, stage breakdown, and heart-rate samples from Apple Health, then uses them to prefill your daily log.'
        : 'YOAKE は Apple Health から睡眠セッション、ステージ内訳、心拍サンプルを読み取り、日々の記録入力に反映します。')
    : t('healthConnect.desc');

  const requestLabel = isIos
    ? (isEnglishUi ? 'Connect Apple Health' : 'Apple Health を接続')
    : t('healthConnect.requestPermission');
  const refreshLabel = isIos
    ? (isEnglishUi ? 'Check again' : 'もう一度確認する')
    : t('healthConnect.recheck');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{title}</Text>

          {status === 'loading' ? (
            <ActivityIndicator color={MORNING_THEME.goldStrong} style={styles.loader} />
          ) : (
            <View style={styles.statusRow}>
              <View style={[styles.statusMarker, { borderColor: statusColor }]}>
                <View style={[styles.statusMarkerDot, { backgroundColor: statusColor }]} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusText}>{statusText}</Text>
                <Text style={styles.statusSubText}>{statusSubText}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{descTitle}</Text>
          <Text style={styles.descText}>{descText}</Text>
        </View>

        {status === 'denied' && (
          <TouchableOpacity
            style={[styles.actionBtn, isRequesting && styles.actionBtnDisabled]}
            onPress={handleRequest}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator color={MORNING_THEME.goldText} />
            ) : (
              <Text style={styles.actionBtnText}>{requestLabel}</Text>
            )}
          </TouchableOpacity>
        )}

        {!isIos && status === 'unavailable' && (
          <TouchableOpacity style={styles.actionBtn} onPress={openProviderStore}>
            <Text style={styles.actionBtnText}>{t('healthConnect.install')}</Text>
          </TouchableOpacity>
        )}

        {(isIos || status === 'granted') && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={checkStatus}>
            <Text style={styles.secondaryBtnText}>{refreshLabel}</Text>
          </TouchableOpacity>
        )}

        {!isIos && status === 'granted' && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={openProviderApp}>
            <Text style={styles.secondaryBtnText}>{t('healthConnect.openApp')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MORNING_THEME.root },
  scroll: { flex: 1 },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  cardTitle: {
    fontSize: 13,
    color: MORNING_THEME.textMuted,
    fontWeight: '600',
    marginBottom: 12,
  },
  loader: { marginTop: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  statusMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusInfo: { flex: 1 },
  statusText: { fontSize: 16, color: MORNING_THEME.textPrimary, fontWeight: '600', marginBottom: 4 },
  statusSubText: { fontSize: 13, color: MORNING_THEME.textMuted, lineHeight: 18 },
  descText: { fontSize: 13, color: MORNING_THEME.textSecondary, lineHeight: 20 },
  actionBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: MORNING_THEME.gold,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: MORNING_THEME.goldText, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  secondaryBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: MORNING_THEME.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MORNING_THEME.borderCool,
  },
  secondaryBtnText: { color: MORNING_THEME.textPrimary, fontSize: 14, fontWeight: '600' },
  bottomSpacer: { height: 32 },
});
