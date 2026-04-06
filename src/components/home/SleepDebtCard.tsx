import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SleepLog } from '../../types';
import { calculateSleepDebt } from '../../utils/scoreCalculator';
import { useTranslation } from '../../i18n';
import Icon from '../common/Icon';
import BatteryIcon from '../common/BatteryIcon';

interface Props {
  recentLogs: SleepLog[];
  targetHours: number;
  isPremium: boolean;
}


export default function SleepDebtCard({ recentLogs, targetHours, isPremium }: Props) {
  const { t } = useTranslation();

  if (!isPremium) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('sleepDebt.title')}</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>{t('sleepDebt.paidLabel')}</Text>
          </View>
        </View>
        <View style={styles.lockedRow}>
          <Icon name="lock" size={18} color="#6B5CE7" />
          <Text style={styles.premiumHint}>{t('sleepDebt.locked')}</Text>
        </View>
      </View>
    );
  }

  const debtMinutes = calculateSleepDebt(recentLogs.slice(0, 14), targetHours);
  const debtHours = Math.floor(debtMinutes / 60);
  const debtMins = debtMinutes % 60;

  const debtText =
    debtMinutes === 0
      ? t('sleepDebt.none')
      : `${debtHours > 0 ? `${debtHours}${t('common.hours')}` : ''}${debtMins > 0 ? `${debtMins}${t('common.minutes')}` : ''}`;

  const debtColor =
    debtMinutes === 0
      ? '#4CAF50'
      : debtMinutes < 120
      ? '#FFC107'
      : '#F44336';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('sleepDebt.title')}</Text>
      </View>

      {/* 負債量テキストとバッテリーアイコンを横並びで表示 */}
      <View style={styles.debtRow}>
        <Text style={[styles.debtValue, { color: debtColor }]}>
          {debtText}
        </Text>
        <BatteryIcon debtMinutes={debtMinutes} size="md" />
      </View>

      {debtMinutes > 0 && (
        <Text style={styles.hint}>
          {t('sleepDebt.hint', { target: targetHours })}
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
    color: '#9A9AB8',
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
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  debtValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#9A9AB8',
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  premiumHint: {
    fontSize: 12,
    color: '#6B5CE7',
  },
});
