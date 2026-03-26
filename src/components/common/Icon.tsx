import React from 'react';
import { SvgXml } from 'react-native-svg';

// ============================================================
// SVG のカスタム名前空間属性を除去するサニタイズ
// ============================================================
const sanitize = (svg: string): string =>
  svg.replace(/\s+xmlns:\w+="[^"]*"/g, '');

// ============================================================
// 単色 SVG の fill を動的に差し替えるヘルパー
//   - ルート <svg> に fill 属性を注入
//   - fill="#000000" / fill="#000" / fill="rgb(0,0,0)" を指定色に変換
//   - fill="none" はアウトライン保持のため変更しない
// ============================================================
const colorize = (svg: string, color: string): string =>
  sanitize(svg)
    .replace(/(<svg\b[^>]*?)(\s*\/>|>)/, `$1 fill="${color}"$2`)
    .replace(/fill="#000000"/gi, `fill="${color}"`)
    .replace(/fill="#000"/gi, `fill="${color}"`)
    .replace(/fill="rgb\(0,0,0\)"/gi, `fill="${color}"`);

// ============================================================
// アイコン SVG 文字列
// ============================================================

// 鍵（プレミアムロック表示用）— lock.svg
const SVG_LOCK = `<svg id="Solid" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="m34 18v-2a10 10 0 0 0 -20 0v2a6.0048 6.0048 0 0 0 -6 6v12a6.0048 6.0048 0 0 0 6 6h20a6.0048 6.0048 0 0 0 6-6v-12a6.0048 6.0048 0 0 0 -6-6zm-8 13.23v1.77a2 2 0 0 1 -4 0v-1.77a3 3 0 1 1 4 0zm4-13.23h-12v-2a6 6 0 0 1 12 0z"/></svg>`;

// スパークル（AI アドバイス・AI機能アイコン）— sparkling.svg
// グラデーション（マゼンタ→ブルー）のため色変更不可、装飾用途
const SVG_SPARKLING = `<svg id="Layer_1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-name="Layer 1"><defs><linearGradient id="sg_grad" gradientUnits="userSpaceOnUse" x1="16.21" x2="4.79" y1="5.29" y2="16.71"><stop offset="0" stop-color="#f0f"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><path d="m8 13.5c-.38 0-.73-.22-.9-.56l-1.5-3.04-3.04-1.5c-.34-.17-.56-.52-.56-.9s.22-.73.56-.9l3.04-1.5 1.5-3.04c.17-.34.52-.56.9-.56.38 0 .73.22.9.56l1.5 3.04 3.04 1.5c.34.17.56.52.56.9s-.22.73-.56.9l-3.04 1.5-1.5 3.04c-.17.34-.52.56-.9.56zm-2.74-6 1.53.75c.2.1.36.26.45.45l.76 1.53.75-1.53c.1-.2.26-.36.45-.45l1.53-.75-1.53-.75c-.2-.1-.36-.26-.45-.45l-.75-1.53-.76 1.53c-.1.2-.26.36-.45.45zm5.74 15c-.38 0-.73-.22-.9-.56l-1.01-2.04-2.04-1.01c-.34-.17-.56-.52-.56-.9s.22-.73.56-.9l2.04-1.01 1.01-2.04c.17-.34.52-.56.9-.56.38 0 .73.22.9.56l1.01 2.04 2.04 1.01c.34.17.56.52.56.9s-.22.73-.56.9l-2.04 1.01-1.01 2.04c-.17.34-.52.56-.9.56zm-1.24-4.5.53.26c.2.1.36.26.45.45l.26.53.26-.53c.1-.2.26-.36.45-.45l.53-.26-.53-.26c-.2-.1-.36-.26-.45-.45l-.26-.53-.26.53c-.1.2-.26.36-.45.45zm7.74-2c-.38 0-.73-.22-.9-.56l-1.01-2.04-2.04-1.01c-.34-.17-.56-.52-.56-.9s.22-.73.56-.9l2.04-1.01 1.01-2.04c.17-.34.52-.56.9-.56.38 0 .73.22.9.56l1.01 2.04 2.04 1.01c.34.17.56.52.56.9s-.22.73-.56.9l-2.04 1.01-1.01 2.04c-.17.34-.52.56-.9.56zm-1.24-4.5.53.26c.2.1.36.26.45.45l.26.53.26-.53c.1-.2.26-.36.45-.45l.53-.26-.53-.26c-.2-.1-.36-.26-.45-.45l-.26-.53-.26.53c-.1.2-.26.36-.45.45z" fill="url(#sg_grad)"/></svg>`;

// ============================================================
// 型定義
// ============================================================

/** colorize: color プロパティで色変更可能。raw: グラデーション等・固定色 */
type IconConfig =
  | { mode: 'colorize'; svg: string }
  | { mode: 'raw'; svg: string };

const ICON_MAP: Record<string, IconConfig> = {
  lock:      { mode: 'colorize', svg: SVG_LOCK },
  sparkling: { mode: 'raw',      svg: SVG_SPARKLING },
};

export type IconName = keyof typeof ICON_MAP;

interface Props {
  name: IconName;
  size?: number;
  /** mode: 'colorize' のアイコンのみ有効（デフォルト '#FFFFFF'） */
  color?: string;
}

// ============================================================
// Icon コンポーネント
// ============================================================
export default function Icon({ name, size = 24, color = '#FFFFFF' }: Props) {
  const config = ICON_MAP[name];
  if (!config) return null;

  const xml =
    config.mode === 'colorize'
      ? colorize(config.svg, color)
      : sanitize(config.svg);

  return <SvgXml xml={xml} width={size} height={size} />;
}
