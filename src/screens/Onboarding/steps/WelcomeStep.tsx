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

interface Props {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: Props) {
  const { t } = useTranslation();

  const FEATURES = [
    // しろくまペルソナの紹介（先頭に追加）
    { emoji: '🐻‍❄️', label: t('onboarding.welcome.feature0') },
    { emoji: '🤖', label: t('onboarding.welcome.feature1') },
    { emoji: '📊', label: t('onboarding.welcome.feature2') },
    { emoji: '📔', label: t('onboarding.welcome.feature3') },
  ];

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY      = useRef(new Animated.Value(24)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY   = useRef(new Animated.Value(16)).current;
  const featuresOpacity = useRef(new Animated.Value(0)).current;
  const featuresY  = useRef(new Animated.Value(12)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonY    = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const reveal = (opacity: Animated.Value, y: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
        Animated.timing(y,       { toValue: 0, duration: 400, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]);

    Animated.parallel([
      reveal(logoOpacity,     logoY,     0),
      reveal(contentOpacity,  contentY,  120),
      reveal(featuresOpacity, featuresY, 260),
      reveal(buttonOpacity,   buttonY,   400),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoBlock, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
        <Text style={styles.logo}>🌅</Text>
        <Text style={styles.appName}>YOAKE</Text>
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
        <Text style={styles.tagline}>{t('onboarding.welcome.tagline')}</Text>
      </Animated.View>

      <Animated.View style={[styles.features, { opacity: featuresOpacity, transform: [{ translateY: featuresY }] }]}>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
            </View>
            <Text style={styles.featureText}>{f.label}</Text>
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
  logo: {
    fontSize: 72,
    marginBottom: 8,
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
    marginBottom: 32,
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
  featureEmoji: {
    fontSize: 18,
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
