import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  ImageBackground,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useHabitStore } from '../../stores/habitStore';
import { useAuthStore } from '../../stores/authStore';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { SCORE_COLORS, FREE_LIMITS, SUBSCRIPTION } from '../../constants';
import { SleepLog, DiaryStackParamList, UserGoal } from '../../types';
import HabitCustomizeModal from './HabitCustomizeModal';
import SleepInputModal from '../Home/SleepInputModal';
import Icon from '../../components/common/Icon';
import { getGoal } from '../../services/firebase';
import { useTranslation } from '../../i18n';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';

type DiaryNav = NativeStackNavigationProp<DiaryStackParamList>;

export default function DiaryScreen() {
  const navigation = useNavigation<DiaryNav>();
  const { recentLogs, loadRecent } = useSleepStore();
  const { loadHabits } = useHabitStore();
  const { isPremium } = useAuthStore();
  const [showCustomize, setShowCustomize] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSleepInput, setShowSleepInput] = useState(false);
  const [inputTargetDate, setInputTargetDate] = useState<string | undefined>(undefined);
  const [inputGoal, setInputGoal] = useState<UserGoal | null>(null);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // 背景ズームアニメーション用（UIコンテンツは動かさない）
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgTransX  = useRef(new Animated.Value(0)).current;
  const bgTransY  = useRef(new Animated.Value(0)).current;
  // 初回だけ画像デコード待ちのためディレイを入れる
  const isFirstFocus = useRef(true);

  // NB座標（タイトル配置・ズームターゲット共用）
  const NB_X = screenW * 0.70;
  const NB_Y = screenH * 0.70;
  const S = 3;
  const toX = (NB_X - screenW / 2) * (1 - S);
  const toY = (NB_Y - screenH / 2) * (1 - S);

  // フォーカス時：ズームイン
  useFocusEffect(useCallback(() => {
    scaleAnim.stopAnimation();
    bgTransX.stopAnimation();
    bgTransY.stopAnimation();
    scaleAnim.setValue(1);
    bgTransX.setValue(0);
    bgTransY.setValue(0);
    // 初回は画像デコード完了を待つため少し遅らせる
    const delay = isFirstFocus.current ? 120 : 0;
    isFirstFocus.current = false;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: S,   duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bgTransX,  { toValue: toX, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bgTransY,  { toValue: toY, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [bgTransX, bgTransY, scaleAnim, toX, toY]));

  // ブラー時：ズームアウト（navigation.addListenerで確実に発火）
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
  }, [bgTransX, bgTransY, navigation, scaleAnim]);

  useEffect(() => {
    loadRecent(30);
  }, [loadRecent]);

  // プルトゥリフレッシュ処理
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadRecent(30), loadHabits()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRecent, loadHabits]);

  const visibleLogs = isPremium
    ? recentLogs
    : recentLogs.slice(0, FREE_LIMITS.LOG_HISTORY_DAYS);

  return (
    <View style={styles.root}>
      {/* ノートズームアニメーション：背景のみズーム、UIは固定 */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            overflow: 'hidden',
            transform: [
              { translateX: bgTransX },
              { translateY: bgTransY },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <ImageBackground
          source={require('../../assets/images/bg_home.png')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Animated.View>

      {/* P5スタイル タグライン（ボトムシート上・左側） */}
      <View style={[styles.taglineWrap, { top: screenH * 0.30 }]}>
        <View style={styles.taglineBar} />
        <Text style={styles.taglineText}>{'TRACE YOUR\nNIGHT'}</Text>
      </View>

      {/* ボトムシート（日記リスト） */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8, maxHeight: screenH * 0.50 }]}>
        {/* ハンドル行：中央ハンドル ＋ 右端⚙️ボタン */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
          <TouchableOpacity
            style={styles.routineBtn}
            onPress={() => setShowCustomize(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.routineBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
        {/* 過去の記録を追加するボタン */}
        <TouchableOpacity
          onPress={async () => {
            const g = await getGoal();
            setInputGoal(g);
            setShowDatePicker(true);
          }}
          style={styles.addPastBtn}
        >
          <View style={styles.addPastBtnIcon}>
            <Icon name="note" size={14} color="#F6F2D6" />
          </View>
          <Text style={styles.addPastBtnText}>{t('diary.addRecord')}</Text>
        </TouchableOpacity>

        <FlatList
          data={visibleLogs}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <DiaryRow
              log={item}
              onPress={() => navigation.navigate('ScoreDetail', { date: item.date })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#6B5CE7"
              colors={['#6B5CE7']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📔</Text>
              <Text style={styles.emptyText}>{t('diary.empty')}</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => (navigation.getParent() as any)?.navigate('Home')}
              >
                <Text style={styles.emptyBtnText}>{t('diary.emptyAction')}</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            !isPremium && recentLogs.length > FREE_LIMITS.LOG_HISTORY_DAYS ? (
              <View style={styles.premiumBanner}>
                <Text style={styles.premiumText}>
                  {t('diary.premiumBanner')}
                </Text>
                <TouchableOpacity
                  style={styles.premiumBannerButton}
                  onPress={() =>
                    (navigation.getParent() as any)?.navigate('Profile', { screen: 'SubscriptionManage' })
                  }
                >
                  <Text style={styles.premiumBannerButtonText}>
                    {t('report.upgradeBtn', { days: SUBSCRIPTION.TRIAL_DAYS })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </View>

      <HabitCustomizeModal
        visible={showCustomize}
        onClose={() => setShowCustomize(false)}
      />

      {/* 日付選択ピッカー（過去の記録追加ボタン押下時に表示） */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const dateStr = format(selectedDate, 'yyyy-MM-dd');
              setInputTargetDate(dateStr);
              setShowSleepInput(true);
            }
          }}
        />
      )}

      {/* 過去日付の睡眠記録入力モーダル */}
      <SleepInputModal
        visible={showSleepInput}
        onClose={() => setShowSleepInput(false)}
        existingLog={null}
        goal={inputGoal}
        targetDate={inputTargetDate}
        onSave={() => {
          // 日記リストを最大90日分再読み込み
          useSleepStore.getState().loadRecent(90);
        }}
      />
    </View>
  );
}

function DiaryRow({ log, onPress }: { log: SleepLog; onPress: () => void }) {
  const { t } = useTranslation();
  const scoreInfo = getScoreInfo(log.score);
  const scoreColor = SCORE_COLORS[scoreInfo.color];
  const dateLabel = format(safeToDate(log.date), 'M月d日（EEE）', { locale: getDateFnsLocale() });
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;
  const checkedHabits = (log.habits ?? []).filter(h => h.checked);
  const isToday = log.date === format(new Date(), 'yyyy-MM-dd');

  return (
    <TouchableOpacity style={[styles.row, isToday && styles.rowToday]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '40', borderColor: scoreColor }]}>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{log.score}</Text>
        <Text style={[styles.scoreLabel, { color: scoreColor }]}>{t(scoreInfo.labelKey)}</Text>
      </View>

      {/* 左カラム：日付・時刻・メモ */}
      <View style={styles.rowLeft}>
        <View style={styles.rowHeader}>
          <Text style={styles.dateText}>{dateLabel}</Text>
          {isToday && (
            <View style={styles.todayChip}>
              <Text style={styles.todayChipText}>{t('home.todayMarker')}</Text>
            </View>
          )}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.sleepDuration}>{hours}h{mins}m</Text>
        <Text style={styles.sleepTime}>
          {format(safeToDate(log.bedTime), 'HH:mm')} → {format(safeToDate(log.wakeTime), 'HH:mm')}
        </Text>
        </View>
        {log.memo ? (
          <Text style={styles.memoPreview} numberOfLines={1}>{log.memo}</Text>
        ) : null}
      </View>

      {/* 右カラム：習慣タグ（あれば） */}
      {checkedHabits.length > 0 ? (
        <View style={styles.rowRight}>
          <View style={styles.habitOverflow}>
            <DiaryHabitIcon label="tag" />
            <Text style={styles.habitOverflowText}>+{checkedHabits.length}</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function DiaryHabitIcon({ label }: { label: string }) {
  const stroke = '#DCD8FF';

  switch (label) {
    case 'tag':
      return (
        <Svg width={13} height={13} viewBox="0 0 24 24">
          <Path
            d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="7.5" cy="7.5" r="0.9" fill={stroke} />
        </Svg>
      );
    case 'カフェイン':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M5 9h9v4.5A3.5 3.5 0 0 1 10.5 17h-2A3.5 3.5 0 0 1 5 13.5Z" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
          <Path d="M14 10h2a2 2 0 1 1 0 4h-2" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1="8" y1="5" x2="8" y2="7" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1="11" y1="5" x2="11" y2="7" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case '飲酒':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M8 5h8l-1.5 6H9.5Z" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
          <Line x1="12" y1="11" x2="12" y2="18" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1="9" y1="18" x2="15" y2="18" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    case '運動':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M13 3 6.5 12H11l-1.2 9L17.5 11H13z" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      );
    case '就寝前スマホ':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Rect x="7" y="3.5" width="10" height="17" rx="2.2" fill="none" stroke={stroke} strokeWidth={1.8} />
          <Line x1="10" y1="6.5" x2="14" y2="6.5" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx="12" cy="17" r="1" fill={stroke} />
        </Svg>
      );
    case 'ストレス高め':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M6 15c1.5-2.4 3.1-3.6 6-3.6s4.5 1.2 6 3.6" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M8 8.5 9.6 10 11.2 8.5 12.8 10 14.4 8.5 16 10" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '入浴':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d="M5 12h14v3.2A2.8 2.8 0 0 1 16.2 18H7.8A2.8 2.8 0 0 1 5 15.2Z" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
          <Line x1="7.5" y1="10" x2="16.5" y2="10" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx="9" cy="7" r="1" fill={stroke} />
          <Circle cx="13" cy="6" r="1" fill={stroke} />
        </Svg>
      );
    default:
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="5.5" fill="none" stroke={stroke} strokeWidth={1.8} />
          <Path d="M12 8.7v3.6l2.4 1.6" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1A2E' },
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
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: 'rgba(244, 244, 255, 0.84)',
    letterSpacing: 2,
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  // ボトムシート
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 13, 30, 0.88)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.3)',
    paddingTop: 12,
  },
  // ハンドル行（中央ハンドル＋右端ルーティンボタン）
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
    height: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 92, 231, 0.4)',
  },
  routineBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  routineBtnText: {
    fontSize: 20,
  },
  list: { paddingTop: 6, paddingBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 17,
    borderWidth: 1,
    borderColor: 'rgba(125, 118, 196, 0.26)',
    borderRadius: 18,
    backgroundColor: 'rgba(18, 20, 44, 0.68)',
    gap: 14,
  },
  rowToday: {
    backgroundColor: 'rgba(32, 46, 68, 0.82)',
    borderColor: 'rgba(143, 226, 184, 0.5)',
  },
  scoreBadge: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: { fontSize: 20, fontFamily: 'KiwiMaru-Regular' },
  scoreLabel: { fontSize: 10, fontWeight: '600' },
  rowLeft: { flex: 1, gap: 4 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  rowRight: {
    minWidth: 34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 6,
  },
  memoPreview: {
    fontSize: 12,
    fontFamily: 'ZenKurenaido-Regular',
    color: '#9A9AB8',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  dateText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  todayChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(143, 226, 184, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(143, 226, 184, 0.4)',
  },
  todayChipText: {
    fontSize: 9,
    color: '#DFF9EC',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  sleepDuration: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F3F1FF',
  },
  sleepTime: {
    fontSize: 13,
    fontFamily: 'ZenKurenaido-Regular',
    color: '#C8C8E0',
  },
  habitList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  habitIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  habitOverflow: {
    minWidth: 40,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(221, 216, 255, 0.12)',
  },
  habitOverflowText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DCD8FF',
    letterSpacing: 0.2,
  },
  chevron: { fontSize: 18, color: '#C8C8E0' },
  emptyContainer: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#C8C8E0' },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  premiumBanner: {
    margin: 16,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
  },
  premiumText: { color: '#9C8FFF', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  premiumBannerButton: {
    backgroundColor: '#6B5CE7',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  premiumBannerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // 過去の記録を追加ボタン
  addPastBtn: {
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 48,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(72, 70, 112, 0.72)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(156, 143, 255, 0.34)',
  },
  addPastBtnIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  addPastBtnText: {
    color: '#F2EFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
