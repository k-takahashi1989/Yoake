import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { getRecentSleepLogs } from '../../services/firebase';
import { safeToDate } from '../../utils/dateUtils';
import { useTranslation } from '../../i18n';

const CHAT_HISTORY_STORAGE_KEY = 'ai_chat_history';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataManagement'>;

export default function DataManagementScreen({ navigation }: Props) {
  const { deleteAccount } = useAuthStore();
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClearChatHistory = () => {
    Alert.alert(
      t('dataManagement.chatHistoryTitle'),
      t('dataManagement.chatHistoryClearConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
            Alert.alert(t('dataManagement.chatHistoryClearedTitle'), t('dataManagement.chatHistoryClearedMessage'));
          },
        },
      ],
    );
  };

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
        Alert.alert(t('dataManagement.exportBtn'), t('dataManagement.exportFailed'));
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
      t('dataManagement.deleteTitle'),
      t('dataManagement.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      t('dataManagement.deleteConfirmTitle'),
      t('dataManagement.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dataManagement.deleteConfirmBtn'),
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
      Alert.alert(t('dataManagement.deleteTitle'), t('dataManagement.deleteFailed'));
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* エクスポート */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dataManagement.exportTitle')}</Text>
          <Text style={styles.cardDesc}>{t('dataManagement.exportDesc')}</Text>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.btnDisabled]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.exportBtnText}>{t('dataManagement.exportBtn')}</Text>
            }
          </TouchableOpacity>
        </View>

        {/* AIチャット履歴 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dataManagement.chatHistoryTitle')}</Text>
          <Text style={styles.cardDesc}>{t('dataManagement.chatHistoryDesc')}</Text>
          <TouchableOpacity style={styles.clearChatBtn} onPress={handleClearChatHistory}>
            <Text style={styles.clearChatBtnText}>{t('dataManagement.chatHistoryClearBtn')}</Text>
          </TouchableOpacity>
        </View>

        {/* 危険ゾーン */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, styles.dangerTitle]}>{t('dataManagement.dangerZoneTitle')}</Text>
          <Text style={styles.cardDesc}>{t('dataManagement.dangerZoneDesc')}</Text>
          <TouchableOpacity
            style={[styles.deleteBtn, isDeleting && styles.btnDisabled]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting
              ? <ActivityIndicator color="#F44336" size="small" />
              : <Text style={styles.deleteBtnText}>{t('dataManagement.deleteBtn')}</Text>
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
  cardTitle: { fontSize: 13, color: '#9A9AB8', fontWeight: '600', marginBottom: 8 },
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
  clearChatBtn: {
    borderWidth: 1,
    borderColor: '#6B5CE7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clearChatBtnText: { color: '#9C8FFF', fontSize: 15, fontWeight: '600' },
});
