import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { HomeStackParamList, SleepLog } from '../../types';
import { getSleepLog } from '../../services/firebase';
import { getScoreInfo, calculateScore } from '../../utils/scoreCalculator';
import { SCORE_COLORS } from '../../constants';
import { safeToDate } from '../../utils/dateUtils';

type Props = NativeStackScreenProps<HomeStackParamList, 'ScoreDetail'>;

export default function ScoreDetailScreen({ route }: Props) {
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
        <View style={styles.center}>
          <ActivityIndicator color="#6B5CE7" />
        </View>
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
  const isHC = log.source === 'HEALTH_CONNECT';

  // breakdown を再計算（表示用）
  const { breakdown } = calculateScore(log, []);

  const dateLabel = format(new Date(date.replace(/-/g, '/')), 'M月d日（EEE）', { locale: ja });
  const bedStr = format(safeToDate(log.bedTime), 'HH:mm');
  const wakeStr = format(safeToDate(log.wakeTime), 'HH:mm');
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* スコアサマリー */}
        <View style={styles.header}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{log.score}</Text>
            <Text style={styles.scoreUnit}>点</Text>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '55' }]}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{scoreInfo.label}</Text>
            </View>
          </View>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceText}>
              {isHC ? '❤️ Health Connect' : '✏️ 手動入力'}
            </Text>
          </View>
        </View>

        {/* 基本データ */}
        <SectionCard title="基本データ">
          <DataRow label="就寝" value={bedStr} />
          <DataRow label="起床" value={wakeStr} />
          <DataRow label="睡眠時間" value={`${hours}時間${mins}分`} />
          <DataRow
            label="目覚め"
            value={{ GOOD: 'すっきり 😊', NORMAL: 'ふつう 😐', BAD: 'つらい 😩' }[log.wakeFeeling]}
          />
          <DataRow
            label="寝つき"
            value={{ FAST: 'すぐ寝れた 😴', NORMAL: '少し時間かかった 😐', SLOW: 'なかなか寝れなかった 😫' }[log.sleepOnset]}
          />
        </SectionCard>

        {/* Health Connect データ */}
        {isHC && log.deepSleepMinutes !== null && (
          <SectionCard title="睡眠ステージ">
            <DataRow label="深睡眠" value={`${log.deepSleepMinutes}分`} />
            <DataRow label="レム睡眠" value={`${log.remMinutes ?? 0}分`} />
            <DataRow label="浅い睡眠" value={`${log.lightSleepMinutes ?? 0}分`} />
            <DataRow label="覚醒回数" value={`${log.awakenings ?? 0}回`} />
            {log.heartRateAvg && <DataRow label="心拍数（平均）" value={`${log.heartRateAvg} bpm`} />}
          </SectionCard>
        )}

        {/* スコア内訳 */}
        <SectionCard title="スコア内訳">
          <ScoreBar
            label="睡眠時間"
            score={breakdown.sleepDuration}
            maxScore={isHC ? 30 : 40}
          />
          <ScoreBar
            label="就寝時刻"
            score={breakdown.bedTime}
            maxScore={isHC ? 20 : 25}
          />
          {isHC && (
            <ScoreBar label="深睡眠割合" score={breakdown.deepSleep} maxScore={15} />
          )}
          <ScoreBar
            label="目覚め主観"
            score={breakdown.wakeFeeling}
            maxScore={isHC ? 15 : 20}
          />
          {isHC && (
            <ScoreBar label="睡眠連続性" score={breakdown.continuity} maxScore={10} />
          )}
          <ScoreBar
            label="寝つき主観"
            score={breakdown.sleepOnset}
            maxScore={isHC ? 10 : 15}
          />
          {breakdown.consistencyBonus !== 0 && (
            <ScoreBar
              label="就寝時刻の一定さ"
              score={breakdown.consistencyBonus}
              maxScore={5}
              allowNegative
            />
          )}
          {breakdown.oversleepPenalty !== 0 && (
            <ScoreBar
              label="寝過ぎペナルティ"
              score={breakdown.oversleepPenalty}
              maxScore={0}
              allowNegative
            />
          )}
        </SectionCard>

        {/* 習慣 */}
        {log.habits.length > 0 && (
          <SectionCard title="習慣チェック">
            <View style={styles.habitsGrid}>
              {log.habits.map(h => (
                <View
                  key={h.id}
                  style={[styles.habitChip, h.checked && styles.habitChipChecked]}
                >
                  <Text style={styles.habitEmoji}>{h.emoji}</Text>
                  <Text style={[styles.habitLabel, h.checked && styles.habitLabelChecked]}>
                    {h.label}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>
        )}

        {/* メモ */}
        {log.memo && (
          <SectionCard title="メモ">
            <Text style={styles.memoText}>{log.memo}</Text>
          </SectionCard>
        )}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function ScoreBar({
  label,
  score,
  maxScore,
  allowNegative = false,
}: {
  label: string;
  score: number;
  maxScore: number;
  allowNegative?: boolean;
}) {
  const isNegative = score < 0;
  const displayMax = maxScore === 0 ? Math.abs(score) : maxScore;
  const progress = displayMax > 0 ? Math.abs(score) / displayMax : 0;
  const barColor = isNegative ? '#F44336' : '#6B5CE7';

  return (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarLeft}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <View style={styles.scoreBarTrack}>
          <View
            style={[
              styles.scoreBarFill,
              { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.scoreBarValue, isNegative && { color: '#F44336' }]}>
        {isNegative ? score : `+${score}`}/{maxScore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#888', fontSize: 16 },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  dateLabel: { fontSize: 14, color: '#888', marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  scoreValue: { fontSize: 72, fontWeight: 'bold', lineHeight: 80 },
  scoreUnit: { fontSize: 20, color: '#FFFFFF', marginBottom: 12 },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  scoreBadgeText: { fontSize: 14, fontWeight: '700' },
  sourceRow: { marginTop: 4 },
  sourceText: { fontSize: 12, color: '#666' },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff08',
  },
  dataLabel: { fontSize: 14, color: '#B0B0C8' },
  dataValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  scoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  scoreBarLeft: { flex: 1 },
  scoreBarLabel: { fontSize: 12, color: '#B0B0C8', marginBottom: 4 },
  scoreBarTrack: {
    height: 6,
    backgroundColor: '#1A1A2E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: { height: 6, borderRadius: 3 },
  scoreBarValue: { fontSize: 12, color: '#6B5CE7', fontWeight: '600', minWidth: 40, textAlign: 'right' },
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
  memoText: { fontSize: 14, color: '#D0D0E8', lineHeight: 22 },
  spacer: { height: 32 },
});
