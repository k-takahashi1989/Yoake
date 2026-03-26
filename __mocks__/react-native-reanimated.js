// react-native-reanimated のJestモック
// 実際の Reanimated v3 の公式モックを参照しつつ、ScoreRing で使う API を網羅
const React = require('react');

const mockSharedValue = (init) => ({ value: init });

const mockWithTiming = (toValue) => toValue;

const mockEasing = {
  out: () => () => {},
  cubic: () => {},
};

const mockUseAnimatedProps = (fn) => fn();

const mockUseDerivedValue = (fn) => ({ value: fn() });

const mockUseAnimatedStyle = (fn) => fn();

const mockCreateAnimatedComponent = (Component) => {
  // animatedProps を通常の props にマージして渡すラッパー
  const Wrapped = ({ animatedProps, ...rest }) => {
    const merged = { ...rest, ...(animatedProps || {}) };
    return React.createElement(Component, merged);
  };
  Wrapped.displayName = `Animated(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
};

const Animated = {
  Text: 'Text',
  View: 'View',
  createAnimatedComponent: mockCreateAnimatedComponent,
};

module.exports = {
  default: Animated,
  useSharedValue: mockSharedValue,
  useAnimatedProps: mockUseAnimatedProps,
  useDerivedValue: mockUseDerivedValue,
  useAnimatedStyle: mockUseAnimatedStyle,
  withTiming: mockWithTiming,
  Easing: mockEasing,
  ...Animated,
};
