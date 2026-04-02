/**
 * ShirokumaIcon.tsx
 *
 * しろくまの顔を SVG で描画するアイコンコンポーネント。
 * スコア帯に応じた 3 種類の表情（happy / normal / cheer）を持つ。
 * mood が変化した際に scale バウンスアニメーションを行う。
 * happy 時は shadowOpacity のグロー点滅ループを実行する（useNativeDriver: false）。
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export type ShirokumaMood = 'happy' | 'normal' | 'cheer';

interface Props {
  size?: number;
  mood: ShirokumaMood;
}

export default function ShirokumaIcon({ size = 48, mood }: Props) {
  // mood 切替バウンスアニメーション（useNativeDriver: true）
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);
  const prevMood = useRef<ShirokumaMood>(mood);

  // happy 時のグロー点滅用（shadowOpacity は JS スレッド: useNativeDriver: false）
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // 初回マウントはスキップ
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevMood.current = mood;
      return;
    }
    // mood が変化した場合のみバウンス
    if (prevMood.current !== mood) {
      prevMood.current = mood;
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.25,
          speed: 20,
          bounciness: 0,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          speed: 14,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [mood, scaleAnim]);

  // happy 時のグロー点滅ループ（period: 2000ms）
  useEffect(() => {
    if (mood === 'happy') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [mood, glowAnim]);

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }] }}
      accessibilityRole="image"
      accessibilityLabel={
        mood === 'happy'
          ? 'しろくまの表情: 喜び'
          : mood === 'cheer'
          ? 'しろくまの表情: 励まし'
          : 'しろくまの表情: 普通'
      }
    >
      {/* happy 時のみグロー枠をアニメーション（shadowOpacity は JS スレッド） */}
      <Animated.View
        style={[
          styles.glowWrapper,
          { width: size, height: size, borderRadius: size / 2 },
          mood === 'happy' && {
            shadowColor: '#FFD700',
            shadowOpacity: glowAnim,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 48 48">
          {/* 耳（左右の白い丸） */}
          <Circle cx="9" cy="12" r="7" fill="#FFFFFF" />
          <Circle cx="39" cy="12" r="7" fill="#FFFFFF" />
          {/* 耳の内側（薄いピンク） */}
          <Circle cx="9" cy="12" r="4" fill="#F5D0D0" />
          <Circle cx="39" cy="12" r="4" fill="#F5D0D0" />
          {/* 頭部（白い丸） */}
          <Circle cx="24" cy="26" r="18" fill="#FFFFFF" />
          {/* 鼻（黒い小判型） */}
          <Ellipse cx="24" cy="30" rx="4" ry="2.5" fill="#222244" />

          {/* 目（mood 別） */}
          {mood === 'happy' && (
            <>
              {/* 弧（笑い目） */}
              <Path
                d="M 15 23 Q 17 19 19 23"
                stroke="#222244"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 29 23 Q 31 19 33 23"
                stroke="#222244"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
          {mood === 'normal' && (
            <>
              {/* 小円（ふつう目） */}
              <Circle cx="17" cy="22" r="2.5" fill="#222244" />
              <Circle cx="31" cy="22" r="2.5" fill="#222244" />
            </>
          )}
          {mood === 'cheer' && (
            <>
              {/* 困り目（斜め線） */}
              <Path
                d="M 14 20 L 20 24"
                stroke="#222244"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <Path
                d="M 34 20 L 28 24"
                stroke="#222244"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          )}

          {/* 口（mood 別） */}
          {mood === 'happy' && (
            <Path
              d="M 18 35 Q 24 40 30 35"
              stroke="#222244"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
          {(mood === 'normal' || mood === 'cheer') && (
            <Path
              d="M 19 35 Q 24 38 29 35"
              stroke="#222244"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // グロー枠ラッパー（happy 時のみ shadow が適用される）
  glowWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
