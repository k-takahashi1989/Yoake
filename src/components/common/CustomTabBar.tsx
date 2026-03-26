/**
 * CustomTabBar.tsx
 *
 * @react-navigation/bottom-tabs の tabBar prop に渡すカスタムタブバー。
 * タブアイコン・ラベル・アクティブ状態を既存の TabBarIcon で描画しつつ、
 * タブ切替時に AnimatedBackground.focusTab() を呼び出して背景ズームを発火する。
 *
 * react-native-reanimated v3 を使用し、アイコンのバウンスアニメーションを
 * useSharedValue / withSequence / withSpring で実現する。
 *
 * 使用方法:
 *   <Tab.Navigator tabBar={(props) => (
 *     <CustomTabBar {...props} backgroundRef={bgRef} />
 *   )}>
 */

import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { AnimatedBackgroundHandle } from './AnimatedBackground';
import TabBarIcon from './TabBarIcon';
import { MainTabParamList } from '../../types';

// ============================================================
// 定数
// ============================================================

const ACTIVE_COLOR   = '#6B5CE7';
const INACTIVE_COLOR = '#9E9E9E';
const BAR_BG         = '#1A1A2E';
const BORDER_COLOR   = '#2D2D44';
const TAB_HEIGHT     = 56;

// ============================================================
// Props
// ============================================================

interface CustomTabBarProps extends BottomTabBarProps {
  /** AnimatedBackground の ref。タブ切替時にズームをトリガーする */
  backgroundRef: React.RefObject<AnimatedBackgroundHandle | null>;
}

// ============================================================
// タブアイテム（SharedValue をタブごとに独立管理するために分離）
// ============================================================

interface TabItemProps {
  routeKey: string;
  routeName: string;
  label: string;
  isFocused: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({
  routeName,
  label,
  isFocused,
  accessibilityLabel,
  onPress,
  onLongPress,
}: TabItemProps) {
  const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;

  // タブアイコンのバウンスアニメーション（reanimated v3）
  const iconScale = useSharedValue<number>(1);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handlePress = useCallback(() => {
    // バウンス: 縮む → バネで戻る
    iconScale.value = withSequence(
      withTiming(0.82, { duration: 80 }),
      withSpring(1, { damping: 6, stiffness: 200 }),
    );
    onPress();
  }, [iconScale, onPress]);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={1}
    >
      {/* アイコン（バウンスアニメーション付き） */}
      <Animated.View style={[styles.iconWrapper, iconAnimStyle]}>
        {/* アクティブタブの背景ピル */}
        {isFocused && <View style={styles.activePill} />}
        <TabBarIcon name={routeName} color={color} size={22} />
      </Animated.View>

      {/* ラベル */}
      <Text
        style={[styles.label, { color }, isFocused && styles.labelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// CustomTabBar 本体
// ============================================================

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
  backgroundRef,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(
    (index: number, routeName: string, isFocused: boolean) => {
      // ---- 背景ズームトリガー ----
      backgroundRef.current?.focusTab(routeName as keyof MainTabParamList);

      // ---- ナビゲーション ----
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes[index].key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        // @ts-ignore – navigate は string キーを受け付ける
        navigation.navigate({ name: routeName, merge: true });
      }
    },
    [navigation, state.routes, backgroundRef],
  );

  const handleLongPress = useCallback(
    (index: number) => {
      navigation.emit({
        type: 'tabLongPress',
        target: state.routes[index].key,
      });
    },
    [navigation, state.routes],
  );

  return (
    <View
      style={[
        styles.container,
        {
          // Safe Area の下辺を考慮した padding
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: TAB_HEIGHT + (insets.bottom > 0 ? insets.bottom : 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused   = state.index === index;
        const label       = (options.title ?? route.name) as string;

        return (
          <TabItem
            key={route.key}
            routeKey={route.key}
            routeName={route.name}
            label={label}
            isFocused={isFocused}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => handlePress(index, route.name, isFocused)}
            onLongPress={() => handleLongPress(index)}
          />
        );
      })}
    </View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: BAR_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_COLOR,
    // iOS の影
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 28,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: 44,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 92, 231, 0.18)',
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '400',
  },
  labelActive: {
    fontWeight: '600',
  },
});
