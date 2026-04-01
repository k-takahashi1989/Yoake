import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 押下時の縮小スケール。デフォルト 0.96 */
  scaleValue?: number;
}

// TouchableOpacity を Animated に対応させる
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * タップ時に scale: 1→scaleValue に縮み、離すと spring で 1 に戻る共通ボタン。
 * TouchableOpacity の代替として Props を透過する。
 */
export default function ScalePressable({
  children,
  style,
  scaleValue = 0.96,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[animatedStyle, style]}
      activeOpacity={1}
      onPressIn={(e) => {
        // 80ms で素早く縮む → 押した感触
        scale.value = withTiming(scaleValue, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // spring で弾んで元に戻る
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
}
