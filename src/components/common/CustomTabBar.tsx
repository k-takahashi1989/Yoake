/**
 * CustomTabBar.tsx
 *
 * @react-navigation/bottom-tabs の tabBar prop に渡すカスタムタブバー。
 * タブアイコン・ラベル・アクティブ状態を既存の TabBarIcon で描画しつつ、
 * タブ切替時に AnimatedBackground.focusTab() を呼び出して背景ズームを発火する。
 *
 * 使用方法:
 *   <Tab.Navigator tabBar={(props) => (
 *     <CustomTabBar {...props} backgroundRef={bgRef} />
 *   )}>
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
// コンポーネント本体
// ============================================================

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
  backgroundRef,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();

  // タブアイコンの微小バウンスアニメーション用（タブごとに独立した Animated.Value）
  const scaleAnims = useRef<Animated.Value[]>(
    state.routes.map(() => new Animated.Value(1)),
  ).current;

  const handlePress = useCallback(
    (index: number, routeName: string, isFocused: boolean) => {
      // ---- アイコンバウンス ----
      Animated.sequence([
        Animated.timing(scaleAnims[index], {
          toValue: 0.82,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnims[index], {
          toValue: 1,
          useNativeDriver: true,
          damping: 6,
          stiffness: 200,
        }),
      ]).start();

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
    [navigation, state.routes, scaleAnims, backgroundRef],
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
        const isFocused = state.index === index;
        const color     = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR;
        const label     = (options.title ?? route.name) as string;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => handlePress(index, route.name, isFocused)}
            onLongPress={() => handleLongPress(index)}
            style={styles.tabButton}
            activeOpacity={1}
          >
            {/* アイコン（バウンスアニメーション付き） */}
            <Animated.View
              style={[
                styles.iconWrapper,
                { transform: [{ scale: scaleAnims[index] }] },
              ]}
            >
              {/* アクティブタブの背景ピル */}
              {isFocused && <View style={styles.activePill} />}
              <TabBarIcon name={route.name} color={color} size={22} />
            </Animated.View>

            {/* ラベル */}
            <Text
              style={[
                styles.label,
                { color },
                isFocused && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
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
