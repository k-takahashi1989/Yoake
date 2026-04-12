import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { DiaryStackParamList, SleepLog } from '../../types';
import { getSleepLog } from '../../services/firebase';
import {
  getImportedHealthSourceLabelKey,
  isHealthDataSource,
} from '../../services/healthData';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { SCORE_COLORS } from '../../constants';
import { i18n, useTranslation } from '../../i18n';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';
import HabitIcon from '../../components/common/HabitIcon';
import { getSleepOnsetLabel, getWakeFeelingLabel } from '../../utils/sleepSubjective';

type Props = NativeStackScreenProps<DiaryStackParamList, 'RecordDetail'>;

export default function RecordDetailScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const reloadLog = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextLog = await getSleepLog(date);
      setLog(nextLog);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      reloadLog();
    }, [reloadLog])
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator color="#6B5CE7" /></View>
      </SafeAreaView>
    );
  }

  if (!log) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>データが見つかりません</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scoreInfo = getScoreInfo(log.score);
  const scoreColor = SCORE_COLORS[scoreInfo.color];
  const dateLabel = format(safeToDate(date), 'M月d日（EEE）', { locale: getDateFnsLocale() });
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;

  const wakeFeelingLabel = getWakeFeelingLabel(log.wakeFeeling, t);
  const sleepOnsetLabel = getSleepOnsetLabel(log.sleepOnset, t);

  const checkedHabits = log.habits.filter(h => h.checked);
  const uncheckedHabits = log.habits.filter(h => !h.checked);
  const actionsTitle = i18n.language === 'ja' ? '記録した行動' : t('recordDetail.habitsTitle');
  const checkedLabel = i18n.language === 'ja' ? '記録あり' : t('recordDetail.habitsChecked');
  const uncheckedLabel = i18n.language === 'ja' ? '記録なし' : t('recordDetail.habitsUnchecked');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{log.score}</Text>
            <Text style={styles.scoreUnit}>点</Text>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '55' }]}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{t(scoreInfo.labelKey)}</Text>
            </View>
          </View>
          <Text style={styles.sourceLabel}>
            {isHealthDataSource(log.source)
              ? t(getImportedHealthSourceLabelKey(log.source))
              : t('common.manualInput')}
          </Text>
        </View>

        {/* 睡眠サマリー */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('recordDetail.summarySectionTitle')}</Text>
          <View style={styles.summaryGrid}>
            <SummaryCell
              label="就寝"
              value={format(safeToDate(log.bedTime), 'HH:mm')}
            />
            <SummaryCell
              label="起床"
              value={format(safeToDate(log.wakeTime), 'HH:mm')}
            />
            <SummaryCell
              label="睡眠時間"
              value={`${hours}h${mins}m`}
            />
            <SummaryCell label={t('recordDetail.wakeFeeling')} value={wakeFeelingLabel} />
            <SummaryCell label={t('recordDetail.sleepOnset')} value={sleepOnsetLabel} />
            {isHealthDataSource(log.source) && log.deepSleepMinutes !== null && (
              <SummaryCell label={t('recordDetail.deepSleep')} value={`${log.deepSleepMinutes}${t('common.minutes')}`} />
            )}
          </View>
        </View>

        {/* 習慣チェック */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{actionsTitle}</Text>

          {checkedHabits.length > 0 && (
            <>
              <Text style={styles.habitGroupLabel}>{checkedLabel}</Text>
              <View style={styles.habitsGrid}>
                {checkedHabits.map(h => (
                  <View key={h.id} style={[styles.habitChip, styles.habitChipChecked]}>
                    <HabitIcon
                      habit={h}
                      size={22}
                      backgroundColor="rgba(107, 92, 231, 0.18)"
                      borderColor="rgba(107, 92, 231, 0.34)"
                      color="#DCD8FF"
                    />
                    <Text style={[styles.habitLabel, styles.habitLabelChecked]}>{h.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {uncheckedHabits.length > 0 && (
            <>
              <Text style={[styles.habitGroupLabel, { marginTop: checkedHabits.length > 0 ? 12 : 0 }]}>
                {uncheckedLabel}
              </Text>
              <View style={styles.habitsGrid}>
                {uncheckedHabits.map(h => (
                  <View key={h.id} style={styles.habitChip}>
                    <HabitIcon
                      habit={h}
                      size={22}
                      backgroundColor="rgba(255,255,255,0.04)"
                      borderColor="#444"
                      color="#9A9AB8"
                    />
                    <Text style={styles.habitLabel}>{h.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {log.habits.length === 0 && (
            <Text style={styles.noHabitsText}>{t('recordDetail.noHabits')}</Text>
          )}
        </View>

        {/* メモ */}
        {log.memo && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('recordDetail.memoTitle')}</Text>
            <Text style={styles.memoText}>{log.memo}</Text>
          </View>
        )}

        {/* 編集ボタン */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('RecordEdit', { date })}
        >
          <Text style={styles.editButtonText}>{t('recordDetail.editButton')}</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryCellLabel}>{label}</Text>
      <Text style={styles.summaryCellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9A9AB8', fontSize: 16 }, // WCAG AA対応: #888 → #9A9AB8
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  dateLabel: { fontSize: 14, color: '#9A9AB8', marginBottom: 8 }, // WCAG AA対応: #888 → #9A9AB8
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  scoreValue: { fontSize: 64, fontWeight: 'bold', lineHeight: 72 },
  scoreUnit: { fontSize: 18, color: '#FFFFFF', marginBottom: 10 },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  scoreBadgeText: { fontSize: 13, fontWeight: '700' },
  sourceLabel: { fontSize: 12, color: '#9A9AB8', marginTop: 4 }, // WCAG AA対応: #666 → #9A9AB8
  card: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, color: '#9A9AB8', fontWeight: '600', marginBottom: 12 }, // WCAG AA対応: #888 → #9A9AB8
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCell: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 10,
    minWidth: '30%',
    flex: 1,
  },
  summaryCellLabel: { fontSize: 11, color: '#9A9AB8', marginBottom: 4 }, // WCAG AA対応: #888 → #9A9AB8
  summaryCellValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  habitGroupLabel: { fontSize: 11, color: '#9A9AB8', marginBottom: 8 }, // WCAG AA対応: #666 → #9A9AB8
  habitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
    gap: 4,
  },
  habitChipChecked: { borderColor: '#6B5CE7', backgroundColor: '#6B5CE715' },
  habitLabel: { fontSize: 12, color: '#9A9AB8' }, // WCAG AA対応: #888 → #9A9AB8
  habitLabelChecked: { color: '#9C8FFF' },
  noHabitsText: { color: '#555', fontSize: 14 },
  memoText: { fontSize: 14, color: '#D0D0E8', lineHeight: 22 },
  editButton: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  editButtonText: { color: '#9C8FFF', fontSize: 15, fontWeight: '600' },
  spacer: { height: 32 },
});
