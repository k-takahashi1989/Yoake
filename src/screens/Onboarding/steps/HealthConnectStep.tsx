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
  requestSleepDataPermissions,
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
          await useSleepStore.getState().loadRecent();
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

      if (isAndroid) {
        waitingForReturn.current = true;
        const opened = await openHealthDataProviderApp();
        if (!opened) {
          waitingForReturn.current = false;
          setStatus('unavailable');
        }
        return;
      }

      const granted = await requestSleepDataPermissions();
      setStatus(granted ? 'connected' : 'denied');
      if (granted) {
        await useSleepStore.getState().loadRecent();
      }
    } catch {
      waitingForReturn.current = false;
      setStatus('unavailable');
    }
  };

  const handleOpenStore = () => {
    openHealthDataProviderStorePage().catch(() => undefined);
  };

  const benefits = isAndroid
    ? [
        t('onboarding.healthConnect.benefit1'),
        t('onboarding.healthConnect.benefit2'),
        t('onboarding.healthConnect.benefit3'),
        t('onboarding.healthConnect.benefit4'),
      ]
    : isEnglishUi
      ? [
          'Import sleep automatically from Apple Health and Apple Watch',
          'Prefill bedtime, wake time, stages, and overnight heart rate',
          'Get richer score details when stage data is available',
          'You can still continue with manual logging at any time',
        ]
      : [
          'Apple Health / Apple Watch の睡眠データを自動で取り込めます',
          '就寝・起床・睡眠ステージ・夜間心拍を記録入力に反映できます',
          'ステージがある日はスコア詳細もより正確になります',
          'あとからでも手動入力に切り替えて続けられます',
        ];

  const title = isAndroid
    ? t('onboarding.healthConnect.title')
    : isEnglishUi
      ? 'Connect Apple Health'
      : 'Apple Health を接続';
  const description = isAndroid
    ? t('onboarding.healthConnect.desc')
    : isEnglishUi
      ? 'Allow Apple Health access so YOAKE can read your sleep data and prepare each daily log for you.'
      : 'Apple Health の読み取りを許可すると、YOAKE が睡眠データを取り込み、日々の記録入力を楽にできます。';
  const previewTitle = isAndroid
    ? (isEnglishUi ? 'What you unlock right away' : '連携すると最初から見えること')
    : isEnglishUi
      ? 'What Apple Health fills in'
      : 'Apple Health で自動入力される内容';
  const previewRows = isAndroid
    ? [
        isEnglishUi
          ? { label: 'Bedtime / wake time', value: 'Auto import' }
          : { label: '就寝 / 起床', value: '自動取り込み' },
        isEnglishUi
          ? { label: 'Deep / REM sleep', value: 'Stage details' }
          : { label: '深い睡眠 / REM', value: 'ステージ詳細' },
        isEnglishUi
          ? { label: 'First value', value: "Today's score" }
          : { label: '最初の確認', value: '今日のスコア' },
      ]
    : [
        isEnglishUi
          ? { label: 'Bedtime / wake time', value: 'Prefilled' }
          : { label: '就寝 / 起床', value: '自動入力' },
        isEnglishUi
          ? { label: 'Sleep stages', value: 'Deep / REM / Core' }
          : { label: '睡眠ステージ', value: 'Deep / REM / Core' },
        isEnglishUi
          ? { label: 'Morning detail', value: 'Score + insight' }
          : { label: '朝の確認', value: 'スコア + 気づき' },
      ];

  const connectLabel = isAndroid
    ? t('onboarding.healthConnect.connectBtn')
    : isEnglishUi
      ? 'Connect Apple Health'
      : 'Apple Health を接続';
  const waitingLabel = isAndroid
    ? t('onboarding.healthConnect.waitingBtn')
    : isEnglishUi
      ? 'Waiting for permission...'
      : '権限の確認中...';
  const successText = isAndroid
    ? t('onboarding.healthConnect.successBanner')
    : isEnglishUi
      ? 'Apple Health is connected.'
      : 'Apple Health を接続しました。';
  const deniedText = isAndroid
    ? t('onboarding.healthConnect.deniedBanner')
    : isEnglishUi
      ? 'Permission was not granted yet. You can try again or continue with manual logging.'
      : '権限はまだ許可されていません。もう一度試すか、手動入力で続けられます。';
  const unavailableText = isAndroid
    ? t('onboarding.healthConnect.unavailableBanner')
    : isEnglishUi
      ? 'Apple Health is not available on this device.'
      : 'この端末では Apple Health を利用できません。';
  const skipLabel = isAndroid
    ? t('onboarding.healthConnect.skipBtn')
    : isEnglishUi
      ? 'Start with manual logging'
      : '手動入力で始める';

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
        {benefits.map(benefit => (
          <View key={benefit} style={styles.benefitRow}>
            <View style={styles.checkDot} />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {status === 'checking' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            {isAndroid ? t('onboarding.healthConnect.checkingBanner') : waitingLabel}
          </Text>
        </View>
      )}

      {status === 'connected' && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{successText}</Text>
        </View>
      )}

      {status === 'denied' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{deniedText}</Text>
        </View>
      )}

      {status === 'unavailable' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{unavailableText}</Text>
          {isAndroid && (
            <TouchableOpacity onPress={handleOpenStore} style={styles.installButton}>
              <Text style={styles.installButtonText}>{t('onboarding.healthConnect.installBtn')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>{t('onboarding.healthConnect.privacyNote')}</Text>
      </View>

      <View style={styles.buttonGroup}>
        {status !== 'connected' && status !== 'unavailable' && (
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
              {status === 'checking' ? waitingLabel : connectLabel}
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
            {status === 'connected' ? t('onboarding.healthConnect.nextBtn') : skipLabel}
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
