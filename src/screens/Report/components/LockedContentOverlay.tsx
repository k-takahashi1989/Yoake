import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../../i18n';
import { SUBSCRIPTION } from '../../../constants';
import Icon from '../../../components/common/Icon';

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
  const previewPoints = isJa
    ? [
        { label: '今週の平均', value: '78点' },
        { label: '先週比', value: '+6点' },
        { label: '次の一手', value: '23:30までに布団へ' },
      ]
    : [
        { label: 'Weekly average', value: '78 pts' },
        { label: 'vs last week', value: '+6 pts' },
        { label: 'Next move', value: 'Get in bed by 11:30 pm' },
      ];
  const previewSnippet = isJa
    ? '火曜と木曜に就寝が遅れた日ほどスコアが下がりやすい傾向です。今週はまず、23:30までにベッドに入る日を2日つくってみましょう。'
    : 'Your score tends to dip most on days when bedtime slips later. This week, aim for two nights in bed by 11:30 pm.';

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
          <View style={styles.badge}>
            <Icon name="crown" size={14} color="#F2EEFF" />
            <Text style={styles.lockIcon}>{isJa ? 'プレミアム' : 'Premium'}</Text>
          </View>
          <Text style={styles.ctaTitle}>{title}</Text>
          <Text style={styles.ctaSubtitle}>{subtitle}</Text>
          <View style={styles.previewGrid}>
            {previewPoints.map(point => (
              <View key={point.label} style={styles.previewStat}>
                <Text style={styles.previewStatLabel}>{point.label}</Text>
                <Text style={styles.previewStatValue}>{point.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.previewSnippetCard}>
            <Text style={styles.previewSnippetLabel}>
              {isJa ? 'AIレポートの見え方' : 'How the AI report reads'}
            </Text>
            <Text style={styles.previewSnippetText}>{previewSnippet}</Text>
          </View>
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 92, 231, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(207, 203, 255, 0.18)',
    marginBottom: 10,
  },
  lockIcon: {
    fontSize: 12,
    color: '#CFCBFF',
    fontWeight: '800',
    letterSpacing: 0.5,
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
    marginBottom: 14,
    lineHeight: 20,
  },
  previewGrid: {
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  previewStat: {
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewStatLabel: {
    color: '#AFA9D9',
    fontSize: 11,
    marginBottom: 3,
  },
  previewStatValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewSnippetCard: {
    width: '100%',
    backgroundColor: 'rgba(107, 92, 231, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  previewSnippetLabel: {
    color: '#DCD8FF',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  previewSnippetText: {
    color: '#E8E4FF',
    fontSize: 12,
    lineHeight: 18,
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
