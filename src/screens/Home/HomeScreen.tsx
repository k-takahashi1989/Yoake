import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  ImageBackground,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, startOfMonth, subDays } from 'date-fns';
import { format as dateFnsFormat } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../../i18n';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useAuthStore } from '../../stores/authStore';
import { getGoal } from '../../services/firebase';
import { getScoreInfo, calculateSleepDebt } from '../../utils/scoreCalculator';
import { calculateStreak } from '../../utils/streakCalculator';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';
import { SCORE_COLORS, SLEEP_LOG_FETCH_LIMIT } from '../../constants';
import { UserGoal, HomeStackParamList } from '../../types';
import SleepInputModal from './SleepInputModal';
import Icon from '../../components/common/Icon';
import ScalePressable from '../../components/common/ScalePressable';
import { haptics } from '../../utils/haptics';
import { promptForReviewIfEligible } from '../../services/reviewService';
import {
  getExpectedLogDateForPending,
  getPendingSleepStart,
} from '../../services/notificationService';

type HomeNav = NativeStackNavigationProp<HomeStackParamList>;

const HOME_TUTORIAL_SEEN_KEY = '@yoake:home_tutorial_seen_v1';
const MISSED_LOG_BANNER_DISMISSED_KEY = '@yoake:missed_log_banner_dismissed';
const HOME_THEME = {
  surfaceGlass: 'rgba(14, 27, 41, 0.76)',
  surfacePrimary: 'rgba(24, 40, 59, 0.86)',
  surfaceElevated: 'rgba(33, 54, 76, 0.9)',
  surfaceRaised: 'rgba(42, 67, 92, 0.94)',
  surfaceSoft: 'rgba(28, 46, 66, 0.82)',
  borderSoft: 'rgba(246, 241, 232, 0.1)',
  borderStrong: 'rgba(217, 180, 106, 0.22)',
  borderCool: 'rgba(134, 175, 195, 0.2)',
  textPrimary: '#F6F1E8',
  textSecondary: '#D3DCE4',
  textMuted: '#A5B6C5',
  gold: '#D9B46A',
  goldStrong: '#E7C98F',
  goldText: '#FFF8EC',
  goldSurface: 'rgba(217, 180, 106, 0.16)',
  goldBorder: 'rgba(217, 180, 106, 0.3)',
  blueSurface: 'rgba(134, 175, 195, 0.14)',
  blueBorder: 'rgba(134, 175, 195, 0.24)',
  shadow: '#0A1622',
} as const;


export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<HomeNav>();
  const { todayLog, recentLogs, loadToday, loadRecent } = useSleepStore();
  const { isPremium } = useAuthStore();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [showInputModal, setShowInputModal] = useState(false);
  const [modalTargetDate, setModalTargetDate] = useState<string | undefined>(undefined);
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHomeGuide, setShowHomeGuide] = useState(false);
  const [showMissedBanner, setShowMissedBanner] = useState(false);
  const [debtPeriod] = useState<'14' | '30' | 'month'>('14');
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [dotsVisible, setDotsVisible] = useState(true);
  const panelAnim = useRef(new Animated.Value(1)).current;
  const ecgAnim = useRef(new Animated.Value(0)).current;
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // --- initial stagger reveal（マウント時のコンテンツフェードイン）---
  // 各セクションの opacity / translateY を個別に管理し、既存アニメーションと独立させる
  const revealScoreOpacity = useRef(new Animated.Value(0)).current;
  const revealScoreY = useRef(new Animated.Value(10)).current;
  const revealDotsOpacity = useRef(new Animated.Value(0)).current;
  const revealDotsY = useRef(new Animated.Value(10)).current;
  const revealDebtOpacity = useRef(new Animated.Value(0)).current;
  const revealDebtY = useRef(new Animated.Value(10)).current;
  const [zoomTarget, setZoomTarget] = useState<{ x: number; y: number; color: string } | null>(null);
  const zoomTargetRef = useRef<{ x: number; y: number; color: string } | null>(null);
  // Diaryタブから戻るズームアウト用・直前のタブを追跡
  const prevTabRef = useRef<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  const handleDotPress = useCallback((dateStr: string, cx: number, cy: number, color: string) => {
    const target = { x: cx, y: cy, color };
    setZoomTarget(target);
    zoomTargetRef.current = target;
    zoomAnim.setValue(0);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.timing(zoomAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      // ズーム後半でスコアカラーがフェードイン → 遷移の隙間を埋める
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      navigation.navigate('ScoreDetail', { date: dateStr, scoreColor: color });
      // リセットは戻ってきた時（focusイベント）で行う → チラ見え防止
    });
  }, [navigation, overlayAnim, zoomAnim]);


  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        // フラット
        Animated.delay(600),
        // スパイク（急上昇）
        Animated.timing(ecgAnim, { toValue: 1, duration: 80, useNativeDriver: false }),
        // 急降下
        Animated.timing(ecgAnim, { toValue: 0.05, duration: 70, useNativeDriver: false }),
        // 小さな跳ね返り
        Animated.timing(ecgAnim, { toValue: 0.4, duration: 90, useNativeDriver: false }),
        // ゆっくりゼロに収束
        Animated.timing(ecgAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
        // 次のビートまで待つ
        Animated.delay(900),
      ])
    ).start();
  }, [ecgAnim]);

  // マウント時・各コンテンツセクションを stagger で fade-in + translateY（0ms / 100ms）
  useEffect(() => {
    const makeReveal = (opacity: Animated.Value, y: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 250,
          delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      makeReveal(revealScoreOpacity, revealScoreY, 0),
      makeReveal(revealDotsOpacity, revealDotsY, 100),
    ]).start();
  }, [
    revealDotsOpacity,
    revealDotsY,
    revealScoreOpacity,
    revealScoreY,
  ]);



  // ナビゲーション離脱・復帰でゴールドット非表示・前面時表示
  useEffect(() => {
    const blurUnsub = navigation.addListener('blur', () => setDotsVisible(false));
    const focusUnsub = navigation.addListener('focus', () => setDotsVisible(true));
    return () => { blurUnsub(); focusUnsub(); };
  }, [navigation]);

  // 直前のタブを追跡（Diaryから戻ったか判定するため）
  useEffect(() => {
    const parentNav = navigation.getParent();
    if (!parentNav) return;
    const unsub = (parentNav as any).addListener('state', (e: any) => {
      const name = e.data?.state?.routes?.[e.data.state.index]?.name;
      if (name && name !== 'Home') prevTabRef.current = name;
    });
    return unsub;
  }, [navigation]);

  // ScoreDetailから戻った時 / Diaryタブから戻った時・ズームアウトアニメーション
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (zoomTargetRef.current) {
        // ScoreDetailから戻った時（既存処理）
        Animated.parallel([
          Animated.timing(overlayAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(zoomAnim, {
            toValue: 0,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          zoomTargetRef.current = null;
          setZoomTarget(null);
        });
        return;
      }
      // Diaryタブから戻った時・HomeScreen側でノーマル座標からカメラズームアウト
      if (prevTabRef.current === 'Diary') {
        prevTabRef.current = null;
      // ZOOM_SCALE=8に対してscale=3になる値：(3-1)/(8-1)=2/7
        zoomAnim.setValue(2 / 7);
        Animated.timing(zoomAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        return;
      }
      // Reportタブから戻った時・グラフ座標からカメラズームアウト
      if (prevTabRef.current === 'Report') {
        prevTabRef.current = null;
        // S=3 竊・(3-1)/(8-1)=2/7
        zoomAnim.setValue(2 / 7);
        Animated.timing(zoomAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        return;
      }
      // Alarmタブから戻った時・目標就寢時間座標からカメラズームアウト
      if (prevTabRef.current === 'Alarm') {
        prevTabRef.current = null;
        // S=3 竊・(3-1)/(8-1)=2/7
        zoomAnim.setValue(2 / 7);
        Animated.timing(zoomAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    return unsub;
  }, [navigation, overlayAnim, screenH, screenW, zoomAnim]);

  const checkHomeGuideSeen = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(HOME_TUTORIAL_SEEN_KEY);
      if (!stored) {
        await AsyncStorage.setItem(HOME_TUTORIAL_SEEN_KEY, 'seen');
      }
    } catch {
      // ignore
    }
  }, []);

  const loadGoalAndAi = useCallback(async () => {
    const g = await getGoal();
    setGoal(g);
  }, []);

  useEffect(() => {
    loadToday();
    loadRecent(SLEEP_LOG_FETCH_LIMIT.HOME);
    loadGoalAndAi();
    checkHomeGuideSeen();
  }, [
    checkHomeGuideSeen,
    loadGoalAndAi,
    loadRecent,
    loadToday,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadToday();
      void loadRecent(SLEEP_LOG_FETCH_LIMIT.HOME);

      // 就寝リマインダー通知の「今から寝ます」ボタンで保存された就寝時刻があれば
      // 睡眠入力モーダルを自動表示して就寝時刻をプリセットする
      const checkPendingSleepStart = async () => {
        const pending = await getPendingSleepStart();
        if (!pending) return;

        // 押下時刻から想定される起床日（ログ日）を求め、未来（まだ寝ていない）ならスキップ。
        // 過去／今日なら適切な targetDate でモーダルを開く。
        const expectedLogDate = getExpectedLogDateForPending(pending);
        if (expectedLogDate > today) return;

        const currentGoal = goal ?? (await getGoal());
        setGoal(currentGoal);
        setModalTargetDate(expectedLogDate === today ? undefined : expectedLogDate);
        setShowInputModal(true);
      };
      void checkPendingSleepStart();
    }, [goal, loadRecent, loadToday]),
  );

  const animatePanel = useCallback((expanded: boolean) => {
    Animated.timing(panelAnim, {
      toValue: expanded ? 1 : 0,
      duration: 280,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    setIsPanelExpanded(expanded);
  }, [panelAnim]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadToday(), loadRecent(SLEEP_LOG_FETCH_LIMIT.HOME)]);
    setIsRefreshing(false);
  }, [loadRecent, loadToday]);

  const togglePanel = useCallback(() => {
    animatePanel(!isPanelExpanded);
  }, [animatePanel, isPanelExpanded]);

  // スコアが null→数値に変わった瞬間に軽いフィードバック
  const prevTodayLogRef = useRef<typeof todayLog>(undefined);
  useEffect(() => {
    const wasNull = prevTodayLogRef.current == null;
    const isNowNumber = todayLog != null;
    if (wasNull && isNowNumber) {
      haptics.light();
    }
    prevTodayLogRef.current = todayLog;
  }, [todayLog]);


  // 連続記録日数（recentLogs は降順で渡す）
  const streak = calculateStreak(recentLogs);
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // スコアコンテキスト（前日比・今週達成度）

  // 今週の目標達成数
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
  const todayDurationText = todayLog
    ? `${Math.floor(todayLog.totalMinutes / 60)}h${todayLog.totalMinutes % 60}m`
    : t('home.noData');
  const todayBedtimeText = todayLog
    ? format(safeToDate(todayLog.bedTime), 'HH:mm')
    : '--:--';
  const todayWakeText = todayLog
    ? format(safeToDate(todayLog.wakeTime), 'HH:mm')
    : '--:--';
  const heroSubtitle = todayLog ? t('home.heroReadySub') : t('home.heroEmptySub');
  const isEnglishUi = t('nav.aiChat') === 'AI Chat';
  const isJa = !isEnglishUi;
  const reviewLanguage = isEnglishUi ? 'en' : 'ja';
  const hasTodayLog = Boolean(todayLog ?? logMap.get(today));
  const hasYesterdayLog = Boolean(logMap.get(yesterday));
  const shouldOfferCatchUp = recentLogs.length > 0 && !hasTodayLog && !hasYesterdayLog;
  const streakLabel = isEnglishUi ? `${streak} day streak` : `${streak}日継続`;
  const primaryActionLabel = todayLog
    ? (isEnglishUi ? 'Result' : '結果を見る')
    : (isEnglishUi ? 'Log sleep' : '睡眠記録');
  const todayMarkerLabel = isJa ? '今日' : t('home.todayMarker');
  const quickStatsTitle = isJa ? '今日のチェックポイント' : t('home.quickStatsTitle');
  const durationLabel = isJa ? '睡眠時間' : t('home.duration');
  const bedtimeLabel = isJa ? '就寝時間' : t('home.bedtime');
  const wakeupLabel = isJa ? '起床時間' : t('home.wakeup');
  const statusTone = todayLog ? '#79E0B5' : '#FFD36E';
  const progressMeta = (
    <View style={styles.heroMetaColumn}>
      <View style={styles.heroBadge}>
        <View style={[styles.heroBadgeDot, { backgroundColor: statusTone }]} />
        <Text style={styles.heroBadgeText}>
          {goal ? t('home.weekGoalCompact', { achieved: achievedDays }) : t('home.todaySleep')}
        </Text>
      </View>
      {streak >= 2 && (
        <View style={styles.heroStreakBadge}>
          <Text style={styles.heroStreakText}>{streakLabel}</Text>
        </View>
      )}
    </View>
  );
  const monthStart = dateFnsFormat(startOfMonth(new Date()), 'yyyy-MM-dd');
  const debtLogs =
    debtPeriod === '14' ? recentLogs.slice(0, 14)
    : debtPeriod === '30' ? recentLogs.slice(0, 30)
    : recentLogs.filter(l => l.date >= monthStart);
  const debtMinutes = calculateSleepDebt(debtLogs, goal?.targetHours ?? 7.5);
  const debtHours = Math.floor(debtMinutes / 60);
  const debtMins = debtMinutes % 60;
  const debtText = debtMinutes === 0
    ? t('sleepDebt.none')
    : `${debtHours > 0 ? `${debtHours}${t('common.hours')}` : ''}${debtMins > 0 ? `${debtMins}${t('common.minutes')}` : ''}`;
  const debtColor = debtMinutes === 0 ? '#4CAF50' : debtMinutes < 120 ? '#FFC107' : '#F44336';

  // クマの位置: focusX=0.5, focusY=0.43, scale=1.0
  const bearX = screenW * 0.4 + 40;
  const bearY = screenH * 0.35 + 70;
  const dotRadius = 108; // 点の半径(px)
  const DOT_HALF = 18;   // ドットの半径(36/2)
  // 7日分を扇形状に並べる 角度（-150° 〜 -30°）に等間隔配置
  const goalDotAngles = [-150, -125, -100, -75, -50, -25, 0];

  // 睡眠負債計算

  // カメラズーム用トランスフォーム（ドット座標をピボットにスケールアップ）
  const ZOOM_SCALE = 8;
  const zoomTransform = zoomTarget ? [
    {
      translateX: zoomAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -(ZOOM_SCALE - 1) * (zoomTarget.x - screenW / 2)],
      }),
    },
    {
      translateY: zoomAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -(ZOOM_SCALE - 1) * (zoomTarget.y - screenH / 2)],
      }),
    },
    {
      scale: zoomAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, ZOOM_SCALE],
      }),
    },
  ] : undefined;
  const guideItems = [
    { key: 'hero', title: t('home.guideHeroTitle'), body: t('home.guideHeroBody') },
    { key: 'note', title: t('home.guideNoteTitle'), body: t('home.guideNoteBody') },
    { key: 'dots', title: t('home.guideDotsTitle'), body: t('home.guideDotsBody') },
    { key: 'panel', title: t('home.guidePanelTitle'), body: t('home.guidePanelBody') },
  ];

  useFocusEffect(
    useCallback(() => {
      promptForReviewIfEligible(reviewLanguage).catch(() => {});
    }, [reviewLanguage]),
  );

  useEffect(() => {
    let isMounted = true;

    if (!shouldOfferCatchUp) {
      setShowMissedBanner(false);
      return () => {
        isMounted = false;
      };
    }

    AsyncStorage.getItem(MISSED_LOG_BANNER_DISMISSED_KEY)
      .then(storedDate => {
        if (!isMounted) return;
        setShowMissedBanner(storedDate !== yesterday);
      })
      .catch(() => {
        if (!isMounted) return;
        setShowMissedBanner(true);
      });

    return () => {
      isMounted = false;
    };
  }, [shouldOfferCatchUp, yesterday]);

  const handleMissedBannerDismiss = useCallback(() => {
    setShowMissedBanner(false);
    AsyncStorage.setItem(MISSED_LOG_BANNER_DISMISSED_KEY, yesterday).catch(() => {});
  }, [yesterday]);

  const handleCatchUpPress = useCallback(async () => {
    const currentGoal = goal ?? (await getGoal());
    setGoal(currentGoal);
    setModalTargetDate(yesterday);
    setShowInputModal(true);
    setShowMissedBanner(false);
  }, [goal, yesterday]);

  return (
    <View style={[styles.root, { overflow: 'hidden' }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, zoomTransform ? { transform: zoomTransform } : null]}
      >
        <ImageBackground
          source={require('../../assets/images/bg_home.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
      <View style={[styles.guideAnchor, { top: insets.top + 14 }]}>
        <TouchableOpacity
          style={styles.guideButton}
          activeOpacity={0.85}
          onPress={() => setShowHomeGuide(prev => !prev)}
        >
          <Icon name="note" size={13} color="#F7EBC0" />
          <Text style={styles.guideButtonText}>{t('home.guideButton')}</Text>
        </TouchableOpacity>

        {showHomeGuide && (
          <View style={[styles.guideCard, { width: Math.min(248, screenW * 0.68) }]}>
            <View style={styles.guideCardHeader}>
              <Text style={styles.guideCardTitle}>{t('home.guideTitle')}</Text>
              <TouchableOpacity onPress={() => setShowHomeGuide(false)} hitSlop={8}>
                <Text style={styles.guideCardClose}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.guideCardHint}>{t('home.guideHint')}</Text>

            <View style={styles.guideList}>
              {guideItems.map((item, index) => (
                <View key={item.key} style={styles.guideItem}>
                  <View style={styles.guideItemIndex}>
                    <Text style={styles.guideItemIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.guideItemCopy}>
                    <Text style={styles.guideItemTitle}>{item.title}</Text>
                    <Text style={styles.guideItemBody}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
      {/* 上部（今日日付/左） 縦（スコアサマリー/右） stagger reveal [0ms] */}
      <Animated.View style={{ opacity: revealScoreOpacity, transform: [{ translateY: revealScoreY }] }}>
        {false && <View style={[styles.heroCard, { marginTop: insets.top + 8 }]}>
          <View style={styles.heroCardHeader}>
            <View style={styles.heroCopy}>
              {!todayLog && <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>}
            </View>
            <View style={styles.heroMetaColumn}>
              <View style={styles.heroBadge}>
                <View style={[styles.heroBadgeDot, { backgroundColor: statusTone }]} />
                <Text style={styles.heroBadgeText}>
                  {goal ? t('home.weekGoalCompact', { achieved: achievedDays }) : t('home.todaySleep')}
                </Text>
              </View>
              {streak >= 2 && (
                <View style={styles.heroStreakBadge}>
                  <Text style={styles.heroStreakText}>{streakLabel}</Text>
                </View>
              )}
            </View>
          </View>
        </View>}

      <View style={[styles.topZone, { paddingTop: insets.top + 8 }]}>
        {/* 左：今日日付 + ストリークバッジ */}
        <View style={styles.dateColumn} />

        {/* 右：睡眠サマリー縦並び */}
        <View style={styles.topRightColumn}>

          {/* 睡眠サマリー */}

          {/* 記録ボタン（未記録時のみ、スコアリングの下）*/}
          {progressMeta}
        </View>
      </View>
      </Animated.View>

      {/* 睡眠負債 付箋メモ（プレミアムのみ） stagger reveal [240ms] */}
      {false && isPremium && (
        <Animated.View style={{ opacity: revealDebtOpacity, transform: [{ translateY: revealDebtY }] }}>
          <StickyNoteDebt
            label={t('sleepDebt.title')}
            value={debtText}
            color={debtColor}
            screenW={screenW}
            topOffset={insets.top + 100}
          />
        </Animated.View>
      )}

      {/* 今週の目標ドット（クマ周囲に弧状配置） stagger reveal [180ms] */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: revealDotsOpacity, transform: [{ translateY: revealDotsY }] }]} pointerEvents="box-none">
      {goal && last7Days.map((dateStr, i) => {
        const log = logMap.get(dateStr);
        const achieved = log ? log.score >= goal.targetScore : false;
        const dayLabel = format(safeToDate(dateStr), 'E', { locale: getDateFnsLocale() });
        const rad = (goalDotAngles[i] * Math.PI) / 180;
        const isTodayDot = i === 6;
        // 今日のドットは1.6倍サイズ（=7×1.4）なので中心合わせのオフセットを調整
        const dotHalfW = DOT_HALF;
        const dotHalfH = DOT_HALF;
        const dotX = bearX + dotRadius * Math.cos(rad) - dotHalfW;
        const dotY = bearY + dotRadius * Math.sin(rad) - dotHalfH;
        const dotScoreColor = log ? SCORE_COLORS[getScoreInfo(log.score).color] : '#555577';
        return (
          <TouchableOpacity
            key={dateStr}
            style={[styles.floatingDotWrap, { left: dotX, top: dotY }]}
            onPress={() => log && handleDotPress(dateStr, dotX + dotHalfW, dotY + dotHalfH, dotScoreColor)}
            activeOpacity={log ? 0.7 : 1}
          >
            <CloudDot score={log?.score} scoreColor={dotScoreColor} achieved={achieved} empty={!log} index={i} visible={dotsVisible} isToday={isTodayDot} />
            <View style={styles.goalDayMeta}>
              <Text style={styles.goalDayLabel}>{dayLabel}</Text>
              {isTodayDot && (
                <View style={styles.todayMarker}>
                  <Text style={styles.todayMarkerText}>{todayMarkerLabel}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
      </Animated.View>


      {/* ボトムパネル */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity onPress={togglePanel} activeOpacity={0.8} style={styles.handleWrap}>
          <View style={styles.handle} />
        </TouchableOpacity>
        <Animated.View style={{
          maxHeight: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 228] }),
          overflow: 'hidden',
        }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#6B5CE7" />}
          >
            <View style={styles.panelActionGroup}>
              {showMissedBanner && (
                <View style={styles.missedBanner}>
                  <View style={styles.missedBannerContent}>
                    <Icon name="calendar-warning" size={18} color="#FFB55A" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.missedBannerText}>{t('home.missedBanner')}</Text>
                      <TouchableOpacity onPress={handleCatchUpPress} activeOpacity={0.8}>
                        <Text style={styles.missedBannerAction}>{t('home.missedBannerAction')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={handleMissedBannerDismiss} hitSlop={8}>
                    <Text style={styles.missedBannerDismiss}>×</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.panelQuickStats}>
                <Text style={styles.panelQuickStatsTitle}>{quickStatsTitle}</Text>
                <View style={styles.panelQuickStatsRow}>
                  <View style={styles.panelQuickStat}>
                    <Text style={styles.panelQuickLabel}>{durationLabel}</Text>
                    <Text style={styles.panelQuickValue}>{todayDurationText}</Text>
                  </View>
                  <View style={styles.panelQuickStat}>
                    <Text style={styles.panelQuickLabel}>{bedtimeLabel}</Text>
                    <Text style={styles.panelQuickValue}>{todayBedtimeText}</Text>
                  </View>
                  <View style={styles.panelQuickStat}>
                    <Text style={styles.panelQuickLabel}>{wakeupLabel}</Text>
                    <Text style={styles.panelQuickValue}>{todayWakeText}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.panelActionRow}>
                <ScalePressable
                  style={[styles.heroPrimaryAction, !todayLog && styles.heroPrimaryActionWarm]}
                  onPress={() => {
                    if (todayLog) {
                      navigation.navigate('ScoreDetail', { date: today });
                    } else {
                      setModalTargetDate(today);
                      setShowInputModal(true);
                    }
                  }}
                >
                  <Text style={styles.heroPrimaryActionText} numberOfLines={1}>
                    {primaryActionLabel}
                  </Text>
                </ScalePressable>

                {todayLog && (
                  <ScalePressable
                    style={styles.heroSecondaryAction}
                    onPress={() => {
                      setModalTargetDate(today);
                      setShowInputModal(true);
                    }}
                  >
                    <Icon
                      name="user-edit"
                      size={14}
                      color="#CFC9FF"
                    />
                    <Text style={styles.heroSecondaryActionText} numberOfLines={1}>
                      {t('common.edit')}
                    </Text>
                  </ScalePressable>
                )}

                <ScalePressable
                  style={[styles.heroSecondaryAction, styles.heroAiAction, !isPremium && styles.heroAiActionLocked]}
                  onPress={() => navigation.navigate('AiChat')}
                >
                  <Icon
                    name="speech-bubble"
                    size={14}
                    color={isPremium ? '#CFC9FF' : '#A8A4CC'}
                  />
                  <Text style={styles.heroSecondaryActionText} numberOfLines={1}>
                    {t('nav.aiChat')}
                  </Text>
                </ScalePressable>
              </View>

              {!todayLog && (
                <Text style={styles.panelEmptyHint}>{heroSubtitle}</Text>
              )}

            </View>

            {/* ウェルカムカード（初回）*/}
            {!todayLog && recentLogs.length === 0 && (
              <View style={styles.firstTimeCard}>
                <Text style={styles.firstTimeTitle}>{t('home.welcomeTitle')}</Text>
                <Text style={styles.firstTimeDesc}>{t('home.welcomeDesc')}</Text>
              </View>
            )}

            {/* 昨日の未記録バナー（未実装・非表示）*/}

          </ScrollView>
        </Animated.View>

      </View>

      <SleepInputModal
        visible={showInputModal}
        onClose={() => setShowInputModal(false)}
        existingLog={modalTargetDate === today ? todayLog : null}
        goal={goal}
        targetDate={modalTargetDate}
        onSave={() => {}}
      />

        </ImageBackground>
      </Animated.View>

      {/* 遷移ブリッジ・ズーム完了前にスコアカラーで画面を覚う */}
      {zoomTarget && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: zoomTarget.color, opacity: overlayAnim },
          ]}
        />
      )}
    </View>
  );
}

// ============================================================
// 雲形ゴールドット
// ============================================================
function CloudDot({
  score,
  scoreColor,
  achieved,
  empty,
  index,
  visible,
  isToday,
}: {
  score?: number;
  scoreColor?: string;
  achieved: boolean;
  empty: boolean;
  index: number;
  visible: boolean;
  isToday?: boolean;
}) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  // 落下アニメ用（translateY: -60→0, opacity: 0→1）
  const dropY = useRef(new Animated.Value(-60)).current;
  const dropOpacity = useRef(new Animated.Value(0)).current;
  // floatループ参照・blur時に停止するため
  const floatLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      // ── 落下アニメ・画面に戻った時・初回mount ──
      // まず既存アニメをリセット
      floatLoopRef.current?.stop();
      floatAnim.stopAnimation();
      floatAnim.setValue(0);
      dropY.setValue(-60);
      dropOpacity.setValue(0);

      // 1) 左から順に落下（index × 90ms stagger）
      const DROP_DELAY = 300 + index * 90;
      const dropTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.spring(dropY, {
            toValue: 0,
            speed: 14,
            bounciness: 7,
            useNativeDriver: true,
          }),
          Animated.timing(dropOpacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }, DROP_DELAY);

      // 2) 落下完了後にふわふわループ開始
      const floatTimeout = setTimeout(() => {
        floatLoopRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -3,
              duration: 1900 + index * 80,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1900 + index * 80,
              easing: Easing.inOut(Easing.cubic),
              useNativeDriver: true,
            }),
          ])
        );
        floatLoopRef.current.start();
      }, DROP_DELAY + 650);

      return () => {
        clearTimeout(dropTimeout);
        clearTimeout(floatTimeout);
        floatLoopRef.current?.stop();
      };
    } else {
      // ── 浮上アニメ・非表示になる時 ──
      // floatループ停止・floatAnim=0にリセット
      floatLoopRef.current?.stop();
      floatLoopRef.current = null;
      floatAnim.setValue(0);

      // 右から順に上昇（index 6→0 stagger）
      const RISE_DELAY = (6 - index) * 60;
      const riseTimeout = setTimeout(() => {
        Animated.parallel([
          Animated.timing(dropY, {
            toValue: -60,
            duration: 220,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dropOpacity, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }, RISE_DELAY);

      return () => clearTimeout(riseTimeout);
    }
  }, [dropOpacity, dropY, floatAnim, index, visible]);

  const bgColor = empty
    ? 'rgba(107, 92, 231, 0.18)'
    : scoreColor
    ? scoreColor + 'CC'
    : achieved
    ? 'rgba(76, 175, 80, 0.82)'
    : 'rgba(107, 92, 231, 0.52)';

  return (
    <Animated.View
      style={[
        styles.cloudDot,
        {
          backgroundColor: bgColor,
          opacity: dropOpacity,
          transform: [
            { translateY: dropY },
            { translateY: floatAnim },
          ],
        },
        // 今日のドット: 1.6倍サイズ・発光ボーダー・影
        isToday && {
          borderWidth: 1.5,
          borderColor: (scoreColor ?? '#9C8FFF') + 'AA',
          shadowColor: scoreColor ?? '#6B5CE7',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 10,
          shadowOpacity: 0.85,
          elevation: 8,
        },
        empty && styles.goalDotEmpty,
      ]}
    >
      {!empty && score != null && <Text style={styles.goalDotScore}>{score}</Text>}
    </Animated.View>
  );
}

// ============================================================
// 付箋紙コンポーネント（睡眠負債用）
// ============================================================
const STICKY_FONT = 'ZenKurenaido-Regular';

function StickyNoteDebt({
  label,
  value,
  color,
  screenW,
  topOffset,
}: {
  label: string;
  value: string;
  color: string;
  screenW: number;
  topOffset: number;
}) {
  return (
    <View style={[stickyStyles.note, { left: screenW * 0.04, top: topOffset }]}>
      {/* テープ風ストリップ（上端）*/}
      <View style={stickyStyles.tape} />
      <Text style={stickyStyles.label}>{label}</Text>
      <Text style={[stickyStyles.value, { color }]}>{value}</Text>
    </View>
  );
}

const stickyStyles = StyleSheet.create({
  note: {
    position: 'absolute',
    backgroundColor: '#FEFCE0',
    borderRadius: 3,
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    zIndex: 12,
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  tape: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 11,
    backgroundColor: '#F9E84A',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    opacity: 0.85,
  },
  label: {
    fontFamily: STICKY_FONT,
    fontSize: 11,
    color: '#888866',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  value: {
    fontFamily: STICKY_FONT,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 24,
    backgroundColor: HOME_THEME.surfaceGlass,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
    shadowColor: HOME_THEME.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 22,
  },
  heroCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 8,
  },
  heroMetaColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 12,
    color: HOME_THEME.goldStrong,
    marginBottom: 6,
    fontWeight: '600',
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: HOME_THEME.textSecondary,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: HOME_THEME.surfaceSoft,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
  },
  heroBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 11,
    color: HOME_THEME.textPrimary,
    fontWeight: '700',
  },
  heroStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME_THEME.goldSurface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: HOME_THEME.goldBorder,
  },
  heroStreakText: {
    fontSize: 11,
    color: HOME_THEME.goldStrong,
    fontWeight: '700',
  },
  heroPrimaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_THEME.gold,
    borderWidth: 1,
    borderColor: 'rgba(255, 248, 236, 0.22)',
    borderTopColor: 'rgba(255, 252, 246, 0.38)',
    paddingHorizontal: 16,
    shadowColor: HOME_THEME.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  heroPrimaryActionWarm: {
    backgroundColor: HOME_THEME.goldStrong,
    shadowColor: HOME_THEME.gold,
  },
  heroPrimaryActionText: {
    color: '#17263A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  heroSecondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    backgroundColor: HOME_THEME.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(246, 241, 232, 0.1)',
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 14,
    shadowColor: HOME_THEME.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  heroSecondaryActionText: {
    color: HOME_THEME.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  heroAiAction: {
    backgroundColor: 'rgba(48, 72, 98, 0.92)',
    borderColor: 'rgba(134, 175, 195, 0.22)',
    borderTopColor: 'rgba(214, 232, 242, 0.16)',
  },
  heroAiActionLocked: {
    backgroundColor: 'rgba(15, 26, 42, 0.84)',
    borderColor: 'rgba(196, 207, 219, 0.08)',
  },
  panelActionGroup: {
    marginBottom: 12,
  },
  panelQuickStats: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: HOME_THEME.surfacePrimary,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
  },
  panelQuickStatsTitle: {
    fontSize: 11,
    color: HOME_THEME.goldStrong,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  panelQuickStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  panelQuickStat: {
    flex: 1,
    backgroundColor: HOME_THEME.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: HOME_THEME.borderCool,
  },
  panelQuickLabel: {
    fontSize: 10,
    color: HOME_THEME.textMuted,
    marginBottom: 4,
  },
  panelQuickValue: {
    fontSize: 16,
    color: HOME_THEME.textPrimary,
    fontWeight: '800',
  },
  panelActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // s喩~]|]s鍰級wf]{ScoreRing?s驎
  panelEmptyHint: {
    marginTop: 10,
    color: HOME_THEME.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  topZone: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingRight: 0,
    marginTop: 4,
  },
  dateColumn: {
    alignItems: 'flex-start',
  },
  dateText: { fontSize: 12, color: HOME_THEME.textSecondary, marginTop: 8 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME_THEME.goldSurface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: HOME_THEME.goldBorder,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  streakText: {
    fontSize: 12,
    color: HOME_THEME.goldStrong,
    fontWeight: '700',
  },
  topRight: {
    alignItems: 'flex-end',
  },
  topRightColumn: {
    alignItems: 'flex-end',
  },
  topSummaryColumn: {
    marginTop: 6,
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: HOME_THEME.surfaceGlass,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
  },
  topSummaryItem: {
    alignItems: 'flex-end',
  },
  topSummaryLabel: {
    fontSize: 10,
    color: HOME_THEME.textMuted,
    lineHeight: 13,
  },
  topSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: HOME_THEME.textPrimary,
    lineHeight: 20,
  },
  scoreCloudWrap: {
    backgroundColor: HOME_THEME.surfaceGlass,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
    alignItems: 'center',
  },
  scoreContext: { fontSize: 10, color: HOME_THEME.textMuted, marginLeft: 10, flex: 1, textAlign: 'left' },
        // クマ周囲のゴールドット（絶対配置）
  floatingDotWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },
  todayMarker: {
    marginTop: 4,
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: HOME_THEME.surfaceGlass,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
    shadowColor: HOME_THEME.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  todayMarkerText: {
    fontSize: 7,
    color: HOME_THEME.goldText,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cloudDot: {
    width: 36,
    height: 28,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalDotEmpty: { opacity: 0.35 },
  goalDotScore: { fontSize: 13, fontFamily: 'KiwiMaru-Regular', color: '#FFFFFF', lineHeight: 16, includeFontPadding: false },
  goalDayMeta: {
    marginTop: 2,
    alignItems: 'center',
    gap: 2,
  },
          // 今日のドット：1.6倍サイズなのでスコアも大きく
  goalDayLabel: { fontSize: 9, color: HOME_THEME.textPrimary, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
          // 今日の曜日ラベル・少し大きく
        // AIチャットボタン・ECG波線アニメ
  guideAnchor: {
    position: 'absolute',
    left: 12,
    zIndex: 30,
  },
  guideButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: HOME_THEME.surfaceGlass,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
  },
  guideButtonText: {
    color: HOME_THEME.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  guideCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 20,
    backgroundColor: HOME_THEME.surfacePrimary,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
    shadowColor: HOME_THEME.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  guideCardTitle: {
    color: HOME_THEME.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  guideCardClose: {
    color: HOME_THEME.goldStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  guideCardHint: {
    color: HOME_THEME.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  guideList: {
    gap: 10,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guideItemIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HOME_THEME.goldSurface,
    borderWidth: 1,
    borderColor: HOME_THEME.goldBorder,
  },
  guideItemIndexText: {
    color: HOME_THEME.goldText,
    fontSize: 11,
    fontWeight: '800',
  },
  guideItemCopy: {
    flex: 1,
  },
  guideItemTitle: {
    color: HOME_THEME.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  guideItemBody: {
    color: HOME_THEME.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  chatButtonShell: {
    position: 'absolute',
    borderRadius: 20,
    zIndex: 10,
    elevation: 8,
    shadowColor: HOME_THEME.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
  },
  chatButtonInner: {
    borderRadius: 20,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: HOME_THEME.surfaceRaised,
    borderTopWidth: 1,
    borderTopColor: 'rgba(240, 201, 120, 0.18)',
    overflow: 'hidden',
  },
  chatButtonLocked: { backgroundColor: 'rgba(15, 26, 42, 0.92)' },
  chatButtonText: { color: HOME_THEME.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  // AIチャット導線ボタン
  aiChatPanelButton: {
    backgroundColor: HOME_THEME.surfaceRaised,
    borderRadius: 22,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiChatPanelButtonLocked: { backgroundColor: 'rgba(15, 26, 42, 0.92)' },
  aiChatPanelButtonText: { color: HOME_THEME.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
        // ミニ記録ボタン（スコアリングの下）
  miniRecordButton: {
    marginTop: 8,
    backgroundColor: HOME_THEME.gold,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 244, 226, 0.18)',
  },
  miniRecordButtonText: { color: '#17263A', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  // 9a5u]緘x
  debtBadge: {
    position: 'absolute',
    backgroundColor: HOME_THEME.surfaceGlass,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
    zIndex: 10,
    minWidth: 70,
  },
  debtBadgeLabel: { fontSize: 9, color: HOME_THEME.textMuted, marginBottom: 2 },
  debtBadgeValue: { fontSize: 16, fontWeight: 'bold' },
        // 今日の睡眠サマリー（旧横並び・未使用）
  topSummaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 6,
    backgroundColor: HOME_THEME.surfaceGlass,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
  },
  topSummaryTitle: {
    fontSize: 10,
    color: HOME_THEME.goldStrong,
    fontWeight: '600',
  },
  // ボトムパネル
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 392,
    backgroundColor: HOME_THEME.surfaceGlass,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: HOME_THEME.borderSoft,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(240, 201, 120, 0.4)',
    alignSelf: 'center',
  },
  handleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 4,
  },
  firstTimeCard: {
    marginBottom: 12,
    backgroundColor: HOME_THEME.surfacePrimary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: HOME_THEME.borderStrong,
    alignItems: 'center',
  },
  firstTimeTitle: { fontSize: 15, fontWeight: 'bold', color: HOME_THEME.goldStrong, marginBottom: 4 },
  firstTimeDesc: { fontSize: 12, color: HOME_THEME.textSecondary, textAlign: 'center', lineHeight: 18 },
  premiumTeaserCard: {
    marginBottom: 12,
    backgroundColor: HOME_THEME.surfacePrimary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: HOME_THEME.borderStrong,
  },
  premiumTeaserTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: HOME_THEME.textPrimary,
    marginBottom: 6,
  },
  premiumTeaserBody: {
    fontSize: 12,
    color: HOME_THEME.textSecondary,
    lineHeight: 18,
  },
  recordButton: {
    backgroundColor: HOME_THEME.gold,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  recordButtonText: { color: '#17263A', fontSize: 15, fontWeight: '600' },

  missedBanner: {
    marginBottom: 10,
    backgroundColor: HOME_THEME.goldSurface,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: HOME_THEME.goldBorder,
  },
  missedBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  missedBannerText: { color: HOME_THEME.goldStrong, fontSize: 12 },
  missedBannerAction: { color: HOME_THEME.goldStrong, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  missedBannerDismiss: { color: HOME_THEME.textSecondary, fontSize: 14, padding: 4 },
  summaryCard: {
    backgroundColor: HOME_THEME.surfaceGlass,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: HOME_THEME.borderSoft,
  },
  cardTitle: { fontSize: 13, color: HOME_THEME.textSecondary, marginBottom: 10, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: HOME_THEME.textPrimary },
  summaryLabel: { fontSize: 10, color: HOME_THEME.textSecondary, marginTop: 3 },
});
