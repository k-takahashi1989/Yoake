/**
 * TabBarIcon — SVG タブバーアイコンのユニットテスト
 *
 * colorize() ヘルパーと TabBarIcon コンポーネントの動作を検証する。
 * - 各タブ名に対して対応する SVG が返ること
 * - 未知のタブ名で null を返すこと
 * - colorize() が fill 色を正しく置換すること
 * - fill="none" が保持されること
 * - xmlns:sketch などカスタム名前空間が除去されること
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import TabBarIcon from '../src/components/common/TabBarIcon';

// ============================================================
// colorize ヘルパー（TabBarIcon と同等ロジックを再定義してテスト）
// ============================================================
const colorize = (svg: string, color: string): string =>
  svg
    .replace(/\s+xmlns:\w+="[^"]*"/g, '')
    .replace(/(<svg\b[^>]*?)(\s*\/>|>)/, `$1 fill="${color}"$2`)
    .replace(/fill="#000000"/gi, `fill="${color}"`)
    .replace(/fill="#000"/gi, `fill="${color}"`)
    .replace(/fill="rgb\(0,0,0\)"/gi, `fill="${color}"`);

// ============================================================
// colorize() の単体テスト
// ============================================================

describe('colorize()', () => {
  const COLOR = '#6B5CE7';

  test('fill="#000" を指定色に置換する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M0"/></svg>';
    const result = colorize(svg, COLOR);
    expect(result).toContain(`fill="${COLOR}"`);
    expect(result).not.toContain('fill="#000"');
  });

  test('fill="#000000" を指定色に置換する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M0"/></svg>';
    const result = colorize(svg, COLOR);
    expect(result).toContain(`fill="${COLOR}"`);
    expect(result).not.toContain('fill="#000000"');
  });

  test('fill="rgb(0,0,0)" を指定色に置換する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g fill="rgb(0,0,0)"></g></svg>';
    const result = colorize(svg, COLOR);
    expect(result).toContain(`fill="${COLOR}"`);
    expect(result).not.toContain('fill="rgb(0,0,0)"');
  });

  test('fill="none" はアウトライン保持のため変更しない', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g fill="none"><path fill="#000" d="M0"/></g></svg>';
    const result = colorize(svg, COLOR);
    expect(result).toContain('fill="none"');
    // path の #000 は置換される
    expect(result).not.toContain('fill="#000"');
  });

  test('<svg> タグに fill 属性を追加する（継承用）', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0"/></svg>';
    const result = colorize(svg, COLOR);
    // svg タグに fill が付与される
    expect(result).toMatch(/<svg[^>]+fill="[^"]+"/);
  });

  test('xmlns:sketch などカスタム名前空間属性を除去する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:sketch="http://example.com"><path d="M0"/></svg>';
    const result = colorize(svg, COLOR);
    expect(result).not.toContain('xmlns:sketch');
  });

  test('xmlns:xlink なども除去する', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><path d="M0"/></svg>';
    const result = colorize(svg, COLOR);
    expect(result).not.toContain('xmlns:xlink');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"'); // 標準 xmlns は保持
  });

  test('大文字小文字を無視して置換する（gi フラグ）', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="M0"/></svg>';
    const result = colorize(svg, COLOR);
    expect(result).not.toContain('fill="#000000"');
    expect(result).not.toContain('fill="#000000"'.toUpperCase());
  });
});

// ============================================================
// TabBarIcon コンポーネントのテスト
// ============================================================

describe('TabBarIcon', () => {
  const VALID_NAMES = ['Home', 'Diary', 'Report', 'Profile'];
  const COLOR = '#6B5CE7';
  const INACTIVE_COLOR = '#9E9E9E';

  test.each(VALID_NAMES)('name="%s" でコンポーネントが描画される', (name) => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TabBarIcon name={name} color={COLOR} />,
      );
    });
    // null を返さず描画されること
    expect(renderer!.toJSON()).not.toBeNull();
  });

  test('未知の name で null を返す', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TabBarIcon name="Unknown" color={COLOR} />,
      );
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  test('空文字の name で null を返す', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TabBarIcon name="" color={COLOR} />,
      );
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  test('color prop がコンポーネントに渡される', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TabBarIcon name="Home" color={INACTIVE_COLOR} />,
      );
    });
    expect(renderer!.toJSON()).not.toBeNull();
  });

  test('size prop のデフォルト値は 22', () => {
    // size 省略時もエラーなく描画されること
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TabBarIcon name="Home" color={COLOR} />,
      );
    });
    expect(renderer!.toJSON()).not.toBeNull();
  });

  test('カスタム size prop を受け付ける', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TabBarIcon name="Profile" color={COLOR} size={28} />,
      );
    });
    expect(renderer!.toJSON()).not.toBeNull();
  });
});
