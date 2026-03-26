import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../i18n';
import Icon from '../common/Icon';

interface Props {
  advice: string | null;
  isLoading: boolean;
  onRefresh?: () => void;
}

export default function AiAdviceCard({ advice, isLoading, onRefresh }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="sparkling" size={18} />
          <Text style={styles.title}>{t('aiAdviceCard.title')}</Text>
        </View>
        {onRefresh && !isLoading && (
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>{t('aiAdviceCard.refresh')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#6B5CE7" />
          <Text style={styles.loadingText}>{t('aiAdviceCard.loading')}</Text>
        </View>
      ) : (
        <Text style={styles.advice}>
          {advice ?? t('aiAdviceCard.noData')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: '#252540',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6B5CE7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13, color: '#888', fontWeight: '600' },
  refreshBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  refreshText: { fontSize: 11, color: '#6B5CE7' },
  advice: { fontSize: 15, color: '#E0E0F0', lineHeight: 24 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#888', fontSize: 14 },
});
