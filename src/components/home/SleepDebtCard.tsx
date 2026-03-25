import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { startOfMonth, format } from 'date-fns';
import { SleepLog } from '../../types';
import { calculateSleepDebt } from '../../utils/scoreCalculator';

type DebtPeriod = '14' | '30' | 'month';

interface Props {
  recentLogs: SleepLog[];
  targetHours: number;
  isPremium: boolean;
}

const PERIOD_LABELS: Record<DebtPeriod, string> = {
  '14': '14日',
  '30': '30日',
  'month': '今月',
};

export default function SleepDebtCard({ recentLogs, targetHours, isPremium }: Props) {
  const [period, setPeriod] = useState<DebtPeriod>('14');

  if (!isPremium) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>睡眠負債</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>有料</Text>
          </View>
        </View>
        <View style={styles.lockedRow}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.premiumHint}>プレミアムで睡眠負債を確認できます</Text>
        </View>
      </View>
    );
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const filteredLogs =
    period === '14'
      ? recentLogs.slice(0, 14)
      : period === '30'
      ? recentLogs.slice(0, 30)
      : recentLogs.filter(l => l.date >= monthStart);

  const debtMinutes = calculateSleepDebt(filteredLogs, targetHours);
  const debtHours = Math.floor(debtMinutes / 60);
  const debtMins = debtMinutes % 60;

  const debtText =
    debtMinutes === 0
      ? '睡眠負債なし 🎉'
      : `${debtHours > 0 ? `${debtHours}時間` : ''}${debtMins > 0 ? `${debtMins}分` : ''}`;

  const debtColor =
    debtMinutes === 0
      ? '#4CAF50'
      : debtMinutes < 120
      ? '#FFC107'
      : '#F44336';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>睡眠負債</Text>
      </View>

      {/* 期間チップ */}
      <View style={styles.chipRow}>
        {(['14', '30', 'month'] as DebtPeriod[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, period === p && styles.chipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextActive]}>
              {PERIOD_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.debtValue, { color: debtColor }]}>
        {debtText}
      </Text>

      {debtMinutes > 0 && (
        <Text style={styles.hint}>
          目標 {targetHours}時間/日に対して累積不足分です
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  premiumText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#444',
  },
  chipActive: {
    backgroundColor: '#6B5CE720',
    borderColor: '#6B5CE7',
  },
  chipText: {
    fontSize: 12,
    color: '#888',
  },
  chipTextActive: {
    color: '#9C8FFF',
    fontWeight: '600',
  },
  debtValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: '#888',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  lockIcon: { fontSize: 16 },
  premiumHint: {
    fontSize: 12,
    color: '#6B5CE7',
  },
});
