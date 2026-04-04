import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
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
      await requestSleepDataPermissions();
      await checkStatus();
      useSleepStore.getState().loadRecent();
    } catch {
      // ignore
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

  const statusColor =
    status === 'granted'
      ? '#79E0B5'
      : status === 'denied'
        ? '#F4B35D'
        : '#F16C6C';

  const title = isIos
    ? isEnglishUi
      ? 'Apple Health status'
      : 'Apple Health 連携状況'
    : t('healthConnect.statusTitle');
  const statusText = isIos
    ? isEnglishUi
      ? 'Apple Health import is not wired yet'
      : 'Apple Health 連携はまだ未実装です'
    : status === 'granted'
      ? t('healthConnect.statusGranted')
      : status === 'denied'
        ? t('healthConnect.statusDenied')
        : t('healthConnect.statusUnavailable');
  const statusSubText = isIos
    ? isEnglishUi
      ? 'This build has the iOS project, but HealthKit permission and sleep import still need native wiring.'
      : 'iOS プロジェクトの土台はできていますが、HealthKit 権限と睡眠取り込みの native 実装がまだ必要です。'
    : status === 'granted'
      ? t('healthConnect.statusSubGranted')
      : status === 'denied'
        ? t('healthConnect.statusSubDenied')
        : t('healthConnect.statusSubUnavailable');
  const descTitle = isIos
    ? isEnglishUi
      ? 'What remains on iOS'
      : 'iOS で残っていること'
    : t('healthConnect.descTitle');
  const descText = isIos
    ? isEnglishUi
      ? 'Automatic import still needs Apple Health capability, usage descriptions, and the native bridge that reads sleep data.'
      : '自動取り込みには、Apple Health capability、用途説明文、睡眠データを読む native ブリッジの追加がまだ必要です。'
    : t('healthConnect.desc');
  const refreshLabel = isIos
    ? isEnglishUi
      ? 'Check again'
      : 'もう一度確認する'
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

        {!isIos && status === 'denied' && (
          <TouchableOpacity
            style={[styles.actionBtn, isRequesting && styles.actionBtnDisabled]}
            onPress={handleRequest}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator color={MORNING_THEME.goldText} />
            ) : (
              <Text style={styles.actionBtnText}>{t('healthConnect.requestPermission')}</Text>
            )}
          </TouchableOpacity>
        )}

        {!isIos && status === 'unavailable' && (
          <TouchableOpacity style={styles.actionBtn} onPress={openProviderStore}>
            <Text style={styles.actionBtnText}>{t('healthConnect.install')}</Text>
          </TouchableOpacity>
        )}

        {isIos && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={checkStatus}>
            <Text style={styles.secondaryBtnText}>{refreshLabel}</Text>
          </TouchableOpacity>
        )}

        {!isIos && status === 'granted' && (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRequest}>
              <Text style={styles.secondaryBtnText}>{t('healthConnect.recheck')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={openProviderApp}>
              <Text style={styles.secondaryBtnText}>{t('healthConnect.openApp')}</Text>
            </TouchableOpacity>
          </>
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
