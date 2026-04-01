import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from '../../../i18n';
import { SUBSCRIPTION } from '../../../constants';

// ============================================================
// ロックコンテンツオーバーレイ（無料ユーザー向けプレビュー+CTA）
// ============================================================

interface Props {
  onPress: () => void;
}

export default function LockedContentOverlay({ onPress }: Props) {
  const { t } = useTranslation();
  const TRIAL_DAYS = SUBSCRIPTION.TRIAL_DAYS;

  return (
    <View style={styles.container}>
      {/* ゴーストカード1: WeeklyReportCard のシルエット */}
      <View style={styles.ghostCard}>
        <View style={styles.ghostMask} />
        <View style={styles.ghostLine} />
        <View style={[styles.ghostLine, styles.ghostLineLong]} />
        <View style={[styles.ghostLine, styles.ghostLineMedium]} />
        <View style={[styles.ghostLine, styles.ghostLineLong]} />
        <View style={[styles.ghostLine, styles.ghostLineShort]} />
      </View>

      {/* ゴーストカード2: HabitCorrelationCard のシルエット */}
      <View style={styles.ghostCard}>
        <View style={styles.ghostMask} />
        <View style={styles.ghostLine} />
        <View style={styles.ghostBarRow}>
          {[52, 70, 45, 80, 60, 55].map((h, i) => (
            <View key={i} style={[styles.ghostBar, { height: h }]} />
          ))}
        </View>
      </View>

      {/* CTAオーバーレイ */}
      <View style={styles.ctaOverlay} pointerEvents="box-none">
        <View style={styles.ctaCard}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.ctaTitle}>{t('report.lockedOverlayTitle')}</Text>
          <Text style={styles.ctaSubtitle}>{t('report.lockedOverlaySubtitle')}</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.ctaButtonText}>{t('report.ctaButtonText', { days: TRIAL_DAYS })}</Text>
          </TouchableOpacity>
          <Text style={styles.trialNote}>{t('report.trialNote', { days: TRIAL_DAYS })}</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 280,
  },
  ghostCard: {
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ghostMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.82)',
    borderRadius: 16,
    zIndex: 1,
  },
  ghostLine: {
    height: 10,
    backgroundColor: 'rgba(107, 92, 231, 0.12)',
    borderRadius: 5,
    marginBottom: 10,
    width: '40%',
  },
  ghostLineLong: { width: '92%' },
  ghostLineMedium: { width: '75%' },
  ghostLineShort: { width: '55%' },
  ghostBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    height: 80,
    marginTop: 8,
  },
  ghostBar: {
    flex: 1,
    backgroundColor: 'rgba(107, 92, 231, 0.15)',
    borderRadius: 4,
  },
  ctaOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
  },
  ctaCard: {
    backgroundColor: 'rgba(13, 13, 30, 0.92)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.45)',
    shadowColor: '#6B5CE7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  lockIcon: { fontSize: 36, marginBottom: 10 },
  ctaTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: '#B0B0C8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  trialNote: {
    fontSize: 11,
    color: '#9A9AB8',
    marginTop: 12,
    textAlign: 'center',
  },
});
