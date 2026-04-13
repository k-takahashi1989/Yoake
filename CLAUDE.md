# YOAKE プロジェクト

睡眠トラッキング・AI分析 Android アプリ（個人開発）。

---

## プロジェクト構造

```
C:/Users/neigh/Documents/Yoake/
└── Yoake/          ← React Native アプリ本体（作業はほぼここ）
    ├── src/
    │   ├── screens/        # Home / Diary / Report / Alarm / Profile / Onboarding / Paywall
    │   ├── components/     # alarm / common / dev / diary / home / report
    │   ├── services/       # claudeApi.ts / firebase.ts / healthConnect.ts / alarmService.ts
    │   ├── stores/         # Zustand: authStore / sleepStore / habitStore / alarmStore
    │   ├── utils/          # scoreCalculator.ts / dateUtils.ts
    │   ├── hooks/
    │   ├── navigation/
    │   ├── i18n/
    │   └── types/
    ├── functions/          # Firebase Cloud Functions（Node.js）
    ├── docs/
    │   ├── feature-spec.md      ← 【実装レベルの機能設計書】実装ステータス・データ構造・ロジック
    │   ├── ui-ux-review.md      ← UI/UX改善リスト
    │   └── ...
    ├── YOAKE_設計まとめ.md      ← プロダクト仕様・コンセプト・ビジネス設計
    └── YOAKE_改善点レビュー.md  ← セキュリティ/UX/品質の改善リスト（✅済み / 未対応）
```

---

## 技術スタック

| 分類 | 内容 |
|---|---|
| フレームワーク | React Native 0.84.1 / React 19.2.3 |
| プラットフォーム | Android（リリース済み）/ iOS（EAS Build 対応中） |
| 言語 | TypeScript |
| 状態管理 | Zustand |
| バックエンド | Firebase（Auth / Firestore / Cloud Functions / Messaging） |
| AI | Claude Haiku 4.5（Cloud Functions 経由・APIキーはサーバー側） |
| 健康データ | Health Connect（Android 14+ or アプリ導入済み） |
| 課金 | react-native-iap（Google Play Billing） |
| 多言語 | i18next（日本語・英語） |
| アニメーション | react-native-reanimated v3 |
| テスト | Jest |

---

## 重要な実装ルール

### Firebase / Firestore
- `snap.exists()` はメソッド呼び出し（@react-native-firebase v18 以降の仕様）
- Timestamp 変換は必ず `safeToDate()` 経由（Hermes 互換のため）
- `subscription` ドキュメントへの書き込みはクライアント不可（Cloud Function のみ）

### スコア・カラー
- スコアカラーキーは小文字: `green` / `yellowGreen` / `yellow` / `orange` / `red`
- スコア計算: `src/utils/scoreCalculator.ts`

### i18n
- ハードコード文字列禁止 → 必ず `t('key')` を使う

### コード変更の原則
- 変更は最小限に。関係ないコードには触れない
- 大きな変更後は必ず `npx tsc --noEmit` + `npx jest --no-coverage` を実行

### ドキュメント更新ルール（必須）
**コードを変更したら、影響する箇所を `docs/feature-spec.md` に反映すること。**

| コード変更の種類 | 更新するドキュメント |
|---|---|
| 機能の追加・削除 | `feature-spec.md` の該当機能セクション + 実装ステータス |
| スコアロジックの変更 | `feature-spec.md` § 3. スコア計算 |
| 画面・ナビゲーションの変更 | `feature-spec.md` § 8. 画面構成 |
| Firestoreスキーマの変更 | `feature-spec.md` 該当データ構造 |
| 無料/有料境界の変更 | `feature-spec.md` 該当機能 + `CLAUDE.md` § 無料/有料境界 |
| iOS対応状況の変化 | `feature-spec.md` § 10. iOS対応状況 |
| セキュリティルールの変更 | `feature-spec.md` § 9. Firestoreセキュリティルール |

変更履歴も `feature-spec.md` 末尾に追記する。

---

## カラーパレット（ダークテーマ）

| 用途 | 値 |
|---|---|
| 背景 | `#1A1A2E` |
| カード | `#2D2D44` |
| アクセント（紫） | `#6B5CE7` |
| テキスト（薄） | `#888`（WCAG AAギリギリ → `#9A9AB8` 推奨） |

---

## Firestore 主要コレクション

```
users/{userId}/
  ├── profile
  ├── subscription   ← クライアント書き込み禁止
  ├── goal
  ├── sleepLogs/{date}     # "2026-03-24" 形式
  ├── aiReports/{key}      # "2026-03-24" or "2026-W12"
  ├── habitTemplates/{id}
  └── chatHistory/{id}
```

---

## 無料 / 有料 境界

**無料**: 睡眠記録・スコア計算・AIひとこと・デフォルト習慣6項目・通常アラーム・直近7日ログ

**有料 (¥380/月 or ¥2,800/年・7日間トライアル)**:
週次AIレポート・AIチャット・週次/月次グラフ・スマートアラーム・習慣カスタマイズ・CSV出力 など

---

## よく使うコマンド

```bash
# アプリ起動（Metro bundler）
cd Yoake && npx react-native start

# Android 実行
cd Yoake && npx react-native run-android

# 型チェック（functions/ 除外）
cd Yoake && npx tsc --noEmit 2>&1 | grep -v "^functions/"

# テスト
cd Yoake && npx jest --no-coverage

# Cloud Functions エミュレーター
cd Yoake && firebase emulators:start --only functions
```

---

## エージェント構成

専門エージェントが `~/.claude/agents/` に定義済み：
- `yoake-pm` — PM兼オーケストレーター（まずここに投げる）
- `rn-specialist` — RN実装・バグ修正
- `sleep-analyst` — スコアロジック・睡眠医学・AIプロンプト
- `ui-ux-expert` — デザイン・アニメーション
- `code-auditor` — テスト・型チェック・監査
- `bug-finder` — バグ発見・原因特定（修正はrn-specialistに委譲）
