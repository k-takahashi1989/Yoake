import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AiReport } from '../../../types';
import { useTranslation } from '../../../i18n';

interface Props {
  weeklyReport: AiReport | null;
  pastReports: Array<{ key: string } & AiReport>;
  isLoadingReport: boolean;
  onGenerate: () => void;
}

export default function WeeklyReportCard({
  weeklyReport,
  pastReports,
  isLoadingReport,
  onGenerate,
}: Props) {
  const { t } = useTranslation();
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(null);

  return (
    <>
      {/* 今週のレポート */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{t('report.weeklyAIReportTitle')}</Text>
          <TouchableOpacity
            style={[styles.generateBtn, isLoadingReport && styles.generateBtnDisabled]}
            onPress={onGenerate}
            disabled={isLoadingReport}
          >
            <Text style={styles.generateBtnText}>
              {isLoadingReport ? t('report.generatingBtn') : weeklyReport ? t('report.regenerateBtn') : t('report.generateBtn')}
            </Text>
          </TouchableOpacity>
        </View>
        {isLoadingReport ? (
          <ActivityIndicator color="#6B5CE7" style={{ marginTop: 8 }} />
        ) : weeklyReport ? (
          <Text style={styles.reportText}>{weeklyReport.content}</Text>
        ) : (
          <Text style={styles.reportPlaceholder}>{t('report.reportPlaceholder')}</Text>
        )}
      </View>

      {/* 過去のレポート */}
      {pastReports.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('report.pastReportsTitle')}</Text>
          {pastReports.slice(1).map(r => {
            const isExpanded = expandedReportKey === r.key;
            const weekLabel = r.key.replace(/(\d{4})-W(\d+)/, '$1年 第$2週');
            return (
              <TouchableOpacity
                key={r.key}
                style={styles.pastReportRow}
                onPress={() => setExpandedReportKey(isExpanded ? null : r.key)}
                activeOpacity={0.7}
              >
                <View style={styles.pastReportHeader}>
                  <Text style={styles.pastReportLabel}>{weekLabel}</Text>
                  <Text style={styles.pastReportChevron}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
                {isExpanded && (
                  <Text style={styles.pastReportContent}>{r.content}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 12 },
  generateBtn: {
    backgroundColor: '#6B5CE720',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6B5CE740',
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: '#9C8FFF', fontSize: 12 },
  reportText: { fontSize: 14, color: '#D0D0E8', lineHeight: 22 },
  reportPlaceholder: { fontSize: 13, color: '#555', lineHeight: 20 },
  pastReportRow: {
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
    paddingVertical: 10,
  },
  pastReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastReportLabel: { fontSize: 13, color: '#D0D0E8', fontWeight: '600' },
  pastReportChevron: { fontSize: 10, color: '#666' },
  pastReportContent: {
    fontSize: 13,
    color: '#B0B0C8',
    lineHeight: 20,
    marginTop: 8,
  },
});
