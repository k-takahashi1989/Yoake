import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from '../../i18n';

// SVG の Circle を RN Animated 対応コンポーネントに変換
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number | null;
  scoreColor: string;
  label: string | null;
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

    return () => {
      // アンマウント時に rAF をクリーンアップ
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [score]);

  return (
    <View style={styles.container}>
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
            <Text style={styles.unit}>{t('scoreRing.unit')}</Text>
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
    color: '#9E9E9E',
    marginTop: -4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  noData: {
    fontSize: 14,
    color: '#9E9E9E',
  },
});
