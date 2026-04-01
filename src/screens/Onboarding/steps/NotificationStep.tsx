import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { useTranslation } from '../../../i18n';
import ScalePressable from '../../../components/common/ScalePressable';

interface Props {
  onNext: (granted: boolean) => void;
}

export default function NotificationStep({ onNext }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const requestPermission = async () => {
    setStatus('requesting');
    try {
      // Android 13+ は POST_NOTIFICATIONS パーミッションが必要
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const androidResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (androidResult !== PermissionsAndroid.RESULTS.GRANTED) {
          setStatus('denied');
          return;
        }
      }

      // Firebase Messaging のパーミッション取得
      const authStatus = await messaging().requestPermission();
      const granted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      setStatus(granted ? 'granted' : 'denied');
    } catch (e) {
      console.error('通知許可エラー:', e);
      setStatus('denied');
    }
  };

  const notifications = [
    { emoji: '🤖', label: t('onboarding.notification.notif1Label'), desc: t('onboarding.notification.notif1Desc') },
    { emoji: '🌙', label: t('onboarding.notification.notif2Label'), desc: t('onboarding.notification.notif2Desc') },
    { emoji: '📊', label: t('onboarding.notification.notif3Label'), desc: t('onboarding.notification.notif3Desc') },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔔</Text>
      <Text style={styles.title}>{t('onboarding.notification.title')}</Text>
      <Text style={styles.description}>{t('onboarding.notification.desc')}</Text>

      <View style={styles.notifList}>
        {notifications.map(n => (
          <View key={n.label} style={styles.notifRow}>
            <Text style={styles.notifEmoji}>{n.emoji}</Text>
            <View style={styles.notifContent}>
              <Text style={styles.notifLabel}>{n.label}</Text>
              <Text style={styles.notifDesc}>{n.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {status === 'granted' && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{t('onboarding.notification.grantedBanner')}</Text>
        </View>
      )}

      {status === 'denied' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            {t('onboarding.notification.deniedBanner')}
          </Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        {status === 'idle' && (
          <ScalePressable style={styles.buttonPrimary} onPress={requestPermission}>
            <Text style={styles.buttonTextPrimary}>{t('onboarding.notification.allowBtn')}</Text>
          </ScalePressable>
        )}

        {status === 'requesting' && (
          <ScalePressable style={[styles.buttonPrimary, styles.buttonDisabled]} disabled>
            <Text style={styles.buttonTextPrimary}>{t('onboarding.notification.checkingBtn')}</Text>
          </ScalePressable>
        )}

        <ScalePressable
          style={status === 'granted' ? styles.buttonPrimary : styles.buttonSecondary}
          onPress={() => onNext(status === 'granted')}
        >
          <Text style={status === 'granted' ? styles.buttonTextPrimary : styles.buttonTextSecondary}>
            {status === 'granted' ? t('onboarding.notification.nextBtn') : t('onboarding.notification.skipBtn')}
          </Text>
        </ScalePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  icon: {
    fontSize: 56,
    textAlign: 'center',
    marginBottom: 16,
  },
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
  notifList: {
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notifEmoji: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
    marginTop: 1,
  },
  notifContent: { flex: 1 },
  notifLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  notifDesc: {
    fontSize: 12,
    color: '#9A9AB8',
    lineHeight: 18,
  },
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
  },
  warningText: { color: '#FF9800', fontSize: 13, textAlign: 'center' },
  buttonGroup: { gap: 10 },
  buttonPrimary: {
    backgroundColor: '#6B5CE7',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
  buttonSecondary: {
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary: { color: '#9A9AB8', fontSize: 15 },
});
