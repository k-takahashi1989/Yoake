import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { HabitStat } from '../utils/habitStats';

interface Props {
  habitStats: HabitStat[];
  avgScore: number;
  chartWidth: number;
}

export default function HabitCorrelationCard({ habitStats, avgScore, chartWidth }: Props) {
  const barData = habitStats.slice(0, 6).map(h => ({
    value: h.withAvg,
    label: h.emoji,
    frontColor: h.withAvg >= avgScore ? '#4CAF50' : '#FF9800',
  }));

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>習慣別スコア影響</Text>
      {habitStats.length === 0 ? (
        <Text style={styles.reportPlaceholder}>
          複数日の習慣チェック記録が溜まると表示されます。
        </Text>
      ) : (
        <>
          <Text style={styles.cardSubTitle}>
            各習慣を実行した日の平均スコア（緑：全体平均以上 / 橙：全体平均未満）
          </Text>
          {barData.length >= 2 ? (
            <View style={{ marginBottom: 12 }}>
              <BarChart
                data={barData}
                width={chartWidth - 16}
                height={140}
                barWidth={28}
                spacing={12}
                noOfSections={4}
                maxValue={100}
                yAxisColor="transparent"
                xAxisColor="#1A1A2E"
                xAxisLabelTextStyle={styles.axisLabelLarge}
                yAxisTextStyle={styles.axisLabel}
                showReferenceLine1
                referenceLine1Position={avgScore}
                referenceLine1Config={{
                  color: '#6B5CE770',
                  thickness: 1,
                  type: 'dashed',
                  dashWidth: 6,
                  dashGap: 4,
                }}
                initialSpacing={12}
                endSpacing={12}
              />
            </View>
          ) : null}
          {habitStats.slice(0, 6).map(h => (
            <HabitCorrelationRow key={h.id} stat={h} />
          ))}
        </>
      )}
    </View>
  );
}

function HabitCorrelationRow({ stat }: { stat: HabitStat }) {
  const diff = stat.withAvg - stat.withoutAvg;
  const diffColor = diff > 2 ? '#4CAF50' : diff < -2 ? '#F44336' : '#888';
  const diffText = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0';

  return (
    <View style={styles.habitRow}>
      <Text style={styles.habitEmoji}>{stat.emoji}</Text>
      <Text style={styles.habitLabel}>{stat.label}</Text>
      <View style={styles.habitScores}>
        {stat.withCount > 0 && (
          <View style={styles.habitScoreChip}>
            <Text style={styles.habitScoreChipLabel}>あり</Text>
            <Text style={styles.habitScoreChipValue}>{stat.withAvg}点</Text>
          </View>
        )}
        {stat.withoutCount > 0 && (
          <View style={[styles.habitScoreChip, styles.habitScoreChipMuted]}>
            <Text style={styles.habitScoreChipLabel}>なし</Text>
            <Text style={[styles.habitScoreChipValue, { color: '#888' }]}>{stat.withoutAvg}点</Text>
          </View>
        )}
        {stat.withCount > 0 && stat.withoutCount > 0 && (
          <Text style={[styles.habitDiff, { color: diffColor }]}>{diffText}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  cardSubTitle: { fontSize: 11, color: '#555', marginTop: -8, marginBottom: 12 },
  reportPlaceholder: { fontSize: 13, color: '#555', lineHeight: 20 },
  axisLabel: { color: '#666', fontSize: 9 },
  axisLabelLarge: { color: '#888', fontSize: 13 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
    gap: 8,
  },
  habitEmoji: { fontSize: 18, width: 28 },
  habitLabel: { fontSize: 13, color: '#FFFFFF', flex: 1 },
  habitScores: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  habitScoreChip: {
    backgroundColor: '#6B5CE720',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#6B5CE740',
    alignItems: 'center',
  },
  habitScoreChipMuted: { backgroundColor: '#1A1A2E', borderColor: '#333' },
  habitScoreChipLabel: { fontSize: 8, color: '#888' },
  habitScoreChipValue: { fontSize: 12, fontWeight: '600', color: '#9C8FFF' },
  habitDiff: { fontSize: 12, fontWeight: '700', minWidth: 28, textAlign: 'right' },
});
