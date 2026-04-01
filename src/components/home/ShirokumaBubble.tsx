/**
 * ShirokumaBubble.tsx
 *
 * しろくまアイコン + 吹き出し形式で AIアドバイスを表示する複合コンポーネント。
 * HomeScreen の dreamBubble ゾーンをそのまま置き換える形で使用する。
 * 既存の state・アニメーション値は HomeScreen から Props として受け取る。
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useTranslation } from '../../i18n';
import ShirokumaIcon, { ShirokumaMood } from '../common/ShirokumaIcon';
import AiAdviceSkeleton from './AiAdviceSkeleton';

// ============================================================
// スコア帯 → mood 変換
// ============================================================

function getMoodFromScore(score: number | null): ShirokumaMood {
  if (score === null) return 'normal';
  if (score >= 80) return 'happy';
  if (score >= 60) return 'normal';
  return 'cheer';
}

// ============================================================
// 吹き出し枠色（mood 別）
// ============================================================

function getBubbleBorderColor(mood: ShirokumaMood): string {
  switch (mood) {
    case 'happy':  return 'rgba(255, 215, 0, 0.35)';
    case 'normal': return 'rgba(107, 92, 231, 0.25)';
    case 'cheer':  return 'rgba(156, 143, 255, 0.20)';
  }
}

// ============================================================
// Props
// ============================================================

interface Props {
  advice: string | null;
  isLoading: boolean;
  score: number | null;
  isDreamExpanded: boolean;
  onToggleExpand: () => void;
  dreamExpandAnim: Animated.Value;
  ecgAnim: Animated.Value;
  dreamExpandedH: number;
  onRefresh?: () => void;
}

// ============================================================
// ShirokumaBubble
// ============================================================

export default function ShirokumaBubble({
  advice,
  isLoading,
  score,
  isDreamExpanded,
  onToggleExpand,
  dreamExpandAnim,
  ecgAnim,
  dreamExpandedH,
}: Props) {
  const { t } = useTranslation();
  const mood = getMoodFromScore(score);
  const bubbleBorderColor = getBubbleBorderColor(mood);

  // happy 時のグロー点滅（shadowOpacity は layout プロパティのため useNativeDriver: false）
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // 前のアニメーションを停止
    glowLoopRef.current?.stop();

    if (mood === 'happy') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: false,
          }),
        ]),
      );
      glowLoopRef.current = loop;
      loop.start();
    } else {
      // happy 以外ではグロー不要
      glowOpacity.setValue(0);
    }

    return () => {
      glowLoopRef.current?.stop();
    };
  }, [mood, glowOpacity]);

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          borderColor: ecgAnim.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [
              'rgba(107,92,231,0.25)',
              'rgba(156,143,255,0.6)',
              'rgba(200,180,255,0.85)',
            ],
          }),
        },
      ]}
    >
      {/* 上向き尻尾（しろくまの方向へ） */}
      <View style={styles.tail} />

      <TouchableOpacity
        onPress={onToggleExpand}
        activeOpacity={0.85}
        style={styles.inner}
        accessibilityRole="button"
        accessibilityLabel={
          isDreamExpanded
            ? 'しろくまのアドバイスを折りたたむ'
            : 'しろくまのアドバイスを展開する'
        }
        accessibilityHint="ダブルタップでアドバイスの全文を表示します"
      >
        {/* 左カラム：しろくまアイコン */}
        <View style={styles.leftCol}>
          {/* happy 時のみグロー枠を適用 */}
          {mood === 'happy' ? (
            <Animated.View
              style={[
                styles.iconContainer,
                styles.iconContainerHappy,
                { shadowOpacity: glowOpacity },
              ]}
            >
              <ShirokumaIcon size={48} mood={mood} />
            </Animated.View>
          ) : (
            <View style={styles.iconContainer}>
              <ShirokumaIcon size={48} mood={mood} />
            </View>
          )}
          {/* キャラクター名ラベル */}
          <Text style={styles.nameLabel}>{t('shirokuma.name')}</Text>
        </View>

        {/* 吹き出し三角（左向き） */}
        <View style={styles.speechTriangle} />

        {/* 右カラム：発話テキスト */}
        <View style={[styles.speechBubble, { borderColor: bubbleBorderColor }]}>
          {isLoading ? (
            <AiAdviceSkeleton />
          ) : (
            <>
              <Animated.View
                style={{
                  maxHeight: dreamExpandAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [52, dreamExpandedH],
                  }),
                  overflow: 'hidden',
                }}
              >
                <ScrollView
                  scrollEnabled={isDreamExpanded}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  <Text
                    style={styles.adviceText}
                    numberOfLines={isDreamExpanded ? undefined : 3}
                  >
                    {advice ?? ''}
                  </Text>
                </ScrollView>
              </Animated.View>
              {/* 展開/折りたたみシェブロン */}
              <Text style={styles.chevron}>
                {isDreamExpanded ? '▲' : '▼'}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  // 外枠（旧 dreamBubbleShell をベースに拡張）
  shell: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#252540',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'visible',
    zIndex: 15,
    elevation: 8,
    shadowColor: '#9B8AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.5,
  },
  // 上向き尻尾（旧 dreamBubbleTail をコピー）
  tail: {
    position: 'absolute',
    top: -9,
    left: '38%',
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(22, 18, 54, 0.92)',
  },
  // タッチ可能エリア
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 0,
  },
  // 左カラム（アイコン列）
  leftCol: {
    alignItems: 'center',
    width: 56,
    marginRight: 4,
  },
  // アイコンコンテナ（通常）
  iconContainer: {
    borderRadius: 28,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  // アイコンコンテナ（happy 時のグロー枠を追加）
  iconContainerHappy: {
    shadowColor: '#FFD700',
    shadowRadius: 12,
    elevation: 8,
    // shadowOpacity はアニメーションで制御
  },
  // キャラクター名ラベル
  nameLabel: {
    fontSize: 10,
    color: '#9A9AB8',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // 吹き出し三角（左向き）
  speechTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#2D2D55',
    marginTop: 14,
  },
  // 吹き出し背景
  speechBubble: {
    flex: 1,
    backgroundColor: '#2D2D55',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    marginLeft: 0,
  },
  // 発話テキスト
  adviceText: {
    fontSize: 14,
    color: '#E0E0F0',
    lineHeight: 22,
  },
  // 展開/折りたたみシェブロン
  chevron: {
    fontSize: 8,
    color: 'rgba(200,180,255,0.55)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
