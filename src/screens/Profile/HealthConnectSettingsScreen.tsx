import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isHCAvailable, hasHCSleepPermission, requestHCPermissions } from '../../services/healthConnect';

type Status = 'loading' | 'unavailable' | 'granted' | 'denied';

export default function HealthConnectSettingsScreen() {
  const [status, setStatus] = useState<Status>('loading');
  const [isRequesting, setIsRequesting] = useState(false);

  const checkStatus = async () => {
    setStatus('loading');
    try {
      const available = await isHCAvailable();
      if (!available) {
        setStatus('unavailable');
        return;
      }
      const granted = await hasHCSleepPermission();
      setStatus(granted ? 'granted' : 'denied');
    } catch {
      setStatus('unavailable');
    }
  };

  useEffect(() => { checkStatus(); }, []);

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      await requestHCPermissions();
      await checkStatus();
    } catch {
      // ignore
    } finally {
      setIsRequesting(false);
    }
  };

  const openHCApp = () => {
    Linking.openURL('android-app://com.google.android.apps.healthdata').catch(() =>
      Linking.openURL(
        'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
      ),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ステータスカード */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Connect 接続状況</Text>

          {status === 'loading' ? (
            <ActivityIndicator color="#6B5CE7" style={{ marginTop: 8 }} />
          ) : (
            <View style={styles.statusRow}>
              <Text style={styles.statusIcon}>
                {status === 'granted' ? '✅' : status === 'denied' ? '⚠️' : '❌'}
              </Text>
              <View style={styles.statusInfo}>
                <Text style={styles.statusText}>
                  {status === 'granted'
                    ? '権限付与済み'
                    : status === 'denied'
                    ? '権限が必要です'
                    : 'Health Connectが利用できません'}
                </Text>
                <Text style={styles.statusSubText}>
                  {status === 'granted'
                    ? '睡眠データを自動取得できます'
                    : status === 'denied'
                    ? '睡眠データの自動取得には権限が必要です'
                    : 'Android 9以上・Health Connectアプリが必要です'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 説明カード */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Connect とは</Text>
          <Text style={styles.descText}>
            {'Health ConnectはGoogleが提供するヘルスデータ統合プラットフォームです。\n\n' +
              'YOAKEはHealth Connectと連携することで、ウェアラブルデバイスの睡眠データ（就寝・起床時刻、深睡眠・REM睡眠・浅い睡眠・覚醒回数）を自動で取得できます。\n\n' +
              'データはGoogle Playサービスにより管理され、YOAKEのサーバーには送信されません。'}
          </Text>
        </View>

        {/* アクションボタン */}
        {status === 'denied' && (
          <TouchableOpacity
            style={[styles.actionBtn, isRequesting && styles.actionBtnDisabled]}
            onPress={handleRequest}
            disabled={isRequesting}
          >
            {isRequesting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.actionBtnText}>睡眠データの権限を要求</Text>
            }
          </TouchableOpacity>
        )}

        {status === 'unavailable' && (
          <TouchableOpacity style={styles.actionBtn} onPress={openHCApp}>
            <Text style={styles.actionBtnText}>Health Connectをインストール</Text>
          </TouchableOpacity>
        )}

        {status === 'granted' && (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRequest}>
              <Text style={styles.secondaryBtnText}>権限を再確認する</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={openHCApp}>
              <Text style={styles.secondaryBtnText}>Health Connectアプリを開く</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusIcon: { fontSize: 24 },
  statusInfo: { flex: 1 },
  statusText: { fontSize: 16, color: '#FFFFFF', fontWeight: '600', marginBottom: 4 },
  statusSubText: { fontSize: 13, color: '#888', lineHeight: 18 },
  descText: { fontSize: 13, color: '#B0B0C8', lineHeight: 20 },
  actionBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#6B5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#9C8FFF', fontSize: 14 },
});
