import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types';
import { getGoal, getRecentSleepLogs, getSleepLog, saveSleepLog } from '../../services/firebase';
import {
  getHealthDataPlatform,
  getNativeHealthSource,
  hasSleepDataPermission,
  isSleepDataAvailable,
  readSleepDataForDate,
  requestSleepDataPermissions,
} from '../../services/healthData';
import { calculateScore, calculateSleepDebt } from '../../utils/scoreCalculator';
import { SCORE_VERSION } from '../../constants';
import { safeToDate } from '../../utils/dateUtils';
import { useTranslation } from '../../i18n';
import { MORNING_THEME } from '../../theme/morningTheme';

const CHAT_HISTORY_STORAGE_KEY = 'ai_chat_history';
const ACCOUNT_DELETION_URL = 'https://yoake-app.web.app/account-deletion.html';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataManagement'>;

export default function DataManagementScreen({ navigation: _navigation }: Props) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const isJa = t('common.cancel') === 'キャンセル';
  const healthPlatform = getHealthDataPlatform();
  const importTitle = healthPlatform === 'apple_health'
    ? (isJa ? 'Apple Health から取り込む' : 'Import from Apple Health')
    : t('dataManagement.hcImportTitle');
  const importDesc = healthPlatform === 'apple_health'
    ? (isJa
        ? 'Apple Health の過去 14 日分の睡眠データから、未記録の日だけを取り込みます。'
        : 'Import the last 14 days of Apple Health sleep data for dates that are still missing in YOAKE.')
    : t('dataManagement.hcImportDesc');
  const importButtonLabel = healthPlatform === 'apple_health'
    ? (isJa ? 'Apple Health を取り込む' : 'Import Apple Health data')
    : t('dataManagement.hcImportBtn');

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
            Alert.alert(
              t('dataManagement.chatHistoryClearedTitle'),
              t('dataManagement.chatHistoryClearedMessage'),
            );
          },
        },
      ],
    );
  };

  const handleImportFromHealthData = async () => {
    setIsImporting(true);

    try {
      const available = await isSleepDataAvailable();
      if (!available) {
        Alert.alert(
          isJa ? 'ヘルスデータを利用できません' : 'Health data unavailable',
          healthPlatform === 'apple_health'
            ? (isJa ? 'Apple Health を利用できる端末でお試しください。' : 'Try again on a device with Apple Health support.')
            : t('dataManagement.hcImportNoPermissionDesc'),
        );
        return;
      }

      let hasPermission = await hasSleepDataPermission();
      if (!hasPermission) {
        hasPermission = await requestSleepDataPermissions();
      }

      if (!hasPermission) {
        Alert.alert(
          healthPlatform === 'apple_health'
            ? (isJa ? 'Apple Health の権限が必要です' : 'Apple Health permission required')
            : t('dataManagement.hcImportNoPermission'),
          healthPlatform === 'apple_health'
            ? (isJa
                ? '睡眠データの読み取りを許可してから、もう一度お試しください。'
                : 'Allow sleep-data access first, then try again.')
            : t('dataManagement.hcImportNoPermissionDesc'),
        );
        return;
      }

      type Candidate = {
        date: string;
        data: NonNullable<Awaited<ReturnType<typeof readSleepDataForDate>>>;
      };

      const candidates: Candidate[] = [];
      for (let i = 1; i <= 14; i++) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const existing = await getSleepLog(date);
        if (existing) continue;

        const data = await readSleepDataForDate(date);
        if (data) {
          candidates.push({ date, data });
        }
      }

      if (candidates.length === 0) {
        Alert.alert(
          healthPlatform === 'apple_health'
            ? (isJa ? '取り込めるデータがありません' : 'No Apple Health data found')
            : t('dataManagement.hcImportNone'),
          healthPlatform === 'apple_health'
            ? (isJa ? '未記録の日に取り込める睡眠データが見つかりませんでした。' : 'No missing dates with Apple Health sleep data were found.')
            : t('dataManagement.hcImportNoneDesc'),
        );
        return;
      }

      Alert.alert(
        healthPlatform === 'apple_health'
          ? (isJa ? `${candidates.length} 日分の Apple Health データが見つかりました` : `Found ${candidates.length} days of Apple Health data`)
          : t('dataManagement.hcImportFound', { count: candidates.length }),
        healthPlatform === 'apple_health'
          ? (isJa ? '未記録の日だけを YOAKE に取り込みます。' : 'Only dates without an existing YOAKE log will be imported.')
          : t('dataManagement.hcImportFoundDesc'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: healthPlatform === 'apple_health'
              ? (isJa ? '取り込む' : 'Import')
              : t('dataManagement.hcImportConfirmBtn'),
            onPress: async () => {
              setIsImporting(true);
              try {
                const [recentLogs, goal] = await Promise.all([
                  getRecentSleepLogs(30),
                  getGoal(),
                ]);
                const targetHours = goal?.targetHours ?? 7.5;
                const source = getNativeHealthSource();

                for (const { date, data } of candidates) {
                  const logPartial = {
                    date,
                    bedTime: data.bedTime as any,
                    wakeTime: data.wakeTime as any,
                    totalMinutes: data.totalMinutes,
                    deepSleepMinutes: data.deepSleepMinutes,
                    remMinutes: data.remMinutes,
                    lightSleepMinutes: data.lightSleepMinutes,
                    awakenings: data.awakenings,
                    heartRateAvg: data.heartRateAvg,
                    sleepOnset: 'NORMAL' as const,
                    wakeFeeling: 'NORMAL' as const,
                    habits: [],
                    memo: null,
                    source,
                    scoreVersion: SCORE_VERSION,
                  };
                  const { score } = calculateScore(logPartial, recentLogs);
                  const sleepDebtMinutes = calculateSleepDebt(recentLogs.slice(0, 14), targetHours);
                  await saveSleepLog({ ...logPartial, score, sleepDebtMinutes });
                }

                Alert.alert(
                  healthPlatform === 'apple_health'
                    ? (isJa ? `${candidates.length} 日分を取り込みました` : `Imported ${candidates.length} days`)
                    : t('dataManagement.hcImportDone', { count: candidates.length }),
                );
              } catch {
                Alert.alert(
                  t('common.error'),
                  healthPlatform === 'apple_health'
                    ? (isJa ? 'Apple Health データの取り込みに失敗しました。' : 'Failed to import Apple Health data.')
                    : t('dataManagement.hcImportFailed'),
                );
              } finally {
                setIsImporting(false);
              }
            },
          },
        ],
      );
    } catch {
      Alert.alert(
        t('common.error'),
        healthPlatform === 'apple_health'
          ? (isJa ? 'Apple Health データの取り込みに失敗しました。' : 'Failed to import Apple Health data.')
          : t('dataManagement.hcImportFailed'),
      );
    } finally {
      setIsImporting(false);
    }
  };

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
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
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
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{importTitle}</Text>
          <Text style={styles.cardDesc}>{importDesc}</Text>
          <TouchableOpacity
            style={[styles.exportBtn, isImporting && styles.btnDisabled]}
            onPress={handleImportFromHealthData}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.exportBtnText}>{importButtonLabel}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('dataManagement.exportTitle')}</Text>
          <Text style={styles.cardDesc}>{t('dataManagement.exportDesc')}</Text>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.btnDisabled]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.exportBtnText}>{t('dataManagement.exportBtn')}</Text>
            )}
          </TouchableOpacity>
        </View>

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
