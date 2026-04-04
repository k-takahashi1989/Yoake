import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  hasSleepDataPermission,
  isSleepDataAvailable,
  openHealthDataProviderApp,
  openHealthDataProviderStorePage,
} from '../../../services/healthData';
import { useTranslation } from '../../../i18n';
import ScalePressable from '../../../components/common/ScalePressable';
import Icon from '../../../components/common/Icon';
import { useSleepStore } from '../../../stores/sleepStore';

interface Props {
  onNext: () => void;
}

type Status = 'idle' | 'checking' | 'connected' | 'denied' | 'unavailable';

export default function HealthConnectStep({ onNext }: Props) {
  const { t } = useTranslation();
  const isAndroid = Platform.OS === 'android';
  const isEnglishUi = t('nav.aiChat') === 'AI Chat';
  const [status, setStatus] = useState<Status>('idle');
  const appStateRef = useRef(AppState.currentState);
  const waitingForReturn = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === 'active' &&
        waitingForReturn.current
      ) {
        waitingForReturn.current = false;
        setStatus('checking');
        const granted = await hasSleepDataPermission();
        setStatus(granted ? 'connected' : 'denied');

        if (granted) {
          useSleepStore.getState().loadRecent();
        }
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, []);

  const handleConnect = async () => {
    setStatus('checking');
    try {
      const available = await isSleepDataAvailable();
      if (!available) {
        setStatus('unavailable');
        return;
      }

      waitingForReturn.current = true;
      const opened = await openHealthDataProviderApp();
      if (!opened) {
        waitingForReturn.current = false;
        setStatus('unavailable');
      }
    } catch {
      waitingForReturn.current = false;
      setStatus('unavailable');
    }
  };

  const handleOpenPlayStore = () => {
    openHealthDataProviderStorePage().catch(() => undefined);
  };

  const benefits = [
    isAndroid
      ? t('onboarding.healthConnect.benefit1')
      : isEnglishUi
        ? 'Prepare for Apple Health / Apple Watch sleep import'
        : 'Apple Watch / ヘルスケア連携の受け皿を用意',
    isAndroid
      ? t('onboarding.healthConnect.benefit2')
      : isEnglishUi
        ? 'Start with manual logging and still get a score plus guidance'
        : 'まずは手動入力でもスコアと改善提案を始められる',
    isAndroid
      ? t('onboarding.healthConnect.benefit3')
      : isEnglishUi
        ? 'AI guidance gets sharper as more data builds up'
        : 'データが増えるほどAIの提案が具体的になる',
    isAndroid
      ? t('onboarding.healthConnect.benefit4')
      : isEnglishUi
        ? 'You can add health sync later without losing logs'
        : 'あとから設定を追加しても記録はそのまま使える',
  ];

  const title = isAndroid
    ? t('onboarding.healthConnect.title')
    : isEnglishUi
      ? 'Prepare your sleep data'
      : '睡眠データの準備';
  const description = isAndroid
    ? t('onboarding.healthConnect.desc')
    : isEnglishUi
      ? 'You can start with manual logging in this build. In the iOS release build, Apple Health integration should make sleep capture more automatic.'
      : 'このビルドでは手動入力から始められます。iOS公開ビルドではヘルスケア連携を有効化して、より自動で記録できるようにします。';
  const previewTitle = isAndroid
    ? (isEnglishUi ? 'What you unlock right away' : '連携すると最初から見えること')
    : isEnglishUi
      ? 'What you can see right away'
      : '手動入力でも最初から見えること';
  const previewRows = isAndroid
    ? [
        isEnglishUi
          ? { label: 'Bedtime / wake time', value: 'Auto import' }
          : { label: '就寝・起床', value: '自動取得' },
        isEnglishUi
          ? { label: 'Deep / REM sleep', value: 'Stage details' }
          : { label: '深睡眠 / REM', value: 'ステージ確認' },
        isEnglishUi
          ? { label: 'First value', value: "Today's score" }
          : { label: '初回の価値', value: '今日のスコア' },
      ]
    : [
        isEnglishUi
          ? { label: "Today's status", value: 'Sleep score' }
          : { label: '今日の状態', value: '睡眠スコア' },
        isEnglishUi
          ? { label: 'Next improvement', value: 'AI note' }
          : { label: '次の改善', value: 'AIのひとこと' },
        isEnglishUi
          ? { label: 'Reason to return', value: 'Weekly report' }
          : { label: '続ける理由', value: '週次レポート' },
      ];

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="heart-beat" size={52} color="#8FA7FF" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>{previewTitle}</Text>
        {previewRows.map(row => (
          <View key={row.label} style={styles.previewRow}>
            <Text style={styles.previewLabel}>{row.label}</Text>
            <Text style={styles.previewValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.benefitList}>
        {benefits.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={styles.checkDot} />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {status === 'checking' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>{t('onboarding.healthConnect.checkingBanner')}</Text>
        </View>
      )}

      {status === 'connected' && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{t('onboarding.healthConnect.successBanner')}</Text>
        </View>
      )}

      {status === 'denied' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{t('onboarding.healthConnect.deniedBanner')}</Text>
        </View>
      )}

      {status === 'unavailable' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{t('onboarding.healthConnect.unavailableBanner')}</Text>
          <TouchableOpacity onPress={handleOpenPlayStore} style={styles.installButton}>
            <Text style={styles.installButtonText}>{t('onboarding.healthConnect.installBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>{t('onboarding.healthConnect.privacyNote')}</Text>
      </View>

      <View style={styles.buttonGroup}>
        {isAndroid && status !== 'connected' && (
          <ScalePressable
            style={[
              styles.button,
              styles.buttonPrimary,
              status === 'checking' && styles.buttonDisabled,
            ]}
            onPress={handleConnect}
            disabled={status === 'checking'}
          >
            <Text style={styles.buttonText}>
              {status === 'checking'
                ? t('onboarding.healthConnect.waitingBtn')
                : t('onboarding.healthConnect.connectBtn')}
            </Text>
          </ScalePressable>
        )}

        <ScalePressable
          style={[
            styles.button,
            status === 'connected' ? styles.buttonPrimary : styles.buttonSecondary,
          ]}
          onPress={onNext}
        >
          <Text style={[styles.buttonText, status !== 'connected' && styles.buttonTextSecondary]}>
            {status === 'connected'
              ? t('onboarding.healthConnect.nextBtn')
              : isAndroid
                ? t('onboarding.healthConnect.skipBtn')
                : isEnglishUi
                  ? 'Start with manual logging'
                  : '手動入力で始める'}
          </Text>
        </ScalePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#B0B0C8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitList: {
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: 'rgba(107, 92, 231, 0.14)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.28)',
  },
  previewTitle: {
    color: '#DCD8FF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  previewLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  previewValue: {
    color: '#CFC9FF',
    fontSize: 12,
    fontWeight: '700',
  },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#79E0B5',
    marginRight: 12,
    marginTop: 6,
  },
  benefitText: { flex: 1, fontSize: 14, color: '#D0D0E8', lineHeight: 20 },
  infoBanner: {
    backgroundColor: '#6B5CE720',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6B5CE740',
  },
  infoText: { color: '#9C8FFF', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  successBanner: {
    backgroundColor: '#4CAF5020',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  successText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  warningBanner: {
    backgroundColor: '#FF980020',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningText: { color: '#FF9800', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  installButton: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 16 },
  installButtonText: { color: '#FF9800', fontSize: 13, textDecorationLine: 'underline' },
  privacyNote: { marginBottom: 16, paddingHorizontal: 4 },
  privacyNoteText: { fontSize: 11, color: '#555', lineHeight: 17, textAlign: 'center' },
  buttonGroup: { gap: 10 },
  button: { paddingVertical: 14, borderRadius: 28, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#6B5CE7' },
  buttonSecondary: { borderWidth: 1, borderColor: '#555' },
  buttonDisabled: { backgroundColor: '#6B5CE760' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary: { color: '#9A9AB8' },
});
