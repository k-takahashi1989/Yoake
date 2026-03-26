/**
 * AnimatedBackground.tsx
 *
 * ペルソナ5スタイルの背景コンポーネント。
 *
 * ── モード ─────────────────────────────────────────────────────
 *   sources  (推奨): タブごとに別画像を渡す。タブ切替時にクロスフェード。
 *   source   (単独): 1枚の画像をズーム&パン（旧実装・後方互換）。
 *   どちらも未指定:  濃紺フォールバック。
 *
 * ── クロスフェード実装（デュアルスロット方式）─────────────────
 *   slotA / slotB の 2 枚を重ね、opacityA/opacityB をアニメーション
 *   させることで画像の差し替えを滑らかにする。React Native では
 *   同一 source への更新ではなく別 slot への描画切替のため、
 *   画像のちらつき（白フレーム）が起きない。
 *
 * ── ズーム&パン（source 単独モード）──────────────────────────
 *   focusX/Y (0〜1) + scale で注目点を画面中央に合わせる translate を
 *   計算し、画像端が画面外に出ないようクランプして withTiming で適用。
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  ImageSourcePropType,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MainTabParamList } from '../../types';

// ============================================================
// タブごとのフォーカス設定（source 単独モード用）
// ============================================================

export interface FocusConfig {
  x: number;   // 画像内注目点 X（0〜1）
  y: number;   // 画像内注目点 Y（0〜1）
  scale: number; // ズーム倍率（1.0 = 全体表示）
}

const TAB_FOCUS: Record<keyof MainTabParamList, FocusConfig> = {
  Home:    { x: 0.50, y: 0.60, scale: 1.0 },
  Diary:   { x: 0.30, y: 0.80, scale: 2.0 },
  Report:  { x: 0.50, y: 0.20, scale: 2.5 },
  Alarm:   { x: 0.20, y: 0.55, scale: 2.2 },
  Profile: { x: 0.80, y: 0.30, scale: 2.0 },
};

const DURATION = 600;
const ANIM_EASING = Easing.inOut(Easing.cubic);
const CROSSFADE_DURATION = 500;

// ============================================================
// Ref 型
// ============================================================

export interface AnimatedBackgroundHandle {
  focusTab: (tabName: keyof MainTabParamList) => void;
}

// ============================================================
// Props
// ============================================================

interface Props {
  /** タブごとの背景画像（推奨）。指定したタブのみ切り替わる。 */
  sources?: Partial<Record<keyof MainTabParamList, ImageSourcePropType>>;
  /** 単一背景画像（後方互換・ズーム&パンモード） */
  source?: ImageSourcePropType;
}

// ============================================================
// コンポーネント本体
// ============================================================

const AnimatedBackground = forwardRef<AnimatedBackgroundHandle, Props>(
  ({ sources, source }, ref) => {
    const { width: screenW, height: screenH } = useWindowDimensions();

    // ── デュアルスロット（クロスフェード用）──────────────────
    const [slotA, setSlotA] = useState<ImageSourcePropType | null>(
      () => (sources ? (sources.Home ?? null) : source ?? null),
    );
    const [slotB, setSlotB] = useState<ImageSourcePropType | null>(null);
    const currentSlot = useRef<'A' | 'B'>('A');
    const opacityA = useSharedValue(1);
    const opacityB = useSharedValue(0);

    // ── ズーム&パン SharedValue（source 単独モード用）────────
    const svScale = useSharedValue<number>(TAB_FOCUS.Home.scale);
    const svTX    = useSharedValue<number>(0);
    const svTY    = useSharedValue<number>(0);

    const calcTranslate = useCallback(
      (cfg: FocusConfig) => {
        const imgW = screenW * cfg.scale;
        const imgH = screenH * cfg.scale;
        let tx = screenW / 2 - cfg.x * imgW;
        let ty = screenH / 2 - cfg.y * imgH;
        tx = Math.min(0, Math.max(screenW - imgW, tx));
        ty = Math.min(0, Math.max(screenH - imgH, ty));
        return { tx, ty };
      },
      [screenW, screenH],
    );

    // マウント時に Home 位置をセット
    useEffect(() => {
      if (!sources) {
        const { tx, ty } = calcTranslate(TAB_FOCUS.Home);
        svScale.value = TAB_FOCUS.Home.scale;
        svTX.value    = tx;
        svTY.value    = ty;
      }
    }, [calcTranslate, sources, svScale, svTX, svTY]);

    // 画面回転対応
    useEffect(() => {
      if (!sources) {
        const { tx, ty } = calcTranslate({ ...TAB_FOCUS.Home, scale: svScale.value });
        svTX.value = tx;
        svTY.value = ty;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenW, screenH]);

    // ── Animated スタイル ──────────────────────────────────────
    const zoomStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: svTX.value },
        { translateY: svTY.value },
        { scale:      svScale.value },
      ],
    }));

    const styleA = useAnimatedStyle(() => ({ opacity: opacityA.value }));
    const styleB = useAnimatedStyle(() => ({ opacity: opacityB.value }));

    // ── クロスフェード関数 ─────────────────────────────────────
    const crossFadeTo = useCallback(
      (newSource: ImageSourcePropType) => {
        const timing = { duration: CROSSFADE_DURATION, easing: ANIM_EASING };
        if (currentSlot.current === 'A') {
          setSlotB(newSource);
          opacityB.value = withTiming(1, timing);
          opacityA.value = withTiming(0, timing);
          currentSlot.current = 'B';
        } else {
          setSlotA(newSource);
          opacityA.value = withTiming(1, timing);
          opacityB.value = withTiming(0, timing);
          currentSlot.current = 'A';
        }
      },
      [opacityA, opacityB],
    );

    // ── Imperative handle ──────────────────────────────────────
    useImperativeHandle(ref, () => ({
      focusTab: (tabName: keyof MainTabParamList) => {
        if (sources) {
          // クロスフェードモード
          const newSource = sources[tabName];
          if (newSource) crossFadeTo(newSource);
        } else {
          // ズーム&パンモード（単一 source）
          const cfg = TAB_FOCUS[tabName] ?? TAB_FOCUS.Home;
          const { tx, ty } = calcTranslate(cfg);
          const timingConfig = { duration: DURATION, easing: ANIM_EASING };
          svScale.value = withTiming(cfg.scale, timingConfig);
          svTX.value    = withTiming(tx, timingConfig);
          svTY.value    = withTiming(ty, timingConfig);
        }
      },
    }));

    const imageSize = { width: screenW, height: screenH };

    return (
      <Animated.View style={[StyleSheet.absoluteFill, styles.container]}>

        {sources ? (
          // ── クロスフェードモード ──────────────────────────────
          <>
            {slotA && (
              <Animated.Image
                source={slotA}
                style={[styles.image, imageSize, styleA]}
                resizeMode="cover"
              />
            )}
            {slotB && (
              <Animated.Image
                source={slotB}
                style={[styles.image, imageSize, styleB]}
                resizeMode="cover"
              />
            )}
          </>
        ) : source ? (
          // ── ズーム&パンモード ─────────────────────────────────
          <Animated.Image
            source={source}
            style={[styles.image, imageSize, zoomStyle]}
            resizeMode="cover"
          />
        ) : (
          // ── フォールバック ────────────────────────────────────
          <Animated.View style={[styles.fallback, imageSize]} />
        )}

        {/* 可読性確保オーバーレイ */}
        <Animated.View style={styles.overlay} pointerEvents="none" />
      </Animated.View>
    );
  },
);

AnimatedBackground.displayName = 'AnimatedBackground';

export default AnimatedBackground;

// ============================================================
// スタイル
// ============================================================

const styles = StyleSheet.create({
  container: {
    zIndex: 0,
    backgroundColor: '#1A1A2E',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#2D2D44',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.38)',
  },
});
