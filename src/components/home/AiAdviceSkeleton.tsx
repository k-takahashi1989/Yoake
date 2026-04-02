/**
 * AiAdviceSkeleton.tsx
 *
 * AIアドバイスカードの読み込み中に表示するSkeletonコンポーネント。
 * react-native-reanimated v3 でopacityをループさせるパルスアニメーションを実装。
 * AiAdviceCardと同じ外形・余白を持ち、差し替えしやすい設計。
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// シマーのベースカラーとハイライトカラー（ダークテーマ用）
const BASE_COLOR = '#3D3D58';

// ============================================================
// 骨格1本分のBarコンポーネント
// ============================================================

interface SkeletonBarProps {
  width: string | number;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBar({ width, height = 12, borderRadius = 6, style }: SkeletonBarProps) {
  // opacity パルスアニメーション（BaseColor ↔ ShimmerColor 相当）
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, {
          duration: 600,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 600,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1, // 無限ループ
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: BASE_COLOR,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ============================================================
// AiAdviceSkeleton 本体
// ============================================================

export default function AiAdviceSkeleton() {
  return (
    <View style={styles.card}>
      {/* ヘッダー行：アイコン円 + タイトルバー */}
      <View style={styles.header}>
        {/* アイコン円 */}
        <View style={styles.headerLeft}>
          <SkeletonBar width={18} height={18} borderRadius={9} />
          <SkeletonBar width={80} height={12} borderRadius={6} style={styles.titleBar} />
        </View>
      </View>

      {/* 本文行1 */}
      <SkeletonBar width="100%" height={13} borderRadius={6} style={styles.textBar} />
      {/* 本文行2 */}
      <SkeletonBar width="88%" height={13} borderRadius={6} style={styles.textBar} />
      {/* 本文行3（短め） */}
      <SkeletonBar width="60%" height={13} borderRadius={6} style={styles.textBar} />
    </View>
  );
}

// ============================================================
// スタイル（AiAdviceCard と同一の外形を維持）
// ============================================================

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: '#252540',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6B5CE7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleBar: {
    marginLeft: 2,
  },
  textBar: {
    marginBottom: 8,
  },
});
