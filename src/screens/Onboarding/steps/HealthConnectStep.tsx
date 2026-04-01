import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { isHCAvailable, hasHCSleepPermission } from '../../../services/healthConnect';
import { useTranslation } from '../../../i18n';
import ScalePressable from '../../../components/common/ScalePressable';
import { useSleepStore } from '../../../stores/sleepStore';

interface Props {
  onNext: () => void;
}

type Status = 'idle' | 'checking' | 'connected' | 'denied' | 'unavailable';

export default function HealthConnectStep({ onNext }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const appStateRef = useRef(AppState.currentState);
  const waitingForReturn = useRef(false);

  // HCアプリから戻ったとき権限を再チェック
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === 'active' &&
        waitingForReturn.current
      ) {
        waitingForReturn.current = false;
        setStatus('checking');
        const granted = await hasHCSleepPermission();
        setStatus(granted ? 'connected' : 'denied');
        // 権限取得済みの場合はホーム画面のデータを即時更新
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
      const available = await isHCAvailable();
      if (!available) {
        setStatus('unavailable');
        return;
      }
      // requestPermission は端末環境によってクラッシュする場合があるため
      // HCアプリを直接開いて権限付与してもらう方式を採用
      waitingForReturn.current = true;
      await Linking.openURL('android-app://com.google.android.apps.healthdata');
    } catch {
      // HCアプリが見つからない場合
      waitingForReturn.current = false;
      setStatus('unavailable');
    }
  };

  const handleOpenPlayStore = () => {
    Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
      Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
    );
  };

  const benefits = [
    t('onboarding.healthConnect.benefit1'),
    t('onboarding.healthConnect.benefit2'),
    t('onboarding.healthConnect.benefit3'),
    t('onboarding.healthConnect.benefit4'),
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>❤️</Text>
      <Text style={styles.title}>{t('onboarding.healthConnect.title')}</Text>
      <Text style={styles.description}>{t('onboarding.healthConnect.desc')}</Text>

      <View style={styles.benefitList}>
        {benefits.map(b => (
          <View key={b} style={styles.benefitRow}>
            <Text style={styles.checkIcon}>✓</Text>
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
      </View>

      {status === 'checking' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            {t('onboarding.healthConnect.checkingBanner')}
          </Text>
        </View>
      )}

      {status === 'connected' && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{t('onboarding.healthConnect.successBanner')}</Text>
        </View>
      )}

      {status === 'denied' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            {t('onboarding.healthConnect.deniedBanner')}
          </Text>
        </View>
      )}

      {status === 'unavailable' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            {t('onboarding.healthConnect.unavailableBanner')}
          </Text>
          <TouchableOpacity onPress={handleOpenPlayStore} style={styles.installButton}>
            <Text style={styles.installButtonText}>{t('onboarding.healthConnect.installBtn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>
          {t('onboarding.healthConnect.privacyNote')}
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        {status !== 'connected' && (
          <ScalePressable
            style={[styles.button, styles.buttonPrimary, status === 'checking' && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={status === 'checking'}
          >
            <Text style={styles.buttonText}>
              {status === 'checking' ? t('onboarding.healthConnect.waitingBtn') : t('onboarding.healthConnect.connectBtn')}
            </Text>
          </ScalePressable>
        )}

        <ScalePressable
          style={[styles.button, status === 'connected' ? styles.buttonPrimary : styles.buttonSecondary]}
          onPress={() => onNext()}
        >
          <Text style={[styles.buttonText, status !== 'connected' && styles.buttonTextSecondary]}>
            {status === 'connected' ? t('onboarding.healthConnect.nextBtn') : t('onboarding.healthConnect.skipBtn')}
          </Text>
        </ScalePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  icon: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 15, color: '#B0B0C8', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  benefitList: { backgroundColor: '#2D2D44', borderRadius: 16, padding: 16, marginBottom: 24 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  checkIcon: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold', marginRight: 10, marginTop: 1 },
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
