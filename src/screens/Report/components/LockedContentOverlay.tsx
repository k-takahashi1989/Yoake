import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../../i18n';
import { SUBSCRIPTION } from '../../../constants';

interface Props {
  onPress: () => void;
}

export default function LockedContentOverlay({ onPress }: Props) {
  const { i18n } = useTranslation();
  const isJa = i18n.language === 'ja';
  const trialDays = SUBSCRIPTION.TRIAL_DAYS;

  const title = isJa ? '記録を、改善につなげる' : 'Turn your logs into better sleep';
  const subtitle = isJa
    ? '週次レポートと行動分析で、何を変えるとスコアが伸びるか見えてきます。'
    : 'Use weekly reports and action analysis to see what actually improves your score.';
  const cta = isJa
    ? `${trialDays}日間無料で改善分析を試す`
    : `Try the full analysis experience free for ${trialDays} days`;
  const note = isJa
    ? `${trialDays}日間無料、いつでもキャンセル可能`
    : `Free for ${trialDays} days, cancel anytime`;

  return (
    <View style={styles.container}>
      <View style={styles.ghostCard}>
        <View style={styles.ghostMask} />
        <View style={styles.ghostLine} />
        <View style={[styles.ghostLine, styles.ghostLineLong]} />
        <View style={[styles.ghostLine, styles.ghostLineMedium]} />
        <View style={[styles.ghostLine, styles.ghostLineLong]} />
        <View style={[styles.ghostLine, styles.ghostLineShort]} />
      </View>

      <View style={styles.ghostCard}>
        <View style={styles.ghostMask} />
        <View style={styles.ghostLine} />
        <View style={styles.ghostBarRow}>
          {[52, 70, 45, 80, 60, 55].map((height, index) => (
            <View key={index} style={[styles.ghostBar, { height }]} />
          ))}
        </View>
      </View>

      <View style={styles.ctaOverlay} pointerEvents="box-none">
        <View style={styles.ctaCard}>
          <Text style={styles.lockIcon}>PRO</Text>
          <Text style={styles.ctaTitle}>{title}</Text>
          <Text style={styles.ctaSubtitle}>{subtitle}</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.ctaButtonText}>{cta}</Text>
          </TouchableOpacity>
          <Text style={styles.trialNote}>{note}</Text>
        </View>
      </View>
    </View>
  );
}

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
  lockIcon: {
    fontSize: 16,
    color: '#CFCBFF',
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 1.2,
  },
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
