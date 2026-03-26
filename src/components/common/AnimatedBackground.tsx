/**
 * AnimatedBackground.tsx
 *
 * ペルソナ5スタイルの背景ズーム＆パンコンポーネント。
 * 縦長（9:16）の寝室イラストを画面全体に敷き、タブ切替に応じて
 * 該当ゾーンへカメラがパン／ズームするような演出を
 * react-native-reanimated v3 で実現する。
 *
 * ─── 座標系 ───────────────────────────────────────────────
 *   focusX / focusY は画像内の注目点を 0〜1 の相対値で表す（左上が 0,0）。
 *   scale はズーム倍率（1.0 = 全体表示）。
 *
 * ─── 変換の仕組み ─────────────────────────────────────────
 *   画像は position: absolute で左上に置かれ、常に画面全体を覆う
 *   ベースサイズ（screenW × screenH）で描画される。
 *
 *   transform の適用順（React Native は配列の先頭から順に適用）:
 *     1. translateX / translateY — 注目点を画面中央に寄せるオフセット
 *     2. scale                  — 中心（左上原点）を基準に拡大
 *
 *   translateX/Y の計算:
 *     imgW = screenW * scale
 *     imgH = screenH * scale
 *     理想 tx = screenW / 2 - focusX * imgW   （注目点 → 画面中央）
 *     理想 ty = screenH / 2 - focusY * imgH
 *
 *   クランプ:
 *     tx は [screenW - imgW, 0] に収める（画像端が画面外に出ないよう）
 *     ty は [screenH - imgH, 0] に収める
 *
 * ─── reanimated v3 における transform の注意点 ───────────
 *   useAnimatedStyle 内で SharedValue を参照する際は .value を使う。
 *   withTiming / withSpring は worklet 内で直接呼び出せる。
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import {
  Image,
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
// タブごとのフォーカス設定
// ============================================================

export interface FocusConfig {
  /** 画像内の注目点 X（0〜1） */
  x: number;
  /** 画像内の注目点 Y（0〜1） */
  y: number;
  /** ズーム倍率（1.0 = 全体） */
  scale: number;
}

const TAB_FOCUS: Record<keyof MainTabParamList, FocusConfig> = {
  Home:    { x: 0.50, y: 0.60, scale: 1.0 },  // ベッド全体（ワイドショット）
  Diary:   { x: 0.30, y: 0.80, scale: 2.0 },  // 手前の日記
  Report:  { x: 0.50, y: 0.20, scale: 2.5 },  // 夢の吹き出し
  Alarm:   { x: 0.20, y: 0.55, scale: 2.2 },  // 枕元の時計
  Profile: { x: 0.80, y: 0.30, scale: 2.0 },  // 鏡
};

// アニメーション設定
const DURATION = 600;
const ANIM_EASING = Easing.inOut(Easing.cubic);

// ============================================================
// Ref 型（CustomTabBar から呼び出すインターフェース）
// ============================================================

export interface AnimatedBackgroundHandle {
  focusTab: (tabName: keyof MainTabParamList) => void;
}

// ============================================================
// Props
// ============================================================

interface Props {
  /** 背景画像。省略時はグラデーション風フォールバック描画 */
  source?: ImageSourcePropType;
}

// ============================================================
// コンポーネント本体
// ============================================================

const AnimatedBackground = forwardRef<AnimatedBackgroundHandle, Props>(
  ({ source }, ref) => {
    const { width: screenW, height: screenH } = useWindowDimensions();

    // ── SharedValue（reanimated v3）──────────────────────────
    // 初期値は Home フォーカス位置（アニメーションなし）
    const svScale = useSharedValue<number>(TAB_FOCUS.Home.scale);
    const svTX    = useSharedValue<number>(0);
    const svTY    = useSharedValue<number>(0);

    // ── 注目点 → translate を計算するヘルパー ─────────────────
    const calcTranslate = useCallback(
      (cfg: FocusConfig): { tx: number; ty: number } => {
        const imgW = screenW * cfg.scale;
        const imgH = screenH * cfg.scale;

        // 注目点を画面中央に揃える理想的なオフセット
        let tx = screenW / 2 - cfg.x * imgW;
        let ty = screenH / 2 - cfg.y * imgH;

        // 画像端が画面内に入らないようクランプ
        // （scale 1.0 の場合は imgW === screenW なので tx/ty = 0 に固定される）
        tx = Math.min(0, Math.max(screenW - imgW, tx));
        ty = Math.min(0, Math.max(screenH - imgH, ty));

        return { tx, ty };
      },
      [screenW, screenH],
    );

    // マウント時に Home の初期位置を即時セット（アニメーションなし）
    useEffect(() => {
      const { tx, ty } = calcTranslate(TAB_FOCUS.Home);
      svScale.value = TAB_FOCUS.Home.scale;
      svTX.value    = tx;
      svTY.value    = ty;
    }, [calcTranslate, svScale, svTX, svTY]);

    // 画面サイズが変わったときも即時リセット（回転対応）
    useEffect(() => {
      const { tx, ty } = calcTranslate({ ...TAB_FOCUS.Home, scale: svScale.value });
      svTX.value = tx;
      svTY.value = ty;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenW, screenH]);

    // ── 外部呼び出し用 imperative handle ───────────────────────
    useImperativeHandle(ref, () => ({
      focusTab: (tabName: keyof MainTabParamList) => {
        const cfg = TAB_FOCUS[tabName] ?? TAB_FOCUS.Home;
        const { tx, ty } = calcTranslate(cfg);

        const timingConfig = {
          duration: DURATION,
          easing: ANIM_EASING,
        };

        svScale.value = withTiming(cfg.scale, timingConfig);
        svTX.value    = withTiming(tx,        timingConfig);
        svTY.value    = withTiming(ty,        timingConfig);
      },
    }));

    // ── Animated スタイル ──────────────────────────────────────
    // transform 適用順: translate → scale
    // React Native は配列の先頭から順に apply するため、
    // translate を先に書くことで「ズーム原点を左上に固定」したまま
    // 画像をオフセットできる。
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: svTX.value },
        { translateY: svTY.value },
        { scale:      svScale.value },
      ],
    }));

    return (
      <Animated.View style={[StyleSheet.absoluteFill, styles.container]}>
        {source ? (
          <Animated.Image
            source={source}
            style={[styles.image, { width: screenW, height: screenH }, animatedStyle]}
            resizeMode="cover"
          />
        ) : (
          // 背景画像が未設定の場合のフォールバック（開発中用）
          <Animated.View
            style={[
              styles.fallback,
              { width: screenW, height: screenH },
              animatedStyle,
            ]}
          />
        )}
        {/* 画面全体に薄いオーバーレイを掛けて可読性を確保 */}
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
    // 夜の寝室を連想させる濃紺〜紫の配色
    backgroundColor: '#2D2D44',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#6B5CE7',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.55)',
  },
});
