import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTranslation } from '../../../i18n';
import ScalePressable from '../../../components/common/ScalePressable';
import Icon, { IconName } from '../../../components/common/Icon';

interface Props {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: Props) {
  const { t } = useTranslation();
  const isEnglishUi = t('nav.aiChat') === 'AI Chat';

  const features: Array<{ icon: IconName; label: string }> = [
    { icon: 'speech-bubble', label: t('onboarding.welcome.feature0') },
    { icon: 'sparkling', label: t('onboarding.welcome.feature1') },
    { icon: 'data-analytics', label: t('onboarding.welcome.feature2') },
    { icon: 'note', label: t('onboarding.welcome.feature3') },
  ];

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(16)).current;
  const featuresOpacity = useRef(new Animated.Value(0)).current;
  const featuresY = useRef(new Animated.Value(12)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const reveal = (opacity: Animated.Value, y: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        Animated.timing(y, {
          toValue: 0,
          duration: 400,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      reveal(logoOpacity, logoY, 0),
      reveal(contentOpacity, contentY, 120),
      reveal(featuresOpacity, featuresY, 260),
      reveal(buttonOpacity, buttonY, 400),
    ]).start();
  }, [buttonOpacity, buttonY, contentOpacity, contentY, featuresOpacity, featuresY, logoOpacity, logoY]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoBlock, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
        <View style={styles.logoBadge}>
          <Icon name="sparkling" size={34} color="#FFFFFF" />
        </View>
        <Text style={styles.appName}>YOAKE</Text>
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
        <Text style={styles.tagline}>{t('onboarding.welcome.tagline')}</Text>
        <View style={styles.promiseCard}>
          <Text style={styles.promiseTitle}>
            {isEnglishUi ? 'From zero to your first score in a few minutes' : '数分で、最初のスコアと次の改善が見える'}
          </Text>
          <Text style={styles.promiseBody}>
            {isEnglishUi
              ? 'Set a goal, connect health data or log manually, then start seeing what helps your sleep.'
              : '目標設定と記録だけで、まず今日の状態が見えます。データが増えるほどAIの提案も具体的になります。'}
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.features, { opacity: featuresOpacity, transform: [{ translateY: featuresY }] }]}>
        {features.map(feature => (
          <View key={feature.label} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Icon name={feature.icon} size={18} color="#DCD8FF" />
            </View>
            <Text style={styles.featureText}>{feature.label}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity, transform: [{ translateY: buttonY }] }]}>
        <ScalePressable style={styles.button} onPress={onNext}>
          <Text style={styles.buttonText}>{t('onboarding.welcome.startBtn')}</Text>
        </ScalePressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(107, 92, 231, 0.26)',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 8,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 16,
    color: '#C8C8E8',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 18,
  },
  promiseCard: {
    backgroundColor: 'rgba(107, 92, 231, 0.14)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.26)',
  },
  promiseTitle: {
    fontSize: 13,
    color: '#F4F1FF',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  promiseBody: {
    fontSize: 12,
    color: '#C8C8E8',
    textAlign: 'center',
    lineHeight: 18,
  },
  features: {
    width: '100%',
    backgroundColor: 'rgba(45, 45, 68, 0.78)',
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(107, 92, 231, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#E0E0F0',
    flex: 1,
    lineHeight: 20,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 64,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#6B5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
