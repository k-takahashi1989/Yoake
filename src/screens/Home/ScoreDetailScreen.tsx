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
import { HomeStackParamList, SleepLog } from '../../types';
import { useTranslation } from '../../i18n';
import { getSleepLog } from '../../services/firebase';
import { getScoreInfo, calculateScore } from '../../utils/scoreCalculator';
import { SCORE_COLORS } from '../../constants';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';

type Props = NativeStackScreenProps<HomeStackParamList, 'ScoreDetail'>;

export default function ScoreDetailScreen({ route }: Props) {
  const { t } = useTranslation();
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
          <Text style={styles.emptyText}>{t('common.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scoreInfo = getScoreInfo(log.score);
  const scoreColor = SCORE_COLORS[scoreInfo.color];
  const isHC = log.source === 'HEALTH_CONNECT';

  // breakdown を再計算（表示用）
  const { breakdown } = calculateScore(log, []);

  const dateLabel = format(safeToDate(date), 'M月d日（EEE）', { locale: getDateFnsLocale() });
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
            <Text style={styles.scoreUnit}>{t('common.points')}</Text>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '55' }]}>
              <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{t(scoreInfo.labelKey)}</Text>
            </View>
          </View>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceText}>
              {isHC ? '❤️ Health Connect' : '✏️ 手動入力'}
            </Text>
          </View>
        </View>

        {/* 基本データ */}
        <SectionCard title={t('scoreDetail.basicDataTitle')}>
          <DataRow label={t('common.bedTime')} value={bedStr} />
          <DataRow label={t('common.wakeTime')} value={wakeStr} />
          <DataRow label={t('common.sleepDuration')} value={`${hours}${t('common.hours')}${mins}${t('common.minutes')}`} />
          <DataRow
            label={t('scoreDetail.wakeFeeling')}
            value={{
              GOOD: t('common.wakeFeeling.good'),
              NORMAL: t('common.wakeFeeling.normal'),
              BAD: t('common.wakeFeeling.bad'),
            }[log.wakeFeeling]}
          />
          <DataRow
            label={t('scoreDetail.sleepOnset')}
            value={{
              FAST: t('common.sleepOnset.fast'),
              NORMAL: t('common.sleepOnset.normal'),
              SLOW: t('common.sleepOnset.slow'),
            }[log.sleepOnset]}
          />
        </SectionCard>

        {/* Health Connect データ */}
        {isHC && log.deepSleepMinutes !== null && (
          <SectionCard title={t('scoreDetail.sleepStageTitle')}>
            <DataRow label={t('scoreDetail.deepSleep')} value={`${log.deepSleepMinutes}${t('common.minutes')}`} />
            <DataRow label={t('scoreDetail.remSleep')} value={`${log.remMinutes ?? 0}${t('common.minutes')}`} />
            <DataRow label={t('scoreDetail.lightSleep')} value={`${log.lightSleepMinutes ?? 0}${t('common.minutes')}`} />
            <DataRow label={t('scoreDetail.awakenings')} value={`${log.awakenings ?? 0}${t('common.times')}`} />
            {log.heartRateAvg && <DataRow label={t('scoreDetail.heartRate')} value={`${log.heartRateAvg} bpm`} />}
          </SectionCard>
        )}

        {/* スコア内訳 */}
        <SectionCard title={t('scoreDetail.scoreBreakdownTitle')}>
          <ScoreBar
            label={t('scoreDetail.durationLabel')}
            score={breakdown.sleepDuration}
            maxScore={isHC ? 30 : 40}
          />
          <ScoreBar
            label={t('scoreDetail.bedTimeLabel')}
            score={breakdown.bedTime}
            maxScore={isHC ? 20 : 25}
          />
          {isHC && (
            <ScoreBar label={t('scoreDetail.deepSleepLabel')} score={breakdown.deepSleep} maxScore={15} />
          )}
          <ScoreBar
            label={t('scoreDetail.wakeFeelingLabel')}
            score={breakdown.wakeFeeling}
            maxScore={isHC ? 15 : 20}
          />
          {isHC && (
            <ScoreBar label={t('scoreDetail.continuityLabel')} score={breakdown.continuity} maxScore={10} />
          )}
          <ScoreBar
            label={t('scoreDetail.sleepOnsetLabel')}
            score={breakdown.sleepOnset}
            maxScore={isHC ? 10 : 15}
          />
          {breakdown.consistencyBonus !== 0 && (
            <ScoreBar
              label={t('scoreDetail.consistencyLabel')}
              score={breakdown.consistencyBonus}
              maxScore={5}
              allowNegative
            />
          )}
          {breakdown.oversleepPenalty !== 0 && (
            <ScoreBar
              label={t('scoreDetail.oversleepLabel')}
              score={breakdown.oversleepPenalty}
              maxScore={0}
              allowNegative
            />
          )}
        </SectionCard>

        {/* 習慣 */}
        {log.habits.length > 0 && (
          <SectionCard title={t('scoreDetail.habitsTitle')}>
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
          <SectionCard title={t('scoreDetail.memoTitle')}>
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
