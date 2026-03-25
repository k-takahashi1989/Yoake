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

interface Props {
  onNext: (granted: boolean) => void;
}

export default function NotificationStep({ onNext }: Props) {
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

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔔</Text>
      <Text style={styles.title}>通知を許可する</Text>
      <Text style={styles.description}>
        毎朝AIアドバイスをお届けし、{'\n'}睡眠の質を継続的に改善します。
      </Text>

      <View style={styles.notifList}>
        {NOTIFICATIONS.map(n => (
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
          <Text style={styles.successText}>✅ 通知を許可しました</Text>
        </View>
      )}

      {status === 'denied' && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            通知が拒否されました。設定アプリから後で変更できます。
          </Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        {status === 'idle' && (
          <TouchableOpacity style={styles.buttonPrimary} onPress={requestPermission}>
            <Text style={styles.buttonTextPrimary}>通知を許可する</Text>
          </TouchableOpacity>
        )}

        {status === 'requesting' && (
          <TouchableOpacity style={[styles.buttonPrimary, styles.buttonDisabled]} disabled>
            <Text style={styles.buttonTextPrimary}>確認中...</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={status === 'granted' ? styles.buttonPrimary : styles.buttonSecondary}
          onPress={() => onNext(status === 'granted')}
        >
          <Text style={status === 'granted' ? styles.buttonTextPrimary : styles.buttonTextSecondary}>
            {status === 'granted' ? '次へ' : 'スキップ'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const NOTIFICATIONS = [
  { emoji: '🤖', label: '毎朝AIアドバイス', desc: '起床後にその日の睡眠を分析してお届け' },
  { emoji: '🌙', label: '就寝リマインダー（有料）', desc: '設定した目標就寝時刻の30分前に通知' },
  { emoji: '📊', label: '週次レポート（有料）', desc: '月曜日に先週の睡眠サマリーをお届け' },
];

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
    color: '#888',
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
  buttonTextSecondary: { color: '#888', fontSize: 15 },
});
