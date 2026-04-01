/**
 * BatteryIcon.tsx
 *
 * 睡眠負債量に応じた4レベルのバッテリーアイコン。
 * react-native-svg でバッテリー形状を描画し、
 * 121分以上の場合は react-native-reanimated v3 でopacityをパルスアニメーション。
 */

import React, { useEffect } from 'react';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { View } from 'react-native';

// ============================================================
// 負債レベルの定義
// ============================================================

type DebtLevel = 'full' | 'three-quarter' | 'half' | 'empty';

function getDebtLevel(debtMinutes: number): DebtLevel {
  if (debtMinutes === 0) return 'full';
  if (debtMinutes <= 60) return 'three-quarter';
  if (debtMinutes <= 120) return 'half';
  return 'empty';
}

const LEVEL_COLOR: Record<DebtLevel, string> = {
  full: '#4CAF50',
  'three-quarter': '#8BC34A',
  half: '#FFC107',
  empty: '#FF5722',
};

// 充電レベルに応じた内側塗りつぶし高さの割合（0〜1）
const LEVEL_FILL: Record<DebtLevel, number> = {
  full: 1,
  'three-quarter': 0.75,
  half: 0.5,
  empty: 0.15,
};

// ============================================================
// サイズ定義
// ============================================================

const SIZE_MAP = {
  sm: 20,
  md: 28,
};

// ============================================================
// Props
// ============================================================

interface BatteryIconProps {
  debtMinutes: number;
  size?: 'sm' | 'md';
}

// ============================================================
// BatteryIcon 本体
// ============================================================

export default function BatteryIcon({ debtMinutes, size = 'md' }: BatteryIconProps) {
  const level = getDebtLevel(debtMinutes);
  const color = LEVEL_COLOR[level];
  const fillRatio = LEVEL_FILL[level];
  const isEmpty = level === 'empty';

  // 121分以上のとき opacity パルスアニメーションを実行
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (isEmpty) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, {
            duration: 600,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: 600,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        false,
      );
    } else {
      // アニメーション不要の場合は opacity を 1 に戻す
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [isEmpty, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const px = SIZE_MAP[size];

  // SVG内部の座標系（viewBox 0 0 24 48）
  // バッテリー外枠: x=1, y=4, width=22, height=40, rx=3
  // +端子（上部）: x=8, y=1, width=8, height=4, rx=1
  // 充電エリア: x=3, y=6, width=18, height=36 の中を fillRatio で塗りつぶし
  const innerH = 36;
  const innerY_top = 6;
  const fillH = Math.round(innerH * fillRatio);
  // 下から塗りつぶすため y 座標を逆算
  const fillY = innerY_top + (innerH - fillH);

  return (
    <Animated.View style={animatedStyle}>
      <View>
        <Svg width={px} height={px * 2} viewBox="0 0 24 48">
          {/* +端子（上部中央） */}
          <Rect x={8} y={1} width={8} height={5} rx={1} ry={1} fill={color} />
          {/* バッテリー外枠 */}
          <Rect
            x={1}
            y={6}
            width={22}
            height={40}
            rx={3}
            ry={3}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
          {/* 充電レベル塗りつぶし（下から） */}
          {fillH > 0 && (
            <Rect
              x={3}
              y={fillY + 2}
              width={18}
              height={fillH - 2}
              rx={1}
              ry={1}
              fill={color}
            />
          )}
        </Svg>
      </View>
    </Animated.View>
  );
}
