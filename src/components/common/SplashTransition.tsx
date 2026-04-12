import React, { useCallback } from 'react';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import BootSplash from 'react-native-bootsplash';

interface Props {
  ready: boolean;
}

export default function SplashTransition({ ready }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animate = useCallback(() => {
    scale.value = withTiming(1.3, { duration: 450 });
    opacity.value = withTiming(0, { duration: 450 });
  }, [scale, opacity]);

  const { container, logo } = BootSplash.useHideAnimation({
    manifest: require('../../assets/bootsplash/manifest.json'),
    logo: require('../../assets/bootsplash/logo.png'),
    ready,
    animate,
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View {...container} style={[container.style, animatedStyle]}>
      <Animated.Image {...logo} />
    </Animated.View>
  );
}
