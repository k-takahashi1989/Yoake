import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useAuthStore } from '../../stores/authStore';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { SCORE_COLORS, FREE_LIMITS } from '../../constants';
import { SleepLog, DiaryStackParamList } from '../../types';
import HabitCustomizeModal from './HabitCustomizeModal';
import { useTranslation } from '../../i18n';
import { safeToDate, getDateFnsLocale } from '../../utils/dateUtils';

type DiaryNav = NativeStackNavigationProp<DiaryStackParamList>;

export default function DiaryScreen() {
  const navigation = useNavigation<DiaryNav>();
  const { recentLogs, loadRecent } = useSleepStore();
  const { isPremium } = useAuthStore();
  const [showCustomize, setShowCustomize] = useState(false);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  useEffect(() => {
    loadRecent(30);
  }, []);

  const visibleLogs = isPremium
    ? recentLogs
    : recentLogs.slice(0, FREE_LIMITS.LOG_HISTORY_DAYS);

  return (
    <View style={styles.root}>
      {/* 右上フローティングヘッダー（日記帳の左上・机周辺を空ける） */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Text style={styles.title}>{t('diary.title')}</Text>
        <TouchableOpacity
          style={styles.customizeBtn}
          onPress={() => setShowCustomize(true)}
        >
          <Text style={styles.customizeBtnText}>{t('diary.customize')}</Text>
        </TouchableOpacity>
      </View>

      {/* ボトムシート（日記リスト） */}
      <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 8, maxHeight: screenH * 0.50 }]}>
        <View style={styles.handle} />
        <FlatList
          data={visibleLogs}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <DiaryRow
              log={item}
              onPress={() => navigation.navigate('RecordDetail', { date: item.date })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
      <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '20', borderColor: scoreColor }]}>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{log.score}</Text>
        <Text style={[styles.scoreLabel, { color: scoreColor }]}>{t(scoreInfo.labelKey)}</Text>
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Text style={styles.sleepTime}>
          {format(safeToDate(log.bedTime), 'HH:mm')} → {format(safeToDate(log.wakeTime), 'HH:mm')}
          {'  '}{hours}h{mins}m
        </Text>
        {checkedHabits.length > 0 && (
          <Text style={styles.habits}>
            {checkedHabits.map(h => h.emoji).join(' ')}
          </Text>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 右上フローティングヘッダー
  header: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  customizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(13, 13, 30, 0.82)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.35)',
  },
  customizeBtnText: { fontSize: 12, color: '#9C8FFF' },
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
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(107, 92, 231, 0.4)',
    alignSelf: 'center',
    marginBottom: 4,
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
  scoreValue: { fontSize: 20, fontWeight: 'bold' },
  scoreLabel: { fontSize: 10, fontWeight: '600' },
  rowContent: { flex: 1 },
  dateText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  sleepTime: { fontSize: 13, color: '#C8C8E0', marginBottom: 3 },
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
});
