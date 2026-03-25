import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SleepLog } from '../../../types';
import { buildLineData, ScorePeriod } from '../utils/habitStats';

interface Props {
  monthlyLogs: SleepLog[];
  chartWidth: number;
}

export default function ScoreTrendCard({ monthlyLogs, chartWidth }: Props) {
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>('7');
  const lineData = useMemo(
    () => buildLineData(monthlyLogs, scorePeriod),
    [monthlyLogs, scorePeriod],
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>スコア推移</Text>
        <View style={styles.periodChips}>
          {(['7', '14', '30'] as ScorePeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, scorePeriod === p && styles.periodChipActive]}
              onPress={() => setScorePeriod(p)}
            >
              <Text style={[styles.periodChipText, scorePeriod === p && styles.periodChipTextActive]}>
                {p}日
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {lineData.length >= 2 ? (
        <LineChart
          data={lineData}
          width={chartWidth}
          height={180}
          color="#6B5CE7"
          dataPointsColor="#6B5CE7"
          dataPointsRadius={4}
          startFillColor="#6B5CE730"
          endFillColor="transparent"
          areaChart
          hideRules={false}
          rulesColor="#1A1A2E"
          rulesType="solid"
          yAxisColor="transparent"
          xAxisColor="#1A1A2E"
          xAxisLabelTextStyle={styles.axisLabel}
          yAxisTextStyle={styles.axisLabel}
          noOfSections={4}
          maxValue={100}
          initialSpacing={16}
          endSpacing={16}
          curved
        />
      ) : (
        <View style={styles.chartEmpty}>
          <Text style={styles.chartEmptyText}>グラフ表示には2件以上のデータが必要です</Text>
        </View>
      )}
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  periodChips: { flexDirection: 'row', gap: 4 },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#444',
  },
  periodChipActive: { backgroundColor: '#6B5CE720', borderColor: '#6B5CE7' },
  periodChipText: { fontSize: 11, color: '#666' },
  periodChipTextActive: { color: '#9C8FFF', fontWeight: '600' },
  axisLabel: { color: '#666', fontSize: 9 },
  chartEmpty: { alignItems: 'center', paddingVertical: 24 },
  chartEmptyText: { color: '#555', fontSize: 13 },
});
