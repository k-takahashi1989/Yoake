import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { getRecentSleepLogs } from '../../services/firebase';
import { safeToDate } from '../../utils/dateUtils';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataManagement'>;

export default function DataManagementScreen({ navigation }: Props) {
  const { deleteAccount } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ============================================================
  // データエクスポート
  // ============================================================

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const logs = await getRecentSleepLogs(365);

      const exportData = logs.map(log => ({
        date: log.date,
        bedTime: format(safeToDate(log.bedTime), 'HH:mm'),
        wakeTime: format(safeToDate(log.wakeTime), 'HH:mm'),
        totalMinutes: log.totalMinutes,
        score: log.score,
        sleepOnset: log.sleepOnset,
        wakeFeeling: log.wakeFeeling,
        deepSleepMinutes: log.deepSleepMinutes,
        remMinutes: log.remMinutes,
        lightSleepMinutes: log.lightSleepMinutes,
        awakenings: log.awakenings,
        heartRateAvg: log.heartRateAvg,
        habits: log.habits
          .filter(h => h.checked)
          .map(h => h.label)
          .join(', '),
        memo: log.memo ?? '',
        source: log.source,
      }));

      const json = JSON.stringify(exportData, null, 2);

      await Share.share({
        title: `YOAKE睡眠データ_${format(new Date(), 'yyyyMMdd')}`,
        message: json,
      });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('エクスポート失敗', 'データの取得に失敗しました。');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================
  // アカウント削除
  // ============================================================

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウントを削除',
      '全ての睡眠記録・設定・AIレポートが削除されます。この操作は元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      '本当によろしいですか？',
      '削除後はデータを復元できません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '完全に削除',
          style: 'destructive',
          onPress: executeDelete,
        },
      ],
    );
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      // authStore が hasCompletedOnboarding: false にするので
      // AppNavigator が自動的に Onboarding へリダイレクト
    } catch {
      Alert.alert('削除失敗', 'アカウントの削除に失敗しました。');
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* エクスポート */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>データエクスポート</Text>
          <Text style={styles.cardDesc}>
            過去1年分の睡眠データをJSON形式でエクスポートします。他のアプリへの移行や自己分析に活用できます。
          </Text>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.btnDisabled]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.exportBtnText}>📤 データをエクスポート</Text>
            }
          </TouchableOpacity>
        </View>

        {/* 危険ゾーン */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, styles.dangerTitle]}>危険ゾーン</Text>
          <Text style={styles.cardDesc}>
            以下の操作は取り消しできません。実行前に必ずデータをエクスポートしてください。{'\n'}
            削除後はFirestore上のデータが消去されます。AIアドバイス生成時にAnthropicに送信したデータについては、Anthropicのデータポリシーが適用されます。
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && styles.btnDisabled]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting
              ? <ActivityIndicator color="#F44336" size="small" />
              : <Text style={styles.deleteBtnText}>🗑️ アカウントを削除する</Text>
            }
          </TouchableOpacity>
        </View>

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
  dangerCard: {
    borderWidth: 1,
    borderColor: '#F4433640',
    backgroundColor: '#F4433608',
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8 },
  dangerTitle: { color: '#F44336' },
  cardDesc: { fontSize: 13, color: '#B0B0C8', lineHeight: 20, marginBottom: 16 },
  exportBtn: {
    backgroundColor: '#6B5CE7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  exportBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#F44336', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
