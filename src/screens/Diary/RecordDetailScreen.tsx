import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { DiaryStackParamList, SleepLog } from '../../types';
import { getSleepLog } from '../../services/firebase';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { SCORE_COLORS } from '../../constants';

type Props = NativeStackScreenProps<DiaryStackParamList, 'RecordDetail'>;

function safeToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts;
  if (typeof ts.toDate === 'function') {
    const d: Date = ts.toDate();
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  return new Date();
}

export default function RecordDetailScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSleepLog(date)
      .then(l => setLog(l))
      .finally(() => setIsLoading(false));
  }, [date]);

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
  const scoreColor = SCORE_COLORS[scoreInfo.color.toUpperCase() as keyof typeof SCORE_COLORS];
  const dateLabel = format(new Date(date.replace(/-/g, '/')), 'M月d日（EEE）', { locale: ja });
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;

  const wakeFeelingLabel = { GOOD: 'すっきり 😊', NORMAL: 'ふつう 😐', BAD: 'つらい 😩' }[log.wakeFeeling];
  const sleepOnsetLabel = { FAST: 'すぐ寝れた 😴', NORMAL: '少し時間かかった 😐', SLOW: 'なかなか寝れなかった 😫' }[log.sleepOnset];

  const checkedHabits = log.habits.filter(h => h.checked);
  const uncheckedHabits = log.habits.filter(h => !h.checked);

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
              <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{scoreInfo.label}</Text>
            </View>
          </View>
          <Text style={styles.sourceLabel}>
            {log.source === 'HEALTH_CONNECT' ? '❤️ Health Connect' : '✏️ 手動入力'}
          </Text>
        </View>

        {/* 睡眠サマリー */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>睡眠サマリー</Text>
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
            <SummaryCell label="目覚め" value={wakeFeelingLabel} />
            <SummaryCell label="寝つき" value={sleepOnsetLabel} />
            {log.source === 'HEALTH_CONNECT' && log.deepSleepMinutes !== null && (
              <SummaryCell label="深睡眠" value={`${log.deepSleepMinutes}分`} />
            )}
          </View>
        </View>

        {/* 習慣チェック */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>習慣チェック</Text>

          {checkedHabits.length > 0 && (
            <>
              <Text style={styles.habitGroupLabel}>チェックあり</Text>
              <View style={styles.habitsGrid}>
                {checkedHabits.map(h => (
                  <View key={h.id} style={[styles.habitChip, styles.habitChipChecked]}>
                    <Text style={styles.habitEmoji}>{h.emoji}</Text>
                    <Text style={[styles.habitLabel, styles.habitLabelChecked]}>{h.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {uncheckedHabits.length > 0 && (
            <>
              <Text style={[styles.habitGroupLabel, { marginTop: checkedHabits.length > 0 ? 12 : 0 }]}>
                チェックなし
              </Text>
              <View style={styles.habitsGrid}>
                {uncheckedHabits.map(h => (
                  <View key={h.id} style={styles.habitChip}>
                    <Text style={styles.habitEmoji}>{h.emoji}</Text>
                    <Text style={styles.habitLabel}>{h.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {log.habits.length === 0 && (
            <Text style={styles.noHabitsText}>習慣データなし</Text>
          )}
        </View>

        {/* メモ */}
        {log.memo && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>メモ</Text>
            <Text style={styles.memoText}>{log.memo}</Text>
          </View>
        )}

        {/* 編集ボタン */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('RecordEdit', { date })}
        >
          <Text style={styles.editButtonText}>✏️ この記録を編集する</Text>
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
  emptyText: { color: '#888', fontSize: 16 },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  dateLabel: { fontSize: 14, color: '#888', marginBottom: 8 },
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
  sourceLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCell: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 10,
    minWidth: '30%',
    flex: 1,
  },
  summaryCellLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  summaryCellValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  habitGroupLabel: { fontSize: 11, color: '#666', marginBottom: 8 },
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
  habitEmoji: { fontSize: 14 },
  habitLabel: { fontSize: 12, color: '#888' },
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
