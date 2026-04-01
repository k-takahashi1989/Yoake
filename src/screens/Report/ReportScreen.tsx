import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Animated,
  Easing,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { SLEEP_LOG_FETCH_LIMIT, SUBSCRIPTION } from '../../constants';
import { useTranslation } from '../../i18n';
import {
  getRecentSleepLogs,
  getAiReport,
  saveAiReport,
  getGoal,
  getPastWeeklyReports,
} from '../../services/firebase';
import { generateWeeklyReport, SleepStats } from '../../services/claudeApi';
import { SleepLog, AiReport } from '../../types';
import { computeHabitStats, HabitStat } from './utils/habitStats';
import ScoreTrendCard from './components/ScoreTrendCard';
import WeeklyReportCard from './components/WeeklyReportCard';
import HabitCorrelationCard from './components/HabitCorrelationCard';
import LockedContentOverlay from './components/LockedContentOverlay';

// ============================================================
// ヘルパー型
// ============================================================

type Tab = 'weekly' | 'monthly';

// ============================================================
// メイン画面
// ============================================================

export default function ReportScreen() {
  const { t } = useTranslation();
  const { isPremium } = useAuthStore();
  const navigation = useNavigation<any>();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const chartWidth = screenW - 64;
  const insets = useSafeAreaInsets();

  // 背景ズームアニメーション（グラフ紙へのズームイン）
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgTransX  = useRef(new Animated.Value(0)).current;
  const bgTransY  = useRef(new Animated.Value(0)).current;

  // RP座標：クマの頭上のボードに貼られたレポート紙
  const RP_X = screenW * 0.50;
  const RP_Y = screenH * 0.10;
  const S = 3;
  const toX = (RP_X - screenW / 2) * (1 - S);
  const toY = (RP_Y - screenH / 2) * (1 - S);

  // フォーカス時：ズームイン
  useFocusEffect(useCallback(() => {
    scaleAnim.stopAnimation();
    bgTransX.stopAnimation();
    bgTransY.stopAnimation();
    scaleAnim.setValue(1);
    bgTransX.setValue(0);
    bgTransY.setValue(0);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: S,   duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(bgTransX,  { toValue: toX, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(bgTransY,  { toValue: toY, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [screenW, screenH]));

  // ブラー時：ズームアウト
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      scaleAnim.stopAnimation();
      bgTransX.stopAnimation();
      bgTransY.stopAnimation();
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bgTransX,  { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bgTransY,  { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
    return unsub;
  }, [navigation]);

  const [tab, setTab] = useState<Tab>('weekly');
  const [weeklyLogs, setWeeklyLogs] = useState<SleepLog[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<SleepLog[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<AiReport | null>(null);
  const [pastReports, setPastReports] = useState<Array<{ key: string } & AiReport>>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // NOTE: useMemo はペイウォール early return の前に置く（Rules of Hooks）
  const logs = useMemo(
    () => (tab === 'weekly' ? weeklyLogs : monthlyLogs),
    [tab, weeklyLogs, monthlyLogs],
  );
  const habitStats = useMemo(() => computeHabitStats(logs), [logs]);

  const { profile } = useAuthStore();

  const buildStats = useCallback((logs: SleepLog[]): Partial<SleepStats> => {
    const prevWeek = logs.slice(7, 14);
    const avgScore = (arr: SleepLog[]) =>
      arr.length > 0
        ? Math.round(arr.reduce((s, l) => s + l.score, 0) / arr.length)
        : null;

    // 3ヶ月平均（90日分・14件以上あれば計算）
    const threeMonth = logs.slice(0, 90);
    const threeMonthAvg = threeMonth.length >= 14 ? avgScore(threeMonth) : null;

    const stats = computeHabitStats(logs);
    const diff = (h: HabitStat) => h.withAvg - h.withoutAvg;
    const positives = stats.filter(h => diff(h) > 0).sort((a, b) => diff(b) - diff(a));
    const negatives = stats.filter(h => diff(h) < 0).sort((a, b) => diff(a) - diff(b));

    return {
      prevPeriodAvgScore: avgScore(prevWeek),
      threeMonthAvgScore: threeMonthAvg,
      topPositiveHabit: positives[0]
        ? { label: positives[0].label, emoji: positives[0].emoji, diff: diff(positives[0]) }
        : null,
      topNegativeHabit: negatives[0]
        ? { label: negatives[0].label, emoji: negatives[0].emoji, diff: diff(negatives[0]) }
        : null,
      ageGroup: profile?.ageGroup ?? null,
    };
  }, [profile]);

  const loadWeeklyReport = useCallback(async (
    logs: SleepLog[],
    past: Array<{ key: string } & AiReport>,
  ) => {
    const today = new Date();
    const weekKey = format(today, "RRRR-'W'II");

    // past[0] が今週のレポートなら再取得不要
    const cached = past[0]?.key === weekKey ? past[0] : await getAiReport(weekKey);
    if (cached) {
      setWeeklyReport(cached);
      return;
    }

    // 月曜日 + 直近7日に3件以上あれば自動生成
    if (today.getDay() === 1 && logs.slice(0, 7).length >= 3) {
      setIsLoadingReport(true);
      try {
        const goal = await getGoal();
        const report = await generateWeeklyReport(
          logs.slice(0, 7),
          goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null },
          buildStats(logs),
        );
        await saveAiReport(weekKey, report);
        setWeeklyReport(report);
      } catch {
        // ignore API errors
      } finally {
        setIsLoadingReport(false);
      }
    }
  }, [buildStats]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isPremium) {
        // 有料ユーザー: AIレポート・過去レポートも含めてフルロード
        const [logs, past] = await Promise.all([
          getRecentSleepLogs(SLEEP_LOG_FETCH_LIMIT.REPORT),
          getPastWeeklyReports(8),
        ]);
        setMonthlyLogs(logs);
        setWeeklyLogs(logs.slice(0, 7));
        setPastReports(past);
        await loadWeeklyReport(logs, past);
      } else {
        // 無料ユーザー: スコアグラフ表示のため直近7件だけロード
        const logs = await getRecentSleepLogs(SLEEP_LOG_FETCH_LIMIT.REPORT);
        setMonthlyLogs(logs);
        setWeeklyLogs(logs.slice(0, 7));
      }
    } catch (e) {
      console.error('ReportScreen loadData error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isPremium, loadWeeklyReport]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateReport = async () => {
    const today = new Date();
    const weekKey = format(today, "RRRR-'W'II");
    const targetLogs = weeklyLogs.length >= 1 ? weeklyLogs : monthlyLogs.slice(0, 7);
    if (targetLogs.length === 0) return;
    setIsLoadingReport(true);
    try {
      const goal = await getGoal();
      const report = await generateWeeklyReport(
        targetLogs,
        goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null },
        buildStats(monthlyLogs),
      );
      await saveAiReport(weekKey, report);
      setWeeklyReport(report);
    } catch (e) {
      console.error('generateWeeklyReport failed:', e);
      Alert.alert(t('common.error'), t('report.generateFailed'));
    } finally {
      setIsLoadingReport(false);
    }
  };

  const avgScore =
    logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)
      : 0;
  const bestScore = logs.length > 0 ? Math.max(...logs.map(l => l.score)) : 0;
  const worstScore = logs.length > 0 ? Math.min(...logs.map(l => l.score)) : 0;

  // 前週（8〜14日前）の平均スコア（週次タブ用の前週比計算）
  const prevWeekLogs = monthlyLogs.slice(7, 14);
  const previousWeekAvgScore =
    prevWeekLogs.length > 0
      ? Math.round(prevWeekLogs.reduce((s, l) => s + l.score, 0) / prevWeekLogs.length)
      : null;

  return (
    <View style={styles.root}>
      {/* ズームする背景レイヤー */}
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          overflow: 'hidden',
          transform: [{ translateX: bgTransX }, { translateY: bgTransY }, { scale: scaleAnim }],
        }]}
      >
        <ImageBackground
          source={require('../../assets/images/bg_home.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Animated.View>

      {/* P5スタイル タグライン */}
      <View style={[styles.taglineWrap, { top: screenH * 0.13 }]}>
        <View style={styles.taglineBar} />
        <Text style={styles.taglineText}>{'WHAT THE\nDATA SAYS'}</Text>
      </View>

      {/* ボトムシート */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8 }]}>
        {/* ハンドル行：中央ハンドル ＋ タブ切り替え */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'weekly' && styles.tabBtnActive]}
              onPress={() => setTab('weekly')}
            >
              <Text style={[styles.tabText, tab === 'weekly' && styles.tabTextActive]}>{t('report.weekly')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'monthly' && styles.tabBtnActive]}
              onPress={() => setTab('monthly')}
            >
              <Text style={[styles.tabText, tab === 'monthly' && styles.tabTextActive]}>{t('report.monthly')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#6B5CE7" size="large" />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>{t('report.insufficientData')}</Text>
            <Text style={styles.emptySubText}>
              {tab === 'weekly' ? t('report.insufficientDataSub_weekly') : t('report.insufficientDataSub_monthly')}
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* 統計サマリー（無料ユーザーにも実データを表示して価値を訴求） */}
            <View style={styles.statsRow}>
              <StatCell label={t('report.avgScore')} score={avgScore} suffix={t('common.points')} color="#6B5CE7" delay={0} />
              <StatCell label={t('report.bestScore')} score={bestScore} suffix={t('common.points')} color="#4CAF50" delay={80} />
              <StatCell label={t('report.worstScore')} score={worstScore} suffix={t('common.points')} color="#F44336" delay={160} />
            </View>

            {isPremium ? (
              <>
                {/* 有料: スコア推移グラフ（期間切り替え付き） */}
                <ScoreTrendCard monthlyLogs={monthlyLogs} chartWidth={chartWidth} />

                {/* 週次AIレポート（週次タブのみ） */}
                {tab === 'weekly' && (
                  <WeeklyReportCard
                    weeklyReport={weeklyReport}
                    pastReports={pastReports}
                    isLoadingReport={isLoadingReport}
                    onGenerate={handleGenerateReport}
                    currentWeekAvgScore={weeklyLogs.length > 0 ? avgScore : null}
                    previousWeekAvgScore={previousWeekAvgScore}
                  />
                )}

                {/* 習慣別スコア影響 */}
                <HabitCorrelationCard
                  habitStats={habitStats}
                  avgScore={avgScore}
                  chartWidth={chartWidth}
                />
              </>
            ) : (
              <>
                {/* 無料: スコア推移グラフはマスク表示 */}
                <ScoreTrendCard monthlyLogs={monthlyLogs} chartWidth={chartWidth} locked={true} />

                {/* 無料: ロックオーバーレイ（ゴーストカード+CTA） */}
                <LockedContentOverlay
                  onPress={() => navigation.navigate('Profile', { screen: 'SubscriptionManage' })}
                />
              </>
            )}

            <View style={styles.spacer} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ============================================================
// サブコンポーネント
// ============================================================

function useCountUp(target: number, duration = 700, delay = 0): number {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(new Animated.Value(0));
  useEffect(() => {
    animRef.current.setValue(0);
    setDisplay(0);
    const listenerId = animRef.current.addListener(({ value }) => setDisplay(Math.round(value)));
    const timer = setTimeout(() => {
      Animated.timing(animRef.current, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => {
      clearTimeout(timer);
      animRef.current.removeListener(listenerId);
    };
  }, [target]);
  return display;
}

function StatCell({
  label,
  score,
  suffix,
  color,
  delay = 0,
}: {
  label: string;
  score: number;
  suffix: string;
  color: string;
  delay?: number;
}) {
  const displayScore = useCountUp(score, 700, delay);
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{displayScore}{suffix}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  root: { flex: 1 },
  // P5タグライン
  taglineWrap: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  taglineBar: {
    width: 4,
    height: 52,
    backgroundColor: '#FF3B30',
    borderRadius: 2,
    marginRight: 10,
    marginTop: 2,
  },
  taglineText: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 3,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  // ボトムシート（日記タブと同構造）
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '35%',
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.3)',
    paddingTop: 12,
  },
  // ハンドル行：中央ハンドル ＋ 右タブ切り替え
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    height: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 92, 231, 0.4)',
  },
  tabRow: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 18 },
  tabBtnActive: { backgroundColor: '#6B5CE7' },
  tabText: { fontSize: 12, color: '#C8C8E0' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#C8C8E0', marginTop: 8 },
  emptySubText: { fontSize: 13, color: '#C8C8E0', textAlign: 'center', marginTop: 4 },
  scroll: { flex: 1 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  statCell: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  statValue: { fontSize: 20, fontFamily: 'KiwiMaru-Regular', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#C8C8E0' },
  spacer: { height: 32 },
});
