import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../../i18n';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useAuthStore } from '../../stores/authStore';
import { getAiReport, saveAiReport, getGoal, getSleepLog } from '../../services/firebase';
import { generateDailyAdvice } from '../../services/claudeApi';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';
import { SCORE_COLORS, SLEEP_LOG_FETCH_LIMIT } from '../../constants';
import { UserGoal, HomeStackParamList } from '../../types';
import SleepInputModal from './SleepInputModal';
import ScoreRing from '../../components/home/ScoreRing';
import SleepDebtCard from '../../components/home/SleepDebtCard';
import AiAdviceCard from '../../components/home/AiAdviceCard';

type HomeNav = NativeStackNavigationProp<HomeStackParamList>;

const DISMISSED_BANNER_KEY = '@yoake:dismissed_banner_date';

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<HomeNav>();
  const { todayLog, recentLogs, loadToday, loadRecent } = useSleepStore();
  const { isPremium } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
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
  const dateLabel = format(new Date(), 'M月d日（EEE）', { locale: getDateFnsLocale() });

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12  ? t('home.greetingMorning')
    : hour >= 12 && hour < 18 ? t('home.greetingAfternoon')
    : hour >= 18 && hour < 23 ? t('home.greetingEvening')
    :                            t('home.greetingNight');

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
      setAiAdvice(t('home.aiAdviceFailed'));
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
  const scoreColor = scoreInfo ? SCORE_COLORS[scoreInfo.color] : '#6B5CE7';

  // スコアコンテキスト（前日比・今週平均）
  const prevScore = recentLogs[1]?.score ?? null;
  const scoreDiff = todayLog && prevScore !== null ? todayLog.score - prevScore : null;

  // 今週の目標達成
  const weekLogs = recentLogs.slice(0, 7);
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return format(d, 'yyyy-MM-dd');
  });
  const logMap = new Map(recentLogs.map(l => [l.date, l]));
  const achievedDays = goal
    ? last7Days.filter(dateStr => {
        const log = logMap.get(dateStr);
        return log ? log.score >= goal.targetScore : false;
      }).length
    : 0;

  // クマの画面座標（Home: focusX=0.5, focusY=0.6, scale=1.0）
  const bearX = screenW * 0.5;
  const bearY = screenH * 0.6;
  const dotRadius = 100; // 弧の半径(px)
  const DOT_HALF = 14;   // ドットの半径(28/2)
  // 7日分を上半分の弧（-150° 〜 -30°）に均等配置
  const goalDotAngles = [-150, -125, -100, -75, -50, -25, 0];

  return (
    <View style={styles.root}>
      {/* 上部：日付・挨拶 + ScoreRing */}
      <View style={[styles.topZone, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.headerTitle}>{greeting}</Text>
        <TouchableOpacity
          style={styles.scoreRingWrap}
          onPress={() => todayLog && navigation.navigate('ScoreDetail', { date: today })}
          activeOpacity={todayLog ? 0.7 : 1}
        >
          <ScoreRing
            score={todayLog?.score ?? null}
            scoreColor={scoreColor}
            label={scoreInfo ? t(scoreInfo.labelKey) : null}
            size={120}
          />
        </TouchableOpacity>
        {todayLog && (scoreDiff !== null || weekLogs.length > 0) && (
          <Text style={styles.scoreContext}>
            {scoreDiff !== null
              ? t('home.scoreDiff', { value: `${scoreDiff >= 0 ? '+' : ''}${scoreDiff}` })
              : ''}
            {scoreDiff !== null && weekLogs.length > 0 ? '　／　' : ''}
            {weekLogs.length > 0
              ? t('home.weekAvg', { score: Math.round(weekLogs.reduce((s, l) => s + l.score, 0) / weekLogs.length) })
              : ''}
          </Text>
        )}
      </View>

      {/* 今週の目標ドット（クマの周囲に弧状配置） */}
      {goal && last7Days.map((dateStr, i) => {
        const log = logMap.get(dateStr);
        const achieved = log ? log.score >= goal.targetScore : false;
        const dayLabel = format(safeToDate(dateStr), 'E', { locale: getDateFnsLocale() });
        const rad = (goalDotAngles[i] * Math.PI) / 180;
        const dotX = bearX + dotRadius * Math.cos(rad) - DOT_HALF;
        const dotY = bearY + dotRadius * Math.sin(rad) - DOT_HALF;
        return (
          <TouchableOpacity
            key={dateStr}
            style={[styles.floatingDotWrap, { left: dotX, top: dotY }]}
            onPress={() => log && navigation.navigate('ScoreDetail', { date: dateStr })}
            activeOpacity={log ? 0.7 : 1}
          >
            <View style={[
              styles.goalDot,
              achieved && styles.goalDotAchieved,
              !log && styles.goalDotEmpty,
            ]}>
              {log && <Text style={styles.goalDotScore}>{log.score}</Text>}
            </View>
            <Text style={styles.goalDayLabel}>{dayLabel}</Text>
          </TouchableOpacity>
        );
      })}

      {/* ボトムパネル */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6B5CE7" />}
        >
          {/* ウェルカムカード（初回） */}
          {!todayLog && recentLogs.length === 0 && (
            <View style={styles.firstTimeCard}>
              <Text style={styles.firstTimeTitle}>{t('home.welcomeTitle')}</Text>
              <Text style={styles.firstTimeDesc}>{t('home.welcomeDesc')}</Text>
            </View>
          )}

          {/* 記録/編集ボタン */}
          {!todayLog ? (
            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => { setModalTargetDate(today); setShowInputModal(true); }}
            >
              <Text style={styles.recordButtonText}>{t('home.recordButton')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => { setModalTargetDate(today); setShowInputModal(true); }}
            >
              <Text style={styles.editButtonText}>{t('home.editButton')}</Text>
            </TouchableOpacity>
          )}

          {/* 前日の未記録バナー */}
          {yesterdayMissed && !dismissedYesterday && (
            <View style={styles.missedBanner}>
              <View style={styles.missedBannerContent}>
                <Text style={styles.missedBannerText}>{t('home.missedBanner')}</Text>
                <TouchableOpacity
                  onPress={() => { setModalTargetDate(yesterday); setShowInputModal(true); }}
                >
                  <Text style={styles.missedBannerAction}>{t('home.missedBannerAction')}</Text>
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
              {isPremium ? t('home.aiChatButton') : t('home.aiChatLocked')}
            </Text>
          </TouchableOpacity>

          {/* 今日のサマリー */}
          {todayLog && (
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>{t('home.todaySleep')}</Text>
              <View style={styles.summaryRow}>
                <SummaryItem
                  label={t('home.duration')}
                  value={`${Math.floor(todayLog.totalMinutes / 60)}h${todayLog.totalMinutes % 60}m`}
                />
                <SummaryItem
                  label={t('home.bedtime')}
                  value={format(safeToDate(todayLog.bedTime), 'HH:mm')}
                />
                <SummaryItem
                  label={t('home.wakeup')}
                  value={format(safeToDate(todayLog.wakeTime), 'HH:mm')}
                />
              </View>
            </View>
          )}

          {/* 睡眠負債 */}
          <SleepDebtCard
            recentLogs={recentLogs}
            targetHours={goal?.targetHours ?? 7.5}
            isPremium={isPremium}
          />
        </ScrollView>
      </View>

      <SleepInputModal
        visible={showInputModal}
        onClose={() => setShowInputModal(false)}
        existingLog={modalTargetDate === today ? todayLog : null}
        goal={goal}
        targetDate={modalTargetDate}
      />
    </View>
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
  root: { flex: 1 },
  // 上部ゾーン（日付・挨拶・ScoreRing）
  topZone: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dateText: { fontSize: 12, color: '#C8C8E0' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginTop: 2, marginBottom: 8 },
  scoreRingWrap: { marginBottom: 4 },
  scoreContext: { fontSize: 11, color: '#C8C8E0', marginTop: 2 },
  // クマ周囲のゴールドット（絶対配置）
  floatingDotWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },
  goalDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 92, 231, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalDotAchieved: { backgroundColor: '#4CAF50' },
  goalDotEmpty: { opacity: 0.35 },
  goalDotScore: { fontSize: 8, fontWeight: 'bold', color: '#FFFFFF' },
  goalDayLabel: { fontSize: 9, color: '#FFFFFF', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  // ボトムパネル
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '52%',
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.3)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 92, 231, 0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  firstTimeCard: {
    marginBottom: 12,
    backgroundColor: 'rgba(107, 92, 231, 0.15)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
    alignItems: 'center',
  },
  firstTimeTitle: { fontSize: 15, fontWeight: 'bold', color: '#9C8FFF', marginBottom: 4 },
  firstTimeDesc: { fontSize: 12, color: '#C8C8E0', textAlign: 'center', lineHeight: 18 },
  recordButton: {
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 10,
  },
  recordButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  editButton: { alignItems: 'center', marginBottom: 8 },
  editButtonText: { color: '#C8C8E0', fontSize: 13, textDecorationLine: 'underline' },
  chatButton: {
    marginBottom: 10,
    backgroundColor: 'rgba(107, 92, 231, 0.15)',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  chatButtonLocked: { backgroundColor: 'rgba(26, 26, 46, 0.5)' },
  chatButtonText: { color: '#9C8FFF', fontSize: 14, fontWeight: '600' },
  missedBanner: {
    marginBottom: 10,
    backgroundColor: '#FF980018',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FF980040',
  },
  missedBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  missedBannerText: { color: '#FF9800', fontSize: 12 },
  missedBannerAction: { color: '#FF9800', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  missedBannerDismiss: { color: '#C8C8E0', fontSize: 14, padding: 4 },
  summaryCard: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.2)',
  },
  cardTitle: { fontSize: 13, color: '#C8C8E0', marginBottom: 10, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  summaryLabel: { fontSize: 10, color: '#C8C8E0', marginTop: 3 },
});
