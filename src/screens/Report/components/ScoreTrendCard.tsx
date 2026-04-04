import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  locked?: boolean;
}

export default function ScoreTrendCard({ monthlyLogs, chartWidth, locked = false }: Props) {
  const { t } = useTranslation();
  const [scorePeriod, setScorePeriod] = useState<ScorePeriod>('7');
  const chartScrollRef = useRef<any>(null);
  const lineData = useMemo(
    () => buildLineData(monthlyLogs, scorePeriod),
    [monthlyLogs, scorePeriod],
  );
  const innerChartWidth = Math.max(chartWidth - 36, 220);

  useEffect(() => {
    const id = setTimeout(() => {
      chartScrollRef.current?.scrollTo?.({ x: 0, animated: false });
    }, 0);

    return () => clearTimeout(id);
  }, [scorePeriod]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{t('report.scoreTrendTitle')}</Text>
        {!locked && (
          <View style={styles.periodChips}>
            {(['7', '14', '30'] as ScorePeriod[]).map(period => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodChip,
                  scorePeriod === period && styles.periodChipActive,
                ]}
                onPress={() => setScorePeriod(period)}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    scorePeriod === period && styles.periodChipTextActive,
                  ]}
                >
                  {period}{t('common.days')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.chartFrame, locked ? styles.lockedChartWrapper : undefined]}>
        {lineData.length >= 2 ? (
          <LineChart
            key={scorePeriod}
            data={lineData}
            width={innerChartWidth}
            height={188}
            scrollRef={chartScrollRef}
            color="#8F82FF"
            thickness={3}
            dataPointsColor="#F3EFFF"
            dataPointsRadius={3}
            startFillColor="#8F82FF"
            endFillColor="#8F82FF"
            startOpacity={0.24}
            endOpacity={0.02}
            areaChart
            hideRules={false}
            rulesColor="rgba(154, 154, 184, 0.12)"
            rulesType="dashed"
            yAxisColor="transparent"
            xAxisColor="rgba(154, 154, 184, 0.18)"
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
            noOfSections={4}
            maxValue={100}
            initialSpacing={10}
            endSpacing={10}
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
    backgroundColor: 'rgba(37, 39, 66, 0.96)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 130, 255, 0.14)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13,
    color: '#AEB0D2',
    fontWeight: '600',
  },
  periodChips: {
    flexDirection: 'row',
    gap: 6,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 18, 36, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  periodChipActive: {
    backgroundColor: 'rgba(143, 130, 255, 0.16)',
    borderColor: 'rgba(143, 130, 255, 0.42)',
  },
  periodChipText: {
    fontSize: 11,
    color: '#9A9AB8', // WCAG AA対応: #747697 → #9A9AB8
  },
  periodChipTextActive: {
    color: '#DCD8FF',
    fontWeight: '600',
  },
  chartFrame: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 17, 34, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  axisLabel: {
    color: '#9A9AB8', // WCAG AA対応: #747697 → #9A9AB8
    fontSize: 9,
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  chartEmptyText: {
    color: '#9A9AB8', // WCAG AA対応: #666A86 → #9A9AB8
    fontSize: 13,
  },
  lockedChartWrapper: {
    overflow: 'hidden',
    borderRadius: 18,
    position: 'relative',
  },
  chartMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 34, 0.78)',
    borderRadius: 18,
  },
});
