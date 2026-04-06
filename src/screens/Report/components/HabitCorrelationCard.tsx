import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { HabitStat } from '../utils/habitStats';
import { useTranslation } from '../../../i18n';
import HabitIcon from '../../../components/common/HabitIcon';
import { MORNING_THEME } from '../../../theme/morningTheme';

interface Props {
  habitStats: HabitStat[];
  avgScore: number;
  chartWidth: number;
}

const BAR_ZONE_HEIGHT = 128;
const ICON_ZONE_HEIGHT = 42;
const PILL_ZONE_HEIGHT = 34;
const GRID_STEP = 5;
const MIN_VISIBLE_RANGE = 20;

type ChartHabitStat = HabitStat & {
  diff: number;
  barHeight: number;
};

function getBarColors(diff: number): string[] {
  if (diff < -2) {
    return ['#FFBE6D', '#F18B2D'];
  }

  if (diff > 2) {
    return ['#43D4C8', '#2B88B8'];
  }

  return ['#8792C5', '#5F699B'];
}

function getDiffTone(diff: number) {
  if (diff < -2) {
    return {
      backgroundColor: 'rgba(255, 190, 109, 0.16)',
      borderColor: 'rgba(255, 190, 109, 0.26)',
      color: '#FFCF91',
    };
  }

  if (diff > 2) {
    return {
      backgroundColor: 'rgba(67, 212, 200, 0.16)',
      borderColor: 'rgba(67, 212, 200, 0.24)',
      color: '#9BF0E7',
    };
  }

  return {
    backgroundColor: 'rgba(143, 147, 179, 0.14)',
    borderColor: 'rgba(143, 147, 179, 0.22)',
    color: '#C3C8E9',
  };
}

function floorToStep(value: number, step: number) {
  return Math.floor(value / step) * step;
}

function ceilToStep(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function buildChartRange(values: number[]) {
  const minScore = Math.min(...values);
  const maxScore = Math.max(...values);

  let minValue = Math.max(0, floorToStep(minScore - GRID_STEP, GRID_STEP));
  let maxValue = Math.min(100, ceilToStep(maxScore + GRID_STEP, GRID_STEP));

  if (maxValue - minValue < MIN_VISIBLE_RANGE) {
    const missingRange = MIN_VISIBLE_RANGE - (maxValue - minValue);
    const paddingSteps = Math.ceil(missingRange / 2 / GRID_STEP) * GRID_STEP;

    minValue -= paddingSteps;
    maxValue += paddingSteps;

    if (minValue < 0) {
      maxValue = Math.min(100, maxValue + Math.abs(minValue));
      minValue = 0;
    }

    if (maxValue > 100) {
      minValue = Math.max(0, minValue - (maxValue - 100));
      maxValue = 100;
    }
  }

  const range = Math.max(GRID_STEP, maxValue - minValue);
  const gridValues = Array.from(
    { length: Math.floor(range / GRID_STEP) + 1 },
    (_, index) => maxValue - index * GRID_STEP,
  ).filter(value => value >= minValue);

  return {
    minValue,
    range,
    gridValues,
  };
}

export default function HabitCorrelationCard({ habitStats, avgScore }: Props) {
  const { t } = useTranslation();
  const rawStats = habitStats.slice(0, 6).map(stat => ({
    ...stat,
    diff: stat.withAvg - stat.withoutAvg,
  }));

  const chartValues = rawStats.length > 0
    ? [...rawStats.map(stat => stat.withAvg), avgScore]
    : [avgScore];
  const { minValue, range, gridValues } = buildChartRange(chartValues);

  const toBarHeight = (score: number) =>
    Math.max(8, Math.round(((score - minValue) / range) * BAR_ZONE_HEIGHT));

  const chartStats: ChartHabitStat[] = rawStats.map(stat => ({
    ...stat,
    barHeight: toBarHeight(stat.withAvg),
  }));

  const avgBottom = ICON_ZONE_HEIGHT + Math.round(((avgScore - minValue) / range) * BAR_ZONE_HEIGHT);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('report.habitCorrelationTitle')}</Text>
      {chartStats.length === 0 ? (
        <Text style={styles.reportPlaceholder}>{t('report.habitCorrelationEmpty')}</Text>
      ) : (
        <>
          <Text style={styles.cardSubTitle}>{t('report.habitCorrelationSub')}</Text>

          <View style={styles.chartFrame}>
            <View style={styles.chartSurface}>
              {gridValues.map(value => {
                const bottom = ICON_ZONE_HEIGHT + Math.round(((value - minValue) / range) * BAR_ZONE_HEIGHT);
                return (
                  <View key={value} style={[styles.gridRow, { bottom }]}>
                    <Text style={styles.gridLabel}>{value}</Text>
                    <View style={styles.gridLine} />
                  </View>
                );
              })}

              <View style={[styles.averageLine, { bottom: avgBottom }]} />

              <View style={styles.columnsRow}>
                {chartStats.map(stat => {
                  const diffTone = getDiffTone(stat.diff);
                  const diffText = stat.diff > 0 ? `+${stat.diff}` : `${stat.diff}`;

                  return (
                    <View key={stat.id} style={styles.column}>
                      <View
                        style={[
                          styles.diffPill,
                          {
                            backgroundColor: diffTone.backgroundColor,
                            borderColor: diffTone.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.diffPillText, { color: diffTone.color }]}>
                          {diffText}
                        </Text>
                      </View>

                      <View style={styles.barSlot}>
                        <LinearGradient
                          colors={getBarColors(stat.diff)}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          style={[styles.bar, { height: stat.barHeight }]}
                        />
                      </View>

                      <View style={styles.iconSlot}>
                        <HabitIcon habit={stat} size={28} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </>
      )}
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
  cardTitle: {
    fontSize: 15,
    color: MORNING_THEME.goldStrong,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardSubTitle: {
    fontSize: 11,
    color: MORNING_THEME.textMuted,
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 16,
  },
  reportPlaceholder: {
    fontSize: 13,
    color: MORNING_THEME.textMuted,
    lineHeight: 20,
  },
  chartFrame: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  chartSurface: {
    height: PILL_ZONE_HEIGHT + BAR_ZONE_HEIGHT + ICON_ZONE_HEIGHT + 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
    backgroundColor: MORNING_THEME.surfaceGlass,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
    position: 'relative',
  },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  gridLabel: {
    width: 24,
    color: MORNING_THEME.textMuted,
    fontSize: 10,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(165, 182, 197, 0.12)',
  },
  averageLine: {
    position: 'absolute',
    left: 38,
    right: 14,
    height: 1,
    backgroundColor: MORNING_THEME.goldBorder,
  },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 30,
    marginRight: 6,
    marginTop: 2,
    height: PILL_ZONE_HEIGHT + BAR_ZONE_HEIGHT + ICON_ZONE_HEIGHT,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  diffPill: {
    minWidth: 34,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'center',
  },
  diffPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  barSlot: {
    height: BAR_ZONE_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  iconSlot: {
    height: ICON_ZONE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
