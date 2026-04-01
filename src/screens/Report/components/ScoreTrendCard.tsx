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
import { useTranslation } from '../../../i18n';

interface Props {
  monthlyLogs: SleepLog[];
  chartWidth: number;
  /** true の場合: 期間チップを非表示にし、グラフをマスクで覆う */
  locked?: boolean;
}

export default function ScoreTrendCard({ monthlyLogs, chartWidth, locked = false }: Props) {
  const { t } = useTranslation();
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>('7');
  const lineData = useMemo(
    () => buildLineData(monthlyLogs, scorePeriod),
    [monthlyLogs, scorePeriod],
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{t('report.scoreTrendTitle')}</Text>
        {/* locked=true の場合は期間チップを非表示 */}
        {!locked && (
          <View style={styles.periodChips}>
            {(['7', '14', '30'] as ScorePeriod[]).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodChip, scorePeriod === p && styles.periodChipActive]}
                onPress={() => setScorePeriod(p)}
              >
                <Text style={[styles.periodChipText, scorePeriod === p && styles.periodChipTextActive]}>
                  {p}{t('common.days')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {/* locked=true の場合はグラフをマスクで覆う */}
      <View style={locked ? styles.lockedChartWrapper : undefined}>
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
            <Text style={styles.chartEmptyText}>{t('report.chartNoData')}</Text>
          </View>
        )}
        {locked && <View style={styles.chartMask} />}
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, color: '#9A9AB8', fontWeight: '600', marginBottom: 12 },
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
  // locked=true 時のグラフラッパー・マスク
  lockedChartWrapper: {
    overflow: 'hidden',
    borderRadius: 8,
    position: 'relative',
  },
  chartMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.82)',
    borderRadius: 8,
  },
});
