# YOAKE — CLAUDE.md

## プロジェクト概要

**YOAKE（ヨアケ）** は Android 向け睡眠トラッキングアプリ。
Health Connect からデータを自動取得し、AI（Claude）がスコア・週次レポート・改善提案を提供する。

- プラットフォーム: Android（React Native 0.84.1）
- 言語: TypeScript / 日本語・英語（i18next）
- バックエンド: Firebase（Firestore / Auth / Functions / Messaging）
- AI: Claude API（Cloud Functions 経由のみ。クライアントから直接呼ばない）
- 課金: Google Play Billing（react-native-iap）
- 健康データ: Health Connect（react-native-health-connect）
- 状態管理: Zustand

---

## ディレクトリ構成

```
src/
  screens/        # 画面（Home / Diary / Report / Profile / Onboarding）
  components/     # 再利用コンポーネント
  stores/         # Zustand ストア（authStore / sleepStore）
  services/       # Firebase・Claude API・IAP・通知など外部連携
  utils/          # ロジック（scoreCalculator / dateUtils / sleepSubjective …）
  types/          # 型定義（index.ts に集約）
  i18n/           # 翻訳（locales/ja.ts / locales/en.ts）
  constants/      # 定数
  theme/          # デザイントークン（morningTheme.ts）
functions/        # Firebase Cloud Functions（サーバー側ロジック）
__tests__/        # Jest テスト
```

---

## コーディング規約

### TypeScript
- `any` 禁止。Firebase の型は `FirebaseFirestoreTypes.Timestamp` など公式型を使う
- 型アサーション（`as`）は最小限。使う場合はコメントで理由を書く
- `null` と `undefined` を混在させない。オプショナルは `| null` に統一

### スタイル
- スタイルは必ず `StyleSheet.create()` に定義する。インラインスタイルは動的な値のみ
- デザイントークンは `MORNING_THEME`（`src/theme/morningTheme.ts`）から参照
- ハードコードのカラー値（`#FFFFFF` 等）を新規追加しない

### 文言・i18n
- ユーザーに見えるすべての文字列を翻訳キー経由で出す（`t('key')`）
- キーを追加する場合は `ja.ts` と `en.ts` を必ずセットで更新する
- 翻訳キーの命名: `画面名.要素名`（例: `scoreDetail.consistencyLabel`）

### コンポーネント
- 1ファイル1コンポーネントを基本とする
- ローカルな小コンポーネント（`function ScoreBar` 等）は同ファイル末尾に定義してよい

---

## 重要なロジック

### スコア計算（`src/utils/scoreCalculator.ts`）
- Health Connect あり / 手動入力で配点が異なる（満点は両方 100 点）
- `SCORE_VERSION` 定数で管理。ロジック変更時はバージョンを上げる
- `consistencyBonus` は直近ログの標準偏差で計算（3件未満は 0）

### プレミアム判定
- クライアント: `authStore.isPremium`（表示制御のみ）
- サーバー: Cloud Function 内の `isPremiumUser(uid)` が Firestore を読んで判定
  - `status === 'active' | 'trial'` かつ `currentPeriodEndAt > now` が必須
- **クライアントの isPremium だけを信じてサーバー処理を通さない**

### Firestore Timestamp
- 日付の変換は必ず `safeToDate()`（`src/utils/dateUtils.ts`）を使う
- `new Date()` に直接 cast しない

### Claude API 呼び出し
- **すべて Cloud Functions 経由**（`functions/src/index.ts`）
- クライアントから直接 Anthropic API を叩かない
- API キーは Cloud Functions の Secret Manager に格納

---

## デバッグ・開発

### デバッグカードでのプレミアム切り替え
- `authStore._devSetPremium(true)` を使う
- `currentPeriodEndAt` に1年後の Timestamp が入るため、Cloud Function のプレミアムチェックも通過する

### コマンド
```bash
yarn android          # Android 起動
yarn test             # Jest テスト
yarn lint             # ESLint
npx tsc --noEmit      # 型チェック
```

---

## やってはいけないこと

- Cloud Functions をスキップして Claude API をクライアントから直接呼ぶ
- `any` を使って型エラーを握りつぶす
- `StyleSheet.create()` 外でカラー値をハードコードする
- 翻訳キーを片方の言語だけ追加する
- `sleepStore` の保存処理（`addSleepLog`）をバイパスしてスコアや睡眠負債を直接 Firestore に書き込む
- プレミアムチェックをクライアント側だけで完結させる
