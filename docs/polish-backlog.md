# YOAKE 磨き残しバックログ

> 作成: 2026-04-01
> 参照元: `ui-ux-review.md` / `monetization-gap-analysis.md` / `retention-strategy.md`
> ルール: 実装したら ✅ に更新する

---

## 凡例
| マーク | 意味 |
|---|---|
| ✅ | 完了 |
| 🔧 | 着手中 |
| ❌ | 未着手 |

---

## A. UI/UX（見た目・体験品質）

### 優先度: HIGH（リリース前に必須）

| # | 内容 | 場所 | ステータス |
|---|---|---|---|
| A1 | タブバーの絵文字をベクターアイコンに置き換え | `navigation/index.tsx` | ✅ 2026-04-01 |
| A2 | DiaryRowのスコアバッジ透明度を `'20'`→`'40'` に | `DiaryRow.tsx` | ✅ 2026-04-01 |
| A3 | secondary text の色を `#888` → `#9A9AB8` に統一（WCAG AA対応） | アプリ全体 | ✅ 2026-04-01 |
| A4 | TrialStep スキップボタンのコントラスト改善（`#666`→`#888`以上） | `TrialStep.tsx` | ✅ 2026-04-01 |

### 優先度: MEDIUM

| # | 内容 | 場所 | ステータス |
|---|---|---|---|
| A5 | DiaryScreen に pull-to-refresh を追加 | `DiaryScreen.tsx` | ✅ 2026-04-01 |
| A6 | AI読み込み中に Skeleton UI（shimmer）を表示 | `HomeScreen.tsx` ほか | ✅ 2026-04-01 |
| A7 | 週次目標ドットのスコア数値が 9px で小さすぎ → 36px に拡大かスコア非表示 | `HomeScreen.tsx` | ✅ 2026-04-01 |
| A8 | SleepDebtCard に負債量別バッテリーアイコン追加 (⚡/🔋/🪫) | `SleepDebtCard.tsx` | ✅ 2026-04-01 |
| A9 | AIアドバイスカードの再生成ボタンを🔄アイコン付きゴーストボタンに | `HomeScreen.tsx` | ✅ 2026-04-01 |

### 優先度: LOW

| # | 内容 | 場所 | ステータス |
|---|---|---|---|
| A10 | SleepInputModal のセクション区切りをヘッダー付きに改善 | `SleepInputModal.tsx` | ✅ 2026-04-01 |
| A11 | タブラベル `fontSize: 10` に `allowFontScaling={false}` 追加 | `navigation/index.tsx` | ✅ 2026-04-01 |
| A12 | ScoreRing の「点」単位 → `/ 100` サブテキストに変更 | `ScoreRing.tsx` | ✅ 2026-04-01 |

---

## B. 継続率（リテンション）

| # | 内容 | 場所 | ステータス |
|---|---|---|---|
| B1 | 記録ストリーク表示（🔥 N日連続） | `HomeScreen.tsx` | ✅ 2026-04-01 |
| B2 | 朝通知パーソナライズ（スコア付き文言） | `notificationService.ts` | ✅ 2026-04-01 |
| B3 | ストリーク達成通知（3/7/14/30日） | `notificationService.ts` | ✅ 2026-04-01 |
| B4 | 週次インサイト数値化（スコア前週比 ↑↓ 表示） | `WeeklyReportCard.tsx` | ✅ 2026-04-01 |
| B5 | しろくまペルソナ導入（AIアドバイスをキャラクター発話に） | `HomeScreen.tsx` 他 | ✅ 2026-04-01 |
| B6 | バッジ / 実績システム（初記録・7日連続・スコア90点等） | 新規 | ❌ |

---

## C. 収益化（転換率・LTV）

| # | 内容 | 場所 | ステータス |
|---|---|---|---|
| C1 | レポートペイウォール改善（7日分グレーアウト+プレビュー型） | `ReportScreen.tsx` | ✅ 2026-04-01 |
| C2 | スコアシェア機能（`react-native-view-shot` + Share API） | 新規 | ❌ |
| C3 | 年額プランの節約額訴求（「年間¥1,760お得」バッジ） | `TrialStep.tsx` | ✅ すでに実装済 |
| C4 | 就寝リマインダー通知（有料機能として実装） | `notificationService.ts` | ❌ |
| C5 | CSV エクスポート（有料機能） | `ProfileScreen.tsx` | ❌ |
| C6 | 週次AIレポートの画像シェア機能 | `ReportScreen.tsx` | ❌ |

---

## D. 機能完成度

| # | 内容 | 場所 | ステータス |
|---|---|---|---|
| D1 | HC連携後に即 `loadRecent()` でホーム反映 | `HealthConnectStep.tsx` 他 | ✅ 2026-04-01 |
| D2 | RecordDetailScreen の TypeScript エラー修正 | `RecordDetailScreen.tsx` | ✅ 2026-04-01 |
| D3 | Alarm 関連の残骸コード削除（AlarmScreen / alarmStore / alarmService） | 複数ファイル | ✅ 2026-04-01 |
| D4 | iOS 対応（EAS Build + HealthKit + Apple IAP + APNs） | 全体 | ❌ |

---

## 今セッションで完了したもの（参考）

| 完了日 | 内容 |
|---|---|
| 2026-04-01 | ScoreRing: strokeDashoffset アニメーション + スコアカウントアップ |
| 2026-04-01 | ScoreRing: 75点以上でグロウ効果 |
| 2026-04-01 | HomeScreen: stagger reveal アニメーション |
| 2026-04-01 | ScalePressable 共通コンポーネント作成・各所に適用 |
| 2026-04-01 | 触覚フィードバック（haptics.ts） |
| 2026-04-01 | AIチャット max_tokens 200→400 |
| 2026-04-01 | 週次レポート再生成ボタン：生成済み時は非表示 |
| 2026-04-01 | 今日の一言トリガー：睡眠記録保存後に変更 |
| 2026-04-01 | 過去日付の睡眠記録入力（DatePicker追加） |
| 2026-04-01 | オンボーディング: 背景画像 + stagger reveal + ScalePressable統一 |
| 2026-04-01 | オンボーディング: 機能訴求文言変更（アラーム→末尾・ソフト化） |
| 2026-04-01 | アラーム機能削除に伴いオンボーディングから除去 |
| 2026-04-01 | ストリーク表示（🔥バッジ） |
| 2026-04-01 | 朝通知パーソナライズ（スコア付き） |
| 2026-04-01 | 睡眠保存の楽観的更新（20秒→1〜2秒） |
| 2026-04-01 | シードデータ後に loadRecent() で即反映 |
| 2026-04-01 | native/JS driver 混在アニメーションバグ修正 |
| 2026-04-01 | A1: TabBarIcon をシンプルなSVGパス（react-native-svg Svg/Path）に置き換え |
| 2026-04-01 | A6: AiAdviceSkeleton コンポーネント作成、HomeScreen の dreamBubble で isLoadingAi 切り替え |
| 2026-04-01 | A8: BatteryIcon コンポーネント作成（4レベル・パルスアニメ）、SleepDebtCard に組み込み |

---

## 次に着手するなら

優先度と工数のバランスから、次の順番を推奨：

1. **D1** HC連携後の即反映 — 工数小、体験品質
2. **D2** RecordDetailScreen TypeScript エラー修正 — 工数小
3. **D3** Alarm残骸コード削除 — クリーンアップ
4. **C1** レポートペイウォール改善 — 転換率に直結
5. **B5** しろくまペルソナ — 感情的継続フック
