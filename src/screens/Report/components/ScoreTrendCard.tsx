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
import { MORNING_THEME } from '../../../theme/morningTheme';

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
  const DOT_RADIUS = 4;
  const EDGE_PADDING = DOT_RADIUS + 8; // ドットが確実に収まる余白
  const innerChartWidth = Math.max(chartWidth - 32, 220);
  const pointSpacing =
    lineData.length > 1
      ? Math.floor((innerChartWidth - EDGE_PADDING * 2) / (lineData.length - 1))
      : 50;

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
            height={200}
            scrollRef={chartScrollRef}
            color={MORNING_THEME.goldStrong}
            thickness={2.5}
            dataPointsColor={MORNING_THEME.goldStrong}
            dataPointsRadius={DOT_RADIUS}
            startFillColor={MORNING_THEME.goldStrong}
            endFillColor={MORNING_THEME.goldStrong}
            startOpacity={0.28}
            endOpacity={0.02}
            areaChart
            hideRules={false}
            rulesColor="rgba(165, 182, 197, 0.14)"
            rulesType="dashed"
            yAxisColor="transparent"
            xAxisColor="rgba(165, 182, 197, 0.18)"
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
            noOfSections={4}
            maxValue={100}
            spacing={pointSpacing}
            initialSpacing={EDGE_PADDING}
            endSpacing={EDGE_PADDING}
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
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderStrong,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    color: MORNING_THEME.goldStrong,
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
    backgroundColor: MORNING_THEME.surfaceSoft,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  periodChipActive: {
    backgroundColor: MORNING_THEME.goldSurface,
    borderColor: MORNING_THEME.goldBorder,
  },
  periodChipText: {
    fontSize: 12,
    color: MORNING_THEME.textMuted,
  },
  periodChipTextActive: {
    color: MORNING_THEME.goldText,
    fontWeight: '600',
  },
  chartFrame: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: MORNING_THEME.surfaceGlass,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  axisLabel: {
    color: MORNING_THEME.textMuted,
    fontSize: 10,
  },
  chartEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  chartEmptyText: {
    color: MORNING_THEME.textMuted,
    fontSize: 13,
  },
  lockedChartWrapper: {
    overflow: 'hidden',
    borderRadius: 18,
    position: 'relative',
  },
  chartMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 27, 41, 0.82)',
    borderRadius: 18,
  },
});
