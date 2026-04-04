import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { HabitStat } from '../utils/habitStats';
import { useTranslation } from '../../../i18n';
import HabitIcon from '../../../components/common/HabitIcon';

interface Props {
  habitStats: HabitStat[];
  avgScore: number;
  chartWidth: number;
}

const BAR_ZONE_HEIGHT = 128;
const ICON_ZONE_HEIGHT = 42;
const PILL_ZONE_HEIGHT = 34;
const GRID_VALUES = [100, 75, 50, 25];

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

export default function HabitCorrelationCard({ habitStats, avgScore }: Props) {
  const { t } = useTranslation();
  const chartStats: ChartHabitStat[] = habitStats.slice(0, 6).map(stat => {
    const diff = stat.withAvg - stat.withoutAvg;
    return {
      ...stat,
      diff,
      barHeight: Math.max(28, Math.round((stat.withAvg / 100) * BAR_ZONE_HEIGHT)),
    };
  });

  const avgBottom = ICON_ZONE_HEIGHT + Math.round((avgScore / 100) * BAR_ZONE_HEIGHT);

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
              {GRID_VALUES.map(value => {
                const bottom = ICON_ZONE_HEIGHT + Math.round((value / 100) * BAR_ZONE_HEIGHT);
                return (
                  <View key={value} style={[styles.gridRow, { bottom }]}>
                    <Text style={styles.gridLabel}>{value}</Text>
                    <View style={styles.gridLine} />
                  </View>
                );
              })}

              <View style={[styles.averageLine, { bottom: avgBottom }]}>
                <View style={styles.averagePill}>
                  <Text style={styles.averagePillText}>AVG {avgScore}</Text>
                </View>
              </View>

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
    backgroundColor: 'rgba(37, 39, 66, 0.96)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 130, 255, 0.14)',
  },
  cardTitle: {
    fontSize: 13,
    color: '#AEB0D2',
    fontWeight: '600',
    marginBottom: 12,
  },
  cardSubTitle: {
    fontSize: 11,
    color: '#9A9AB8', // WCAG AA対応: #6F738F → #9A9AB8
    marginTop: -8,
    marginBottom: 12,
    lineHeight: 16,
  },
  reportPlaceholder: {
    fontSize: 13,
    color: '#9A9AB8', // WCAG AA対応: #666A86 → #9A9AB8
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
    backgroundColor: 'rgba(15, 17, 34, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#9A9AB8', // WCAG AA対応: #6F738F → #9A9AB8
    fontSize: 9,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(154, 154, 184, 0.10)',
  },
  averageLine: {
    position: 'absolute',
    left: 38,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(143, 130, 255, 0.36)',
  },
  averagePill: {
    position: 'absolute',
    right: 0,
    top: -10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(143, 130, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(143, 130, 255, 0.24)',
  },
  averagePillText: {
    color: '#DCD8FF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  barSlot: {
    height: BAR_ZONE_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    borderRadius: 999,
  },
  iconSlot: {
    height: ICON_ZONE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
