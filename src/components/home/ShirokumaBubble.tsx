import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import AiAdviceSkeleton from './AiAdviceSkeleton';

interface Props {
  advice: string | null;
  compactLabel: string;
  isLoading: boolean;
  isDreamExpanded: boolean;
  onToggleExpand: () => void;
  dreamExpandAnim: Animated.Value;
  ecgAnim: Animated.Value;
  dreamExpandedH: number;
}

export default function ShirokumaBubble({
  advice,
  compactLabel,
  isLoading,
  isDreamExpanded,
  onToggleExpand,
  dreamExpandAnim,
  ecgAnim,
  dreamExpandedH,
}: Props) {
  const isCompact = !isDreamExpanded;

  return (
    <Animated.View
      style={[
        styles.shell,
        isCompact ? styles.shellCompact : styles.shellExpanded,
        {
          borderColor: ecgAnim.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [
              'rgba(107,92,231,0.25)',
              'rgba(156,143,255,0.6)',
              'rgba(200,180,255,0.85)',
            ],
          }),
        },
      ]}
    >
      <View style={[styles.tail, isCompact ? styles.tailCompact : styles.tailExpanded]} />

      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.85}
        style={[styles.inner, isCompact ? styles.innerCompact : styles.innerExpanded]}
        accessibilityRole="button"
        accessibilityLabel={isDreamExpanded ? 'Collapse advice' : 'Expand advice'}
      >
        {isLoading ? (
          <AiAdviceSkeleton />
        ) : (
          <>
            <Animated.View
              style={[
                styles.compactContent,
                {
                  maxHeight: dreamExpandAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [34, 0],
                  }),
                  opacity: dreamExpandAnim.interpolate({
                    inputRange: [0, 0.12, 1],
                    outputRange: [1, 0, 0],
                  }),
                },
              ]}
            >
              <Text style={styles.compactLabel}>{compactLabel}</Text>
            </Animated.View>

            <Animated.View
              style={{
                maxHeight: dreamExpandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, dreamExpandedH],
                }),
                opacity: dreamExpandAnim.interpolate({
                  inputRange: [0, 0.18, 1],
                  outputRange: [0, 0, 1],
                }),
                overflow: 'hidden',
              }}
            >
              <ScrollView
                scrollEnabled={isDreamExpanded}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <Text style={styles.adviceText}>{advice ?? ''}</Text>
              </ScrollView>
              <Text style={styles.chevron}>▲</Text>
            </Animated.View>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    backgroundColor: 'rgba(37, 37, 64, 0.92)',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'visible',
    zIndex: 15,
    elevation: 8,
    shadowColor: '#9B8AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.26,
  },
  shellCompact: {
    alignSelf: 'flex-start',
    minHeight: 44,
    minWidth: 0,
    maxWidth: 132,
  },
  shellExpanded: {
    width: '100%',
  },
  tail: {
    position: 'absolute',
    top: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(22, 18, 54, 0.92)',
  },
  tailCompact: {
    right: 22,
  },
  tailExpanded: {
    left: 24,
  },
  inner: {
    justifyContent: 'center',
  },
  innerCompact: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  innerExpanded: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
  },
  compactContent: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  compactLabel: {
    fontFamily: 'ZenKurenaido-Regular',
    fontSize: 16,
    color: '#F3F0FF',
    letterSpacing: 0.2,
  },
  adviceText: {
    fontSize: 13,
    color: '#E0E0F0',
    lineHeight: 23,
  },
  chevron: {
    fontSize: 10,
    color: 'rgba(200,180,255,0.55)',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
});
