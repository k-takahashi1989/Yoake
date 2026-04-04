import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { useTranslation } from '../../../i18n';
import ScalePressable from '../../../components/common/ScalePressable';
import Icon, { IconName } from '../../../components/common/Icon';

interface Props {
  onNext: (granted: boolean) => void;
}

export default function NotificationStep({ onNext }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  const requestPermission = async () => {
    setStatus('requesting');
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const androidResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (androidResult !== PermissionsAndroid.RESULTS.GRANTED) {
          setStatus('denied');
          return;
        }
      }

      const authStatus = await messaging().requestPermission();
      const granted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      setStatus(granted ? 'granted' : 'denied');
    } catch (error) {
      console.error('Notification permission request failed:', error);
      setStatus('denied');
    }
  };

  const notifications: Array<{ icon: IconName; label: string; desc: string }> = [
    {
      icon: 'speech-bubble',
      label: t('onboarding.notification.notif1Label'),
      desc: t('onboarding.notification.notif1Desc'),
    },
    {
      icon: 'bell',
      label: t('onboarding.notification.notif2Label'),
      desc: t('onboarding.notification.notif2Desc'),
    },
    {
      icon: 'data-analytics',
      label: t('onboarding.notification.notif3Label'),
      desc: t('onboarding.notification.notif3Desc'),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon name="bell" size={30} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>{t('onboarding.notification.title')}</Text>
      <Text style={styles.description}>{t('onboarding.notification.desc')}</Text>

      <View style={styles.notifList}>
        {notifications.map(item => (
          <View key={item.label} style={styles.notifRow}>
            <View style={styles.notifIconWrap}>
              <Icon name={item.icon} size={16} color="#DCD8FF" />
            </View>
            <View style={styles.notifContent}>
              <Text style={styles.notifLabel}>{item.label}</Text>
              <Text style={styles.notifDesc}>{item.desc}</Text>
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
          <Text style={styles.warningText}>{t('onboarding.notification.deniedBanner')}</Text>
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
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 92, 231, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.32)',
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
  notifIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(107, 92, 231, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
