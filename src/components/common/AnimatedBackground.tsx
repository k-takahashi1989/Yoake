/**
 * AnimatedBackground.tsx
 *
 * ペルソナ5スタイルの背景ズーム＆パンコンポーネント。
 * 縦長（9:16）の寝室イラストを画面全体に敷き、タブ切替に応じて
 * 該当ゾーンへカメラがパン／ズームするような演出を Animated API で実現する。
 *
 * 座標系:
 *   focusX / focusY は画像内の注目点を 0〜1 の相対値で表す（左上が 0,0）。
 *   scale はズーム倍率（1.0 = 全体表示）。
 *
 * 変換の仕組み:
 *   画像は常に { width: imgW, height: imgH } のサイズで描画される。
 *   imgW = screenW * scale, imgH = screenH * scale（最小カバーを保証）。
 *   注目点を画面中央に合わせるために translateX/Y を計算する:
 *     translateX = screenW/2 - focusX * imgW
 *     translateY = screenH/2 - focusY * imgH
 *   ただし画像端が画面内に入らないようクランプする。
 */

import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  ImageSourcePropType,
} from 'react-native';
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
const EASING = Easing.inOut(Easing.cubic);

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

    // --- Animated 値 ---
    // translateX / translateY / scale を独立した Animated.Value で管理し
    // Animated.parallel で同時に動かすことで easeInOut を統一する。
    const animScale = useRef(new Animated.Value(TAB_FOCUS.Home.scale)).current;
    const animTX    = useRef(new Animated.Value(0)).current;
    const animTY    = useRef(new Animated.Value(0)).current;

    // 初期座標を計算（マウント直後に Home フォーカスを適用）
    const calcTranslate = useCallback(
      (cfg: FocusConfig) => {
        const imgW = screenW * cfg.scale;
        const imgH = screenH * cfg.scale;

        // 注目点を画面中央に揃える理想的なオフセット
        let tx = screenW / 2 - cfg.x * imgW;
        let ty = screenH / 2 - cfg.y * imgH;

        // 画像端が画面に入らないようクランプ（画像が画面をはみ出す方向にのみ移動可）
        const maxTX = 0;
        const minTX = screenW - imgW;
        const maxTY = 0;
        const minTY = screenH - imgH;

        tx = Math.min(maxTX, Math.max(minTX, tx));
        ty = Math.min(maxTY, Math.max(minTY, ty));

        return { tx, ty };
      },
      [screenW, screenH],
    );

    // マウント時に Home の初期位置を即時セット（アニメーションなし）
    useEffect(() => {
      const cfg = TAB_FOCUS.Home;
      const { tx, ty } = calcTranslate(cfg);
      animScale.setValue(cfg.scale);
      animTX.setValue(tx);
      animTY.setValue(ty);
    }, [animScale, animTX, animTY, calcTranslate]);

    // --- 外部呼び出し用 imperative handle ---
    useImperativeHandle(ref, () => ({
      focusTab: (tabName: keyof MainTabParamList) => {
        const cfg = TAB_FOCUS[tabName] ?? TAB_FOCUS.Home;
        const { tx, ty } = calcTranslate(cfg);

        Animated.parallel([
          Animated.timing(animScale, {
            toValue: cfg.scale,
            duration: DURATION,
            easing: EASING,
            useNativeDriver: true,
          }),
          Animated.timing(animTX, {
            toValue: tx,
            duration: DURATION,
            easing: EASING,
            useNativeDriver: true,
          }),
          Animated.timing(animTY, {
            toValue: ty,
            duration: DURATION,
            easing: EASING,
            useNativeDriver: true,
          }),
        ]).start();
      },
    }));

    // --- transform 配列 ---
    // React Native の transform は適用順序が重要:
    // 画像を左上基準で配置してから translate で動かすため
    // scale を先に、translate を後に適用する。
    const animatedStyle = {
      width: screenW,
      height: screenH,
      transform: [
        // 画像の基準点を左上に固定したまま scale する
        { translateX: animTX },
        { translateY: animTY },
        { scaleX: animScale },
        { scaleY: animScale },
      ] as Animated.AnimatedProps<object>[],
    };

    return (
      <Animated.View style={[StyleSheet.absoluteFill, styles.container]}>
        {source ? (
          <Animated.Image
            source={source}
            style={[styles.image, animatedStyle]}
            resizeMode="cover"
          />
        ) : (
          // 背景画像が未設定の場合のフォールバック（開発中用）
          <Animated.View style={[styles.fallback, animatedStyle]} />
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
    // width / height は animatedStyle で上書きされるためここでは宣言不要だが
    // Animated.Image には初期値として設定しておく
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    // 夜の寝室を連想させる濃紺〜紫のグラデーション風配色
    backgroundColor: '#2D2D44',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#6B5CE7',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.55)',
  },
});
