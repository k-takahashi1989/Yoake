import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

export function getLabelToken(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return '•';
  }

  const latinWords = trimmed.match(/[A-Za-z0-9]+/g);
  if (latinWords && latinWords.length > 1) {
    return latinWords
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase() ?? '')
      .join('');
  }

  if (latinWords && latinWords.length === 1) {
    return latinWords[0].slice(0, 2).toUpperCase();
  }

  const chars = Array.from(trimmed.replace(/\s+/g, ''));
  return chars.slice(0, 2).join('');
}

interface Props {
  label: string;
  size?: number;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function TokenBadge({
  label,
  size = 28,
  backgroundColor = 'rgba(107, 92, 231, 0.12)',
  borderColor = 'rgba(107, 92, 231, 0.28)',
  textColor = '#DCD8FF',
  style,
  textStyle,
}: Props) {
  const token = getLabelToken(label);
  const radius = Math.round(size * 0.38);
  const fontSize = Math.max(11, Math.round(size * 0.38));

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor,
          borderColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize,
          },
          textStyle,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {token}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
});
