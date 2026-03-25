import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  score: number | null;
  scoreColor: string;
  label: string | null;
}

const SIZE = 180;
const STROKE_WIDTH = 14;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreRing({ score, scoreColor, label }: Props) {
  const progress = score !== null ? score / 100 : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        {/* 背景の円 */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#2D2D44"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* スコアの円 */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={scoreColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>

      <View style={styles.center}>
        {score !== null ? (
          <>
            <Text style={[styles.score, { color: scoreColor }]}>{score}</Text>
            <Text style={styles.unit}>点</Text>
            {label && <Text style={[styles.label, { color: scoreColor }]}>{label}</Text>}
          </>
        ) : (
          <Text style={styles.noData}>未記録</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  score: {
    fontSize: 52,
    fontWeight: 'bold',
    lineHeight: 56,
  },
  unit: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: -4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  noData: {
    fontSize: 18,
    color: '#888',
  },
});
