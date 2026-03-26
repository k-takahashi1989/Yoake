import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
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
  const { width } = useWindowDimensions();
  const chartWidth = width - 64;

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

  const buildStats = useCallback((logs: SleepLog[]): Partial<SleepStats> => {
    const thisWeek = logs.slice(0, 7);
    const prevWeek = logs.slice(7, 14);
    const avgScore = (arr: SleepLog[]) =>
      arr.length > 0
        ? Math.round(arr.reduce((s, l) => s + l.score, 0) / arr.length)
        : null;

    const stats = computeHabitStats(logs);
    const diff = (h: HabitStat) => h.withAvg - h.withoutAvg;
    const positives = stats.filter(h => diff(h) > 0).sort((a, b) => diff(b) - diff(a));
    const negatives = stats.filter(h => diff(h) < 0).sort((a, b) => diff(a) - diff(b));

    return {
      prevPeriodAvgScore: avgScore(prevWeek),
      topPositiveHabit: positives[0]
        ? { label: positives[0].label, emoji: positives[0].emoji, diff: diff(positives[0]) }
        : null,
      topNegativeHabit: negatives[0]
        ? { label: negatives[0].label, emoji: negatives[0].emoji, diff: diff(negatives[0]) }
        : null,
    };
  }, []);

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
      const [logs, past] = await Promise.all([
        getRecentSleepLogs(SLEEP_LOG_FETCH_LIMIT.REPORT),
        getPastWeeklyReports(8),
      ]);
      setMonthlyLogs(logs);
      setWeeklyLogs(logs.slice(0, 7));
      setPastReports(past);
      await loadWeeklyReport(logs, past);
    } catch (e) {
      console.error('ReportScreen loadData error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [loadWeeklyReport]);

  useEffect(() => {
    if (isPremium) loadData();
  }, [isPremium, loadData]);

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

  // ペイウォール
  if (!isPremium) {
    const paywallFeatures = [
      t('report.paywallFeature1'),
      t('report.paywallFeature2'),
      t('report.paywallFeature3'),
      t('report.paywallFeature4'),
    ];
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('report.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.paywallTitle}>{t('report.paywallTitle')}</Text>
          <View style={styles.paywallFeatureCard}>
            {paywallFeatures.map(f => (
              <View key={f} style={styles.paywallFeatureRow}>
                <Text style={styles.paywallFeatureCheck}>✓</Text>
                <Text style={styles.paywallFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.paywallPrice}>
            月額¥{SUBSCRIPTION.MONTHLY_PRICE.toLocaleString()} 〜
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate('SubscriptionManage')}
          >
            <Text style={styles.upgradeBtnText}>{t('report.upgradeBtn', { days: SUBSCRIPTION.TRIAL_DAYS })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const avgScore =
    logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + l.score, 0) / logs.length)
      : 0;
  const bestScore = logs.length > 0 ? Math.max(...logs.map(l => l.score)) : 0;
  const worstScore = logs.length > 0 ? Math.min(...logs.map(l => l.score)) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('report.title')}</Text>
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
          {/* 統計サマリー */}
          <View style={styles.statsRow}>
            <StatCell label={t('report.avgScore')} value={`${avgScore}${t('common.points')}`} color="#6B5CE7" />
            <StatCell label={t('report.bestScore')} value={`${bestScore}${t('common.points')}`} color="#4CAF50" />
            <StatCell label={t('report.worstScore')} value={`${worstScore}${t('common.points')}`} color="#F44336" />
          </View>

          {/* スコア推移グラフ */}
          <ScoreTrendCard monthlyLogs={monthlyLogs} chartWidth={chartWidth} />

          {/* 週次AIレポート（週次タブのみ） */}
          {tab === 'weekly' && (
            <WeeklyReportCard
              weeklyReport={weeklyReport}
              pastReports={pastReports}
              isLoadingReport={isLoadingReport}
              onGenerate={handleGenerateReport}
            />
          )}

          {/* 習慣別スコア影響 */}
          <HabitCorrelationCard
            habitStats={habitStats}
            avgScore={avgScore}
            chartWidth={chartWidth}
          />

          <View style={styles.spacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ============================================================
// サブコンポーネント
// ============================================================

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#2D2D44',
    borderRadius: 20,
    padding: 2,
  },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18 },
  tabBtnActive: { backgroundColor: '#6B5CE7' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockIcon: { fontSize: 48, marginBottom: 16 },
  paywallTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#FFFFFF',
    textAlign: 'center', marginBottom: 12,
  },
  paywallFeatureCard: {
    backgroundColor: '#2D2D44', borderRadius: 16, padding: 16,
    width: '100%', marginBottom: 16,
  },
  paywallFeatureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  paywallFeatureCheck: { color: '#6B5CE7', fontSize: 14, fontWeight: 'bold', marginRight: 10 },
  paywallFeatureText: { fontSize: 14, color: '#D0D0E8' },
  paywallPrice: { fontSize: 13, color: '#888', marginBottom: 16 },
  upgradeBtn: {
    backgroundColor: '#6B5CE7', paddingHorizontal: 32,
    paddingVertical: 16, borderRadius: 28, width: '100%', alignItems: 'center',
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#888', marginTop: 8 },
  emptySubText: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 4 },
  scroll: { flex: 1 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  statCell: {
    flex: 1,
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#888' },
  spacer: { height: 32 },
});
