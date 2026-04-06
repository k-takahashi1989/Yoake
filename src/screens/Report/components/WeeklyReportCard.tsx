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
import ScalePressable from '../../../components/common/ScalePressable';
import { MORNING_THEME } from '../../../theme/morningTheme';

interface Props {
  weeklyReport: AiReport | null;
  pastReports: Array<{ key: string } & AiReport>;
  isLoadingReport: boolean;
  onGenerate: () => void;
  /** 今週平均スコア（前週比表示用）。null/undefined の場合は前週比行を非表示 */
  currentWeekAvgScore?: number | null;
  /** 前週平均スコア（スコア前週比表示用）。null/undefined の場合は前週比を非表示 */
  previousWeekAvgScore?: number | null;
}

export default function WeeklyReportCard({
  weeklyReport,
  pastReports,
  isLoadingReport,
  onGenerate,
  currentWeekAvgScore,
  previousWeekAvgScore,
}: Props) {
  const { t } = useTranslation();
  const [expandedReportKey, setExpandedReportKey] = useState<string | null>(null);

  return (
    <>
      {/* 今週のレポート */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{t('report.weeklyAIReportTitle')}</Text>
          {/* weeklyReport が未生成かつローディング中でないときだけボタンを表示 */}
          {weeklyReport === null && !isLoadingReport && (
            <ScalePressable
              style={styles.generateBtn}
              onPress={onGenerate}
              scaleValue={0.94}
            >
              <Text style={styles.generateBtnText}>{t('report.generateBtn')}</Text>
            </ScalePressable>
          )}
        </View>
        {/* 今週平均スコアと前週比 */}
        {currentWeekAvgScore != null && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreText}>
              {t('report.avgScore')}: {currentWeekAvgScore}{t('common.points')}
            </Text>
            {previousWeekAvgScore != null && (() => {
              const diff = currentWeekAvgScore - previousWeekAvgScore;
              if (diff > 0) {
                return <Text style={[styles.diffText, { color: '#4CAF50' }]}>↑ +{diff}</Text>;
              } else if (diff < 0) {
                return <Text style={[styles.diffText, { color: '#FF5722' }]}>↓ {diff}</Text>;
              } else {
                return <Text style={[styles.diffText, { color: '#9A9AB8' }]}>→ {t('report.noChange')}</Text>;
              }
            })()}
          </View>
        )}
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
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 16,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, color: MORNING_THEME.goldStrong, fontWeight: '600', marginBottom: 12 },
  generateBtn: {
    backgroundColor: MORNING_THEME.goldSurface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { color: MORNING_THEME.goldText, fontSize: 13, fontWeight: '700' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scoreText: { fontSize: 12, color: MORNING_THEME.textMuted, fontWeight: '600' },
  diffText: { fontSize: 12, fontWeight: 'bold' },
  reportText: { fontSize: 14, color: MORNING_THEME.textSecondary, lineHeight: 22 },
  reportPlaceholder: { fontSize: 13, color: MORNING_THEME.textMuted, lineHeight: 20 },
  pastReportRow: {
    borderTopWidth: 1,
    borderTopColor: MORNING_THEME.borderSoft,
    paddingVertical: 10,
  },
  pastReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastReportLabel: { fontSize: 13, color: MORNING_THEME.textSecondary, fontWeight: '600' },
  pastReportChevron: { fontSize: 12, color: MORNING_THEME.textMuted },
  pastReportContent: {
    fontSize: 13,
    color: MORNING_THEME.textMuted,
    lineHeight: 20,
    marginTop: 8,
  },
});
