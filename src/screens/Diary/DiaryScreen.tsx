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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useHabitStore } from '../../stores/habitStore';
import { useAuthStore } from '../../stores/authStore';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { SCORE_COLORS, FREE_LIMITS } from '../../constants';
import { SleepLog, DiaryStackParamList, UserGoal } from '../../types';
import HabitCustomizeModal from './HabitCustomizeModal';
import SleepInputModal from '../Home/SleepInputModal';
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
  }, [screenW, screenH]));

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
  }, [navigation]);

  useEffect(() => {
    loadRecent(30);
  }, []);

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
          <Text style={styles.addPastBtnText}>{t('diary.addPastRecord')}</Text>
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

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '40', borderColor: scoreColor }]}>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{log.score}</Text>
        <Text style={[styles.scoreLabel, { color: scoreColor }]}>{t(scoreInfo.labelKey)}</Text>
      </View>

      {/* 左カラム：日付・時刻・メモ */}
      <View style={styles.rowLeft}>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.sleepTime}>
          {format(safeToDate(log.bedTime), 'HH:mm')} → {format(safeToDate(log.wakeTime), 'HH:mm')}
          {'  '}{hours}h{mins}m
        </Text>
        {log.memo ? (
          <Text style={styles.memoPreview} numberOfLines={1}>{log.memo}</Text>
        ) : null}
      </View>

      {/* 右カラム：習慣emoji（あれば） */}
      {checkedHabits.length > 0 ? (
        <View style={styles.rowRight}>
          <Text style={styles.habits}>
            {checkedHabits.map(h => h.emoji).join('\n')}
          </Text>
        </View>
      ) : null}

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
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
  list: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 92, 231, 0.25)',
    gap: 12,
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
  rowLeft: { flex: 1 },
  rowRight: {
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(107, 92, 231, 0.2)',
  },
  memoPreview: {
    fontSize: 12,
    fontFamily: 'ZenKurenaido-Regular',
    color: '#9A9AB8',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  dateText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  sleepTime: { fontSize: 14, fontFamily: 'ZenKurenaido-Regular', color: '#C8C8E0', marginBottom: 3 },
  habits: { fontSize: 14, letterSpacing: 2 },
  chevron: { fontSize: 20, color: '#C8C8E0' },
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
  premiumText: { color: '#9C8FFF', fontSize: 14 },
  // 過去の記録を追加ボタン
  addPastBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6B5CE740',
  },
  addPastBtnText: {
    color: '#9C8FFF',
    fontSize: 13,
  },
});
