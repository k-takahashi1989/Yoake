import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useAuthStore } from '../../stores/authStore';
import { getAiReport, saveAiReport, getGoal, getSleepLog } from '../../services/firebase';
import { generateDailyAdvice } from '../../services/claudeApi';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { safeToDate } from '../../utils/dateUtils';
import { SCORE_COLORS, SLEEP_LOG_FETCH_LIMIT } from '../../constants';
import { UserGoal, HomeStackParamList } from '../../types';
import SleepInputModal from './SleepInputModal';
import ScoreRing from '../../components/home/ScoreRing';
import SleepDebtCard from '../../components/home/SleepDebtCard';
import AiAdviceCard from '../../components/home/AiAdviceCard';

type HomeNav = NativeStackNavigationProp<HomeStackParamList>;

const DISMISSED_BANNER_KEY = '@yoake:dismissed_banner_date';

export default function HomeScreen() {
  const navigation = useNavigation<HomeNav>();
  const { todayLog, recentLogs, loadToday, loadRecent } = useSleepStore();
  const { isPremium } = useAuthStore();
  const [showInputModal, setShowInputModal] = useState(false);
  const [modalTargetDate, setModalTargetDate] = useState<string | undefined>(undefined);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [yesterdayMissed, setYesterdayMissed] = useState(false);
  const [dismissedYesterday, setDismissedYesterday] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const dateLabel = format(new Date(), 'M月d日（EEE）', { locale: ja });

  useEffect(() => {
    loadToday();
    loadRecent(SLEEP_LOG_FETCH_LIMIT.HOME);
    loadGoalAndAi();
    checkYesterdayMissed();
    checkDismissedBanner();
  }, []);

  const checkYesterdayMissed = async () => {
    try {
      const log = await getSleepLog(yesterday);
      setYesterdayMissed(!log);
    } catch {
      // ignore
    }
  };

  const checkDismissedBanner = async () => {
    try {
      const stored = await AsyncStorage.getItem(DISMISSED_BANNER_KEY);
      setDismissedYesterday(stored === today);
    } catch {
      // ignore
    }
  };

  const handleDismissBanner = async () => {
    try {
      await AsyncStorage.setItem(DISMISSED_BANNER_KEY, today);
    } catch {
      // ignore
    }
    setDismissedYesterday(true);
  };

  const loadGoalAndAi = async () => {
    const g = await getGoal();
    setGoal(g);
    if (g) {
      await loadAiAdvice(g);
    }
  };

  const loadAiAdvice = async (g: UserGoal, forceRefresh = false) => {
    // 当日のレポートキャッシュを確認
    if (!forceRefresh) {
      const cached = await getAiReport(today);
      if (cached && cached.type === 'daily') {
        setAiAdvice(cached.content);
        return;
      }
    }

    // 生成
    setIsLoadingAi(true);
    try {
      const logs = useSleepStore.getState().recentLogs;

      const avg = (arr: typeof logs) =>
        arr.length > 0 ? Math.round(arr.reduce((s, l) => s + l.score, 0) / arr.length) : null;
      const report = await generateDailyAdvice(logs, g, {
        prevPeriodAvgScore: avg(logs.slice(7, 14)),
      });
      await saveAiReport(today, report);
      setAiAdvice(report.content);
    } catch (e) {
      console.error('AI生成失敗:', e);
      setAiAdvice('AIアドバイスを取得できませんでした。');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadToday(), loadRecent(SLEEP_LOG_FETCH_LIMIT.HOME)]);
    setIsRefreshing(false);
  }, []);

  const scoreInfo = todayLog ? getScoreInfo(todayLog.score) : null;
  const scoreColor = scoreInfo ? SCORE_COLORS[scoreInfo.color.toUpperCase() as keyof typeof SCORE_COLORS] : '#6B5CE7';

  // スコアコンテキスト（前日比・今週平均）
  const prevScore = recentLogs[1]?.score ?? null;
  const scoreDiff = todayLog && prevScore !== null ? todayLog.score - prevScore : null;

  // 今週の目標達成日数
  const weekLogs = recentLogs.slice(0, 7);
  const achievedDays = goal
    ? weekLogs.filter(l => l.score >= goal.targetScore).length
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6B5CE7" />}
      >
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          <Text style={styles.headerTitle}>おはようございます 🌅</Text>
        </View>

        {/* スコアリング */}
        <View style={styles.scoreSection}>
          <TouchableOpacity
            onPress={() => todayLog && navigation.navigate('ScoreDetail', { date: today })}
            activeOpacity={todayLog ? 0.7 : 1}
          >
            <ScoreRing
              score={todayLog?.score ?? null}
              scoreColor={scoreColor}
              label={scoreInfo?.label ?? null}
            />
          </TouchableOpacity>

          {todayLog && (
            <Text style={styles.tapHint}>タップで詳細を見る</Text>
          )}

          {todayLog && (scoreDiff !== null || weekLogs.length > 0) && (
            <Text style={styles.scoreContext}>
              {scoreDiff !== null
                ? `前日比 ${scoreDiff >= 0 ? '+' : ''}${scoreDiff}点`
                : ''}
              {scoreDiff !== null && weekLogs.length > 0 ? '　／　' : ''}
              {weekLogs.length > 0
                ? `今週平均 ${Math.round(weekLogs.reduce((s, l) => s + l.score, 0) / weekLogs.length)}点`
                : ''}
            </Text>
          )}

          {!todayLog && recentLogs.length === 0 && (
            <View style={styles.firstTimeCard}>
              <Text style={styles.firstTimeTitle}>YOAKEへようこそ！</Text>
              <Text style={styles.firstTimeDesc}>
                まず昨夜の睡眠を記録してみましょう。{'\n'}スコアや改善点が一目でわかります。
              </Text>
            </View>
          )}

          {!todayLog && (
            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => { setModalTargetDate(today); setShowInputModal(true); }}
            >
              <Text style={styles.recordButtonText}>今日の睡眠を記録する</Text>
            </TouchableOpacity>
          )}

          {todayLog && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => { setModalTargetDate(today); setShowInputModal(true); }}
            >
              <Text style={styles.editButtonText}>記録を編集</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 前日の未記録バナー */}
        {yesterdayMissed && !dismissedYesterday && (
          <View style={styles.missedBanner}>
            <View style={styles.missedBannerContent}>
              <Text style={styles.missedBannerText}>昨日の記録がありません</Text>
              <TouchableOpacity
                onPress={() => { setModalTargetDate(yesterday); setShowInputModal(true); }}
              >
                <Text style={styles.missedBannerAction}>記録する</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleDismissBanner}>
              <Text style={styles.missedBannerDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AIひとこと */}
        <AiAdviceCard
          advice={aiAdvice}
          isLoading={isLoadingAi}
          onRefresh={goal ? () => { setAiAdvice(null); loadAiAdvice(goal, true); } : undefined}
        />

        {/* AIチャットボタン */}
        <TouchableOpacity
          style={[styles.chatButton, !isPremium && styles.chatButtonLocked]}
          onPress={() => navigation.navigate('AiChat')}
        >
          <Text style={styles.chatButtonText}>
            {isPremium ? '💬 AIに質問する' : '🔒 AIチャット（プレミアム）'}
          </Text>
        </TouchableOpacity>

        {/* 今日のサマリー */}
        {todayLog && (
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>今日の睡眠</Text>
            <View style={styles.summaryRow}>
              <SummaryItem
                label="睡眠時間"
                value={`${Math.floor(todayLog.totalMinutes / 60)}h${todayLog.totalMinutes % 60}m`}
              />
              <SummaryItem
                label="就寝"
                value={format(safeToDate(todayLog.bedTime), 'HH:mm')}
              />
              <SummaryItem
                label="起床"
                value={format(safeToDate(todayLog.wakeTime), 'HH:mm')}
              />
            </View>
          </View>
        )}

        {/* 今週の目標進捗 */}
        {goal && (
          <View style={styles.goalCard}>
            <Text style={styles.cardTitle}>今週の目標達成</Text>
            <View style={styles.goalProgress}>
              {Array.from({ length: 7 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.goalDot,
                    i < achievedDays && styles.goalDotAchieved,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.goalText}>
              {achievedDays}/7日　目標スコア{goal.targetScore}点以上
            </Text>
          </View>
        )}

        {/* 睡眠負債 */}
        <SleepDebtCard
          recentLogs={recentLogs}
          targetHours={goal?.targetHours ?? 7.5}
          isPremium={isPremium}
        />

        <View style={styles.spacer} />
      </ScrollView>

      <SleepInputModal
        visible={showInputModal}
        onClose={() => setShowInputModal(false)}
        existingLog={modalTargetDate === today ? todayLog : null}
        goal={goal}
        targetDate={modalTargetDate}
      />
    </SafeAreaView>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#888',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  firstTimeCard: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#6B5CE720',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6B5CE740',
    alignItems: 'center',
  },
  firstTimeTitle: { fontSize: 16, fontWeight: 'bold', color: '#9C8FFF', marginBottom: 6 },
  firstTimeDesc: { fontSize: 13, color: '#B0B0C8', textAlign: 'center', lineHeight: 20 },
  recordButton: {
    marginTop: 20,
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 11,
    color: '#555',
    marginTop: 6,
  },
  scoreContext: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  editButton: {
    marginTop: 12,
  },
  editButtonText: {
    color: '#888',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  chatButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#6B5CE720',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6B5CE740',
  },
  chatButtonLocked: {
    backgroundColor: '#2D2D44',
    borderColor: '#444',
  },
  chatButtonText: {
    color: '#9C8FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  missedBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FF980018',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FF980040',
  },
  missedBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  missedBannerText: { color: '#FF9800', fontSize: 13 },
  missedBannerAction: {
    color: '#FF9800',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  missedBannerDismiss: { color: '#888', fontSize: 14, padding: 4 },
  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  goalCard: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  goalProgress: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  goalDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#444',
  },
  goalDotAchieved: {
    backgroundColor: '#4CAF50',
  },
  goalText: {
    fontSize: 12,
    color: '#888',
  },
  spacer: {
    height: 24,
  },
});
