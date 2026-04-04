import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Share, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types';
import { getRecentSleepLogs } from '../../services/firebase';
import { safeToDate } from '../../utils/dateUtils';
import { useTranslation } from '../../i18n';
import { MORNING_THEME } from '../../theme/morningTheme';

const CHAT_HISTORY_STORAGE_KEY = 'ai_chat_history';
const ACCOUNT_DELETION_URL = 'https://yoake-app.web.app/account-deletion.html';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataManagement'>;

export default function DataManagementScreen({ navigation: _navigation }: Props) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const isJa = t('common.cancel') === 'キャンセル';

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

  const handleOpenDeletionForm = async () => {
    try {
      await Linking.openURL(ACCOUNT_DELETION_URL);
    } catch {
      Alert.alert(
        isJa ? 'ページを開けませんでした' : 'Unable to open page',
        isJa
          ? 'アカウント削除フォームを開けませんでした。時間をおいて再度お試しください。'
          : 'Could not open the account deletion form. Please try again in a moment.',
      );
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

        <View style={[styles.card, styles.supportCard]}>
          <Text style={[styles.cardTitle, styles.supportTitle]}>
            {isJa ? 'アカウント削除' : 'Account deletion'}
          </Text>
          <Text style={styles.cardDesc}>
            {isJa
              ? 'アカウント削除は専用フォームから受け付けています。リンク先から申請してください。'
              : 'Account deletion requests are handled through a dedicated form. Please use the link below.'}
          </Text>
          <TouchableOpacity style={styles.deleteLinkBtn} onPress={handleOpenDeletionForm}>
            <Text style={styles.deleteLinkBtnText}>
              {isJa ? '削除フォームを開く' : 'Open deletion form'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
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
  supportCard: {
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
    backgroundColor: MORNING_THEME.goldSurface,
  },
  cardTitle: { fontSize: 13, color: MORNING_THEME.textMuted, fontWeight: '600', marginBottom: 8 },
  supportTitle: { color: MORNING_THEME.goldStrong },
  cardDesc: { fontSize: 13, color: MORNING_THEME.textSecondary, lineHeight: 20, marginBottom: 16 },
  exportBtn: {
    backgroundColor: MORNING_THEME.gold,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  exportBtnText: { color: MORNING_THEME.goldText, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  deleteLinkBtn: {
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: MORNING_THEME.surfaceRaised,
  },
  deleteLinkBtnText: { color: MORNING_THEME.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.5 },
  clearChatBtn: {
    borderWidth: 1,
    borderColor: MORNING_THEME.borderCool,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: MORNING_THEME.surfaceElevated,
  },
  clearChatBtnText: { color: MORNING_THEME.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
