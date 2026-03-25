import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🌅</Text>
      <Text style={styles.appName}>YOAKE</Text>
      <Text style={styles.tagline}>毎朝AIが、あなたの睡眠を{'\n'}採点して改善策を教えてくれる</Text>

      <View style={styles.features}>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.featureRow}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>はじめる</Text>
      </TouchableOpacity>
    </View>
  );
}

const FEATURES = [
  { emoji: '🤖', label: 'AIが毎朝ひとこと睡眠アドバイス' },
  { emoji: '📊', label: '睡眠スコアで毎日の質を可視化' },
  { emoji: '⏰', label: '浅い眠りに合わせたスマートアラーム' },
  { emoji: '📔', label: '習慣と睡眠の相関をAIが分析' },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#B0B0C8',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  features: {
    width: '100%',
    marginBottom: 48,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  featureEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#D0D0E8',
  },
  button: {
    backgroundColor: '#6B5CE7',
    paddingHorizontal: 64,
    paddingVertical: 18,
    borderRadius: 30,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
