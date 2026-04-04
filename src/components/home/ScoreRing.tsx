import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

/** スコアが高スコア（75点以上）かどうかの閾値 */
const GLOW_THRESHOLD = 75;
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from '../../i18n';

// SVG の Circle を RN Animated 対応コンポーネントに変換
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number | null;
  scoreColor: string;
  label: string | null;
  size?: number;
}

const SIZE = 180;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// アニメーション時間 (ms)
const ANIM_DURATION = 600;

export default function ScoreRing({ score, scoreColor, label }: Props) {
  const { t } = useTranslation();

  // strokeDashoffset 用のアニメーション値（初期値は CIRCUMFERENCE = 空状態）
  const animatedOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  // スコア数値カウンター (RAF ベース)
  const [displayScore, setDisplayScore] = useState(0);
  const rafRef = useRef<number | null>(null);

  // グロウ効果：スコアが GLOW_THRESHOLD 以上の時にフェードイン
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const prevScoreRef = useRef<number | null>(null);

  useEffect(() => {
    const targetScore = score ?? 0;
    const targetOffset = CIRCUMFERENCE * (1 - targetScore / 100);

    // 円弧アニメーション: CIRCUMFERENCE（空） → 目標 offset（塗り）
    Animated.timing(animatedOffset, {
      toValue: targetOffset,
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset は native driver 非対応
    }).start();

    // スコア数値カウントアップ: 前の rAF をキャンセルして再スタート
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / ANIM_DURATION, 1);
      // ease-out cubic と同じカーブを適用
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(targetScore * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    setDisplayScore(0);
    rafRef.current = requestAnimationFrame(tick);

    // グロウ効果：スコアが null→75以上 に変わった時だけフェードイン
    const isHighScore = targetScore >= GLOW_THRESHOLD;
    const wasHighScore = (prevScoreRef.current ?? 0) >= GLOW_THRESHOLD;
    if (isHighScore && !wasHighScore) {
      // 高スコアに初めてなった時：glowOpacity を 0→1 でフェードイン
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (!isHighScore) {
      // 高スコアでなくなった時：即座にフェードアウト
      glowOpacity.setValue(0);
    }
    prevScoreRef.current = targetScore;

    return () => {
      // アンマウント時に rAF をクリーンアップ
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [animatedOffset, glowOpacity, score]);

  // 高スコア時のグロウスタイル（Android: elevation / iOS: shadow）
  const isHighScore = (score ?? 0) >= GLOW_THRESHOLD;

  return (
    <View style={styles.container}>
      {/* グロウ効果ラッパー：opacity でフェードイン制御 */}
      <Animated.View
        style={[
          styles.glowWrapper,
          isHighScore && {
            shadowColor: scoreColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 16,
            elevation: 12,
          },
          { opacity: glowOpacity },
        ]}
      >
        <View style={styles.glowInner} />
      </Animated.View>
      <Svg width={SIZE} height={SIZE}>
        {/* 背面の輪 */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#2D2D44"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* スコアの輪（strokeDashoffset をアニメーション） */}
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={scoreColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={animatedOffset as any}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      <View style={styles.center}>
        {score !== null ? (
          <>
            {/* カウントアップするスコア数値 */}
            <Text style={[styles.score, { color: scoreColor }]}>{displayScore}</Text>
            <Text style={styles.subUnit}>/100</Text>
            {label && <Text style={[styles.label, { color: scoreColor }]}>{label}</Text>}
          </>
        ) : (
          <Text style={styles.noData}>{t('scoreRing.noData')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // グロウ効果ラッパー：SVGと同サイズの透明な View で影を発生させる
  glowWrapper: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowInner: {
    width: SIZE - STROKE_WIDTH,
    height: SIZE - STROKE_WIDTH,
    borderRadius: (SIZE - STROKE_WIDTH) / 2,
    backgroundColor: 'transparent',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 14,
    color: '#9A9AB8', // WCAG AA対応: #9E9E9E → #9A9AB8
    marginTop: -4,
  },
  subUnit: {
    fontSize: 11,
    color: '#9A9AB8', // WCAG AA対応: #666 → #9A9AB8
    marginTop: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  noData: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'ZenKurenaido-Regular',
    textAlign: 'center',
  },
});
