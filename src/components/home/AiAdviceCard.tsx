import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../i18n';
import ShirokumaIcon from '../common/ShirokumaIcon';
import { ShirokumaMood } from '../common/ShirokumaIcon';

interface Props {
  advice: string | null;
  isLoading: boolean;
  onRefresh?: () => void;
  score?: number | null;   // 追加（未指定時は normal 扱い）
}

// スコア帯 → mood 変換
function getMoodFromScore(score: number | null | undefined): ShirokumaMood {
  if (score == null) return 'normal';
  if (score >= 80) return 'happy';
  if (score >= 60) return 'normal';
  return 'cheer';
}

export default function AiAdviceCard({ advice, isLoading, onRefresh, score }: Props) {
  const { t } = useTranslation();
  const mood = getMoodFromScore(score);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShirokumaIcon size={24} mood={mood} />
          <Text style={styles.title}>{t('aiAdviceCard.title')}</Text>
        </View>
        {onRefresh && !isLoading && (
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>{'🔄 '}{t('aiAdviceCard.refresh')}</Text>
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
  title: { fontSize: 13, color: '#9A9AB8', fontWeight: '600' },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#6B5CE7',
    borderRadius: 12,
  },
  refreshText: { fontSize: 11, color: '#6B5CE7' },
  advice: { fontSize: 15, color: '#E0E0F0', lineHeight: 24 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#9A9AB8', fontSize: 14 },
});
