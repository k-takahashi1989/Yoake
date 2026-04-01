import React from 'react';
import Svg, { Path } from 'react-native-svg';

// ============================================================
// 各タブのSVGパス（viewBox="0 0 24 24" に統一）
// fill は color prop で動的に指定するためパス定義には含めない
// ============================================================

// Home タブ — 家アイコン
const PATH_HOME = 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z';

// Diary タブ — 本/日記アイコン
const PATH_DIARY =
  'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h5v16z';

// Report タブ — 棒グラフアイコン
const PATH_REPORT = 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z';

// Profile タブ — 人物アイコン
const PATH_PROFILE =
  'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z';

// ============================================================
// タブ名 → SVGパスのマッピング
// ============================================================
const ICON_PATHS: Record<string, string> = {
  Home: PATH_HOME,
  Diary: PATH_DIARY,
  Report: PATH_REPORT,
  Profile: PATH_PROFILE,
};

// ============================================================
// TabBarIcon コンポーネント
// ============================================================
interface Props {
  name: string;
  color: string;
  size?: number;
}

export default function TabBarIcon({ name, color, size = 22 }: Props) {
  const path = ICON_PATHS[name];
  if (!path) {
    return null;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={path} fill={color} />
    </Svg>
  );
}
