import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSleepStore } from '../../stores/sleepStore';
import { useAuthStore } from '../../stores/authStore';
import { getScoreInfo } from '../../utils/scoreCalculator';
import { SCORE_COLORS, FREE_LIMITS } from '../../constants';
import { SleepLog, DiaryStackParamList } from '../../types';
import HabitCustomizeModal from './HabitCustomizeModal';

type DiaryNav = NativeStackNavigationProp<DiaryStackParamList>;

export default function DiaryScreen() {
  const navigation = useNavigation<DiaryNav>();
  const { recentLogs, loadRecent } = useSleepStore();
  const { isPremium } = useAuthStore();
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    loadRecent(30);
  }, []);

  const visibleLogs = isPremium
    ? recentLogs
    : recentLogs.slice(0, FREE_LIMITS.LOG_HISTORY_DAYS);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>睡眠日記</Text>
        <TouchableOpacity
          style={styles.customizeBtn}
          onPress={() => setShowCustomize(true)}
        >
          <Text style={styles.customizeBtnText}>⚙️ 習慣</Text>
        </TouchableOpacity>
      </View>

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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📔</Text>
            <Text style={styles.emptyText}>まだ記録がありません</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => (navigation.getParent() as any)?.navigate('Home')}
            >
              <Text style={styles.emptyBtnText}>ホームで睡眠を記録する</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          !isPremium && recentLogs.length > FREE_LIMITS.LOG_HISTORY_DAYS ? (
            <View style={styles.premiumBanner}>
              <Text style={styles.premiumText}>
                🔒 7日より前の記録はプレミアムで閲覧できます
              </Text>
            </View>
          ) : null
        }
      />

      <HabitCustomizeModal
        visible={showCustomize}
        onClose={() => setShowCustomize(false)}
      />
    </SafeAreaView>
  );
}

// Firestore Timestamp / Date / プレーンオブジェクト を安全にDateへ変換
function safeToDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts;
  if (typeof ts.toDate === 'function') {
    const d: Date = ts.toDate();
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (ts.seconds !== undefined) return new Date(ts.seconds * 1000);
  return new Date();
}

function DiaryRow({ log, onPress }: { log: SleepLog; onPress: () => void }) {
  const scoreInfo = getScoreInfo(log.score);
  const scoreColor = SCORE_COLORS[scoreInfo.color.toUpperCase() as keyof typeof SCORE_COLORS];
  const dateLabel = format(new Date(log.date.replace(/-/g, '/')), 'M月d日（EEE）', { locale: ja });
  const hours = Math.floor(log.totalMinutes / 60);
  const mins = log.totalMinutes % 60;
  const checkedHabits = log.habits.filter(h => h.checked);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '20', borderColor: scoreColor }]}>
        <Text style={[styles.scoreValue, { color: scoreColor }]}>{log.score}</Text>
        <Text style={[styles.scoreLabel, { color: scoreColor }]}>{scoreInfo.label}</Text>
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
  customizeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2D2D44',
    borderRadius: 20,
  },
  customizeBtnText: { fontSize: 13, color: '#9C8FFF' },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
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
  sleepTime: { fontSize: 13, color: '#B0B0C8', marginBottom: 3 },
  habits: { fontSize: 14, letterSpacing: 2 },
  chevron: { fontSize: 20, color: '#444' },
  emptyContainer: { alignItems: 'center', paddingTop: 64, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#888' },
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
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  premiumText: { color: '#6B5CE7', fontSize: 14 },
});
