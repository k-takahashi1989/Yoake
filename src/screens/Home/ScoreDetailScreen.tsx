import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { SleepLog } from '../../types';

// HomeStack / DiaryStack 両方で使える共通型
function useCountUp(target: number, duration = 700, delay = 0): number {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(new Animated.Value(0));
  useEffect(() => {
    const anim = animRef.current;
    anim.setValue(0);
    setDisplay(0);
    const listenerId = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => {
      clearTimeout(timer);
      anim.removeListener(listenerId);
    };
  }, [delay, duration, target]);
  return display;
}

type SharedParamList = {
  ScoreDetail: { date: string; scoreColor?: string };
  RecordEdit: { date: string };
};
import { i18n, useTranslation } from '../../i18n';
import { getSleepLog } from '../../services/firebase';
import { getScoreInfo, calculateScore } from '../../utils/scoreCalculator';
import { SCORE_COLORS } from '../../constants';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';

type Props = NativeStackScreenProps<SharedParamList, 'ScoreDetail'>;

export default function ScoreDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { date, scoreColor: routeScoreColor } = route.params;
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAnimatingBack = useRef(false);
  const gradientAnim = useRef(new Animated.Value(0)).current;
  // stagger: header=0, card0..N
  const STAGGER_COUNT = 5;
  const staggerAnims = useRef(
    Array.from({ length: STAGGER_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (isAnimatingBack.current) return;
      e.preventDefault();
      isAnimatingBack.current = true;
      Animated.parallel([
        Animated.stagger(
          50,
          [...staggerAnims].reverse().map(a =>
            Animated.timing(a, {
              toValue: 0,
              duration: 250,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            })
          )
        ),
        Animated.timing(gradientAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation, gradientAnim, staggerAnims]);

  useEffect(() => {
    getSleepLog(date)
      .then(l => setLog(l))
      .finally(() => setIsLoading(false));
  }, [date]);

  // A: gradient fade-in on mount
  useEffect(() => {
    Animated.timing(gradientAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [gradientAnim]);

  // B: staggered content fade-in after data loads
  useEffect(() => {
    if (!isLoading) {
      Animated.stagger(
        80,
        staggerAnims.map(a =>
          Animated.timing(a, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [isLoading, staggerAnims]);

  // フックは early return より前に呼ぶ（Rules of Hooks）
  const displayScore = useCountUp(log?.score ?? 0, 700, 300);

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
  const bgColor = routeScoreColor ?? scoreColor;
  const isHC = log.source === 'HEALTH_CONNECT';

  // breakdown を再計算（表示用）
  const { breakdown } = calculateScore(log, []);

  const dateLabel = format(safeToDate(date), 'M月d日（EEE）', { locale: getDateFnsLocale() });
  const bedStr = format(safeToDate(log.bedTime), 'HH:mm');
  const wakeStr = format(safeToDate(log.wakeTime), 'HH:mm');
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;
  const actionsTitle = i18n.language === 'ja' ? '記録した行動' : t('scoreDetail.habitsTitle');

  const gradientStyle = {
    opacity: gradientAnim,
  };

  const animatedCard = (index: number, child: React.ReactNode) => {
    const anim = staggerAnims[index] ?? staggerAnims[STAGGER_COUNT - 1];
    return (
      <Animated.View
        key={index}
        style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}
      >
        {child}
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D1A' }}>
      {/* A: gradient overlay がフェードインする */}
      <Animated.View style={[StyleSheet.absoluteFill, gradientStyle]} pointerEvents="none">
        <LinearGradient
          colors={[bgColor, bgColor + 'CC', '#0D0D1A']}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* スコアサマリー */}
        {animatedCard(0, <View
          style={[styles.header, { backgroundColor: bgColor + '33', borderBottomColor: bgColor + '55', borderBottomWidth: 1 }]}
        >
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreValueWrap}>
              <Text style={styles.scoreValue}>{displayScore}</Text>
            </View>
            <Text style={styles.scoreUnit}>{t('common.points')}</Text>
            <View style={[styles.scoreBadge, { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.5)' }]}>
              <Text style={[styles.scoreBadgeText, { color: '#FFFFFF' }]}>{t(scoreInfo.labelKey)}</Text>
            </View>
          </View>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceText}>
              {isHC ? '❤️ Health Connect' : '✏️ 手動入力'}
            </Text>
          </View>
        </View>)}

        {/* 基本データ */}
        {animatedCard(1, <SectionCard title={t('scoreDetail.basicDataTitle')}>
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
        </SectionCard>)}

        {/* Health Connect データ */}
        {isHC && log.deepSleepMinutes !== null &&
          animatedCard(2, <SectionCard title={t('scoreDetail.sleepStageTitle')}>
            <DataRow label={t('scoreDetail.deepSleep')} value={`${log.deepSleepMinutes}${t('common.minutes')}`} />
            <DataRow label={t('scoreDetail.remSleep')} value={`${log.remMinutes ?? 0}${t('common.minutes')}`} />
            <DataRow label={t('scoreDetail.lightSleep')} value={`${log.lightSleepMinutes ?? 0}${t('common.minutes')}`} />
            <DataRow label={t('scoreDetail.awakenings')} value={`${log.awakenings ?? 0}${t('common.times')}`} />
            {log.heartRateAvg && <DataRow label={t('scoreDetail.heartRate')} value={`${log.heartRateAvg} bpm`} />}
          </SectionCard>)
        }

        {/* スコア内訳 */}
        {animatedCard(3, <SectionCard title={t('scoreDetail.scoreBreakdownTitle')}>
          <ScoreBar
            label={t('scoreDetail.durationLabel')}
            score={breakdown.sleepDuration}
            maxScore={isHC ? 30 : 40}
            delay={0}
          />
          <ScoreBar
            label={t('scoreDetail.bedTimeLabel')}
            score={breakdown.bedTime}
            maxScore={isHC ? 20 : 25}
            delay={80}
          />
          {isHC && (
            <ScoreBar label={t('scoreDetail.deepSleepLabel')} score={breakdown.deepSleep} maxScore={15} delay={160} />
          )}
          <ScoreBar
            label={t('scoreDetail.wakeFeelingLabel')}
            score={breakdown.wakeFeeling}
            maxScore={isHC ? 15 : 20}
            delay={isHC ? 240 : 160}
          />
          {isHC && (
            <ScoreBar label={t('scoreDetail.continuityLabel')} score={breakdown.continuity} maxScore={10} delay={320} />
          )}
          <ScoreBar
            label={t('scoreDetail.sleepOnsetLabel')}
            score={breakdown.sleepOnset}
            maxScore={isHC ? 10 : 15}
            delay={isHC ? 400 : 240}
          />
          {breakdown.consistencyBonus !== 0 && (
            <ScoreBar
              label={t('scoreDetail.consistencyLabel')}
              score={breakdown.consistencyBonus}
              maxScore={5}
              allowNegative
              delay={isHC ? 480 : 320}
            />
          )}
          {breakdown.oversleepPenalty !== 0 && (
            <ScoreBar
              label={t('scoreDetail.oversleepLabel')}
              score={breakdown.oversleepPenalty}
              maxScore={0}
              allowNegative
              delay={isHC ? 560 : 400}
            />
          )}
        </SectionCard>)}

        {/* 習慣・メモ */}
        {animatedCard(4, <>
          {log.habits.length > 0 && (
            <SectionCard title={actionsTitle}>
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
          {log.memo && (
            <SectionCard title={t('scoreDetail.memoTitle')}>
              <Text style={styles.memoText}>{log.memo}</Text>
            </SectionCard>
          )}
        </>)}

        {/* 編集ボタン */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('RecordEdit', { date })}
        >
          <Text style={styles.editButtonText}>✏️ {t('recordDetail.editButton').replace('✏️ ', '')}</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>

    </View>
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
  allowNegative: _allowNegative = false,
  delay = 0,
}: {
  label: string;
  score: number;
  maxScore: number;
  allowNegative?: boolean;
  delay?: number;
}) {
  const isNegative = score < 0;
  const displayMax = maxScore === 0 ? Math.abs(score) : maxScore;
  const progress = displayMax > 0 ? Math.min(Math.abs(score) / displayMax, 1) : 0;
  const barColor = isNegative ? '#F44336' : '#6B5CE7';
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: progress,
      duration: 550,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animWidth, delay, progress]);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.scoreBarRow}>
      <View style={styles.scoreBarLeft}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <View style={styles.scoreBarTrack}>
          <Animated.View
            style={[
              styles.scoreBarFill,
              { width: widthInterpolated, backgroundColor: barColor },
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
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9A9AB8', fontSize: 16 },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  dateLabel: { fontSize: 14, color: '#9A9AB8', marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  scoreValueWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreValue: { fontSize: 80, fontFamily: 'KiwiMaru-Regular', color: '#FFFFFF', lineHeight: 96, includeFontPadding: false },
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
  cardTitle: { fontSize: 13, color: '#9A9AB8', fontWeight: '600', marginBottom: 12 },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ffffff08',
  },
  dataLabel: { fontSize: 14, color: '#B0B0C8' },
  dataValue: { fontSize: 14, color: '#FFFFFF', fontFamily: 'ZenKurenaido-Regular' },
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
  habitLabel: { fontSize: 12, color: '#9A9AB8' },
  habitLabelChecked: { color: '#9C8FFF' },
  memoText: { fontSize: 14, color: '#D0D0E8', lineHeight: 22, fontFamily: 'ZenKurenaido-Regular' },
  spacer: { height: 32 },
  editButton: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2D2D44',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6B5CE755',
  },
  editButtonText: {
    color: '#9C8FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
